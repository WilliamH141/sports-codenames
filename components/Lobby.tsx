"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  randomizeTeams,
  resetTeams,
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

type TeamStyle = {
  bar: string;
  text: string;
  glow: string;
  hoverRow: string;
};

const TEAM_STYLES: Record<Team, TeamStyle> = {
  red: {
    bar: "bg-team-red",
    text: "text-team-red",
    glow: "shadow-[0_0_48px_-14px_rgba(255,70,85,0.5)]",
    hoverRow: "hover:bg-team-red/[0.04]",
  },
  blue: {
    bar: "bg-team-blue",
    text: "text-team-blue",
    glow: "shadow-[0_0_48px_-14px_rgba(77,142,255,0.5)]",
    hoverRow: "hover:bg-team-blue/[0.04]",
  },
};

const SHOT_CLOCK_OPTIONS: { label: string; value: 60 | 90 | 120 | null }[] = [
  { label: "Off", value: null },
  { label: "60", value: 60 },
  { label: "90", value: 90 },
  { label: "120", value: 120 },
];

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
  const me = members.find((m) => m.id === playerId) ?? null;
  const isOffline = (id: string) =>
    presenceLoaded && onlineMemberIds != null && !onlineMemberIds.has(id);
  const isOnline = (id: string) =>
    !presenceLoaded || onlineMemberIds == null || onlineMemberIds.has(id);

  const takeSeat = (team: Team | null, role: Role | null) => {
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

  const onReset = () =>
    startTransition(async () => {
      try {
        await resetTeams(roomId);
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

  const unassigned = members.filter((m) => !m.team || !m.role);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-5 sm:gap-7 stagger">
      {/* Room code — its own row, no card. The accent rule below ties it to
          the page while keeping it visually distinct from the panels below. */}
      <div className="flex flex-col items-center gap-2">
        <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.4em] uppercase text-dim">
          Share room code
        </span>
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-display)] font-black text-4xl sm:text-5xl tracking-[0.5em] text-ink leading-none pr-[0.5em]">
            {code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.22em] uppercase text-muted hover:text-team-gold transition-colors cursor-pointer px-2 py-1"
            aria-label="Copy code"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
        <div className="vs-rule w-32 sm:w-44 mt-1" />
      </div>

      {/* Three-panel grid — desktop: red | controls | blue. mobile: red+blue, controls full-width below. */}
      <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)_minmax(0,1fr)] gap-3 lg:gap-5">
        <TeamCard
          team="red"
          members={members}
          playerId={playerId}
          me={me}
          pending={pending}
          isOffline={isOffline}
          isOnline={isOnline}
          onClaim={takeSeat}
          className="lg:col-start-1 lg:row-start-1"
        />
        <TeamCard
          team="blue"
          members={members}
          playerId={playerId}
          me={me}
          pending={pending}
          isOffline={isOffline}
          isOnline={isOnline}
          onClaim={takeSeat}
          className="lg:col-start-3 lg:row-start-1"
        />
        <ControlsCard
          pending={pending}
          turnDurationSeconds={turnDurationSeconds}
          onSetShotClock={onSetShotClock}
          onRandomize={onRandomize}
          onReset={onReset}
          disableRandomize={members.length === 0}
          disableReset={members.every((m) => !m.team && !m.role)}
          unassigned={unassigned}
          playerId={playerId}
          isOffline={isOffline}
          className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1"
        />
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
    </div>
  );
}

type TeamCardProps = {
  team: Team;
  members: Member[];
  playerId: string;
  me: Member | null;
  pending: boolean;
  isOffline: (id: string) => boolean;
  isOnline: (id: string) => boolean;
  onClaim: (team: Team | null, role: Role | null) => void;
  className?: string;
};

