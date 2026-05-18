"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Tiny "How to play" affordance — quiet text button that opens a modal with
 * rule bullets. Lives next to the Leave button in both lobby and game headers
 * so a newcomer can find rules without leaving the page.
 */
export default function HowToPlayButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // `fixed` inset-0 is normally viewport-relative, but ANY ancestor with a
  // CSS `transform` (the board's 3D card flips create one) reparents fixed
  // positioning to that ancestor. Portaling to document.body sidesteps that.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Esc to dismiss when open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.25em] uppercase text-dim hover:text-team-gold transition-colors cursor-pointer"
        aria-label="Open how-to-play guide"
      >
        How to play
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-deep/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="card-surface relative w-full max-w-md p-5 sm:p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5">
              <span className="w-6 h-0.5 bg-team-gold rounded-full" />
              <span className="font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.4em] uppercase text-team-gold">
                How to play
              </span>
            </div>

            <ul className="flex flex-col gap-3 text-sm text-ink leading-relaxed">
              <li>
                Each team has a{" "}
                <span className="text-team-gold font-semibold">coach</span>{" "}
                (gives clues) and{" "}
                <span className="text-ink font-semibold">players</span> (guess
                cards).
              </li>
              <li>
                The coach gives a{" "}
                <span className="font-semibold">one-word clue</span> plus a{" "}
                <span className="font-semibold">number</span>. The number is how
                many cards on the board relate to the clue.
              </li>
              <li>
                Players tap cards. Hit your team&apos;s color → keep going. Hit a
                neutral card or the other team&apos;s → turn ends. Hit the{" "}
                <span className="text-team-red font-semibold">assassin</span> →
                instant loss.
              </li>
              <li>
                Tap the{" "}
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-team-gold/20 text-team-gold text-[10px] align-middle">
                  •
                </span>{" "}
                pin on a card to soft-flag it for your team before committing to
                a tap.
              </li>
              <li>
                First team to find{" "}
                <span className="font-semibold">all</span> their cards wins.
              </li>
            </ul>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="self-stretch sm:self-end px-4 py-2 font-[family-name:var(--font-display)] text-xs font-black tracking-[0.22em] uppercase border border-border bg-bg-deep/40 text-ink hover:bg-bg-deep hover:border-team-gold hover:text-team-gold transition-colors cursor-pointer mt-2"
            >
              Got it
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
