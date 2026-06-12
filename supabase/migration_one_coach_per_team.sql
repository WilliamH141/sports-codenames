-- Enforce "one coach per team per room" at the DB level. The setTeamRole
-- server action does a read-then-update check, but two clients clicking the
-- same Coach seat simultaneously can both pass the check and both succeed.
-- This partial unique index turns the second update/insert into a clean
-- 23505 the caller can surface as "already has a coach".

create unique index if not exists members_one_coach_per_team
  on public.members (room_id, team)
  where role = 'coach';
