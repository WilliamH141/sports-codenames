"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { generateRoomCode } from "@/lib/game/codes";
import { dealBoard } from "@/lib/game/deal";
import { rateLimit } from "@/lib/ratelimit";
import { otherTeam } from "@/lib/game/rules";
import type { CardKey, Role, Sport, Team } from "@/lib/types";

const CODE_RETRY_LIMIT = 8;
const ALLOWED_TURN_DURATIONS = [60, 90, 120] as const;
type TurnDurationSeconds = (typeof ALLOWED_TURN_DURATIONS)[number];

const MAX_MEMBERS_PER_ROOM = 20;
const CREATE_ROOM_PER_IP_PER_HOUR = 10;

async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
/** Idle-backstop ceiling used when the room's shot clock is "Off". Prevents a
    soft-lock where the active team's players all disconnect and no one else
    can flip the turn. 30 minutes is generous enough that real human play won't
    hit it; abandoned games eventually auto-flip and the cleanup cron picks
    them up after that. */
const IDLE_BACKSTOP_SECONDS = 30 * 60;

const nextDeadline = (seconds: number | null): string =>
  new Date(Date.now() + (seconds ?? IDLE_BACKSTOP_SECONDS) * 1000).toISOString();

export async function createRoom(sport: Sport = "nba"): Promise<never> {
  // Per-IP cap on new rooms. A single bad actor could spawn many rooms
  // without this. Cards aren't seeded until Tip-off, so the per-room
  // footprint is small (~1 room row + member rows as they join).
  const ip = await getClientIp();
  const limit = rateLimit(
    `createRoom:${ip}`,
    CREATE_ROOM_PER_IP_PER_HOUR,
    60 * 60 * 1000
  );
  if (!limit.allowed) {
    const mins = Math.ceil(limit.retryAfterMs / 60000);
    throw new Error(`Too many rooms created. Try again in ${mins} min.`);
  }

  const db = getServerSupabase();
  const startingTeam: Team = Math.random() < 0.5 ? "red" : "blue";

  let code = "";
  for (let attempt = 0; attempt < CODE_RETRY_LIMIT; attempt++) {
    const candidate = generateRoomCode(4);
    const { data, error } = await db
      .from("rooms")
      .insert({
        code: candidate,
        sport,
        status: "lobby",
        starting_team: startingTeam,
      })
      .select("code")
      .single();
    if (!error && data) {
      code = data.code;
      break;
    }
    // 23505 = unique violation; retry. Other errors: bail.
    if (error && error.code !== "23505") {
      throw new Error(`Failed to create room: ${error.message}`);
    }
  }
  if (!code) throw new Error("Could not allocate a room code");

  // Cards are dealt at startGame (Tip-off), not here. This avoids leaving
  // 25 unused card rows in the DB when a lobby is abandoned before play.

  redirect(`/room/${code}`);
}

export async function joinRoom(input: {
  code: string;
  playerId: string;
  displayName: string;
}): Promise<{ roomId: string }> {
  const db = getServerSupabase();
  const name = input.displayName.trim().slice(0, 32);
  if (!name) throw new Error("Display name is required");
  if (!/^[0-9a-f-]{36}$/i.test(input.playerId))
    throw new Error("Invalid player id");

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status")
    .eq("code", input.code.toUpperCase())
    .single();
  if (roomErr || !room) throw new Error("Room not found");

  // Member cap — only enforced when this is a new join (not a re-join with the
  // same playerId, which the upsert will dedupe). Count current members; if
  // we'd exceed the cap AND this player isn't already in the room, reject.
  const { data: existingMember } = await db
    .from("members")
    .select("id")
    .eq("room_id", room.id)
    .eq("id", input.playerId)
    .maybeSingle();

  if (!existingMember) {
    const { count } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) >= MAX_MEMBERS_PER_ROOM) {
      throw new Error(
        `Room is full (max ${MAX_MEMBERS_PER_ROOM} players).`
      );
    }
  }

  const { error } = await db.from("members").upsert(
    {
      id: input.playerId,
      room_id: room.id,
      display_name: name,
    },
    { onConflict: "room_id,id" }
  );
  if (error) throw new Error(`Failed to join room: ${error.message}`);

  return { roomId: room.id };
}

