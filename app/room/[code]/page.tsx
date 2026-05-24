import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Card, CardTag, Member, Room } from "@/lib/types";
import RoomClient from "./RoomClient";

type Params = Promise<{ code: string }>;

export default async function RoomPage({ params }: { params: Params }) {
  const { code } = await params;
  const upper = decodeURIComponent(code).toUpperCase();

  const db = getServerSupabase();
  const { data: room, error } = await db
    .from("rooms")
    .select(
      "id, code, sport, status, starting_team, current_team, current_clue_word, current_clue_count, guesses_remaining, winner, turn_deadline, turn_duration_seconds, created_at"
    )
    .eq("code", upper)
    .single();
  if (error || !room) notFound();

  const [{ data: members }, { data: cards }, { data: tags }] = await Promise.all([
    db
      .from("members")
      .select("id, room_id, display_name, team, role, joined_at")
      .eq("room_id", room.id),
    // Intentionally NO card_type here — the column is also revoked at the DB
    // level for anon roles. Coaches/end-game viewers fetch the full key via
    // getCardKey on the client.
    db
      .from("cards")
      .select("id, room_id, position, player_name, revealed, revealed_by_team, revealed_card_type")
      .eq("room_id", room.id),
    db
      .from("card_tags")
      .select("card_id, member_id, room_id, created_at")
      .eq("room_id", room.id),
  ]);

  return (
    <RoomClient
      initialRoom={room as Room}
      initialMembers={(members ?? []) as Member[]}
      initialCards={(cards ?? []) as Card[]}
      initialTags={(tags ?? []) as CardTag[]}
    />
  );
}