function TeamCard({
  team,
  members,
  playerId,
  me,
  pending,
  isOffline,
  isOnline,
  onClaim,
  className = "",
}: TeamCardProps) {
  const t = TEAM_STYLES[team];
  const teamMembers = members.filter((m) => m.team === team);
  const coach = teamMembers.find((m) => m.role === "coach") ?? null;
  const players = teamMembers.filter((m) => m.role === "player");
  const coachOnline = coach ? isOnline(coach.id) : false;
  const meIsThisTeam = me?.team === team;
  const meIsPlayerOfThis = meIsThisTeam && me?.role === "player";

  const coachClaimable =
    !pending && (!coach || (coach.id !== playerId && !coachOnline));
  const playerJoinable = !pending && !meIsPlayerOfThis;

  return (
    <div
      className={`card-surface overflow-hidden flex flex-col h-full ${meIsThisTeam ? t.glow : ""} ${className}`}
    >
      {/* Team color band */}
      <div className={`h-1 ${t.bar}`} />

      {/* Header — team name + roster count (+ inline leave when on this team) */}
      <div className="px-4 py-3 flex items-baseline justify-between gap-3">
        <h2
          className={`font-[family-name:var(--font-display)] font-black uppercase text-2xl sm:text-3xl tracking-tight ${t.text} leading-none`}
        >
          {team}
        </h2>
        <div className="flex items-baseline gap-2.5 shrink-0">
          <span className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.3em] uppercase text-dim">
            {teamMembers.length} on roster
          </span>
          {meIsThisTeam && (
            <>
              <span className="text-dim text-[10px] leading-none">·</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => onClaim(null, null)}
                className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.3em] uppercase text-team-red hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✕ Leave
              </button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Coach section */}
      <SeatSection
        title="Coach"
        icon="★"
        iconClass="text-team-gold"
        clickable={coachClaimable}
        onClick={() => onClaim(team, "coach")}
        hoverClass={t.hoverRow}
        minHeightClass="min-h-[5.5rem]"
      >
        {coach ? (
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span
              className={`text-base font-semibold truncate ${t.text} ${!coachOnline ? "opacity-50" : ""}`}
            >
              {coach.display_name}
              {coach.id === playerId && (
                <span className="text-muted text-xs ml-1 font-normal">
                  (you)
                </span>
              )}
            </span>
            {!coachOnline && (
              <span className="font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.25em] uppercase text-dim shrink-0">
                offline
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-dim italic opacity-60">
            Open · tap to claim
          </span>
        )}
      </SeatSection>

      <div className="border-t border-border/40" />

      {/* Players section — flex-1 so it absorbs vertical slack and keeps the
          team card aligned in height with the controls card. */}
      <SeatSection
        title="Players"
        icon="●"
        iconClass={t.text}
        clickable={playerJoinable}
        onClick={() => onClaim(team, "player")}
        hoverClass={t.hoverRow}
        minHeightClass="min-h-[9rem] flex-1"
      >
        {players.length > 0 ? (
          <ul
            className={`gap-0.5 w-full ${players.length > 5 ? "columns-2 gap-x-3" : "flex flex-col"}`}
          >
            {players.map((m) => (
              <li
                key={m.id}
                className={`text-sm text-ink truncate break-inside-avoid ${isOffline(m.id) ? "opacity-40" : ""}`}
              >
                {m.display_name}
                {m.id === playerId && (
                  <span className="text-muted text-xs ml-1">(you)</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-dim italic opacity-60">
            Open · tap to join
          </span>
        )}
      </SeatSection>
    </div>
  );
}

type SeatSectionProps = {
  title: string;
  icon: string;
  iconClass: string;
  clickable: boolean;
  onClick: () => void;
  hoverClass: string;
  minHeightClass?: string;
  children: ReactNode;
};

function SeatSection({
  title,
  icon,
  iconClass,
  clickable,
  onClick,
  hoverClass,
  minHeightClass = "",
  children,
}: SeatSectionProps) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className={`text-sm leading-none ${iconClass}`}>{icon}</span>
        <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.32em] uppercase text-muted">
          {title}
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-center w-full">
        {children}
      </div>
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left px-4 py-3 flex flex-col gap-1.5 transition-colors cursor-pointer ${hoverClass} ${minHeightClass}`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div
      className={`w-full px-4 py-3 flex flex-col gap-1.5 cursor-default ${minHeightClass}`}
    >
      {inner}
    </div>
  );
}

type ControlsCardProps = {
  pending: boolean;
  turnDurationSeconds: number | null;
  onSetShotClock: (seconds: 60 | 90 | 120 | null) => void;
  onRandomize: () => void;
  onReset: () => void;
  disableRandomize: boolean;
  disableReset: boolean;
  unassigned: Member[];
  playerId: string;
  isOffline: (id: string) => boolean;
  className?: string;
};

function ControlsCard({
  pending,
  turnDurationSeconds,
  onSetShotClock,
  onRandomize,
  onReset,
  disableRandomize,
  disableReset,
  unassigned,
  playerId,
  isOffline,
  className = "",
}: ControlsCardProps) {
  return (
    <div
      className={`card-surface overflow-hidden flex flex-col h-full ${className}`}
    >
      {/* Neutral top stripe — matches the team cards' color-band height so the
          three cards line up at the top, but no color (signals "this isn't a team"). */}
      <div className="h-1 bg-border/60" />

      {/* Shot clock */}
      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-team-gold text-sm leading-none">◴</span>
          <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.32em] uppercase text-muted">
            Shot clock
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SHOT_CLOCK_OPTIONS.map((opt) => {
            const selected = opt.value === turnDurationSeconds;
            return (
              <button
                key={opt.label}
                type="button"
                disabled={pending}
                onClick={() => onSetShotClock(opt.value)}
                className={`py-2 px-2 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.18em] uppercase border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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

      <div className="border-t border-border/40" />

      {/* Team-management actions */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending || disableRandomize}
          onClick={onRandomize}
          className="py-2 px-2 font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.18em] uppercase border border-border bg-bg-deep/40 text-ink hover:bg-bg-deep hover:border-team-gold hover:text-team-gold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <span className="text-sm opacity-70">↻</span>
          <span>Randomize teams</span>
        </button>
        <button
          type="button"
          disabled={pending || disableReset}
          onClick={onReset}
          className="py-2 px-2 font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.18em] uppercase border border-border bg-bg-deep/40 text-ink hover:bg-bg-deep hover:border-team-red hover:text-team-red transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <span className="text-sm opacity-70">⌫</span>
          <span>Reset teams</span>
        </button>
      </div>

      <div className="border-t border-border/40" />

      {/* Waiting room — flex-1 absorbs slack so the controls card height
          matches the team cards regardless of how many people are unassigned. */}
      <div className="px-4 py-3 flex flex-col gap-2 flex-1 min-h-[6rem]">
        <div className="flex items-center justify-between">
          <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.32em] uppercase text-muted">
            Waiting room
          </span>
          <span className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.3em] uppercase text-dim">
            {unassigned.length}
          </span>
        </div>
        {unassigned.length === 0 ? (
          <p className="text-xs text-dim italic opacity-60">
            Everyone has a seat.
          </p>
        ) : (
          <ul
            className={`gap-0.5 max-h-[14rem] overflow-y-auto ${unassigned.length > 5 ? "columns-2 gap-x-3" : "flex flex-col"}`}
          >
            {unassigned.map((m) => (
              <li
                key={m.id}
                className={`text-sm text-ink truncate break-inside-avoid ${isOffline(m.id) ? "opacity-40" : ""}`}
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
    </div>
  );
}
