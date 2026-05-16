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
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-zinc-50">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Sports Codenames</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Codenames with NBA players. Two teams, one spymaster each.
          </p>
        </header>

        <form action={createNbaRoom} className="flex flex-col gap-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 text-white px-4 py-3 text-base font-medium"
          >
            Create NBA room
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="flex-1 h-px bg-zinc-200" />
          <span>or</span>
          <span className="flex-1 h-px bg-zinc-200" />
        </div>

        <form action={joinByCode} className="flex gap-2">
          <input
            name="code"
            type="text"
            maxLength={6}
            placeholder="ROOM CODE"
            autoCapitalize="characters"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-base font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
          <button
            type="submit"
            className="rounded-md bg-white border border-zinc-300 px-4 py-2 font-medium"
          >
            Join
          </button>
        </form>
      </div>
    </main>
  );
}
