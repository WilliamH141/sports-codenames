"use client";

import { useState, useTransition } from "react";
import { submitClue } from "@/app/actions";

type Props = {
  roomId: string;
  playerId: string;
};

export default function ClueInput({ roomId, playerId }: Props) {
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
    <form onSubmit={onSubmit} className="flex flex-col gap-2 w-full max-w-md mx-auto">
      <div className="flex gap-2">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="One-word clue"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900"
          required
        />
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="rounded-md border border-zinc-300 px-3 py-2 text-base bg-white"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white font-medium disabled:opacity-50"
        >
          {pending ? "..." : "Send"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
