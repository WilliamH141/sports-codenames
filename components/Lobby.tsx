"use client";

import { useState, useTransition } from "react";
import { setTeamRole, startGame } from "@/app/actions";
import type { Player, Role, Team } from "@/lib/types";

type Props = {
  roomId: string;
  code: string;
  playerId: string;
  players: Player[];
};

type TeamStyle = {
  bar: string;
  text: string;
  fill: string;
  glow: string;
  guesserHover: string;
};

const TEAM_STYLES: Record<Team, TeamStyle> = {
  red: {
    bar: "bg-team-red",
    text: "text-team-red",
    fill: "bg-team-red/10",
    glow: "shadow-[0_0_48px_-14px_rgba(255,70,85,0.5)]",
    guesserHover: "hover:border-team-red",
  },
  blue: {
    bar: "bg-team-blue",
    text: "text-team-blue",
    fill: "bg-team-blue/10",
    glow: "shadow-[0_0_48px_-14px_rgba(77,142,255,0.5)]",
    guesserHover: "hover:border-team-blue",
  },
};

export default function Lobby({ roomId, code, playerId, players }: Props) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const me = players.find((p) => p.id === playerId);

  const takeSeat = (team: Team | null, role: Role | null) =>
    startTransition(async () => {
      try {
        await setTeamRole({ roomId, playerId, team, role });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

  const onStart = () =>
    startTransition(async () => {
      try {
        await startGame(roomId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

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
    const list = players.filter((p) => p.team === t);
    return (
      list.some((p) => p.role === "spymaster") &&
      list.some((p) => p.role === "guesser")
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
          const teamPlayers = players.filter((p) => p.team === team);
          const spymasters = teamPlayers.filter((p) => p.role === "spymaster");
          const guessers = teamPlayers.filter((p) => p.role === "guesser");
          const spymasterTaken =
            spymasters.length > 0 && !spymasters.some((p) => p.id === playerId);
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
                    {teamPlayers.length} player{teamPlayers.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Spymaster slot */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-team-gold text-sm leading-none">★</span>
                    <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.35em] uppercase text-muted">
                      Spymaster
                    </span>
                  </div>
                  {spymasters.length === 0 ? (
                    <p className={`text-sm ${t.text} opacity-40 italic`}>— awaiting —</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {spymasters.map((p) => (
                        <li
                          key={p.id}
                          className={`text-base ${t.text} font-semibold truncate`}
                        >
                          {p.display_name}
                          {p.id === playerId && (
                            <span className="text-muted text-xs ml-1 font-normal">
                              (you)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Guessers */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-sm leading-none ${t.text}`}>●</span>
                    <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.35em] uppercase text-muted">
                      Guessers
                    </span>
                  </div>
                  {guessers.length === 0 ? (
                    <p className="text-sm text-muted opacity-40 italic">— none yet —</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {guessers.map((p) => (
                        <li key={p.id} className="text-sm text-ink truncate">
                          {p.display_name}
                          {p.id === playerId && (
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
                    disabled={pending || spymasterTaken}
                    onClick={() => takeSeat(team, "spymaster")}
                    className="flex-1 min-w-[7rem] py-2 px-3 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase border border-border bg-bg-deep/40 text-ink transition-colors cursor-pointer hover:bg-bg-deep hover:border-team-gold disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-bg-deep/40 disabled:hover:border-border"
                  >
                    ★ Spymaster
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => takeSeat(team, "guesser")}
                    className={`flex-1 min-w-[7rem] py-2 px-3 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase border border-border bg-bg-deep/40 text-ink transition-colors cursor-pointer hover:bg-bg-deep ${t.guesserHover} disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    ● Guesser
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
            Each team needs ★ spymaster + ● guesser
          </p>
        )}
      </div>

      {/* Roster ticker */}
      <div className="flex items-center gap-3 text-[11px] text-dim font-[family-name:var(--font-display)] tracking-[0.3em] uppercase font-bold">
        <span className="flex-1 h-px bg-border" />
        <span className="truncate">
          {players.length} in room
          {players.length > 0 && " · "}
          {players.map((p) => p.display_name).join(" · ")}
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>
    </div>
  );
}
