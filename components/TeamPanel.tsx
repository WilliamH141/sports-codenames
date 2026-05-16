"use client";

import type { Player, Team } from "@/lib/types";

type Props = {
  team: Team;
  players: Player[];
  current: boolean;
  remaining: number;
};

const TEAM_BG: Record<Team, string> = {
  red: "bg-red-50 ring-red-200",
  blue: "bg-blue-50 ring-blue-200",
};
const TEAM_TEXT: Record<Team, string> = {
  red: "text-red-700",
  blue: "text-blue-700",
};

export default function TeamPanel({ team, players, current, remaining }: Props) {
  const spymasters = players.filter((p) => p.role === "spymaster");
  const guessers = players.filter((p) => p.role === "guesser");

  return (
    <div
      className={`rounded-md ring-1 ${TEAM_BG[team]} ${current ? "ring-2 ring-zinc-900" : ""} p-3 flex-1 min-w-0`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={`font-semibold capitalize ${TEAM_TEXT[team]}`}>{team}</h3>
        <span className={`text-sm ${TEAM_TEXT[team]}`}>{remaining} left</span>
      </div>
      <div className="mt-2 text-xs text-zinc-600">Spymaster</div>
      <ul className="text-sm">
        {spymasters.length === 0 && <li className="text-zinc-400">—</li>}
        {spymasters.map((p) => (
          <li key={p.id} className="truncate">{p.display_name}</li>
        ))}
      </ul>
      <div className="mt-2 text-xs text-zinc-600">Guessers</div>
      <ul className="text-sm">
        {guessers.length === 0 && <li className="text-zinc-400">—</li>}
        {guessers.map((p) => (
          <li key={p.id} className="truncate">{p.display_name}</li>
        ))}
      </ul>
    </div>
  );
}
