-- Atomic card reveal.
--
-- The old revealCard() read guesses_remaining, flipped the card, then wrote
-- (n - 1) back as separate queries. Two players on the same team tapping at
-- once both read the same n and both wrote n-1, so the team got a free guess
-- (and sometimes the turn didn't end when it should). The current_clue_word
-- guard didn't help — the word is the same for both guesses.
--
-- Doing it all in one txn with the room row locked (SELECT ... FOR UPDATE)
-- fixes it: the second caller waits for the first to commit, then decrements
-- off the live value. Win/turn logic mirrors evaluateGuess() in
-- lib/game/rules.ts — keep them in sync.
--
-- SECURITY DEFINER to read cards.card_type (revoked from anon by
-- migration_hide_card_types.sql). Only service_role may execute it.

create or replace function public.reveal_card(
  p_room_id   uuid,
  p_card_id   uuid,
  p_player_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status        text;
  v_current_team  text;
  v_starting_team text;
  v_clue_word     text;
  v_guesses       int;
  v_duration      int;
  v_member_team   text;
  v_member_role   text;
  v_card_type     text;
  v_card_revealed boolean;
  v_updated       int;
  v_other_team    text;
  v_red_done      boolean;
  v_blue_done     boolean;
  v_latest_clue   uuid;
  v_ends_turn     boolean := false;
  v_finished      boolean := false;
  v_winner        text    := null;
begin
  -- Lock the room row — this is what serializes reveals on the same room.
  select status, current_team, starting_team, current_clue_word,
         guesses_remaining, turn_duration_seconds
    into v_status, v_current_team, v_starting_team, v_clue_word,
         v_guesses, v_duration
    from public.rooms
   where id = p_room_id
   for update;

  if not found then
    raise exception 'Room not found';
  end if;

  -- Click landed after the turn moved on. No-op; realtime will resync.
  if v_status <> 'playing' then return; end if;
  if v_clue_word is null then return; end if;

  select team, role
    into v_member_team, v_member_role
    from public.members
   where room_id = p_room_id and id = p_player_id;

  if not found then
    raise exception 'You are not in this room';
  end if;
  -- Not this team's player (usually the turn flipped mid-click). No-op.
  if v_member_role <> 'player' or v_member_team <> v_current_team then
    return;
  end if;

  select card_type, revealed
    into v_card_type, v_card_revealed
    from public.cards
   where id = p_card_id and room_id = p_room_id;

  if not found then
    raise exception 'Card not found';
  end if;
  if v_card_revealed then return; end if;

  -- Flip it. The lock already serializes us; revealed=false is just cheap insurance.
  update public.cards
     set revealed = true,
         revealed_by_team = v_member_team,
         revealed_card_type = v_card_type
   where id = p_card_id and revealed = false;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then return; end if;

  v_other_team := case when v_current_team = 'red' then 'blue' else 'red' end;

  -- Win check. Counts include the card we just flipped. 9 for the starting
  -- team, 8 for the other.
  select count(*) >= (case when 'red' = v_starting_team then 9 else 8 end)
    into v_red_done
    from public.cards
   where room_id = p_room_id and card_type = 'red' and revealed;

  select count(*) >= (case when 'blue' = v_starting_team then 9 else 8 end)
    into v_blue_done
    from public.cards
   where room_id = p_room_id and card_type = 'blue' and revealed;

  -- Order matches evaluateGuess(): assassin, win, own colour, then anything else.
  if v_card_type = 'assassin' then
    v_finished  := true;
    v_ends_turn := true;
    v_winner    := v_other_team;
  elsif v_red_done or v_blue_done then
    v_finished  := true;
    v_ends_turn := true;
    v_winner    := case when v_red_done then 'red' else 'blue' end;
  elsif v_card_type = v_current_team then
    v_ends_turn := (v_guesses - 1) <= 0;
  else
    v_ends_turn := true;
  end if;

  -- History row against the active clue.
  select id into v_latest_clue
    from public.clues
   where room_id = p_room_id
   order by created_at desc
   limit 1;

  insert into public.guesses (room_id, clue_id, card_id, guesser_id)
  values (p_room_id, v_latest_clue, p_card_id, p_player_id);

  -- Drop the flipped card's tags.
  delete from public.card_tags where card_id = p_card_id;

  if v_finished then
    update public.rooms
       set status             = 'finished',
           winner             = v_winner,
           current_clue_word  = null,
           current_clue_count = null,
           guesses_remaining  = null,
           turn_deadline      = null
     where id = p_room_id;
  elsif v_ends_turn then
    update public.rooms
       set current_team       = v_other_team,
           current_clue_word  = null,
           current_clue_count = null,
           guesses_remaining  = null,
           turn_deadline      = now() + make_interval(secs => coalesce(v_duration, 1800))
     where id = p_room_id;
  else
    -- Correct guess, turn continues. Decrement off the live (locked) value.
    update public.rooms
       set guesses_remaining = guesses_remaining - 1
     where id = p_room_id;
  end if;

  -- Turn's over → clear the room's tags.
  if v_finished or v_ends_turn then
    delete from public.card_tags where room_id = p_room_id;
  end if;
end;
$$;

revoke all on function public.reveal_card(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reveal_card(uuid, uuid, uuid) to service_role;
