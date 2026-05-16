@AGENTS.md
# Sports Codenames

## What this is
Multiplayer Codenames clone using sports player names instead of word cards.
Two teams, one spymaster per team gives one-word clues linking multiple players
on the board. Teammates guess which players match. First team to find all 
their players wins. Join via room code, no accounts needed.

## Stack
- Next.js 16, TypeScript, Tailwind CSS
- Supabase for DB + realtime subscriptions
- Deployed on Vercel
- Start with NBA players, built to support other sports later

## Structure
- /app → routes
- /components → UI only, no logic
- /lib → game logic, Supabase client, data utils
- /data → static player JSON

## Rules
- Don't install packages without asking first
- Mobile-first UI
- Game state lives in Supabase, not in memory
- Keep components small, one job each
- Sport should be a parameter everywhere, never hardcode NBA