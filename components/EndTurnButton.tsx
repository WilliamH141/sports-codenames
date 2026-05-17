"use client";

import { useTransition } from "react";
import { endTurn } from "@/app/actions";
import type { Team } from "@/lib/types";

type Props = {
  roomId: string;
  playerId: string;
  team: Team;
};

export default function EndTurnButton({ roomId, playerId, team }: Props) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await endTurn({ roomId, playerId });
          } catch (err) {
            alert(err instanceof Error ? err.message : "Failed");
          }
        })
      }
      className={`${team === "red" ? "ghost-red" : "ghost-blue"} shrink-0 px-4 sm:px-5 rounded-md font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-xs uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2`}
      aria-label="End turn"
    >
      <span className="text-lg leading-none">✓</span>
      <span className="hidden sm:inline">End turn</span>
    </button>
  );
}
