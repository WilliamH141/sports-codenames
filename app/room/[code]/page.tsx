import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Card, Member, Room } from "@/lib/types";
import RoomClient from "./RoomClient";

type Params = Promise<{ code: string }>;

export default async function RoomPage({ params }: { params: Params }) {
  const { code } = await params;
  const upper = decodeURIComponent(code).toUpperCase();

  const db = getServerSupabase();
  const { data: room, error } = await db
    .from("rooms")
    .select(
      "id, code, sport, status, starting_team, current_team, current_clue_word, current_clue_count, guesses_remaining, winner, created_at"
    )
    .eq("code", upper)
    .single();
  if (error || !room) notFound();

  const [{ data: members }, { data: cards }] = await Promise.all([
    db
      .from("members")
      .select("id, room_id, display_name, team, role, joined_at")
      .eq("room_id", room.id),
    db
      .from("cards")
      .select("id, room_id, position, player_name, card_type, revealed, revealed_by_team")
      .eq("room_id", room.id),
  ]);

  return (
    <RoomClient
      initialRoom={room as Room}
      initialMembers={(members ?? []) as Member[]}
      initialCards={(cards ?? []) as Card[]}
    />
  );
}
