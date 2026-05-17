"use client";

import type { Team } from "@/lib/types";

type Props = {
  team: Team;
  word: string;
  count: number;
  className?: string;
};

const BAR: Record<Team, string> = {
  red: "bar-red",
  blue: "bar-blue",
};
const TEAM_TEXT: Record<Team, string> = {
  red: "text-team-red",
  blue: "text-team-blue",
};

export default function ClueBanner({ team, word, count, className = "" }: Props) {
  return (
    <div
      className={`${BAR[team]} relative overflow-hidden rounded-md px-4 sm:px-5 py-3 flex items-center gap-3 ${className}`}
    >
      <span className="text-team-gold text-lg leading-none">★</span>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.35em] uppercase text-muted">
          <span className={TEAM_TEXT[team]}>{team}</span> coach says
        </div>
        <div className="flex items-baseline gap-2.5 min-w-0">
          <div className="font-[family-name:var(--font-display)] font-black uppercase text-2xl sm:text-3xl text-ink truncate tracking-tight leading-none">
            {word}
          </div>
          <div
            className={`font-[family-name:var(--font-display)] font-black text-2xl sm:text-3xl ${TEAM_TEXT[team]} leading-none shrink-0`}
          >
            · {count}
          </div>
        </div>
      </div>
    </div>
  );
}
