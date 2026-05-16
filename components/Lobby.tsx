"use client";

import { useTransition } from "react";
import { setTeamRole, startGame } from "@/app/actions";
import type { Player, Role, Team } from "@/lib/types";

type Props = {
  roomId: string;
  code: string;
  playerId: string;
  players: Player[];
};

const TEAM_BG: Record<Team, string> = {
  red: "bg-red-50 ring-red-200",
  blue: "bg-blue-50 ring-blue-200",
};
const TEAM_TEXT: Record<Team, string> = {
  red: "text-red-700",
  blue: "text-blue-700",
};

export default function Lobby({ roomId, code, playerId, players }: Props) {
  const [pending, startTransition] = useTransition();
  const me = players.find((p) => p.id === playerId);

  const takeSeat = (team: Team | null, role: Role | null) =>
    startTransition(async () => {
      try {
        await setTeamRole({ roomId, playerId, team, role });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

  const onStart = () =>
    startTransition(async () => {
      try {
        await startGame(roomId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });

  const teamsReady = (["red", "blue"] as Team[]).every((t) => {
    const list = players.filter((p) => p.team === t);
    return (
      list.some((p) => p.role === "spymaster") &&
      list.some((p) => p.role === "guesser")
    );
  });

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lobby</h1>
          <p className="text-sm text-zinc-600">
            Share this code: <span className="font-mono font-bold text-zinc-900 text-base">{code}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={pending || !teamsReady}
          onClick={onStart}
          className="rounded-md bg-zinc-900 text-white px-4 py-2 font-medium disabled:opacity-40"
        >
          Start game
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["red", "blue"] as Team[]).map((team) => {
          const teamPlayers = players.filter((p) => p.team === team);
          const spymasters = teamPlayers.filter((p) => p.role === "spymaster");
          const guessers = teamPlayers.filter((p) => p.role === "guesser");
          const spymasterTaken =
            spymasters.length > 0 && !spymasters.some((p) => p.id === playerId);
          const meIsThisTeam = me?.team === team;

          return (
            <div key={team} className={`rounded-md ring-1 ${TEAM_BG[team]} p-3`}>
              <h2 className={`font-semibold capitalize text-lg ${TEAM_TEXT[team]}`}>
                {team} team
              </h2>

              <div className="mt-2 text-xs text-zinc-600">Spymaster</div>
              <ul className="text-sm min-h-[1.25rem]">
                {spymasters.length === 0 && <li className="text-zinc-400">—</li>}
                {spymasters.map((p) => (
                  <li key={p.id} className="truncate">
                    {p.display_name}
                    {p.id === playerId && <span className="text-zinc-500"> (you)</span>}
                  </li>
                ))}
              </ul>

              <div className="mt-2 text-xs text-zinc-600">Guessers</div>
              <ul className="text-sm min-h-[1.25rem]">
                {guessers.length === 0 && <li className="text-zinc-400">—</li>}
                {guessers.map((p) => (
                  <li key={p.id} className="truncate">
                    {p.display_name}
                    {p.id === playerId && <span className="text-zinc-500"> (you)</span>}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || spymasterTaken}
                  onClick={() => takeSeat(team, "spymaster")}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-zinc-100"
                >
                  Be spymaster
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => takeSeat(team, "guesser")}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-zinc-100"
                >
                  Be guesser
                </button>
                {meIsThisTeam && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => takeSeat(null, null)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-600 disabled:opacity-40 hover:bg-zinc-100"
                  >
                    Leave seat
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-700">In the room</h3>
        <ul className="text-sm text-zinc-700">
          {players.map((p) => (
            <li key={p.id} className="truncate">
              {p.display_name}
              {p.id === playerId && <span className="text-zinc-500"> (you)</span>}
              {p.team && (
                <span className={`ml-2 text-xs ${TEAM_TEXT[p.team]}`}>
                  {p.team} {p.role ?? ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {!teamsReady && (
        <p className="text-sm text-zinc-500">
          Both teams need at least one spymaster and one guesser to start.
        </p>
      )}
    </div>
  );
}
