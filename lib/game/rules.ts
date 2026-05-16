import type { Card, CardType, Team } from "@/lib/types";

export const otherTeam = (t: Team): Team => (t === "red" ? "blue" : "red");

export function teamTargetCount(team: Team, startingTeam: Team): number {
  return team === startingTeam ? 9 : 8;
}

export function teamRevealedCount(cards: Card[], team: Team): number {
  return cards.filter((c) => c.card_type === team && c.revealed).length;
}

export function teamHasWon(
  cards: Card[],
  team: Team,
  startingTeam: Team
): boolean {
  return teamRevealedCount(cards, team) >= teamTargetCount(team, startingTeam);
}

/**
 * Outcome of revealing a card, expressed as the deltas the caller should
 * apply on top of the current room/cards rows.
 */
export type GuessOutcome = {
  endsTurn: boolean;
  decrementsGuess: boolean;
  winner: Team | null;
  status: "playing" | "finished";
};

export function evaluateGuess(args: {
  cardType: CardType;
  currentTeam: Team;
  startingTeam: Team;
  /** Card list AFTER applying this reveal (so win checks include it). */
  cardsAfterReveal: Card[];
  guessesRemainingBefore: number;
}): GuessOutcome {
  const { cardType, currentTeam, startingTeam, cardsAfterReveal, guessesRemainingBefore } = args;

  if (cardType === "assassin") {
    return {
      endsTurn: true,
      decrementsGuess: false,
      winner: otherTeam(currentTeam),
      status: "finished",
    };
  }

  // Win-by-completion check happens regardless of which team's card was tapped.
  const redDone = teamHasWon(cardsAfterReveal, "red", startingTeam);
  const blueDone = teamHasWon(cardsAfterReveal, "blue", startingTeam);
  if (redDone || blueDone) {
    return {
      endsTurn: true,
      decrementsGuess: false,
      winner: redDone ? "red" : "blue",
      status: "finished",
    };
  }

  if (cardType === currentTeam) {
    const next = guessesRemainingBefore - 1;
    return {
      endsTurn: next <= 0,
      decrementsGuess: true,
      winner: null,
      status: "playing",
    };
  }

  // Neutral or opposing team's color — turn ends, no win.
  return { endsTurn: true, decrementsGuess: false, winner: null, status: "playing" };
}
