"use client";

import type { Card as CardModel, CardType, Team } from "@/lib/types";
import type { CardTagInfo } from "./Board";

type Props = {
  card: CardModel;
  /** True color for this card, or null when the viewer isn't authorized to see
      it (regular players during play). Used to tint the front face when showKey
      is on. Doesn't affect the back face — that uses revealed_card_type, which
      is always populated server-side at the moment of reveal. */
  keyType: CardType | null;
  showKey: boolean; // coach view OR game over
  /** True when the game has finished. Triggers the cascade-flip reveal of
      every card that wasn't manually flipped during play. */
  gameOver: boolean;
  clickable: boolean;
  /** True when the viewer can place/remove their own tag on unrevealed cards. */
  taggable: boolean;
  /** True when the viewer currently has this card tagged. */
  myTag: boolean;
  /** Current team — used to color the flag chip + tag badges. */
  tagTeam: Team | null;
  tags: CardTagInfo[];
  onClick?: (card: CardModel) => void;
  onToggleTag?: (card: CardModel) => void;
};

const REVEALED_CLASS: Record<CardType, string> = {
  red: "tile-revealed-red",
  blue: "tile-revealed-blue",
  neutral: "tile-revealed-neutral",
  assassin: "tile-revealed-assassin",
};

const KEY_CLASS: Record<CardType, string> = {
  red: "tile-key-red",
  blue: "tile-key-blue",
  neutral: "tile-key-neutral",
  assassin: "tile-key-assassin",
};

const REVEAL_TAG: Record<CardType, string> = {
  red: "★ Red",
  blue: "★ Blue",
  neutral: "· Bench ·",
  assassin: "✗ Assassin",
};

function splitName(full: string): { first: string; last: string } {
  const idx = full.indexOf(" ");
  if (idx === -1) return { first: "", last: full };
  return { first: full.slice(0, idx), last: full.slice(idx + 1) };
}

export default function Card({
  card,
  keyType,
  showKey,
  gameOver,
  clickable,
  taggable,
  myTag,
  tagTeam,
  tags,
  onClick,
  onToggleTag,
}: Props) {
  const canTap = clickable && !card.revealed;
  const canFlag = taggable && !card.revealed;
  // Front face color: only when authorized + key has loaded. Back face color:
  // populated when revealed; falls back to `keyType` if a viewer who just
  // gained authorization is looking at an already-revealed card (rare, since
  // revealed_card_type is set at reveal time).
  const frontTileClass =
    showKey && keyType ? `tile ${KEY_CLASS[keyType]}` : "tile";
  const backType: CardType =
    card.revealed_card_type ?? keyType ?? "neutral";
  const backTileClass = `tile ${REVEALED_CLASS[backType]}`;
  // Flip when the card was revealed during play OR when the game ended (in
  // which case we auto-reveal every remaining card). Cards that flip from
  // game-end get a staggered transition-delay so the board reveals as a
  // left-to-right cascade — feels like a final scoreboard reveal instead of
  // an instant state change.
  const flipped = card.revealed || gameOver;
  const flipDelayMs =
    gameOver && !card.revealed ? 80 + card.position * 50 : 0;
  const teamColor = tagTeam === "red" ? "bg-team-red" : "bg-team-blue";
  const teamText = tagTeam === "red" ? "text-team-red" : "text-team-blue";
  // Modifier class on the tap target so hover styles can outline the card
  // in the viewer's team color — reinforces "this is your team's pick"
  // at the moment of commitment.
  const tapTeamClass = canTap
    ? tagTeam === "red"
      ? "tap-red"
      : tagTeam === "blue"
        ? "tap-blue"
        : ""
    : "";

  return (
    <div
      style={{ animationDelay: `${card.position * 18}ms` }}
      className="relative tile-enter aspect-[5/3] sm:aspect-[7/4]"
    >
      <button
        type="button"
        disabled={!canTap}
        onClick={() => onClick?.(card)}
        className={`flipper absolute inset-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-team-gold ${canTap ? `flipper-tap cursor-pointer ${tapTeamClass}` : "cursor-default"}`}
      >
        <div
          className={`flipper-inner ${flipped ? "flipper-flipped" : ""}`}
          style={flipDelayMs ? { transitionDelay: `${flipDelayMs}ms` } : undefined}
        >
          <div className={`face face-front ${frontTileClass}`}>
            <Nameplate name={card.player_name} tag={null} />
          </div>
          <div className={`face face-back ${backTileClass}`}>
            <Nameplate
              name={card.player_name}
              tag={REVEAL_TAG[backType]}
            />
          </div>
        </div>
      </button>

      {/* Tagger initials — bottom-left chips, visible to all. Only the front
          face shows them; once revealed the back covers them naturally. */}
      {!card.revealed && tags.length > 0 && (
        <div className="absolute bottom-1 left-1 flex flex-wrap gap-0.5 pointer-events-none max-w-[70%]">
          {tags.map((t) => (
            <span
              key={t.memberId}
              title={t.displayName}
              className={`${teamColor} ${t.isMe ? "ring-1 ring-team-gold" : ""} text-white font-[family-name:var(--font-display)] font-black uppercase text-[8px] sm:text-[9px] leading-none rounded-sm px-1 py-0.5 tracking-wide`}
            >
              {t.initial}
            </span>
          ))}
        </div>
      )}

      {/* Flag toggle — top-right corner, only renders during your team's
          guess phase on unrevealed cards. Its presence is itself the "your
          turn" signal across the board. Pin SVG (not a star) keeps it
          visually distinct from the coach-star icon used elsewhere. */}
      {canFlag && (
        <button
          type="button"
          aria-label={myTag ? "Remove your tag" : "Tag this card"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleTag?.(card);
          }}
          className={`absolute top-1 right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            myTag
              ? `${teamColor} text-white shadow-[0_0_0_2px_var(--color-bg-deep,#0a0f1e)]`
              : `bg-bg-deep/80 ${teamText} hover:bg-bg-deep`
          }`}
        >
          <PinIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      )}
    </div>
  );
}

function PinIcon({ className = "" }: { className?: string }) {
  // Simple map-pin shape — drop with a hollow center, reads as "your marker
  // on this card." currentColor so the parent's text class drives the fill.
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 1.5c-2.76 0-5 2.24-5 5 0 3.5 5 8 5 8s5-4.5 5-8c0-2.76-2.24-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  );
}

function Nameplate({ name, tag }: { name: string; tag: string | null }) {
  const { first, last } = splitName(name);

  return (
    <div className="flex flex-col items-center justify-center w-full px-0.5">
      {first && (
        <span className="font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.06em] leading-none text-[8px] sm:text-[10px] opacity-75">
          {first}
        </span>
      )}
      <span className="mt-0.5 font-[family-name:var(--font-display)] font-black uppercase tracking-[-0.01em] leading-[0.92] text-balance text-center text-[12px] sm:text-[18px] line-clamp-2 [overflow-wrap:anywhere]">
        {last}
      </span>
      {tag && (
        <span className="mt-1 font-[family-name:var(--font-display)] font-bold uppercase text-[7px] sm:text-[9px] tracking-[0.32em] leading-none opacity-90">
          {tag}
        </span>
      )}
    </div>
  );
}
