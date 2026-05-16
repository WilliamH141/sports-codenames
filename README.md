# Sports Codenames

Multiplayer Codenames clone using sports player names instead of word cards.
NBA-only for now; structured so other sports drop in as JSON files.

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase
(Postgres + Realtime). Game state lives entirely in Supabase; mutations go
through Server Actions using the service role key.

## Setup

1. Install deps:
   ```bash
   npm install
   ```

2. Create a Supabase project (free tier is fine) and apply the schema:
   - Open the SQL editor in Supabase
   - Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql)
   - Run it once

3. Configure env vars:
   ```bash
   cp .env.local.example .env.local
   ```
   Then fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   and `SUPABASE_SERVICE_ROLE_KEY` from Supabase → Settings → API.

4. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Local multi-player testing

Open the app in two browsers (or one + incognito). Create a room in window
A, copy the 4-character code, and join from window B. Pick teams + roles in
the lobby; click **Start game** once each team has a spymaster and a
guesser.

## Project layout

- `app/` — routes + server actions (`actions.ts`)
- `components/` — UI only, no game logic
- `lib/game/` — pure game logic (deal, rules, codes)
- `lib/supabase/` — server (service-role) + browser (anon) clients
- `data/` — `<sport>.json` player pools (currently `nba.json`)
- `supabase/schema.sql` — one-off Postgres schema + RLS + Realtime

## Adding a sport

1. Drop a JSON array of names into `data/<sport>.json` (≥25 entries).
2. Register it in `lib/game/deal.ts`'s `POOLS` map.
3. The `sport` column on `rooms` already flows through; no further changes
   needed.
