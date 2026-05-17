-- Sports Codenames schema.
-- Run this once against a fresh Supabase project (SQL editor or psql).
-- For existing projects mid-migration, see migration_coach_player.sql.

create extension if not exists "pgcrypto";

create table if not exists public.rooms (
  id                   uuid primary key default gen_random_uuid(),
  code                 text unique not null,
  sport                text not null,
  status               text not null check (status in ('lobby','playing','finished')),
  starting_team        text not null check (starting_team in ('red','blue')),
  current_team         text check (current_team in ('red','blue')),
  current_clue_word    text,
  current_clue_count   int,
  guesses_remaining    int,
  winner               text check (winner in ('red','blue')),
  turn_deadline        timestamptz,
  turn_duration_seconds int default 90 check (turn_duration_seconds is null or turn_duration_seconds between 10 and 600),
  created_at           timestamptz not null default now()
);

create table if not exists public.members (
  id            uuid not null,
  room_id       uuid not null references public.rooms(id) on delete cascade,
  display_name  text not null,
  team          text check (team in ('red','blue')),
  role          text check (role in ('coach','player')),
  joined_at     timestamptz not null default now(),
  primary key (room_id, id)
);
create index if not exists members_room_idx on public.members(room_id);

create table if not exists public.cards (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  position      int  not null check (position between 0 and 24),
  player_name   text not null,
  card_type     text not null check (card_type in ('red','blue','neutral','assassin')),
  revealed      bool not null default false,
  revealed_by_team text check (revealed_by_team in ('red','blue')),
  unique (room_id, position)
);
create index if not exists cards_room_idx on public.cards(room_id);

create table if not exists public.clues (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  team        text not null check (team in ('red','blue')),
  word        text not null,
  count       int  not null,
  created_at  timestamptz not null default now()
);
create index if not exists clues_room_idx on public.clues(room_id);

create table if not exists public.guesses (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  clue_id     uuid references public.clues(id) on delete set null,
  card_id     uuid not null references public.cards(id) on delete cascade,
  guesser_id  uuid not null,
  created_at  timestamptz not null default now()
);
create index if not exists guesses_room_idx on public.guesses(room_id);

-- RLS: anyone with the code can read; nobody can write via anon key.
-- Mutations go through Next.js Server Actions using the service role.
alter table public.rooms    enable row level security;
alter table public.members  enable row level security;
alter table public.cards    enable row level security;
alter table public.clues    enable row level security;
alter table public.guesses  enable row level security;

-- Replica identity FULL: required for Realtime's row-level filters (e.g.
-- room_id=eq.X) to evaluate on UPDATE/DELETE events. Default DEFAULT only
-- ships the primary key in DELETE payloads, which silently drops filtered
-- DELETE events on the client.
alter table public.cards    replica identity full;
alter table public.clues    replica identity full;
alter table public.members  replica identity full;
alter table public.guesses  replica identity full;

drop policy if exists "anon read rooms"    on public.rooms;
drop policy if exists "anon read members"  on public.members;
drop policy if exists "anon read cards"    on public.cards;
drop policy if exists "anon read clues"    on public.clues;
drop policy if exists "anon read guesses"  on public.guesses;

create policy "anon read rooms"    on public.rooms    for select using (true);
create policy "anon read members"  on public.members  for select using (true);
create policy "anon read cards"    on public.cards    for select using (true);
create policy "anon read clues"    on public.clues    for select using (true);
create policy "anon read guesses"  on public.guesses  for select using (true);

-- Realtime publication. Idempotent — skip an ADD if the table is already in.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end$$;

do $$
declare t text;
begin
  foreach t in array array['rooms','members','cards','clues'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;
