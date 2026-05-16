"use client";

import { useTransition } from "react";
import { setTeamRole } from "@/app/actions";
import type { Player, Role, Team } from "@/lib/types";

type Props = {
  roomId: string;
  playerId: string;
  players: Player[];
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
  red: "hover:border-team-red",
  blue: "hover:border-team-blue",
};

export default function SeatPicker({ roomId, playerId, players }: Props) {
  const [pending, startTransition] = useTransition();

  const take = (team: Team, role: Role) =>
    startTransition(async () => {
      try {
        await setTeamRole({ roomId, playerId, team, role });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

  const spyTaken = (t: Team) =>
    players.some(
      (p) => p.team === t && p.role === "spymaster" && p.id !== playerId
    );

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
          const spyLocked = spyTaken(team);
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
                  {spyLocked && (
                    <span className="font-[family-name:var(--font-display)] text-[8px] font-bold tracking-[0.3em] uppercase text-dim">
                      spy filled
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={pending || spyLocked}
                    onClick={() => take(team, "spymaster")}
                    className="flex-1 py-1.5 px-2 rounded font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.2em] uppercase border border-border bg-bg-deep/40 text-ink hover:bg-bg-deep hover:border-team-gold disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-bg-deep/40 disabled:hover:border-border transition-colors cursor-pointer"
                  >
                    ★ Spy
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => take(team, "guesser")}
                    className={`flex-1 py-1.5 px-2 rounded font-[family-name:var(--font-display)] text-[10px] font-black tracking-[0.2em] uppercase border border-border bg-bg-deep/40 text-ink hover:bg-bg-deep ${TEAM_HOVER[team]} disabled:opacity-30 transition-colors cursor-pointer`}
                  >
                    ● Guess
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
