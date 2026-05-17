"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { generateRoomCode } from "@/lib/game/codes";
import { dealBoard } from "@/lib/game/deal";
import { evaluateGuess, otherTeam } from "@/lib/game/rules";
import type { Card, Role, Sport, Team } from "@/lib/types";

const CODE_RETRY_LIMIT = 8;
const TURN_DURATION_MS = 90_000;
const nextDeadline = (): string =>
  new Date(Date.now() + TURN_DURATION_MS).toISOString();

export async function createRoom(sport: Sport = "nba"): Promise<never> {
  const db = getServerSupabase();
  const startingTeam: Team = Math.random() < 0.5 ? "red" : "blue";

  let code = "";
  let roomId = "";
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
      .select("id, code")
      .single();
    if (!error && data) {
      code = data.code;
      roomId = data.id;
      break;
    }
    // 23505 = unique violation; retry. Other errors: bail.
    if (error && error.code !== "23505") {
      throw new Error(`Failed to create room: ${error.message}`);
    }
  }
  if (!code || !roomId) throw new Error("Could not allocate a room code");

  const seeds = dealBoard(sport, startingTeam);
  const { error: cardsError } = await db.from("cards").insert(
    seeds.map((s) => ({
      room_id: roomId,
      position: s.position,
      player_name: s.player_name,
      card_type: s.card_type,
    }))
  );
  if (cardsError) {
    await db.from("rooms").delete().eq("id", roomId);
    throw new Error(`Failed to seed board: ${cardsError.message}`);
  }

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
    .select("id")
    .eq("code", input.code.toUpperCase())
    .single();
  if (roomErr || !room) throw new Error("Room not found");

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
  if (error) throw new Error(`Failed to set role: ${error.message}`);
}

export async function startGame(roomId: string): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status, starting_team")
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

  const { error } = await db
    .from("rooms")
    .update({
      status: "playing",
      current_team: room.starting_team,
      current_clue_word: null,
      current_clue_count: null,
      guesses_remaining: null,
      turn_deadline: nextDeadline(),
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
    .select("id, status, current_team, current_clue_word")
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

  const { error: roomUpdErr } = await db
    .from("rooms")
    .update({
      current_clue_word: word,
      current_clue_count: input.count,
      guesses_remaining: input.count + 1,
      turn_deadline: nextDeadline(),
    })
    .eq("id", input.roomId);
  if (roomUpdErr) throw new Error(roomUpdErr.message);
}

export async function revealCard(input: {
  roomId: string;
  cardId: string;
  playerId: string;
}): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select(
      "id, status, current_team, starting_team, current_clue_word, guesses_remaining"
    )
    .eq("id", input.roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  // Soft no-op on race conditions: the click arrived after the state moved on
  // (turn ended, game finished, card already revealed by a teammate). Realtime
  // will sync the client to the truth shortly; surfacing an error would be noise.
  if (room.status !== "playing") return;
  if (!room.current_clue_word) return;

  const { data: member, error: mErr } = await db
    .from("members")
    .select("team, role")
    .eq("room_id", input.roomId)
    .eq("id", input.playerId)
    .single();
  if (mErr || !member) throw new Error("You are not in this room");
  if (member.role !== "player" || member.team !== room.current_team) {
    // Most commonly hit when the turn flips mid-click. Real authorization
    // errors (caller isn't a player at all) are rare and indistinguishable
    // here, so we treat both as silent no-ops to keep the table calm.
    return;
  }

  const { data: targetCard, error: cardErr } = await db
    .from("cards")
    .select("id, card_type, revealed, room_id")
    .eq("id", input.cardId)
    .eq("room_id", input.roomId)
    .single();
  if (cardErr || !targetCard) throw new Error("Card not found");
  if (targetCard.revealed) return;

  const { data: existingCards, error: listErr } = await db
    .from("cards")
    .select("id, room_id, position, player_name, card_type, revealed, revealed_by_team")
    .eq("room_id", input.roomId);
  if (listErr || !existingCards) throw new Error(listErr?.message ?? "Read failed");

  const cardsAfter: Card[] = existingCards.map((c) =>
    c.id === targetCard.id
      ? { ...(c as Card), revealed: true, revealed_by_team: member.team }
      : (c as Card)
  );

  const outcome = evaluateGuess({
    cardType: targetCard.card_type,
    currentTeam: room.current_team as Team,
    startingTeam: room.starting_team as Team,
    cardsAfterReveal: cardsAfter,
    guessesRemainingBefore: room.guesses_remaining ?? 0,
  });

  const { error: revealErr } = await db
    .from("cards")
    .update({ revealed: true, revealed_by_team: member.team })
    .eq("id", targetCard.id);
  if (revealErr) throw new Error(revealErr.message);

  // Find the current (latest) clue id for history.
  const { data: latestClue } = await db
    .from("clues")
    .select("id")
    .eq("room_id", input.roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await db.from("guesses").insert({
    room_id: input.roomId,
    clue_id: latestClue?.id ?? null,
    card_id: targetCard.id,
    guesser_id: input.playerId,
  });

  const roomPatch: Record<string, unknown> = {};
  if (outcome.status === "finished") {
    roomPatch.status = "finished";
    roomPatch.winner = outcome.winner;
    roomPatch.current_clue_word = null;
    roomPatch.current_clue_count = null;
    roomPatch.guesses_remaining = null;
    roomPatch.turn_deadline = null;
  } else if (outcome.endsTurn) {
    roomPatch.current_team = otherTeam(room.current_team as Team);
    roomPatch.current_clue_word = null;
    roomPatch.current_clue_count = null;
    roomPatch.guesses_remaining = null;
    roomPatch.turn_deadline = nextDeadline();
  } else if (outcome.decrementsGuess) {
    roomPatch.guesses_remaining = (room.guesses_remaining ?? 0) - 1;
  }

  if (Object.keys(roomPatch).length) {
    const { error } = await db.from("rooms").update(roomPatch).eq("id", input.roomId);
    if (error) throw new Error(error.message);
  }
}

export async function endTurn(input: {
  roomId: string;
  playerId: string;
}): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status, current_team, current_clue_word")
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
      turn_deadline: nextDeadline(),
    })
    .eq("id", input.roomId);
  if (error) throw new Error(error.message);
}