export async function setTeamRole(input: {
  roomId: string;
  playerId: string;
  team: Team | null;
  role: Role | null;
  /** When true, kick whoever currently holds the requested role to free the
      seat. Client passes this when the existing holder is known-offline via
      Supabase Presence — the server can't observe presence itself. */
  force?: boolean;
}): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("status")
    .eq("id", input.roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status === "finished")
    throw new Error("Game is over");

  // Mid-game seat changes: only newcomers (no team or role yet) may claim a
  // seat. Existing players can't switch teams or roles mid-game — that would
  // break the game state. In lobby, anything goes. Also disallow force-kick
  // of an existing coach mid-game — even an unseated spectator could otherwise
  // boot a live coach by claiming the seat with force=true.
  if (room.status === "playing") {
    const { data: caller } = await db
      .from("members")
      .select("team, role")
      .eq("room_id", input.roomId)
      .eq("id", input.playerId)
      .maybeSingle();
    if (caller?.team && caller?.role) {
      throw new Error("Can't change seats once the game has started");
    }
    if (input.force) {
      throw new Error("Can't kick a coach mid-game");
    }
  }

  if (input.team && input.role === "coach") {
    if (input.force) {
      // Vacate any other coach on this team before claiming.
      await db
        .from("members")
        .update({ role: null })
        .eq("room_id", input.roomId)
        .eq("team", input.team)
        .eq("role", "coach")
        .neq("id", input.playerId);
    } else {
      const { data: existing } = await db
        .from("members")
        .select("id")
        .eq("room_id", input.roomId)
        .eq("team", input.team)
        .eq("role", "coach")
        .neq("id", input.playerId)
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error(`${input.team} already has a coach`);
      }
    }
  }

  const { error } = await db
    .from("members")
    .update({ team: input.team, role: input.role })
    .eq("room_id", input.roomId)
    .eq("id", input.playerId);
  if (error) {
    // 23505 here means the members_one_coach_per_team partial index fired —
    // another concurrent claim won the coach seat in between our check and
    // our write. Surface as the same friendly error as the pre-flight check.
    if (error.code === "23505" && input.role === "coach" && input.team) {
      throw new Error(`${input.team} already has a coach`);
    }
    throw new Error(`Failed to set role: ${error.message}`);
  }
}

/** Lobby-only: clear every member's team + role, sending the whole room back
    to the waiting list so seats can be re-picked from scratch. Sibling of
    randomizeTeams — randomize scrambles, reset wipes. */
export async function resetTeams(roomId: string): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status")
    .eq("id", roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "lobby")
    throw new Error("Can only reset teams in the lobby");

  const { error } = await db
    .from("members")
    .update({ team: null, role: null })
    .eq("room_id", roomId);
  if (error) throw new Error(error.message);
}

/** Shuffle every member in the room and split them evenly between red/blue.
    First member of each half becomes the coach; the rest are players. Only
    callable in lobby — once a game is in flight, mid-game seat changes go
    through setTeamRole instead. */
export async function randomizeTeams(roomId: string): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status")
    .eq("id", roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "lobby")
    throw new Error("Can only randomize in the lobby");

  const { data: members, error: mErr } = await db
    .from("members")
    .select("id")
    .eq("room_id", roomId);
  if (mErr) throw new Error(mErr.message);
  if (!members || members.length === 0) return;

  // Fisher-Yates shuffle.
  const shuffled = members.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Wipe every seat first as a single bulk update. Without this, a parallel
  // reassign can race the one-coach-per-team partial unique index: if the
  // incoming red coach's update runs before the outgoing red coach's update,
  // the DB rejects the second insert and Promise.all (combined with the old
  // swallow-the-error `.then`) hid the failure, leaving the team coachless.
  const { error: resetErr } = await db
    .from("members")
    .update({ team: null, role: null })
    .eq("room_id", roomId);
  if (resetErr) throw new Error(resetErr.message);

  // Split as evenly as possible; first of each half is coach, rest are players.
  const half = Math.ceil(shuffled.length / 2);
  const updates = shuffled.map((m, i) => {
    const team: Team = i < half ? "red" : "blue";
    const indexInTeam = i < half ? i : i - half;
    const role: Role = indexInTeam === 0 ? "coach" : "player";
    return db
      .from("members")
      .update({ team, role })
      .eq("room_id", roomId)
      .eq("id", m.id);
  });
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw new Error(`Failed to randomize teams: ${r.error.message}`);
  }
}

