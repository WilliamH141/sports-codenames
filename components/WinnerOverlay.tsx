"use client";

import { useEffect, useMemo, useState } from "react";
import type { Team } from "@/lib/types";

export type WinCause = "buzzer" | "blowout" | "assassin" | "final";
export type ViewerOutcome = "won" | "lost" | "spectator";

type Props = {
  winner: Team;
  cause: WinCause;
  /** Personalizes the hero text — VICTORY for the winning team, DEFEAT for
      the losing team, FINAL for unseated spectators. */
  viewerOutcome: ViewerOutcome;
  onDismiss: () => void;
};

const CAUSE_LABEL: Record<WinCause, string> = {
  buzzer: "Buzzer beater",
  blowout: "Blowout",
  assassin: "Assassin struck",
  final: "Final whistle",
};

const OUTCOME_LABEL: Record<ViewerOutcome, string> = {
  won: "Victory",
  lost: "Defeat",
  spectator: "Final",
};

const OUTCOME_COLOR: Record<ViewerOutcome, string> = {
  // Gold for the winners — celebratory, distinct from team red/blue.
  won: "text-team-gold",
  // Near-black for losers. Sits heavy on either team-color flood — feels
  // like a verdict, not muted resignation. Can't use red (clashes with
  // team red), can't use blue (clashes with team blue). White was too
  // soft; gold is taken by victory. Black is the visceral choice.
  lost: "text-black/85",
  spectator: "text-white",
};

const BG: Record<Team, string> = {
  red: "bg-team-red",
  blue: "bg-team-blue",
};

const HOLD_MS = 3500;
const FADE_MS = 500;

/**
 * Fullscreen celebration overlay that drops in after the cascade-flip
 * reveal. Holds for ~3.5s then auto-fades. Click anywhere to dismiss
 * early. The persistent WinnerBanner sits underneath, so when this
 * fades the user lands directly on the Play Again UI.
 */
export default function WinnerOverlay({
  winner,
  cause,
  viewerOutcome,
  onDismiss,
}: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setExiting(true), HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(onDismiss, FADE_MS);
    return () => clearTimeout(t);
  }, [exiting, onDismiss]);

  const confetti = useMemo(() => generateConfetti(50), []);

  return (
    <div
      role="dialog"
      aria-label={`${winner} team wins`}
      onClick={() => setExiting(true)}
      className={`fixed inset-0 z-50 flex items-center justify-center cursor-pointer transition-opacity duration-500 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Team-color flood — sits behind everything */}
      <div
        className={`absolute inset-0 ${BG[winner]}`}
        style={{ opacity: 0.92 }}
      />

      {/* Confetti — bursts from center, biased upward. Hidden for losing
          viewers; confetti is celebration with no factual content, so it
          should follow the personal axis (VICTORY/DEFEAT), not the factual
          axis (which team won). Losers see the same color flood + heavy
          DEFEAT text, but no particles cheering at them. */}
      {viewerOutcome !== "lost" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={
                {
                  backgroundColor: c.color,
                  "--tx": `${c.tx}px`,
                  "--ty": `${c.ty}px`,
                  "--rot": `${c.rot}deg`,
                  animationDelay: `${c.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Headline — personal outcome is the hero, team result is secondary,
          cause is the subtitle. Order matters: viewer reads VICTORY/DEFEAT
          first, then sees which team won, then learns the narrative bit. */}
      <div className="relative flex flex-col items-center text-white winner-headline px-4">
        <span
          className={`font-[family-name:var(--font-display)] font-black uppercase leading-[0.85] tracking-tight text-[clamp(4.5rem,18vw,11rem)] ${OUTCOME_COLOR[viewerOutcome]}`}
        >
          {OUTCOME_LABEL[viewerOutcome]}
        </span>
        <span className="mt-3 font-[family-name:var(--font-display)] font-black uppercase text-2xl sm:text-3xl tracking-[0.18em] opacity-90">
          {winner} wins
        </span>
        <span className="mt-2 font-[family-name:var(--font-display)] text-xs sm:text-sm font-bold tracking-[0.35em] uppercase opacity-65">
          {CAUSE_LABEL[cause]}
        </span>
        <span className="mt-8 font-[family-name:var(--font-display)] text-[10px] sm:text-xs font-bold tracking-[0.4em] uppercase opacity-55">
          Tap to dismiss
        </span>
      </div>
    </div>
  );
}

type ConfettiPiece = {
  color: string;
  tx: number;
  ty: number;
  rot: number;
  delay: number;
};

function generateConfetti(n: number): ConfettiPiece[] {
  // Mix of gold tones + white so confetti reads regardless of which team
  // color is behind it. No team-color confetti — that'd disappear into the
  // bg flood.
  const colors = ["#fdb927", "#ffcd5c", "#ffffff", "#f4f5f7"];
  const out: ConfettiPiece[] = [];
  for (let i = 0; i < n; i++) {
    // Evenly distribute around a circle, then jitter so it doesn't read
    // as a perfect ring.
    const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.6;
    const dist = 280 + Math.random() * 420;
    out.push({
      color: colors[Math.floor(Math.random() * colors.length)]!,
      tx: Math.cos(angle) * dist,
      // Bias upward so confetti feels like it's bursting up + outward
      // rather than uniformly radiating.
      ty: Math.sin(angle) * dist - 120,
      rot: (Math.random() - 0.5) * 720,
      delay: Math.random() * 250,
    });
  }
  return out;
}
