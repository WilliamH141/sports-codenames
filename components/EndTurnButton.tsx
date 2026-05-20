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
      className={`${team === "red" ? "cta-red" : "cta-blue"} shrink-0 px-4 sm:px-5 text-white font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-xs uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label="End turn"
    >
      {pending ? "..." : "End →"}
    </button>
  );
}
