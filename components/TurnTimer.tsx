"use client";

import { useEffect, useRef, useState } from "react";
import type { Team } from "@/lib/types";

const TURN_DURATION_MS = 90_000;

type Props = {
  deadline: string | null;
  team: Team | null;
  onExpire: () => void;
};

export default function TurnTimer({ deadline, team, onExpire }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!deadline) return;
    const remaining = new Date(deadline).getTime() - now;
    if (remaining > 0) return;
    if (firedFor.current === deadline) return;
    firedFor.current = deadline;
    onExpire();
  }, [deadline, now, onExpire]);

  if (!deadline || !team) return null;

  const remainingMs = Math.max(0, new Date(deadline).getTime() - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const pct = Math.max(0, Math.min(100, (remainingMs / TURN_DURATION_MS) * 100));
  const critical = seconds <= 10;
  const teamFill = team === "red" ? "bg-team-red" : "bg-team-blue";

  return (
    <div className="card-surface rounded-md overflow-hidden">
      <div className="relative h-9 bg-bg-deep">
        <div
          className={`absolute inset-y-0 left-0 transition-[width] duration-200 ease-linear ${critical ? "bg-team-red" : teamFill} opacity-70`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-3 sm:px-4">
          <span className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.35em] uppercase text-muted">
            Shot clock
          </span>
          <span
            className={`font-[family-name:var(--font-display)] text-base sm:text-lg font-black tabular-nums ${critical ? "text-team-red animate-pulse" : "text-ink"}`}
          >
            {seconds}s
          </span>
        </div>
      </div>
    </div>
  );
}
