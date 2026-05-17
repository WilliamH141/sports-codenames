"use client";

import { useState, useTransition } from "react";
import {
  randomizeTeams,
  setTeamRole,
  setTurnDuration,
  startGame,
} from "@/app/actions";
import type { Member, Role, Team } from "@/lib/types";

type Props = {
  roomId: string;
  code: string;
  playerId: string;
  members: Member[];
  turnDurationSeconds: number | null;
  onlineMemberIds?: Set<string>;
  presenceLoaded?: boolean;
};

type ShotClockOption = { label: string; value: 60 | 90 | 120 | null };
const SHOT_CLOCK_OPTIONS: ShotClockOption[] = [
  { label: "Off", value: null },
  { label: "60", value: 60 },
  { label: "90", value: 90 },
  { label: "120", value: 120 },
];

type TeamStyle = {
  bar: string;
  text: string;
  fill: string;
  glow: string;
  playerHover: string;
};

const TEAM_STYLES: Record<Team, TeamStyle> = {
  red: {
    bar: "bg-team-red",
    text: "text-team-red",
    fill: "bg-team-red/10",
    glow: "shadow-[0_0_48px_-14px_rgba(255,70,85,0.5)]",
    playerHover: "hover:border-team-red",
  },
  blue: {
    bar: "bg-team-blue",
    text: "text-team-blue",
    fill: "bg-team-blue/10",
    glow: "shadow-[0_0_48px_-14px_rgba(77,142,255,0.5)]",
    playerHover: "hover:border-team-blue",
  },
};

