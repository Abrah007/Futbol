export enum Position {
  GK = 'Portero',
  DEF = 'Defensa',
  MID = 'Mediocampista',
  FWD = 'Delantero'
}

export interface Player {
  id: string;
  name: string;
  nickname?: string; // Apodo opcional
  position: Position;
  // Manual overrides or historical data
  initialGoals?: number;
  initialAssists?: number;
  initialMatches?: number;
}

export enum EventType {
  GOAL = 'Gol',
  ASSIST = 'Asistencia',
  YELLOW_CARD = 'Tarjeta Amarilla',
  RED_CARD = 'Tarjeta Roja',
  SAVE = 'Atajada',
  SUBSTITUTION = 'Sustitución'
}

export interface MatchEvent {
  id: string;
  matchId: string;
  side: 'home' | 'away'; // To know which side scored without teamId lookup
  playerId: string;
  assistPlayerId?: string;
  type: EventType;
  minute: number;
  timestamp: number;
}

export interface Match {
  id: string;
  // Custom names for this specific pickup game (e.g. "Rojos" vs "Azules")
  homeTeamName: string; 
  awayTeamName: string;
  
  // Lists of player IDs participating in this match
  homePlayerIds: string[];
  awayPlayerIds: string[];

  homeScore: number;
  awayScore: number;
  date: string;
  isFinished: boolean;
  events: MatchEvent[];
  aiAnalysis?: string;
}