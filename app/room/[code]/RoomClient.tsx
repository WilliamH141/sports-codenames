"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import SeatPicker from "@/components/SeatPicker";
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
  const [revealing, setRevealing] = useState(false);
  const revealInFlight = useRef(false);
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

  // Single-flight lock: rapid taps used to queue up server actions that ran
  // against stale state and surfaced "wait for a clue" alerts. One reveal at a
  // time; subsequent taps are dropped, not queued.
  const onCardClick = (card: Card) => {
    if (!playerId || revealInFlight.current) return;
    revealInFlight.current = true;
    setRevealing(true);
    (async () => {
      try {
        await revealCard({ roomId: room.id, cardId: card.id, playerId });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      } finally {
        revealInFlight.current = false;
        setRevealing(false);
      }
    })();
  };

  if (needsName) {
    return (
      <main className="min-h-dvh">
        <JoinModal
          roomCode={room.code}
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
      <main className="min-h-dvh px-4 sm:px-6 py-8 sm:py-12">
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
    <main className="min-h-dvh px-3 sm:px-6 py-4 sm:py-6">
      <div className="max-w-3xl w-full mx-auto flex flex-col gap-3 sm:gap-4 stagger">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="chip-gold inline-flex items-center px-2 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.22em] uppercase">
              NBA
            </span>
            <span className="hidden sm:inline font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase text-ink">
              Sports Codenames
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-[0.28em] uppercase">
              <span className="text-dim">Room</span>{" "}
              <span className="text-ink ml-1">{room.code}</span>
            </span>
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.25em] uppercase text-dim hover:text-team-gold transition-colors"
            >
              Leave →
            </Link>
          </div>
        </header>

        {/* Scoreboard */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
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

        {/* Seat picker — for fresh joiners / refreshed players with no seat yet. */}
        {!gameOver && (!me?.team || !me?.role) && playerId && (
          <SeatPicker
            roomId={room.id}
            playerId={playerId}
            players={players}
          />
        )}

        {/* Status strip */}
        {gameOver && room.winner ? (
          <WinnerBanner winner={room.winner} />
        ) : canSubmitClue && room.current_team ? (
          <ClueInput
            roomId={room.id}
            playerId={playerId}
            team={room.current_team}
          />
        ) : !gameOver &&
          room.current_clue_word &&
          room.current_team &&
          room.current_clue_count != null ? (
          <ClueBanner
            team={room.current_team}
            word={room.current_clue_word}
            count={room.current_clue_count}
            guessesRemaining={room.guesses_remaining}
          />
        ) : !gameOver && room.current_team ? (
          <AwaitingStrip team={room.current_team} />
        ) : null}

        {/* Board */}
        <Board
          cards={cards}
          viewerRole={me?.role ?? null}
          viewerTeam={me?.team ?? null}
          currentTeam={room.current_team}
          gameOver={gameOver}
          awaitingClue={awaitingClue}
          locked={revealing}
          onCardClick={onCardClick}
        />

        {/* End turn */}
        {showEndTurn && room.current_team && (
          <div className="flex justify-center pt-1">
            <EndTurnButton
              roomId={room.id}
              playerId={playerId}
              team={room.current_team}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function AwaitingStrip({ team }: { team: Team }) {
  return (
    <div
      className={`${team === "red" ? "bar-red" : "bar-blue"} rounded-md px-4 py-2.5 flex items-center gap-2.5`}
    >
      <span
        className={`ping-dot inline-block w-2 h-2 rounded-full ${team === "red" ? "bg-team-red" : "bg-team-blue"}`}
      />
      <span className="font-[family-name:var(--font-display)] text-[11px] font-bold tracking-[0.35em] uppercase text-muted">
        Awaiting{" "}
        <span className={team === "red" ? "text-team-red" : "text-team-blue"}>
          {team}
        </span>{" "}
        spymaster
      </span>
    </div>
  );
}
