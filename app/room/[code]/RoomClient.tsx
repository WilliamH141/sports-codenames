"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { getDisplayName, getOrCreatePlayerId, setDisplayName } from "@/lib/identity";
import { joinRoom, revealCard } from "@/app/actions";
import type { Card, Player, Room, Team } from "@/lib/types";
import Board from "@/components/Board";
import ClueBanner from "@/components/ClueBanner";
import ClueInput from "@/components/ClueInput";
import EndTurnButton from "@/components/EndTurnButton";
import JoinModal from "@/components/JoinModal";
import Lobby from "@/components/Lobby";
import TeamPanel from "@/components/TeamPanel";
import WinnerBanner from "@/components/WinnerBanner";

type Props = {
  initialRoom: Room;
  initialPlayers: Player[];
  initialCards: Card[];
};

export default function RoomClient({ initialRoom, initialPlayers, initialCards }: Props) {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [playerId, setPlayerId] = useState<string>("");
  const [needsName, setNeedsName] = useState<boolean>(false);
  const [, startTransition] = useTransition();
  const joinedRef = useRef(false);

  const doJoin = useCallback(
    async (id: string, name: string) => {
      if (joinedRef.current) return;
      joinedRef.current = true;
      try {
        await joinRoom({ code: room.code, playerId: id, displayName: name });
      } catch (err) {
        joinedRef.current = false;
        console.error(err);
        alert(err instanceof Error ? err.message : "Failed to join room");
      }
    },
    [room.code]
  );

  // Bootstrap identity on first client render — localStorage isn't available
  // during SSR, so this must happen in an effect.
  useEffect(() => {
    const id = getOrCreatePlayerId();
    const name = getDisplayName();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerId(id);
    if (!name) {
      setNeedsName(true);
    } else {
      void doJoin(id, name);
    }
  }, [doJoin]);

  // Realtime subscriptions.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new) setRoom(payload.new as Room);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id?: string };
              return prev.filter((p) => p.id !== old.id);
            }
            const next = payload.new as Player;
            const idx = prev.findIndex((p) => p.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = prev.slice();
            copy[idx] = next;
            return copy;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const next = payload.new as Card;
          setCards((prev) => {
            const idx = prev.findIndex((c) => c.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = prev.slice();
            copy[idx] = next;
            return copy;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room.id]);

  const me = useMemo(() => players.find((p) => p.id === playerId) ?? null, [players, playerId]);

  const remaining = useMemo(() => {
    const target = (team: Team) => (team === room.starting_team ? 9 : 8);
    const used = (team: Team) =>
      cards.filter((c) => c.card_type === team && c.revealed).length;
    return {
      red: target("red") - used("red"),
      blue: target("blue") - used("blue"),
    };
  }, [cards, room.starting_team]);

  const onCardClick = (card: Card) => {
    if (!playerId) return;
    startTransition(async () => {
      try {
        await revealCard({ roomId: room.id, cardId: card.id, playerId });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  if (needsName) {
    return (
      <main className="min-h-dvh bg-zinc-50">
        <JoinModal
          onSubmit={(name) => {
            setDisplayName(name);
            setNeedsName(false);
            void doJoin(playerId, name);
          }}
        />
      </main>
    );
  }

  if (room.status === "lobby") {
    return (
      <main className="min-h-dvh bg-zinc-50 p-4 sm:p-6">
        <Lobby roomId={room.id} code={room.code} playerId={playerId} players={players} />
      </main>
    );
  }

  const gameOver = room.status === "finished";
  const awaitingClue = !room.current_clue_word && !gameOver;
  const canSubmitClue =
    me?.role === "spymaster" &&
    me?.team === room.current_team &&
    awaitingClue;
  const showEndTurn =
    !gameOver &&
    !awaitingClue &&
    me?.role === "guesser" &&
    me?.team === room.current_team;

  return (
    <main className="min-h-dvh bg-zinc-50 p-4 sm:p-6 flex flex-col gap-4 items-stretch">
      <div className="flex items-center justify-between max-w-2xl w-full mx-auto">
        <div>
          <div className="text-xs text-zinc-500">Room</div>
          <div className="font-mono font-bold">{room.code}</div>
        </div>
        {!gameOver && room.current_team && (
          <div className="text-sm">
            <span className="text-zinc-500">Turn: </span>
            <span
              className={
                room.current_team === "red" ? "text-red-700 font-semibold" : "text-blue-700 font-semibold"
              }
            >
              {room.current_team}
              {awaitingClue ? " spymaster" : " guessers"}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 max-w-2xl w-full mx-auto">
        <TeamPanel
          team="red"
          players={players.filter((p) => p.team === "red")}
          current={!gameOver && room.current_team === "red"}
          remaining={remaining.red}
        />
        <TeamPanel
          team="blue"
          players={players.filter((p) => p.team === "blue")}
          current={!gameOver && room.current_team === "blue"}
          remaining={remaining.blue}
        />
      </div>

      {gameOver && room.winner && <WinnerBanner winner={room.winner} />}

      {!gameOver && room.current_clue_word && room.current_team && room.current_clue_count != null && (
        <ClueBanner
          team={room.current_team}
          word={room.current_clue_word}
          count={room.current_clue_count}
          guessesRemaining={room.guesses_remaining}
        />
      )}

      {canSubmitClue && <ClueInput roomId={room.id} playerId={playerId} />}

      <Board
        cards={cards}
        viewerRole={me?.role ?? null}
        viewerTeam={me?.team ?? null}
        currentTeam={room.current_team}
        gameOver={gameOver}
        awaitingClue={awaitingClue}
        onCardClick={onCardClick}
      />

      {showEndTurn && (
        <div className="flex justify-center">
          <EndTurnButton roomId={room.id} playerId={playerId} />
        </div>
      )}
    </main>
  );
}
