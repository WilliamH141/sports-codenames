-- Hide unrevealed card colors from anon clients.
--
-- Before this migration, anyone with the room code could SELECT cards.card_type
-- directly (RLS allowed it) or read it from Supabase Realtime UPDATE payloads.
-- That meant a regular player could open DevTools and see the spymaster grid.
--
-- After: card_type is service-role-only. A new revealed_card_type column carries
-- the color of a card AFTER it's flipped, so all viewers can still see what was
-- just revealed. The full key is delivered through server actions (getCoachKey,
-- getFinalKey) that gate on member role / room status.

alter table public.cards
  add column if not exists revealed_card_type text
  check (revealed_card_type is null or revealed_card_type in ('red','blue','neutral','assassin'));

-- Backfill any cards already revealed in existing rooms.
update public.cards
   set revealed_card_type = card_type
 where revealed = true and revealed_card_type is null;

-- Lock card_type down to service role only. Anon + authenticated keep SELECT
-- on every OTHER column so the existing realtime + page queries still work.
revoke select on public.cards from anon, authenticated;
grant select (id, room_id, position, player_name, revealed, revealed_by_team, revealed_card_type)
  on public.cards
  to anon, authenticated;
