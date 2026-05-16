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
      className={`${surface} ${canTap ? "clickable cursor-pointer" : "cursor-default"} tile-enter aspect-[5/3] sm:aspect-[7/4] rounded-md flex items-center justify-center px-1.5 sm:px-2 outline-none focus-visible:ring-2 focus-visible:ring-team-gold`}
    >
      <span className="block text-center font-semibold leading-[1.05] text-[10.5px] sm:text-[13px] tracking-tight text-balance line-clamp-3">
        {card.player_name}
      </span>
    </button>
  );
}
