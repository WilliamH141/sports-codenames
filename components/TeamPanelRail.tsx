"use client";

import type { Member, Team } from "@/lib/types";

type Props = {
  team: Team;
  members: Member[];
  current: boolean;
  remaining: number;
  phase?: "clue" | "guess";
  /** Only meaningful during this team's guess phase. */
  guessesRemaining?: number | null;
  /** Used to mark the viewer's own name with "(you)". */
  playerId?: string;
  onlineMemberIds?: Set<string>;
  presenceLoaded?: boolean;
};

const STYLE: Record<Team, { band: string; text: string; glow: string }> = {
  red: {
    band: "bg-team-red",
    text: "text-team-red",
    glow: "shadow-[0_0_60px_-18px_rgba(255,70,85,0.55)]",
  },
  blue: {
    band: "bg-team-blue",
    text: "text-team-blue",
    glow: "shadow-[0_0_60px_-18px_rgba(77,142,255,0.55)]",
  },
};

/**
 * Portrait-oriented team panel for desktop side rails. The mobile/scoreboard
 * variant lives in TeamPanel.tsx — same data, different shape (landscape).
 */
export default function TeamPanelRail({
  team,
  members,
  current,
  remaining,
  phase,
  guessesRemaining,
  playerId,
  onlineMemberIds,
  presenceLoaded = false,
}: Props) {
  const showGuessCount =
    current && phase === "guess" && guessesRemaining != null;
  const s = STYLE[team];
  const coach = members.find((m) => m.role === "coach");
  const players = members.filter((m) => m.role === "player");
  const isOffline = (id: string) =>
    presenceLoaded && onlineMemberIds != null && !onlineMemberIds.has(id);
  const phaseTag =
    phase === "clue" ? "✎ On clue" : phase === "guess" ? "▶ Guessing" : "Active";

  return (
    <div
      className={`card-surface overflow-hidden rounded-md transition-shadow ${current ? s.glow : ""}`}
    >
      <div className={`h-1 ${s.band}`} />

      <div className="p-4 flex flex-col gap-4">
        {/* Team header */}
        <div className="flex flex-col gap-1">
          <h2
            className={`font-[family-name:var(--font-display)] font-black uppercase text-3xl xl:text-4xl leading-none tracking-tight ${s.text}`}
          >
            {team}
          </h2>
          {current && (
            <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.3em] uppercase text-team-gold">
              {phaseTag}
            </span>
          )}
        </div>

        {/* Big score */}
        <div className="flex flex-col items-center py-1">
          <div
            className={`font-[family-name:var(--font-display)] font-black leading-none text-7xl xl:text-8xl ${s.text}`}
          >
            {remaining}
          </div>
          <div className="font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.3em] text-[10px] text-dim mt-1.5">
            Left
          </div>
          {showGuessCount && (
            <div className="mt-3 px-2.5 py-1 rounded card-surface font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.25em] text-[10px] text-team-gold">
              {guessesRemaining} {guessesRemaining === 1 ? "guess" : "guesses"}
            </div>
          )}
        </div>

        {/* Coach */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-team-gold text-sm leading-none">★</span>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.32em] uppercase text-muted">
              Coach
            </span>
          </div>
          <div
            className={`text-sm font-semibold truncate ${s.text} ${coach && isOffline(coach.id) ? "opacity-40" : ""}`}
          >
            {coach?.display_name ?? "—"}
            {coach && coach.id === playerId && (
              <span className="text-muted text-xs ml-1 font-normal">(you)</span>
            )}
          </div>
        </div>

        {/* Players */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm leading-none ${s.text}`}>●</span>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.32em] uppercase text-muted">
              Players
            </span>
          </div>
          {players.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {players.map((m) => (
                <li
                  key={m.id}
                  className={`text-sm text-ink truncate ${isOffline(m.id) ? "opacity-40" : ""}`}
                >
                  {m.display_name}
                  {m.id === playerId && (
                    <span className="text-muted text-xs ml-1 font-normal">
                      (you)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted opacity-40 italic">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
