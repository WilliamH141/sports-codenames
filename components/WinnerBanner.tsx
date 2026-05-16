"use client";

import Link from "next/link";
import type { Team } from "@/lib/types";

type Props = { winner: Team };

const TEAM_BG: Record<Team, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
};

export default function WinnerBanner({ winner }: Props) {
  return (
    <div
      className={`${TEAM_BG[winner]} text-white rounded-md px-4 py-4 flex items-center justify-between gap-3 w-full max-w-md mx-auto`}
    >
      <div>
        <div className="text-xs uppercase tracking-wide opacity-80">Game over</div>
        <div className="text-2xl font-bold capitalize">{winner} wins</div>
      </div>
      <Link
        href="/"
        className="rounded-md bg-white/20 hover:bg-white/30 px-3 py-2 text-sm font-medium"
      >
        New game
      </Link>
    </div>
  );
}
