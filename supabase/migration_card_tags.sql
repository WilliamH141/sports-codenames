-- Per-card "tagging" so players can collaboratively flag candidate cards
-- during the guess phase without committing the reveal. Tags clear whenever
-- the turn ends (server actions do that explicitly).
-- Safe to run once on an existing DB.

create table if not exists public.card_tags (
  card_id     uuid not null references public.cards(id) on delete cascade,
  member_id   uuid not null,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (card_id, member_id)
);
create index if not exists card_tags_room_idx on public.card_tags(room_id);

alter table public.card_tags enable row level security;
alter table public.card_tags replica identity full;

drop policy if exists "anon read card_tags" on public.card_tags;
create policy "anon read card_tags" on public.card_tags for select using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'card_tags'
  ) then
    alter publication supabase_realtime add table public.card_tags;
  end if;
end$$;
