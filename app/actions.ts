"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { generateRoomCode } from "@/lib/game/codes";
import { dealBoard } from "@/lib/game/deal";
import { evaluateGuess, otherTeam } from "@/lib/game/rules";
import type { Card, Role, Sport, Team } from "@/lib/types";

const CODE_RETRY_LIMIT = 8;

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

  const { error } = await db.from("players").upsert(
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

  if (input.team && input.role === "spymaster") {
    if (input.force) {
      // Vacate any other spymaster on this team before claiming.
      await db
        .from("players")
        .update({ role: null })
        .eq("room_id", input.roomId)
        .eq("team", input.team)
        .eq("role", "spymaster")
        .neq("id", input.playerId);
    } else {
      const { data: existing } = await db
        .from("players")
        .select("id")
        .eq("room_id", input.roomId)
        .eq("team", input.team)
        .eq("role", "spymaster")
        .neq("id", input.playerId)
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error(`${input.team} already has a spymaster`);
      }
    }
  }

  const { error } = await db
    .from("players")
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

  const { data: players, error: pErr } = await db
    .from("players")
    .select("team, role")
    .eq("room_id", roomId);
  if (pErr) throw new Error(pErr.message);

  for (const t of ["red", "blue"] as Team[]) {
    const teamPlayers = players?.filter((p) => p.team === t) ?? [];
    const hasSpymaster = teamPlayers.some((p) => p.role === "spymaster");
    const hasGuesser = teamPlayers.some((p) => p.role === "guesser");
    if (!hasSpymaster || !hasGuesser) {
      throw new Error(`${t} needs at least one spymaster and one guesser`);
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

  const { data: player, error: pErr } = await db
    .from("players")
    .select("team, role")
    .eq("room_id", input.roomId)
    .eq("id", input.playerId)
    .single();
  if (pErr || !player) throw new Error("Player not in this room");
  if (player.role !== "spymaster" || player.team !== room.current_team) {
    throw new Error("Only the current team's spymaster can submit a clue");
  }

  const { data: clue, error: clueErr } = await db
    .from("clues")
    .insert({
      room_id: input.roomId,
      team: player.team,
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

  const { data: player, error: pErr } = await db
    .from("players")
    .select("team, role")
    .eq("room_id", input.roomId)
    .eq("id", input.playerId)
    .single();
  if (pErr || !player) throw new Error("Player not in this room");
  if (player.role !== "guesser" || player.team !== room.current_team) {
    // Most commonly hit when the turn flips mid-click. Real authorization errors
    // (player isn't a guesser at all) are rare and indistinguishable here, so
    // we treat both as silent no-ops to keep the table calm.
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
      ? { ...(c as Card), revealed: true, revealed_by_team: player.team }
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
    .update({ revealed: true, revealed_by_team: player.team })
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
  } else if (outcome.endsTurn) {
    roomPatch.current_team = otherTeam(room.current_team as Team);
    roomPatch.current_clue_word = null;
    roomPatch.current_clue_count = null;
    roomPatch.guesses_remaining = null;
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

  const { data: player, error: pErr } = await db
    .from("players")
    .select("team, role")
    .eq("room_id", input.roomId)
    .eq("id", input.playerId)
    .single();
  if (pErr || !player) throw new Error("Player not in this room");
  if (player.role !== "guesser" || player.team !== room.current_team) {
    throw new Error("Only current-team guessers can end the turn");
  }

  const { error } = await db
    .from("rooms")
    .update({
      current_team: otherTeam(room.current_team as Team),
      current_clue_word: null,
      current_clue_count: null,
      guesses_remaining: null,
    })
    .eq("id", input.roomId);
  if (error) throw new Error(error.message);
}
