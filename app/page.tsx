import { redirect } from "next/navigation";
import { createRoom } from "@/app/actions";
import HowToPlayButton from "@/components/HowToPlayButton";
import JoinCodeForm, { type JoinByCodeState } from "@/components/JoinCodeForm";
import { getServerSupabase } from "@/lib/supabase/server";

async function joinByCode(
  _prev: JoinByCodeState,
  formData: FormData
): Promise<JoinByCodeState> {
  "use server";
  const raw = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!raw) return { error: "Enter a room code" };
  // Cheap existence check before redirecting — if the code's bogus we keep the
  // user on the home page with an inline error instead of sending them through
  // a redirect + 404. Codes are short and indexed, so this is fast.
  const db = getServerSupabase();
  const { data: room } = await db
    .from("rooms")
    .select("code")
    .eq("code", raw)
    .maybeSingle();
  if (!room) return { error: `No game with code ${raw}` };
  redirect(`/room/${encodeURIComponent(raw)}`);
}

async function createNbaRoom() {
  "use server";
  await createRoom("nba");
}

export default function Home() {
  return (
    <main className="relative min-h-dvh flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-border/70 backdrop-blur-[2px]">
        <div className="flex items-center gap-3">
          <span className="chip-gold inline-flex items-center px-2.5 py-1 font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.22em] uppercase">
            NBA
          </span>
          <span className="hidden sm:inline font-[family-name:var(--font-display)] text-sm font-black tracking-[0.22em] uppercase text-ink">
            Sports Codenames
          </span>
        </div>
        <div className="flex items-center gap-4">
          <HowToPlayButton />
          <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-[0.28em] uppercase text-muted">
            v0.1
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:py-16">
        <div className="w-full max-w-lg mx-auto flex flex-col items-center stagger">
          {/* Big headline — chunky condensed broadcast type */}
          <h1 className="font-[family-name:var(--font-display)] font-black uppercase text-center text-ink leading-[0.85] text-[clamp(3.75rem,14vw,6rem)] tracking-[-0.01em]">
            Codenames
          </h1>

          {/* Team rule (red | gold | blue) */}
          <div className="vs-rule mt-5 w-full" />

          {/* Tagline + attribution */}
          <p className="mt-6 text-center text-muted text-sm">
            Players, teams, plays — all NBA.
          </p>
          <p className="mt-1 text-center text-dim text-xs italic">
            Inspired by Codenames.
          </p>

          {/* Primary CTA */}
          <form action={createNbaRoom} className="mt-8 w-full">
            <button
              type="submit"
              className="cta-red w-full py-4 px-5 text-white font-[family-name:var(--font-display)] font-black tracking-[0.2em] text-base uppercase cursor-pointer flex items-center justify-between gap-3"
            >
              <span className="font-mono text-xs opacity-70">▸▸</span>
              <span className="text-lg">New Game</span>
              <span className="text-xl opacity-90">→</span>
            </button>
          </form>

          {/* Divider */}
          <div className="mt-7 flex items-center gap-3 w-full">
            <span className="flex-1 h-px bg-border" />
            <span className="font-[family-name:var(--font-display)] text-[11px] font-bold tracking-[0.4em] uppercase text-dim">
              or join with code
            </span>
            <span className="flex-1 h-px bg-border" />
          </div>

          {/* Code entry */}
          <JoinCodeForm action={joinByCode} />
        </div>
      </div>
    </main>
  );
}