/** Lobby-only: change the shot clock for upcoming turns. `seconds` must be one
    of the allowed presets, or null to disable the timer entirely. */
export async function setTurnDuration(input: {
  roomId: string;
  seconds: TurnDurationSeconds | null;
}): Promise<void> {
  if (
    input.seconds !== null &&
    !ALLOWED_TURN_DURATIONS.includes(input.seconds)
  ) {
    throw new Error("Invalid turn duration");
  }
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status")
    .eq("id", input.roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "lobby")
    throw new Error("Shot clock can only be changed in the lobby");

  const { error } = await db
    .from("rooms")
    .update({ turn_duration_seconds: input.seconds })
    .eq("id", input.roomId);
  if (error) throw new Error(error.message);
}

export async function startGame(roomId: string): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status, starting_team, sport, turn_duration_seconds")
    .eq("id", roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "lobby") return;

  const { data: members, error: mErr } = await db
    .from("members")
    .select("team, role")
    .eq("room_id", roomId);
  if (mErr) throw new Error(mErr.message);

  for (const t of ["red", "blue"] as Team[]) {
    const teamMembers = members?.filter((m) => m.team === t) ?? [];
    const hasCoach = teamMembers.some((m) => m.role === "coach");
    const hasPlayer = teamMembers.some((m) => m.role === "player");
    if (!hasCoach || !hasPlayer) {
      throw new Error(`${t} needs at least one coach and one player`);
    }
  }

  // Seed cards FIRST so they exist before clients see status="playing" and
  // try to render the board. Idempotent: if cards already exist (e.g. user
  // double-clicked Tip-off), skip the insert — the second status update is
  // a no-op anyway.
  const { count: existingCardCount } = await db
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  if ((existingCardCount ?? 0) === 0) {
    const seeds = dealBoard(room.sport as Sport, room.starting_team as Team);
    const { error: cardsError } = await db.from("cards").insert(
      seeds.map((s) => ({
        room_id: roomId,
        position: s.position,
        player_name: s.player_name,
        card_type: s.card_type,
      }))
    );
    // 23505 = the (room_id, position) unique constraint fired, meaning a
    // sibling Tip-off click already seeded the board between our count check
    // and our insert. That's the same outcome we want — silently fall through
    // and update the status. Any other DB error is real.
    if (cardsError && cardsError.code !== "23505")
      throw new Error(`Failed to seed board: ${cardsError.message}`);
  }

  const { error } = await db
    .from("rooms")
    .update({
      status: "playing",
      current_team: room.starting_team,
      current_clue_word: null,
      current_clue_count: null,
      guesses_remaining: null,
      turn_deadline: nextDeadline(room.turn_duration_seconds),
    })
    .eq("id", roomId);
  if (error) throw new Error(error.message);
}

export async function submitClue(input: {
  roomId: string;
  playerId: string;
  word: string;
  count: number;
}): Promise<void> {
  const db = getServerSupabase();
  const word = input.word.trim();
  if (!word || /\s/.test(word) || word.length > 30) {
    throw new Error("Clue must be a single word, max 30 characters");
  }
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 9) {
    throw new Error("Count must be an integer between 1 and 9");
  }

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status, current_team, current_clue_word, turn_duration_seconds")
    .eq("id", input.roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "playing") throw new Error("Game is not in progress");
  if (room.current_clue_word)
    throw new Error("A clue is already active this turn");

  const { data: member, error: mErr } = await db
    .from("members")
    .select("team, role")
    .eq("room_id", input.roomId)
    .eq("id", input.playerId)
    .single();
  if (mErr || !member) throw new Error("You are not in this room");
  if (member.role !== "coach" || member.team !== room.current_team) {
    throw new Error("Only the current team's coach can submit a clue");
  }

  const { data: clue, error: clueErr } = await db
    .from("clues")
    .insert({
      room_id: input.roomId,
      team: member.team,
      word,
      count: input.count,
    })
    .select("id")
    .single();
  if (clueErr || !clue) throw new Error(clueErr?.message ?? "Insert failed");

  // The shot clock is ticking during the clue phase, so any client's timer can
  // fire expireTurn and flip current_team in the gap between our read above and
  // this write. If that happens, an unconditional update would arm this clue on
  // whatever team is current now, and they'd end up guessing a clue that was
  // never theirs. So only write if the turn still looks like the one we checked:
  // same current_team, still no clue. Same trick expireTurn uses.
  const { data: updated, error: roomUpdErr } = await db
    .from("rooms")
    .update({
      current_clue_word: word,
      current_clue_count: input.count,
      guesses_remaining: input.count + 1,
      turn_deadline: nextDeadline(room.turn_duration_seconds),
    })
    .eq("id", input.roomId)
    .eq("current_team", room.current_team)
    .is("current_clue_word", null)
    .select("id");
  if (roomUpdErr) throw new Error(roomUpdErr.message);

  // Nothing updated means the turn moved out from under us. Drop the clue row
  // we just inserted so reveal_card can't grab it as the latest clue, and tell
  // the coach to try again.
  if (!updated || updated.length === 0) {
    await db.from("clues").delete().eq("id", clue.id);
    throw new Error("Turn changed before your clue landed — try again");
  }
}

