"use client";

import { useEffect, useRef, useState } from "react";
import type { Team } from "@/lib/types";

type Props = {
  team: Team;
  deadline: string | null;
  /** Configured shot clock in seconds. Null = no timer (countdown hidden). */
  durationSeconds: number | null;
  /** Viewer-contextual one-liner ("Tap cards that match the clue", "Waiting on
      Bob", etc.). Computed by the parent based on viewer role + game state. */
  prompt: string;
  /** True when the prompt is asking the viewer to act now (vs. wait/watch).
      Drives gold emphasis on the text. */
  actionable: boolean;
  onExpire: () => void;
};

const STYLE: Record<Team, { band: string; text: string; dot: string }> = {
  red: { band: "bg-team-red", text: "text-team-red", dot: "bg-team-red" },
  blue: { band: "bg-team-blue", text: "text-team-blue", dot: "bg-team-blue" },
};

/**
 * Thin status strip below the top bar — communicates whose turn it is, what
 * phase, and shot clock. Sits above the body grid so the rails and board
 * align at the top of the body. Replaces the previous AwaitingStrip + TurnTimer
 * combo (those were in the center column and pushed the board down).
 */
export default function TurnIndicator({ team, deadline, durationSeconds, prompt, actionable, onExpire }: Props) {
  const s = STYLE[team];
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

  // We always have a deadline server-side (even with shot clock "Off", an idle
  // backstop is set to prevent soft-locks). The visible countdown still only
  // appears when the lobby actually configured a shot clock — otherwise the
  // backstop should feel invisible during normal play.
  const showClock = durationSeconds != null && deadline != null;
  const remainingMs = showClock
    ? Math.max(0, new Date(deadline).getTime() - now)
    : null;
  const seconds = remainingMs != null ? Math.ceil(remainingMs / 1000) : null;
  const totalMs = durationSeconds != null ? durationSeconds * 1000 : 0;
  const pct =
    remainingMs != null && totalMs > 0
      ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))
      : 100;
  const critical = seconds != null && seconds <= 10;

  return (
    <div className="card-surface rounded-md overflow-hidden relative">
      <div className={`h-[2px] ${s.band}`} />
      <div className="relative">
        {/* Soft depleting fill underneath the content. */}
        {showClock && (
          <div
            className={`absolute inset-y-0 left-0 ${critical ? "bg-team-red" : s.dot} opacity-15 transition-[width] duration-200 ease-linear`}
            style={{ width: `${pct}%` }}
          />
        )}
        <div className="relative flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`ping-dot inline-block w-2 h-2 rounded-full ${s.dot}`}
            />
            <span
              className={`font-[family-name:var(--font-display)] text-[10px] sm:text-[11px] font-bold tracking-[0.3em] uppercase truncate ${actionable ? "text-team-gold" : "text-muted"}`}
            >
              {prompt}
            </span>
          </div>
          {seconds != null && (
            <span
              className={`font-[family-name:var(--font-display)] text-base sm:text-lg font-black tabular-nums ${critical ? "text-team-red animate-pulse" : "text-ink"}`}
            >
              {seconds}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
