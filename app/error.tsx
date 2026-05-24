"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Top-level error boundary. Catches uncaught render errors anywhere under
 * `app/` — e.g. a missing env var on the browser client, a malformed Realtime
 * payload, an unhandled action throw — and shows a recovery UI instead of a
 * blank white page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-10">
      <div className="card-surface w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-0.5 bg-team-red rounded-full" />
          <span className="font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.4em] uppercase text-team-red">
            Something broke
          </span>
        </div>

        <div>
          <h1 className="font-[family-name:var(--font-display)] font-black uppercase text-3xl text-ink leading-tight">
            Whoops — that&apos;s on us.
          </h1>
          <p className="mt-2 text-sm text-muted">
            The game hit an unexpected error. You can try recovering, or head
            back home and rejoin the room.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="cta-red w-full py-3 px-5 text-white font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-sm uppercase cursor-pointer flex items-center justify-between gap-3"
          >
            <span className="font-mono text-xs opacity-70">↻</span>
            <span className="text-base">Try again</span>
            <span className="text-lg opacity-90">→</span>
          </button>
          <Link
            href="/"
            className="sticker-btn self-stretch px-4 py-2 text-center font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase border-border bg-surface text-ink hover:border-team-gold hover:text-team-gold cursor-pointer"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
