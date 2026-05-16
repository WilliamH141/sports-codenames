"use client";

import type { Player, Team } from "@/lib/types";

type Props = {
  team: Team;
  players: Player[];
  current: boolean;
  remaining: number;
};

const STYLE: Record<Team, {
  band: string;
  text: string;
  scoreText: string;
  glow: string;
  dot: string;
}> = {
  red: {
    band: "bg-team-red",
    text: "text-team-red",
    scoreText: "text-team-red",
    glow: "shadow-[0_0_44px_-14px_rgba(255,70,85,0.55)]",
    dot: "bg-team-red",
  },
  blue: {
    band: "bg-team-blue",
    text: "text-team-blue",
    scoreText: "text-team-blue",
    glow: "shadow-[0_0_44px_-14px_rgba(77,142,255,0.55)]",
    dot: "bg-team-blue",
  },
};

export default function TeamPanel({ team, players, current, remaining }: Props) {
  const s = STYLE[team];
  const spymaster = players.find((p) => p.role === "spymaster");
  const guessers = players.filter((p) => p.role === "guesser");

  return (
    <div
      className={`relative card-surface overflow-hidden transition-shadow ${current ? s.glow : ""}`}
    >
      <div className={`h-[3px] ${s.band}`} />

      <div className="p-3 sm:p-4 flex items-stretch gap-3">
        {/* Roster */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h3
              className={`font-[family-name:var(--font-display)] font-black uppercase text-xl sm:text-2xl leading-none tracking-tight ${s.text}`}
            >
              {team}
            </h3>
            {current && (
              <span className="inline-flex items-center gap-1 font-[family-name:var(--font-display)] text-[9px] font-black tracking-[0.3em] uppercase text-team-gold">
                <span className="ping-dot inline-block w-1.5 h-1.5 rounded-full bg-team-gold" />
                Active
              </span>
            )}
          </div>

          <div className="text-xs text-muted truncate">
            <span className="text-team-gold mr-1">★</span>
            <span className={`${s.text} font-semibold`}>
              {spymaster?.display_name ?? "—"}
            </span>
          </div>
          <div className="text-xs text-muted truncate">
            <span className={`mr-1 ${s.text}`}>●</span>
            <span className="text-ink">
              {guessers.length > 0 ? guessers.map((g) => g.display_name).join(" · ") : "—"}
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="flex flex-col items-end justify-center min-w-[3.5rem]">
          <div className={`font-[family-name:var(--font-display)] font-black leading-none text-5xl sm:text-6xl ${s.scoreText}`}>
            {remaining}
          </div>
          <div className="font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.3em] text-[9px] text-dim mt-0.5">
            Left
          </div>
        </div>
      </div>
    </div>
  );
}
