export type Sport = "nba" | (string & {});

export type Team = "red" | "blue";
export type Role = "spymaster" | "guesser";
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
  created_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  display_name: string;
  team: Team | null;
  role: Role | null;
  joined_at: string;
};

export type Card = {
  id: string;
  room_id: string;
  position: number;
  player_name: string;
  card_type: CardType;
  revealed: boolean;
  revealed_by_team: Team | null;
};

export type Clue = {
  id: string;
  room_id: string;
  team: Team;
  word: string;
  count: number;
  created_at: string;
};
