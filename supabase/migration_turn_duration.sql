-- Add per-room configurable turn duration. NULL = no timer (turns never expire
-- automatically). Numeric value = seconds-per-turn shot clock.
-- Default 90 matches the prior hardcoded shot clock.
-- Safe to run once on an existing DB.

alter table public.rooms
  add column if not exists turn_duration_seconds int default 90
  check (turn_duration_seconds is null or turn_duration_seconds between 10 and 600);

-- Backfill existing rows that pre-dated the column with the prior default.
update public.rooms set turn_duration_seconds = 90 where turn_duration_seconds is null;
