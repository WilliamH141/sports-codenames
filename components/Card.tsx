"use client";

import type { Card as CardModel, CardType } from "@/lib/types";

type Props = {
  card: CardModel;
  showKey: boolean; // coach view OR game over
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

export default function Card({ card, showKey, clickable, onClick }: Props) {
  const canTap = clickable && !card.revealed;
  const frontTileClass = showKey ? `tile ${KEY_CLASS[card.card_type]}` : "tile";
  const backTileClass = `tile ${REVEALED_CLASS[card.card_type]}`;

  return (
    <button
      type="button"
      disabled={!canTap}
      onClick={() => onClick?.(card)}
      style={{ animationDelay: `${card.position * 18}ms` }}
      className={`flipper tile-enter aspect-[5/3] sm:aspect-[7/4] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-team-gold ${canTap ? "flipper-tap cursor-pointer" : "cursor-default"}`}
    >
      <div className={`flipper-inner ${card.revealed ? "flipper-flipped" : ""}`}>
        <div className={`face face-front ${frontTileClass}`}>
          <Nameplate
            name={card.player_name}
            variant={card.card_type}
            tag={null}
          />
        </div>
        <div className={`face face-back ${backTileClass}`}>
          <Nameplate
            name={card.player_name}
            variant={card.card_type}
            tag={REVEAL_TAG[card.card_type]}
          />
        </div>
      </div>
    </button>
  );
}

function Nameplate({
  name,
  tag,
}: {
  name: string;
  variant: CardType;
  tag: string | null;
}) {
  const { first, last } = splitName(name);

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
      {tag && (
        <span className="mt-1 font-[family-name:var(--font-display)] font-bold uppercase text-[7px] sm:text-[9px] tracking-[0.32em] leading-none opacity-90">
          {tag}
        </span>
      )}
    </div>
  );
}