/** Toggle the caller's tag on a card. Tags are an in-turn coordination tool —
    a player can soft-flag cards they're considering before anyone commits to
    a reveal. Allowed only during the current team's guess phase. */
export async function toggleCardTag(input: {
  roomId: string;
  cardId: string;
  playerId: string;
}): Promise<void> {
  const db = getServerSupabase();

  const { data: room } = await db
    .from("rooms")
    .select("status, current_team, current_clue_word")
    .eq("id", input.roomId)
    .single();
  if (!room || room.status !== "playing") return;
  if (!room.current_clue_word) return;

  const { data: member } = await db
    .from("members")
    .select("team, role")
    .eq("room_id", input.roomId)
    .eq("id", input.playerId)
    .single();
  if (!member || member.role !== "player" || member.team !== room.current_team)
    return;

  const { data: card } = await db
    .from("cards")
    .select("revealed")
    .eq("id", input.cardId)
    .eq("room_id", input.roomId)
    .single();
  if (!card || card.revealed) return;

  const { data: existing } = await db
    .from("card_tags")
    .select("card_id")
    .eq("card_id", input.cardId)
    .eq("member_id", input.playerId)
    .maybeSingle();

  if (existing) {
    await db
      .from("card_tags")
      .delete()
      .eq("card_id", input.cardId)
      .eq("member_id", input.playerId);
  } else {
    await db.from("card_tags").insert({
      card_id: input.cardId,
      member_id: input.playerId,
      room_id: input.roomId,
    });
  }
}

export async function revealCard(input: {
  roomId: string;
  cardId: string;
  playerId: string;
}): Promise<void> {
  const db = getServerSupabase();

  // reveal_card() does the flip, win/turn check and guess decrement in one txn
  // with the room row locked, so two teammates tapping at once can't both
  // decrement the same guesses_remaining. Its logic mirrors evaluateGuess() in
  // lib/game/rules.ts — keep them in sync. Raises on not-found, no-ops on the
  // turn-flipped / already-revealed races, same as the old inline version.
  const { error } = await db.rpc("reveal_card", {
    p_room_id: input.roomId,
    p_card_id: input.cardId,
    p_player_id: input.playerId,
  });
  if (error) throw new Error(error.message);
}

export async function endTurn(input: {
  roomId: string;
  playerId: string;
}): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status, current_team, current_clue_word, turn_duration_seconds")
    .eq("id", input.roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "playing") throw new Error("Game is not in progress");
  if (!room.current_clue_word) throw new Error("No active turn to end");

  const { data: member, error: mErr } = await db
    .from("members")
    .select("team, role")
    .eq("room_id", input.roomId)
    .eq("id", input.playerId)
    .single();
  if (mErr || !member) throw new Error("You are not in this room");
  if (member.role !== "player" || member.team !== room.current_team) {
    throw new Error("Only the current team's players can end the turn");
  }

  const { error } = await db
    .from("rooms")
    .update({
      current_team: otherTeam(room.current_team as Team),
      current_clue_word: null,
      current_clue_count: null,
      guesses_remaining: null,
      turn_deadline: nextDeadline(room.turn_duration_seconds),
    })
    .eq("id", input.roomId);
  if (error) throw new Error(error.message);

  // Wipe tags — they were tied to the turn that just ended.
  await db.from("card_tags").delete().eq("room_id", input.roomId);
}

