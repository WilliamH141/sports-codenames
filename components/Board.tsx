"use client";

import type { Card as CardModel, Role, Team } from "@/lib/types";
import Card from "./Card";

type Props = {
  cards: CardModel[];
  viewerRole: Role | null;
  viewerTeam: Team | null;
  currentTeam: Team | null;
  gameOver: boolean;
  awaitingClue: boolean;
  /** True while a reveal is in flight; disables further taps to prevent races. */
  locked?: boolean;
  onCardClick: (card: CardModel) => void;
};

export default function Board({
  cards,
  viewerRole,
  viewerTeam,
  currentTeam,
  gameOver,
  awaitingClue,
  locked = false,
  onCardClick,
}: Props) {
  const showKey = gameOver || viewerRole === "spymaster";
  const sorted = [...cards].sort((a, b) => a.position - b.position);

  const canClick =
    !locked &&
    !gameOver &&
    !awaitingClue &&
    viewerRole === "guesser" &&
    viewerTeam !== null &&
    viewerTeam === currentTeam;

  return (
    <div
      className={`grid grid-cols-5 gap-1.5 sm:gap-2 w-full transition-opacity ${locked ? "opacity-80" : ""}`}
    >
      {sorted.map((card) => (
        <Card
          key={card.id}
          card={card}
          showKey={showKey}
          clickable={canClick}
          onClick={onCardClick}
        />
      ))}
    </div>
  );
}
