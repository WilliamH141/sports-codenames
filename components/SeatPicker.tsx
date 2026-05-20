"use client";

import { useTransition } from "react";
import { setTeamRole } from "@/app/actions";
import type { Member, Role, Team } from "@/lib/types";

type Props = {
  roomId: string;
  playerId: string;
  members: Member[];
  onlineMemberIds?: Set<string>;
  presenceLoaded?: boolean;
};

const TEAM_TEXT: Record<Team, string> = {
  red: "text-team-red",
  blue: "text-team-blue",
};
const TEAM_BAND: Record<Team, string> = {
  red: "bg-team-red",
  blue: "bg-team-blue",
};
const TEAM_HOVER: Record<Team, string> = {
  red: "enabled:hover:border-team-red enabled:hover:text-team-red",
  blue: "enabled:hover:border-team-blue enabled:hover:text-team-blue",
};

export default function SeatPicker({
  roomId,
  playerId,
  members,
  onlineMemberIds,
  presenceLoaded = false,
}: Props) {
  const [pending, startTransition] = useTransition();

  const isOnline = (id: string) =>
    !presenceLoaded || onlineMemberIds == null || onlineMemberIds.has(id);

  // Current coach of team t, if any, ignoring this player.
  const currentCoach = (t: Team) =>
    members.find(
      (m) => m.team === t && m.role === "coach" && m.id !== playerId
    );

  // The coach seat is "taken" only if a different member holds it AND they're
  // online. Offline holders are treated as having vacated the seat — we'll
  // pass `force: true` to the server so it kicks them on claim.
  const coachOnlineHeld = (t: Team) => {
    const holder = currentCoach(t);
    return holder != null && isOnline(holder.id);
  };

  const take = (team: Team, role: Role) => {
    let force = false;
    if (role === "coach") {
      const holder = currentCoach(team);
      if (holder && !isOnline(holder.id)) force = true;
    }
    startTransition(async () => {
      try {
        await setTeamRole({ roomId, playerId, team, role, force });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <div className="card-surface rounded-md p-3 sm:p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="w-5 h-0.5 bg-team-gold rounded-full" />
        <span className="font-[family-name:var(--font-display)] text-[10px] sm:text-[11px] font-black tracking-[0.35em] uppercase text-team-gold">
          Pick a seat — game in progress
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {(["red", "blue"] as Team[]).map((team) => {
          const coachLocked = coachOnlineHeld(team);
          return (
            <div
              key={team}
              className="card-surface overflow-hidden rounded"
            >
              <div className={`h-[3px] ${TEAM_BAND[team]}`} />
              <div className="p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-[family-name:var(--font-display)] font-black uppercase text-lg sm:text-xl leading-none ${TEAM_TEXT[team]}`}
                  >
                    {team}
                  </span>
                  {coachLocked && (
                    <span className="font-[family-name:var(--font-display)] text-[8px] font-bold tracking-[0.3em] uppercase text-dim">
                      coach filled
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={pending || coachLocked}
                    onClick={() => take(team, "coach")}
                    className="sticker-btn flex-1 py-1.5 px-2 rounded font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.2em] uppercase border-border bg-surface text-ink enabled:hover:border-team-gold enabled:hover:text-team-gold cursor-pointer disabled:cursor-not-allowed"
                  >
                    ★ Coach
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => take(team, "player")}
                    className={`sticker-btn flex-1 py-1.5 px-2 rounded font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.2em] uppercase border-border bg-surface text-ink ${TEAM_HOVER[team]} cursor-pointer disabled:cursor-not-allowed`}
                  >
                    ● Player
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
