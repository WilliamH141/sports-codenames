"use client";

import { useActionState } from "react";

export type JoinByCodeState = { error: string | null };

type Props = {
  action: (
    state: JoinByCodeState,
    formData: FormData
  ) => Promise<JoinByCodeState>;
};

/**
 * Home-page "Join with code" form. Wraps a server action via useActionState so
 * a bad/missing/typo'd code shows up as inline red text under the input — the
 * user can fix and retry without leaving the page. The dedicated 404 page is
 * still there for direct-link visits to a non-existent room.
 */
export default function JoinCodeForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<JoinByCodeState, FormData>(
    action,
    { error: null }
  );

  return (
    <form action={formAction} className="mt-4 w-full flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="code"
          type="text"
          maxLength={6}
          placeholder="XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={state.error ? true : undefined}
          className="card-surface flex-1 px-4 py-4 font-[family-name:var(--font-display)] font-black text-3xl sm:text-4xl tracking-[0.45em] text-center text-ink uppercase placeholder:text-dim/50 outline-none transition-shadow caret-team-gold focus:border-team-gold focus:[box-shadow:5px_5px_0_0_#000,0_0_28px_-6px_rgba(253,185,39,0.55)]"
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="cta-blue px-5 font-[family-name:var(--font-display)] tracking-[0.22em] text-sm font-black uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Join room"
        >
          {pending ? "..." : "Join →"}
        </button>
      </div>
      {state.error && (
        <p
          role="alert"
          className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.25em] uppercase text-team-red"
        >
          ✕ {state.error}
        </p>
      )}
    </form>
  );
}
