"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  /** Visual variant. "default" is the quiet in-header style; "danger" is
      the after-game red emphasis. */
  variant?: "default" | "danger";
};

/**
 * Two-click leave confirmation. First click swaps the button into a red
 * "Confirm leave?" state for 3 seconds; a second click within that window
 * actually navigates home. After the timeout the button reverts. Avoids
 * the heaviness of a modal while still preventing accidental exits.
 */
export default function LeaveButton({ variant = "default" }: Props) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (confirming) {
    return (
      <Link
        href="/"
        className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.25em] uppercase text-team-red hover:opacity-80 transition-opacity"
      >
        ✕ Confirm leave?
      </Link>
    );
  }

  const idle =
    variant === "danger"
      ? "text-team-red hover:opacity-80"
      : "text-dim hover:text-team-gold";

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.25em] uppercase transition-colors cursor-pointer ${idle}`}
    >
      Leave →
    </button>
  );
}
