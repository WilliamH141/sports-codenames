"use client";

import { useTransition } from "react";
import { endTurn } from "@/app/actions";

type Props = {
  roomId: string;
  playerId: string;
};

export default function EndTurnButton({ roomId, playerId }: Props) {
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
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50"
    >
      {pending ? "..." : "End turn"}
    </button>
  );
}
