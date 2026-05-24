import Link from "next/link";

/**
 * Rendered when `notFound()` fires — most commonly when someone visits
 * /room/[code] with a code that doesn't exist (typo, expired room, etc).
 * Replaces Next's bare default 404 with the project's design language so
 * the user has a clear way back instead of a dead end.
 */
export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-10">
      <div className="card-surface w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-0.5 bg-team-gold rounded-full" />
          <span className="font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.4em] uppercase text-team-gold">
            Room not found
          </span>
        </div>

        <div>
          <h1 className="font-[family-name:var(--font-display)] font-black uppercase text-3xl text-ink leading-tight">
            No game with that code.
          </h1>
          <p className="mt-2 text-sm text-muted">
            Double-check the room code with whoever invited you, or start a
            fresh one from home.
          </p>
        </div>

        <Link
          href="/"
          className="cta-red w-full py-3 px-5 text-white font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-sm uppercase cursor-pointer flex items-center justify-between gap-3"
        >
          <span className="font-mono text-xs opacity-70">▸▸</span>
          <span className="text-base">Back to home</span>
          <span className="text-lg opacity-90">→</span>
        </Link>
      </div>
    </main>
  );
}
