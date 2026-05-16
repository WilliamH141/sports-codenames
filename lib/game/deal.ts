import type { CardType, Sport, Team } from "@/lib/types";
import nbaPool from "@/data/nba.json";

const POOLS: Record<string, string[]> = {
  nba: nbaPool,
};

export type CardSeed = {
  position: number;
  player_name: string;
  card_type: CardType;
};

export function getPlayerPool(sport: Sport): string[] {
  const pool = POOLS[sport];
  if (!pool) throw new Error(`Unknown sport: ${sport}`);
  return pool;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function dealBoard(sport: Sport, startingTeam: Team): CardSeed[] {
  const pool = getPlayerPool(sport);
  if (pool.length < 25) {
    throw new Error(`Player pool for ${sport} must contain at least 25 names`);
  }
  const names = shuffle(pool).slice(0, 25);

  const other: Team = startingTeam === "red" ? "blue" : "red";
  const types: CardType[] = [
    ...Array<CardType>(9).fill(startingTeam),
    ...Array<CardType>(8).fill(other),
    ...Array<CardType>(7).fill("neutral"),
    "assassin",
  ];
  const shuffledTypes = shuffle(types);

  return names.map((player_name, position) => ({
    position,
    player_name,
    card_type: shuffledTypes[position],
  }));
}
