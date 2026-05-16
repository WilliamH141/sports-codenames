"use client";

import { useState } from "react";

type Props = {
  initialName?: string;
  onSubmit: (name: string) => void;
};

export default function JoinModal({ initialName = "", onSubmit }: Props) {
  const [name, setName] = useState(initialName);
  return (
    <div className="fixed inset-0 bg-black/40 z-10 flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
        }}
        className="bg-white rounded-lg shadow-xl p-5 w-full max-w-sm flex flex-col gap-3"
      >
        <h2 className="text-lg font-semibold">Pick a display name</h2>
        <p className="text-sm text-zinc-600">Everyone else in the room will see this.</p>
        <input
          autoFocus
          type="text"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="e.g. William"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 text-white px-4 py-2 font-medium disabled:opacity-50"
          disabled={!name.trim()}
        >
          Join
        </button>
      </form>
    </div>
  );
}