/** Direct rematch — same room, same teams/roles, fresh board. */
export async function restartGame(roomId: string): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status, sport")
    .eq("id", roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "finished")
    throw new Error("Can only restart a finished game");

  await db.from("guesses").delete().eq("room_id", roomId);
  await db.from("clues").delete().eq("room_id", roomId);
  await db.from("cards").delete().eq("room_id", roomId);

  const startingTeam: Team = Math.random() < 0.5 ? "red" : "blue";
  const seeds = dealBoard(room.sport as Sport, startingTeam);
  const { error: cardsError } = await db.from("cards").insert(
    seeds.map((s) => ({
      room_id: roomId,
      position: s.position,
      player_name: s.player_name,
      card_type: s.card_type,
    }))
  );
  if (cardsError) throw new Error(`Failed to seed board: ${cardsError.message}`);

  const { error } = await db
    .from("rooms")
    .update({
      status: "playing",
      starting_team: startingTeam,
      current_team: startingTeam,
      current_clue_word: null,
      current_clue_count: null,
      guesses_remaining: null,
      winner: null,
      turn_deadline: nextDeadline(),
    })
    .eq("id", roomId);
  if (error) throw new Error(error.message);
}

/** Reset a finished game back to the lobby — fresh board waiting for tip-off,
    members keep their team/role so they can re-shuffle before starting. */
export async function backToLobby(roomId: string): Promise<void> {
  const db = getServerSupabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select("id, status, sport")
    .eq("id", roomId)
    .single();
  if (roomErr || !room) throw new Error("Room not found");
  if (room.status !== "finished")
    throw new Error("Can only reset a finished game");

  await db.from("guesses").delete().eq("room_id", roomId);
  await db.from("clues").delete().eq("room_id", roomId);
  await db.from("cards").delete().eq("room_id", roomId);

  const startingTeam: Team = Math.random() < 0.5 ? "red" : "blue";
  const seeds = dealBoard(room.sport as Sport, startingTeam);
  const { error: cardsError } = await db.from("cards").insert(
    seeds.map((s) => ({
      room_id: roomId,
      position: s.position,
      player_name: s.player_name,
      card_type: s.card_type,
    }))
  );
  if (cardsError) throw new Error(`Failed to seed board: ${cardsError.message}`);

  const { error } = await db
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
  if (error) throw new Error(error.message);
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
    .select("id, status, current_team, turn_deadline")
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
      turn_deadline: nextDeadline(),
    })
    .eq("id", roomId)
    .eq("turn_deadline", room.turn_deadline);
}
