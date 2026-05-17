"use client";

import Link from "next/link";
import { useTransition } from "react";
import { backToLobby, restartGame } from "@/app/actions";
import type { Team } from "@/lib/types";

type Props = {
  winner: Team;
  roomId: string;
  cause?: "assassin" | "completed";
};

const STYLE: Record<Team, { band: string; text: string; bar: string }> = {
  red: { band: "bg-team-red", text: "text-team-red", bar: "bar-red" },
  blue: { band: "bg-team-blue", text: "text-team-blue", bar: "bar-blue" },
};

export default function WinnerBanner({ winner, roomId, cause }: Props) {
  const s = STYLE[winner];
  const [pending, startTransition] = useTransition();

  const onRematch = () =>
    startTransition(async () => {
      try {
        await restartGame(roomId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

  const onLobby = () =>
    startTransition(async () => {
      try {
        await backToLobby(roomId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

  return (
    <div className={`${s.bar} relative overflow-hidden rounded-md`}>
      <div className={`h-1 ${s.band}`} />
      <div className="px-4 sm:px-6 py-5 flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-team-gold text-base leading-none">★</span>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.4em] uppercase text-team-gold">
              Final
            </span>
          </div>
          <div
            className={`font-[family-name:var(--font-display)] font-black uppercase text-4xl sm:text-5xl leading-none tracking-tight ${s.text} mt-1`}
          >
            {winner} wins
          </div>
          {cause === "assassin" && (
            <p className="mt-2 text-xs text-muted">Assassin revealed.</p>
          )}
        </div>

        {/* Primary — Rematch */}
        <button
          type="button"
          disabled={pending}
          onClick={onRematch}
          className="cta-red w-full py-3.5 px-5 text-white font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-base uppercase cursor-pointer flex items-center justify-between gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <span className="font-mono text-sm opacity-70">↻</span>
          <span className="text-lg">Rematch</span>
          <span className="text-xl opacity-90">→</span>
        </button>

        {/* Secondary — Back to lobby / Leave */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onLobby}
            className="card-surface py-2.5 px-3 font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.2em] uppercase text-ink hover:text-team-gold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back to lobby
          </button>
          <Link
            href="/"
            className="card-surface py-2.5 px-3 font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.2em] uppercase text-ink hover:text-team-gold transition-colors text-center flex items-center justify-center"
          >
            Leave room
          </Link>
        </div>
      </div>
    </div>
  );
}