export default function Lobby({
  roomId,
  code,
  playerId,
  members,
  turnDurationSeconds,
  onlineMemberIds,
  presenceLoaded = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const me = members.find((m) => m.id === playerId);
  const isOffline = (id: string) =>
    presenceLoaded && onlineMemberIds != null && !onlineMemberIds.has(id);

  const isOnline = (id: string) =>
    !presenceLoaded || onlineMemberIds == null || onlineMemberIds.has(id);

  const takeSeat = (team: Team | null, role: Role | null) => {
    // If claiming the coach seat and the current holder is offline, send
    // force=true so the server kicks them — mirrors SeatPicker behaviour.
    let force = false;
    if (team && role === "coach") {
      const holder = members.find(
        (m) => m.team === team && m.role === "coach" && m.id !== playerId
      );
      if (holder && !isOnline(holder.id)) force = true;
    }
    startTransition(async () => {
      try {
        await setTeamRole({ roomId, playerId, team, role, force });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  const onStart = () =>
    startTransition(async () => {
      try {
        await startGame(roomId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

  const onRandomize = () =>
    startTransition(async () => {
      try {
        await randomizeTeams(roomId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

  const onSetShotClock = (seconds: 60 | 90 | 120 | null) => {
    if (seconds === turnDurationSeconds) return;
    startTransition(async () => {
      try {
        await setTurnDuration({ roomId, seconds });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // navigator.clipboard can fail on non-https; silently no-op.
    }
  };

  const teamsReady = (["red", "blue"] as Team[]).every((t) => {
    const list = members.filter((m) => m.team === t);
    return (
      list.some((m) => m.role === "coach") &&
      list.some((m) => m.role === "player")
    );
  });

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 stagger">
      {/* Eyebrow */}
      <div className="flex items-center gap-2.5 self-center">
        <span className="w-6 h-0.5 bg-team-gold rounded-full" />
        <span className="font-[family-name:var(--font-display)] text-xs font-black tracking-[0.4em] uppercase text-team-gold">
          Pre-game lobby
        </span>
        <span className="w-6 h-0.5 bg-team-gold rounded-full" />
      </div>

      {/* Room code share */}
      <div className="flex flex-col items-center gap-2.5">
        <span className="font-[family-name:var(--font-display)] text-[11px] font-bold tracking-[0.4em] uppercase text-dim">
          ▸ Share this code
        </span>
        <div className="flex items-stretch gap-2">
          <div className="card-surface flex items-center px-6 sm:px-8 py-3">
            <span className="font-[family-name:var(--font-display)] font-black text-4xl sm:text-5xl tracking-[0.5em] text-ink leading-none pr-[0.5em]">
              {code}
            </span>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="card-surface min-w-[5.25rem] px-4 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase text-muted hover:text-team-gold transition-colors cursor-pointer"
            aria-label="Copy code"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>

      {/* Team panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {(["red", "blue"] as Team[]).map((team) => {
          const t = TEAM_STYLES[team];
          const teamMembers = members.filter((m) => m.team === team);
          const coaches = teamMembers.filter((m) => m.role === "coach");
          const players = teamMembers.filter((m) => m.role === "player");
          // Coach seat is only "taken" if the holder is a DIFFERENT online
          // player. An offline holder is treated as having vacated; clicking
          // claim will force-kick them via setTeamRole.
          const coachTaken = coaches.some(
            (m) => m.id !== playerId && isOnline(m.id)
          );
          const meIsThisTeam = me?.team === team;

          return (
            <div
              key={team}
              className={`relative card-surface overflow-hidden transition-shadow ${meIsThisTeam ? t.glow : ""}`}
            >
              {/* Team color band */}
              <div className={`h-1 ${t.bar}`} />

              <div className="p-4 sm:p-5 flex flex-col gap-4">
                {/* Title row */}
                <div className="flex items-baseline justify-between gap-2">
                  <h2
                    className={`font-[family-name:var(--font-display)] font-black uppercase text-2xl sm:text-3xl tracking-tight ${t.text} leading-none`}
                  >
                    {team} team
                  </h2>
                  <span className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.3em] uppercase text-dim">
                    {teamMembers.length} on roster
                  </span>
                </div>

                {/* Coach slot */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-team-gold text-sm leading-none">★</span>
                    <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.35em] uppercase text-muted">
                      Coach
                    </span>
                  </div>
                  {coaches.length === 0 ? (
                    <p className={`text-sm ${t.text} opacity-40 italic`}>— awaiting —</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {coaches.map((m) => (
                        <li
                          key={m.id}
                          className={`text-base ${t.text} font-semibold truncate ${isOffline(m.id) ? "opacity-40" : ""}`}
                        >
                          {m.display_name}
                          {m.id === playerId && (
                            <span className="text-muted text-xs ml-1 font-normal">
                              (you)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Players */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-sm leading-none ${t.text}`}>●</span>
                    <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.35em] uppercase text-muted">
                      Players
                    </span>
                  </div>
                  {players.length === 0 ? (
                    <p className="text-sm text-muted opacity-40 italic">— none yet —</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {players.map((m) => (
                        <li
                          key={m.id}
                          className={`text-sm text-ink truncate ${isOffline(m.id) ? "opacity-40" : ""}`}
                        >
                          {m.display_name}
                          {m.id === playerId && (
                            <span className="text-muted text-xs ml-1">(you)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Action row */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={pending || coachTaken}
                    onClick={() => takeSeat(team, "coach")}
                    className="flex-1 min-w-[7rem] py-2 px-3 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase border border-border bg-bg-deep/40 text-ink transition-colors cursor-pointer hover:bg-bg-deep hover:border-team-gold disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-bg-deep/40 disabled:hover:border-border"
                  >
                    ★ Coach
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => takeSeat(team, "player")}
                    className={`flex-1 min-w-[7rem] py-2 px-3 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase border border-border bg-bg-deep/40 text-ink transition-colors cursor-pointer hover:bg-bg-deep ${t.playerHover} disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    ● Player
                  </button>
                  {meIsThisTeam && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => takeSeat(null, null)}
                      className="py-2 px-3 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase border border-border bg-transparent text-muted transition-colors cursor-pointer hover:text-ink hover:border-border-hi disabled:opacity-30"
                    >
                      Leave
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Randomize teams — secondary action above tip-off */}
      <button
        type="button"
        disabled={pending || members.length === 0}
        onClick={onRandomize}
        className="card-surface w-full py-2.5 px-4 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.25em] uppercase text-ink hover:text-team-gold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <span className="text-sm opacity-70">↻</span>
        <span>Randomize teams</span>
      </button>

      {/* Shot clock picker */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-team-gold text-sm leading-none">◴</span>
          <span className="font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.35em] uppercase text-muted">
            Shot clock
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SHOT_CLOCK_OPTIONS.map((opt) => {
            const selected = opt.value === turnDurationSeconds;
            return (
              <button
                key={opt.label}
                type="button"
                disabled={pending}
                onClick={() => onSetShotClock(opt.value)}
                className={`py-2.5 px-3 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  selected
                    ? "border-team-gold text-team-gold bg-team-gold/10"
                    : "border-border bg-bg-deep/40 text-ink hover:bg-bg-deep hover:border-border-hi"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tip-off CTA */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={pending || !teamsReady}
          onClick={onStart}
          className="cta-red w-full py-4 px-5 text-white font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-base uppercase cursor-pointer flex items-center justify-between gap-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <span className="font-mono text-xs opacity-70">▸▸</span>
          <span className="text-lg">Tip off</span>
          <span className="text-xl opacity-90">→</span>
        </button>
        {!teamsReady && (
          <p className="text-center text-[11px] text-dim font-[family-name:var(--font-display)] tracking-[0.3em] uppercase font-bold">
            Each team needs ★ coach + ● player
          </p>
        )}
      </div>

      {/* Roster ticker */}
      <div className="flex items-center gap-3 text-[11px] text-dim font-[family-name:var(--font-display)] tracking-[0.3em] uppercase font-bold">
        <span className="flex-1 h-px bg-border" />
        <span className="truncate">
          {members.length} in room
          {members.length > 0 && " · "}
          {members.map((m, i) => (
            <span key={m.id} className={isOffline(m.id) ? "opacity-40" : ""}>
              {m.display_name}
              {i < members.length - 1 && " · "}
            </span>
          ))}
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>
    </div>
  );
}
