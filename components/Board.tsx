"use client";

import { useMemo } from "react";
import type {
  Card as CardModel,
  CardTag,
  Member,
  Role,
  Team,
} from "@/lib/types";
import Card from "./Card";

type Props = {
  cards: CardModel[];
  members: Member[];
  tags: CardTag[];
  playerId: string;
  viewerRole: Role | null;
  viewerTeam: Team | null;
  currentTeam: Team | null;
  gameOver: boolean;
  awaitingClue: boolean;
  /** True while a reveal is in flight; disables further taps to prevent races. */
  locked?: boolean;
  onCardClick: (card: CardModel) => void;
  onToggleTag: (card: CardModel) => void;
};

export type CardTagInfo = {
  memberId: string;
  initial: string;
  displayName: string;
  isMe: boolean;
};

export default function Board({
  cards,
  members,
  tags,
  playerId,
  viewerRole,
  viewerTeam,
  currentTeam,
  gameOver,
  awaitingClue,
  locked = false,
  onCardClick,
  onToggleTag,
}: Props) {
  const showKey = gameOver || viewerRole === "coach";
  const sorted = [...cards].sort((a, b) => a.position - b.position);

  const canClick =
    !locked &&
    !gameOver &&
    !awaitingClue &&
    viewerRole === "player" &&
    viewerTeam !== null &&
    viewerTeam === currentTeam;

  // Tagging is allowed whenever it's the viewer's team's guess phase — same
  // permission window as clicking to reveal, but without the locked guard
  // (tags are cheap, don't race the reveal flow).
  const canTag =
    !gameOver &&
    !awaitingClue &&
    viewerRole === "player" &&
    viewerTeam !== null &&
    viewerTeam === currentTeam;

  const tagsByCard = useMemo(() => {
    const memberById = new Map(members.map((m) => [m.id, m]));
    const map = new Map<string, CardTagInfo[]>();
    for (const tag of tags) {
      const m = memberById.get(tag.member_id);
      if (!m) continue;
      const initial = (m.display_name.trim()[0] ?? "?").toUpperCase();
      const info: CardTagInfo = {
        memberId: m.id,
        initial,
        displayName: m.display_name,
        isMe: m.id === playerId,
      };
      const arr = map.get(tag.card_id);
      if (arr) arr.push(info);
      else map.set(tag.card_id, [info]);
    }
    return map;
  }, [tags, members, playerId]);

  return (
    <div
      className={`grid grid-cols-5 gap-1.5 sm:gap-2 w-full transition-opacity ${locked ? "opacity-80" : ""}`}
    >
      {sorted.map((card) => {
        const cardTags = tagsByCard.get(card.id) ?? [];
        const myTag = cardTags.some((t) => t.isMe);
        return (
          <Card
            key={card.id}
            card={card}
            showKey={showKey}
            gameOver={gameOver}
            clickable={canClick}
            tags={cardTags}
            taggable={canTag}
            myTag={myTag}
            tagTeam={currentTeam}
            onClick={onCardClick}
            onToggleTag={onToggleTag}
          />
        );
      })}
    </div>
  );
}
