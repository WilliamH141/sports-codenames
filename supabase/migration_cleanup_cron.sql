-- Idle / stale room cleanup. Run this once in the Supabase SQL editor.
-- Requires pg_cron, which is enabled by default on all Supabase projects.
--
-- Schedule: every hour at minute 0, delete:
--   * lobby rooms older than 6 hours   (created but never started)
--   * playing rooms older than 12 hours (abandoned mid-game)
--   * finished rooms older than 1 hour  (game over, no one needs it)
--
-- Cascade deletes wipe cards/clues/members/card_tags/guesses for each room.

select cron.schedule(
  'cleanup-stale-rooms',
  '0 * * * *',
  $$
  delete from public.rooms
  where (status = 'lobby'    and created_at < now() - interval '6 hours')
     or (status = 'playing'  and created_at < now() - interval '12 hours')
     or (status = 'finished' and created_at < now() - interval '1 hour');
  $$
);

-- To inspect / verify the schedule later:
--   select * from cron.job where jobname = 'cleanup-stale-rooms';
--
-- To unschedule (if you ever need to):
--   select cron.unschedule('cleanup-stale-rooms');
