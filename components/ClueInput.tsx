"use client";

import { useState, useTransition } from "react";
import { submitClue } from "@/app/actions";
import type { Team } from "@/lib/types";

type Props = {
  roomId: string;
  playerId: string;
  team: Team;
};

const BAR: Record<Team, string> = {
  red: "bar-red",
  blue: "bar-blue",
};
const TEAM_TEXT: Record<Team, string> = {
  red: "text-team-red",
  blue: "text-team-blue",
};

export default function ClueInput({ roomId, playerId, team }: Props) {
  const [word, setWord] = useState("");
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await submitClue({ roomId, playerId, word, count });
        setWord("");
        setCount(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className={`${BAR[team]} rounded-md px-3 sm:px-4 py-3 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <span className="text-team-gold text-base leading-none">★</span>
        <span className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.35em] uppercase text-muted">
          <span className={TEAM_TEXT[team]}>{team}</span> coach — your clue
        </span>
      </div>

      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="one word"
          autoFocus
          maxLength={30}
          className="card-surface flex-1 min-w-0 px-3 py-2.5 font-[family-name:var(--font-display)] font-bold text-lg sm:text-xl uppercase tracking-wide text-ink placeholder:text-dim placeholder:font-normal placeholder:tracking-normal outline-none transition-shadow focus:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_2px_var(--color-team-gold),0_0_28px_-10px_rgba(253,185,39,0.55)] caret-team-gold"
          required
        />
        <div className="relative">
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="card-surface appearance-none h-full px-3 pr-8 font-[family-name:var(--font-display)] font-black text-xl text-ink uppercase outline-none cursor-pointer focus:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_2px_var(--color-team-gold)]"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n} className="bg-surface text-ink">
                {n}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-team-gold text-xs">▼</span>
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`${team === "red" ? "cta-red" : "cta-blue"} px-4 sm:px-5 text-white font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-xs uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {pending ? "..." : "Send →"}
        </button>
      </div>

      {error && (
        <p className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.25em] uppercase text-team-red">
          ✕ {error}
        </p>
      )}
    </form>
  );
}
