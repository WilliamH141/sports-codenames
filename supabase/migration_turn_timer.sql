-- Add turn_deadline column for the per-turn countdown timer.
-- Safe to run once on an existing DB. For new setups schema.sql already includes it.

alter table public.rooms add column if not exists turn_deadline timestamptz;
