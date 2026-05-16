"use client";

import type { Card as CardModel, CardType } from "@/lib/types";

type Props = {
  card: CardModel;
  showKey: boolean; // spymaster view OR game over
  clickable: boolean;
  onClick?: (card: CardModel) => void;
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

function splitName(full: string): { first: string; last: string } {
  const idx = full.indexOf(" ");
  if (idx === -1) return { first: "", last: full };
  return { first: full.slice(0, idx), last: full.slice(idx + 1) };
}

export default function Card({ card, showKey, clickable, onClick }: Props) {
  const surface = card.revealed
    ? `tile ${REVEALED_CLASS[card.card_type]}`
    : showKey
      ? `tile ${KEY_CLASS[card.card_type]}`
      : "tile";

  const canTap = clickable && !card.revealed;

  return (
    <button
      type="button"
      disabled={!canTap}
      onClick={() => onClick?.(card)}
      style={{ animationDelay: `${card.position * 18}ms` }}
      className={`${surface} ${canTap ? "clickable cursor-pointer" : "cursor-default"} tile-enter aspect-[5/3] sm:aspect-[7/4] rounded-md flex items-center justify-center px-1 sm:px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-team-gold`}
    >
      <Nameplate
        name={card.player_name}
        variant={card.card_type}
        revealed={card.revealed}
      />
    </button>
  );
}

function Nameplate({
  name,
  variant,
  revealed,
}: {
  name: string;
  variant: CardType;
  revealed: boolean;
}) {
  const { first, last } = splitName(name);
  const showAssassinTag = revealed && variant === "assassin";

  return (
    <div className="flex flex-col items-center justify-center w-full px-0.5">
      {first && (
        <span className="font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.06em] leading-none text-[8px] sm:text-[10px] opacity-75">
          {first}
        </span>
      )}
      <span className="mt-0.5 font-[family-name:var(--font-display)] font-black uppercase tracking-[-0.01em] leading-[0.92] text-balance text-center text-[13px] sm:text-[19px] line-clamp-2">
        {last}
      </span>
      {showAssassinTag && (
        <span className="mt-1 font-[family-name:var(--font-display)] font-bold uppercase text-[7px] sm:text-[9px] tracking-[0.32em] leading-none">
          ✗ Assassin
        </span>
      )}
    </div>
  );
}
