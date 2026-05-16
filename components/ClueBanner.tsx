"use client";

import type { Team } from "@/lib/types";

type Props = {
  team: Team;
  word: string;
  count: number;
  guessesRemaining: number | null;
};

const TEAM_BG: Record<Team, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
};

export default function ClueBanner({ team, word, count, guessesRemaining }: Props) {
  return (
    <div
      className={`${TEAM_BG[team]} text-white rounded-md px-4 py-3 flex items-center justify-between gap-3 w-full max-w-md mx-auto`}
    >
      <div>
        <div className="text-xs uppercase tracking-wide opacity-80">
          {team} spymaster says
        </div>
        <div className="text-xl font-semibold">
          {word} <span className="opacity-80">· {count}</span>
        </div>
      </div>
      {guessesRemaining != null && (
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide opacity-80">guesses left</div>
          <div className="text-2xl font-bold">{guessesRemaining}</div>
        </div>
      )}
    </div>
  );
}
