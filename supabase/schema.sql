-- Sports Codenames schema.
-- Run this once against a fresh Supabase project (SQL editor or psql).

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
  created_at           timestamptz not null default now()
);

create table if not exists public.players (
  id            uuid not null,
  room_id       uuid not null references public.rooms(id) on delete cascade,
  display_name  text not null,
  team          text check (team in ('red','blue')),
  role          text check (role in ('spymaster','guesser')),
  joined_at     timestamptz not null default now(),
  primary key (room_id, id)
);
create index if not exists players_room_idx on public.players(room_id);

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
alter table public.players  enable row level security;
alter table public.cards    enable row level security;
alter table public.clues    enable row level security;
alter table public.guesses  enable row level security;

drop policy if exists "anon read rooms"    on public.rooms;
drop policy if exists "anon read players"  on public.players;
drop policy if exists "anon read cards"    on public.cards;
drop policy if exists "anon read clues"    on public.clues;
drop policy if exists "anon read guesses"  on public.guesses;

create policy "anon read rooms"    on public.rooms    for select using (true);
create policy "anon read players"  on public.players  for select using (true);
create policy "anon read cards"    on public.cards    for select using (true);
create policy "anon read clues"    on public.clues    for select using (true);
create policy "anon read guesses"  on public.guesses  for select using (true);

-- Realtime publication.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end$$;

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.clues;
