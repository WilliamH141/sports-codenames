"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { getDisplayName, getOrCreatePlayerId, setDisplayName } from "@/lib/identity";
import { expireTurn, joinRoom, revealCard } from "@/app/actions";
import type { Card, Member, Room, Team } from "@/lib/types";
import Board from "@/components/Board";
import ClueBanner from "@/components/ClueBanner";
import ClueInput from "@/components/ClueInput";
import EndTurnButton from "@/components/EndTurnButton";
import JoinModal from "@/components/JoinModal";
import Lobby from "@/components/Lobby";
import SeatPicker from "@/components/SeatPicker";
import TeamPanel from "@/components/TeamPanel";
import TeamPanelRail from "@/components/TeamPanelRail";
import TurnIndicator from "@/components/TurnIndicator";
import WinnerBanner from "@/components/WinnerBanner";

type Props = {
  initialRoom: Room;
  initialMembers: Member[];
  initialCards: Card[];
};

export default function RoomClient({ initialRoom, initialMembers, initialCards }: Props) {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [playerId, setPlayerId] = useState<string>("");
  const [needsName, setNeedsName] = useState<boolean>(false);
  const [revealing, setRevealing] = useState(false);
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<string>>(new Set());
  const [presenceLoaded, setPresenceLoaded] = useState(false);
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

  // Realtime subscriptions + Presence. The Presence layer rides the same
  // WebSocket and tells us which member IDs currently have a live tab open —
  // that's how we detect "coach bailed without clicking leave."
  useEffect(() => {
    if (!playerId) return;
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`room:${room.id}`, {
        config: { presence: { key: playerId } },
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new) setRoom(payload.new as Room);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `room_id=eq.${room.id}` },
        (payload) => {
          setMembers((prev) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id?: string };
              return prev.filter((m) => m.id !== old.id);
            }
            const next = payload.new as Member;
            const idx = prev.findIndex((m) => m.id === next.id);
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
          setCards((prev) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id?: string };
              return prev.filter((c) => c.id !== old.id);
            }
            const next = payload.new as Card;
            const idx = prev.findIndex((c) => c.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = prev.slice();
            copy[idx] = next;
            return copy;
          });
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineMemberIds(new Set(Object.keys(state)));
        setPresenceLoaded(true);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room.id, playerId]);

  const me = useMemo(() => members.find((m) => m.id === playerId) ?? null, [members, playerId]);

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
        <Lobby
          roomId={room.id}
          code={room.code}
          playerId={playerId}
          members={members}
          onlineMemberIds={onlineMemberIds}
          presenceLoaded={presenceLoaded}
        />
      </main>
    );
  }

  const gameOver = room.status === "finished";
  const awaitingClue = !room.current_clue_word && !gameOver;
  const canSubmitClue =
    me?.role === "coach" &&
    me?.team === room.current_team &&
    awaitingClue;
  const showEndTurn =
    !gameOver &&
    !awaitingClue &&
    me?.role === "player" &&
    me?.team === room.current_team;

  return (
    <main className="min-h-dvh px-3 sm:px-6 py-4 sm:py-6">
      <div className="max-w-[1536px] w-full mx-auto flex flex-col gap-3 sm:gap-4 stagger">
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
              className={`font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.25em] uppercase transition-colors ${gameOver ? "text-team-red hover:opacity-80" : "text-dim hover:text-team-gold"}`}
            >
              Leave →
            </Link>
          </div>
        </header>

        {/* Status above body — turn indicator (with embedded shot clock) OR
            winner banner. Sits between navbar and body grid so rails+board
            align at the top of the body. */}
        {gameOver && room.winner ? (
          <WinnerBanner winner={room.winner} roomId={room.id} />
        ) : !gameOver && room.current_team ? (
          <TurnIndicator
            team={room.current_team}
            phase={room.current_clue_word ? "guess" : "clue"}
            deadline={room.turn_deadline}
            onExpire={() => {
              void expireTurn(room.id);
            }}
          />
        ) : null}

        {/* Body grid — mobile: 1 col, desktop: 14rem | board | 14rem */}
        <div className="grid grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)_14rem] gap-3 lg:gap-5">
          {/* Mobile/tablet scoreboard — hidden on lg+ */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:hidden">
            <TeamPanel
              team="red"
              members={members.filter((m) => m.team === "red")}
              current={!gameOver && room.current_team === "red"}
              remaining={remaining.red}
              phase={!gameOver && room.current_team === "red" ? (room.current_clue_word ? "guess" : "clue") : undefined}
              guessesRemaining={room.current_team === "red" ? room.guesses_remaining : null}
              onlineMemberIds={onlineMemberIds}
              presenceLoaded={presenceLoaded}
            />
            <TeamPanel
              team="blue"
              members={members.filter((m) => m.team === "blue")}
              current={!gameOver && room.current_team === "blue"}
              remaining={remaining.blue}
              phase={!gameOver && room.current_team === "blue" ? (room.current_clue_word ? "guess" : "clue") : undefined}
              guessesRemaining={room.current_team === "blue" ? room.guesses_remaining : null}
              onlineMemberIds={onlineMemberIds}
              presenceLoaded={presenceLoaded}
            />
          </div>

          {/* Desktop left rail — hidden below lg */}
          <div className="hidden lg:block">
            <TeamPanelRail
              team="red"
              members={members.filter((m) => m.team === "red")}
              current={!gameOver && room.current_team === "red"}
              remaining={remaining.red}
              phase={!gameOver && room.current_team === "red" ? (room.current_clue_word ? "guess" : "clue") : undefined}
              guessesRemaining={room.current_team === "red" ? room.guesses_remaining : null}
              onlineMemberIds={onlineMemberIds}
              presenceLoaded={presenceLoaded}
            />
          </div>

          {/* Center column — just the board so it aligns with the rails. */}
          <div className="min-w-0">
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
          </div>

          {/* Desktop right rail — hidden below lg */}
          <div className="hidden lg:block">
            <TeamPanelRail
              team="blue"
              members={members.filter((m) => m.team === "blue")}
              current={!gameOver && room.current_team === "blue"}
              remaining={remaining.blue}
              phase={!gameOver && room.current_team === "blue" ? (room.current_clue_word ? "guess" : "clue") : undefined}
              guessesRemaining={room.current_team === "blue" ? room.guesses_remaining : null}
              onlineMemberIds={onlineMemberIds}
              presenceLoaded={presenceLoaded}
            />
          </div>
        </div>

        {/* Action row below body — clue display, clue input, end turn,
            seat picker. Lives under the board (Codenames-online style). */}
        {!gameOver && (
          <div className="flex flex-col gap-3 sm:gap-4 max-w-2xl w-full mx-auto">
            {(!me?.team || !me?.role) && playerId && (
              <SeatPicker
                roomId={room.id}
                playerId={playerId}
                members={members}
                onlineMemberIds={onlineMemberIds}
                presenceLoaded={presenceLoaded}
              />
            )}
            {room.current_clue_word && room.current_team && room.current_clue_count != null && (
              <div className="flex gap-2 items-stretch">
                <ClueBanner
                  team={room.current_team}
                  word={room.current_clue_word}
                  count={room.current_clue_count}
                  className="flex-1"
                />
                {showEndTurn && (
                  <EndTurnButton
                    roomId={room.id}
                    playerId={playerId}
                    team={room.current_team}
                  />
                )}
              </div>
            )}
            {canSubmitClue && room.current_team && (
              <ClueInput
                roomId={room.id}
                playerId={playerId}
                team={room.current_team}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
