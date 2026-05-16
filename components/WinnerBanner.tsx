"use client";

import Link from "next/link";
import type { Team } from "@/lib/types";

type Props = {
  winner: Team;
  cause?: "assassin" | "completed";
};

const STYLE: Record<Team, { band: string; text: string; bar: string }> = {
  red: { band: "bg-team-red", text: "text-team-red", bar: "bar-red" },
  blue: { band: "bg-team-blue", text: "text-team-blue", bar: "bar-blue" },
};

export default function WinnerBanner({ winner, cause }: Props) {
  const s = STYLE[winner];
  return (
    <div className={`${s.bar} relative overflow-hidden rounded-md`}>
      <div className={`h-1 ${s.band}`} />
      <div className="px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-team-gold text-base leading-none">★</span>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.4em] uppercase text-team-gold">
              Final
            </span>
          </div>
          <div className={`font-[family-name:var(--font-display)] font-black uppercase text-4xl sm:text-5xl leading-none tracking-tight ${s.text} mt-1`}>
            {winner} wins
          </div>
          {cause === "assassin" && (
            <p className="mt-2 text-xs text-muted">Assassin revealed.</p>
          )}
        </div>
        <Link
          href="/"
          className="card-surface px-4 sm:px-5 py-3 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.2em] uppercase text-ink hover:text-team-gold transition-colors shrink-0"
        >
          New game →
        </Link>
      </div>
    </div>
  );
}
