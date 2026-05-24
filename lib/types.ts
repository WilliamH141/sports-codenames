export type Sport = "nba" | (string & {});

export type Team = "red" | "blue";
export type Role = "coach" | "player";
export type GameStatus = "lobby" | "playing" | "finished";
export type CardType = Team | "neutral" | "assassin";

export type Room = {
  id: string;
  code: string;
  sport: Sport;
  status: GameStatus;
  starting_team: Team;
  current_team: Team | null;
  current_clue_word: string | null;
  current_clue_count: number | null;
  guesses_remaining: number | null;
  winner: Team | null;
  turn_deadline: string | null;
  /** Seconds per turn for the shot clock. NULL = no timer; turns don't expire. */
  turn_duration_seconds: number | null;
  created_at: string;
};

export type Member = {
  id: string;
  room_id: string;
  display_name: string;
  team: Team | null;
  role: Role | null;
  joined_at: string;
};

/** Public card row — what anon clients see. `card_type` is intentionally
    omitted; unrevealed colors live in a column anon roles can't read. The
    coach view fetches the full key separately via getCoachKey. */
export type Card = {
  id: string;
  room_id: string;
  position: number;
  player_name: string;
  revealed: boolean;
  revealed_by_team: Team | null;
  /** Set when revealed=true; null otherwise. Safe to ship to all clients. */
  revealed_card_type: CardType | null;
};

/** Coach/end-game view: maps a card id to its true color. Fetched via a
    server action that verifies the caller is the coach (or the game has
    ended). Never fetched by regular players during play. */
export type CardKey = { id: string; card_type: CardType };

export type CardTag = {
  card_id: string;
  member_id: string;
  room_id: string;
  created_at?: string;
};

export type Clue = {
  id: string;
  room_id: string;
  team: Team;
  word: string;
  count: number;
  created_at: string;
};
