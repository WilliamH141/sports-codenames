"use client";

import type { Card as CardModel, CardType } from "@/lib/types";

type Props = {
  card: CardModel;
  showKey: boolean; // spymaster view OR game over
  clickable: boolean;
  onClick?: (card: CardModel) => void;
};

const REVEALED_STYLE: Record<CardType, string> = {
  red: "bg-red-500 text-white",
  blue: "bg-blue-500 text-white",
  neutral: "bg-zinc-300 text-zinc-700",
  assassin: "bg-zinc-900 text-white",
};

const KEY_TINT: Record<CardType, string> = {
  red: "bg-red-200 text-red-950 ring-red-300",
  blue: "bg-blue-200 text-blue-950 ring-blue-300",
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  assassin: "bg-zinc-800 text-white ring-zinc-600",
};

export default function Card({ card, showKey, clickable, onClick }: Props) {
  let className =
    "aspect-[5/3] sm:aspect-[7/4] rounded-md ring-1 ring-zinc-300 flex items-center justify-center px-1 sm:px-2 text-center text-[11px] sm:text-sm font-medium leading-tight select-none transition";

  if (card.revealed) {
    className += ` ${REVEALED_STYLE[card.card_type]} opacity-90`;
  } else if (showKey) {
    className += ` ${KEY_TINT[card.card_type]}`;
  } else {
    className += " bg-white text-zinc-900";
  }

  if (clickable && !card.revealed) {
    className += " cursor-pointer hover:ring-2 hover:ring-zinc-900 active:scale-[0.98]";
  }

  return (
    <button
      type="button"
      disabled={!clickable || card.revealed}
      onClick={() => onClick?.(card)}
      className={className}
    >
      <span className="truncate w-full">{card.player_name}</span>
    </button>
  );
}
