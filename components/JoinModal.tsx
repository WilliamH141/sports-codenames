"use client";

import { useState } from "react";

type Props = {
  initialName?: string;
  roomCode?: string;
  onSubmit: (name: string) => void;
};

export default function JoinModal({ initialName = "", roomCode, onSubmit }: Props) {
  const [name, setName] = useState(initialName);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-bg-deep/75 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
        }}
        className="card-surface w-full max-w-sm p-6 flex flex-col gap-5 stagger"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-0.5 bg-team-gold rounded-full" />
          <span className="font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.4em] uppercase text-team-gold">
            Player Check-in
          </span>
        </div>

        <div>
          <h2 className="font-[family-name:var(--font-display)] font-black uppercase text-3xl text-ink leading-tight">
            Choose a name
          </h2>
          {roomCode && (
            <p className="mt-1.5 text-sm text-muted">
              Everyone in{" "}
              <span className="font-[family-name:var(--font-display)] font-bold tracking-wider text-ink">
                {roomCode}
              </span>{" "}
              will see this.
            </p>
          )}
        </div>

        <input
          autoFocus
          type="text"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          className="card-surface px-4 py-3 text-base text-ink placeholder:text-dim outline-none caret-team-blue transition-shadow focus:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_2px_var(--color-team-blue),0_0_36px_-8px_rgba(77,142,255,0.55)]"
          placeholder="e.g. William"
        />

        <button
          type="submit"
          disabled={!name.trim()}
          className="cta-red w-full py-3.5 px-5 text-white font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-sm uppercase cursor-pointer flex items-center justify-between gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="font-mono text-xs opacity-70">▸▸</span>
          <span className="text-base">Join game</span>
          <span className="text-lg opacity-90">→</span>
        </button>
      </form>
    </div>
  );
}
