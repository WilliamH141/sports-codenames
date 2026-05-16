-- One-time migration: rename players → members, rename role values.
-- Run this against your existing Supabase project in the SQL editor.
-- Safe to re-run? No — only run once. After this, use schema.sql for fresh setups.

-- 1. Rename the table.
alter table public.players rename to members;

-- 2. Rename FK indexes / constraints so they reflect the new name.
alter index if exists players_room_idx rename to members_room_idx;

-- 3. Update role values BEFORE swapping the CHECK constraint.
alter table public.members
  drop constraint if exists players_role_check;

update public.members set role = 'coach'  where role = 'spymaster';
update public.members set role = 'player' where role = 'guesser';

alter table public.members
  add constraint members_role_check
  check (role in ('coach', 'player'));

-- 4. Update the Realtime publication: drop the old name, add the new one.
--    (Postgres renames usually carry over but Realtime's publication can stick.)
do $$
begin
  begin
    alter publication supabase_realtime drop table public.players;
  exception when undefined_table then
    null;  -- already gone, fine
  end;
end$$;
alter publication supabase_realtime add table public.members;
