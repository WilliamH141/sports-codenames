-- Fix: filtered DELETE events were being dropped by Supabase Realtime because
-- by default only the primary key is included in DELETE payloads, so server-side
-- filters on non-PK columns (e.g. room_id=eq.X) can't be evaluated.
-- Setting replica identity FULL includes all columns in the WAL row for
-- UPDATE/DELETE, so filters work as expected on those events too.

alter table public.cards    replica identity full;
alter table public.clues    replica identity full;
alter table public.members  replica identity full;
alter table public.guesses  replica identity full;
