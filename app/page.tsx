import { redirect } from "next/navigation";
import { createRoom } from "@/app/actions";

async function joinByCode(formData: FormData) {
  "use server";
  const raw = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!raw) return;
  redirect(`/room/${encodeURIComponent(raw)}`);
}

async function createNbaRoom() {
  "use server";
  await createRoom("nba");
}

export default function Home() {
  return (
    <main className="relative min-h-dvh flex flex-col">
      {/* Top scoreboard chrome */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-border/70 backdrop-blur-[2px]">
        <div className="flex items-center gap-3">
          <span className="chip-gold inline-flex items-center px-2.5 py-1 font-[family-name:var(--font-display)] text-[11px] font-black tracking-[0.22em] uppercase">
            NBA
          </span>
          <span className="hidden sm:inline font-[family-name:var(--font-display)] text-sm font-black tracking-[0.22em] uppercase text-ink">
            Sports Codenames
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <span className="ping-dot inline-block w-2 h-2 rounded-full bg-team-red" />
          <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-[0.28em] uppercase">
            LIVE · v0.1
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:py-16">
        <div className="w-full max-w-md flex flex-col stagger">
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5 self-center">
            <span className="w-6 h-0.5 bg-team-gold rounded-full" />
            <span className="font-[family-name:var(--font-display)] text-xs font-black tracking-[0.4em] uppercase text-team-gold">
              NBA Edition
            </span>
            <span className="w-6 h-0.5 bg-team-gold rounded-full" />
          </div>

          {/* Big headline — chunky condensed broadcast type */}
          <h1 className="mt-4 font-[family-name:var(--font-display)] font-black uppercase text-center text-ink leading-[0.85] text-[clamp(4.5rem,18vw,7.5rem)] tracking-[-0.01em]">
            Codenames
          </h1>

          {/* Team rule (red | gold | blue) */}
          <div className="vs-rule mt-5" />

          {/* Flavor copy */}
          <p className="mt-7 text-center text-muted text-sm leading-relaxed mx-auto max-w-xs">
            Two teams. One coach each.{" "}
            <span className="text-ink font-semibold">Find your roster.</span>{" "}
            <span className="text-team-red font-semibold">Dodge the assassin.</span>
          </p>

          {/* Primary CTA */}
          <form action={createNbaRoom} className="mt-9">
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
          <div className="mt-7 flex items-center gap-3">
            <span className="flex-1 h-px bg-border" />
            <span className="font-[family-name:var(--font-display)] text-[11px] font-bold tracking-[0.4em] uppercase text-dim">
              or join with code
            </span>
            <span className="flex-1 h-px bg-border" />
          </div>

          {/* Code entry */}
          <form action={joinByCode} className="mt-4 flex gap-2">
            <input
              name="code"
              type="text"
              maxLength={6}
              placeholder="XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="card-surface flex-1 px-4 py-4 font-[family-name:var(--font-display)] font-black text-3xl sm:text-4xl tracking-[0.45em] text-center text-ink uppercase placeholder:text-dim/50 outline-none transition-shadow caret-team-blue focus:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_2px_var(--color-team-blue),0_0_36px_-8px_rgba(77,142,255,0.55)]"
              required
            />
            <button
              type="submit"
              className="card-surface px-5 font-[family-name:var(--font-display)] tracking-[0.22em] text-sm font-black uppercase text-muted hover:text-team-blue transition-all cursor-pointer hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_2px_var(--color-team-blue),0_14px_38px_-22px_rgba(0,0,0,0.8)]"
              aria-label="Join room"
            >
              Join →
            </button>
          </form>
        </div>
      </div>

      {/* Footer ticker */}
      <footer className="px-5 sm:px-8 py-3 flex items-center justify-between text-[10px] sm:text-xs text-dim font-[family-name:var(--font-display)] uppercase tracking-[0.28em] font-bold border-t border-border/40">
        <span>25 cards · 4-char code · realtime</span>
        <span className="hidden sm:inline">classic 9·8·7·1 split</span>
        <span>made for friends on call</span>
      </footer>
    </main>
  );
}