/** End-of-game "Play again": reset to lobby with a fresh board waiting for
    tip-off. Members keep their team/role assignments so the same crew can
    just tap tip-off, or shuffle seats in the lobby first if they want. */
export async function backToLobby(roomId: string): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status")
    .eq("id", roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "finished")
    throw new Error("Can only reset a finished game");

  // Flip the room to "lobby" FIRST so connected clients immediately swap
  // their UI from the game view to the Lobby component. After this, the
  // board isn't rendered anywhere, so the card delete below is invisible.
  // Cards are re-seeded by startGame when Tip-off is clicked — we don't
  // create them here, so an abandoned lobby has no card rows hanging
  // around waiting for cron cleanup.
  const startingTeam: Team = Math.random() < 0.5 ? "red" : "blue";
  const { error: roomUpdateErr } = await db
    .from("rooms")
    .update({
      status: "lobby",
      starting_team: startingTeam,
      current_team: null,
      current_clue_word: null,
      current_clue_count: null,
      guesses_remaining: null,
      winner: null,
      turn_deadline: null,
    })
    .eq("id", roomId);
  if (roomUpdateErr) throw new Error(roomUpdateErr.message);

  await db.from("guesses").delete().eq("room_id", roomId);
  await db.from("clues").delete().eq("room_id", roomId);
  await db.from("card_tags").delete().eq("room_id", roomId);
  await db.from("cards").delete().eq("room_id", roomId);
}

/**
 * Called by clients when their local countdown reaches 0. The server is the
 * source of truth: re-fetches the deadline and only flips the turn if the
 * stored deadline has actually elapsed (and no other client has already
 * flipped). Safe for multiple clients to call simultaneously.
 */
export async function expireTurn(roomId: string): Promise<void> {
  const db = getServerSupabase();
  const { data: room } = await db
    .from("rooms")
    .select("id, status, current_team, turn_deadline, turn_duration_seconds")
    .eq("id", roomId)
    .single();
  if (!room) return;
  if (room.status !== "playing") return;
  if (!room.current_team || !room.turn_deadline) return;
  if (new Date(room.turn_deadline).getTime() > Date.now()) return;

  // Conditional update: if another client already flipped, turn_deadline has
  // already changed and this update affects 0 rows. Optimistic concurrency.
  await db
    .from("rooms")
    .update({
      current_team: otherTeam(room.current_team as Team),
      current_clue_word: null,
      current_clue_count: null,
      guesses_remaining: null,
      turn_deadline: nextDeadline(room.turn_duration_seconds),
    })
    .eq("id", roomId)
    .eq("turn_deadline", room.turn_deadline);

  // Tags were tied to the expired turn — wipe them.
  await db.from("card_tags").delete().eq("room_id", roomId);
}

/**
 * Returns the full color key for every card in the room.
 *
 * Authorization: caller must be a member of the room AND either a coach,
 * OR the room must already be finished (game over reveal). Anyone else
 * gets an empty array — they shouldn't be peeking at unrevealed colors.
 *
 * The `card_type` column is revoked from anon at the DB level, so this is
 * the only path by which a client can ever see the spymaster grid.
 */
export async function getCardKey(input: {
  roomId: string;
  playerId: string;
}): Promise<CardKey[]> {
  const db = getServerSupabase();

  const { data: room } = await db
    .from("rooms")
    .select("status")
    .eq("id", input.roomId)
    .maybeSingle();
  if (!room) return [];

  const isFinished = room.status === "finished";

  if (!isFinished) {
    // Mid-game: only coaches see the key. UUID shape check first so we don't
    // hand back data if a caller passes a malformed playerId.
    if (!/^[0-9a-f-]{36}$/i.test(input.playerId)) return [];
    const { data: member } = await db
      .from("members")
      .select("role")
      .eq("room_id", input.roomId)
      .eq("id", input.playerId)
      .maybeSingle();
    if (!member || member.role !== "coach") return [];
  }

  const { data: cards } = await db
    .from("cards")
    .select("id, card_type")
    .eq("room_id", input.roomId);
  return (cards ?? []) as CardKey[];
}
