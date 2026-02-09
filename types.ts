export enum Position {
  GK = 'Portero',
  DEF = 'Defensa',
  MID = 'Mediocampista',
  FWD = 'Delantero'
}

export interface Player {
  id: string;
  name: string;
  nickname?: string;
  photoUrl?: string; // New field for player image
  position: Position;
  // Since we removed matches, these serve as the main stats
  initialGoals?: number;
  initialAssists?: number;
  initialMatches?: number;
  initialSaves?: number;      // Paradas
  initialClearances?: number; // Despejes
}

export enum EventType {
  GOAL = 'Gol',
  ASSIST = 'Asistencia',
  YELLOW_CARD = 'Tarjeta Amarilla',
  RED_CARD = 'Tarjeta Roja',
  SAVE = 'Atajada',
  SUBSTITUTION = 'Sustitución'
}

// Kept for compatibility if DB has old match data, though not used in UI
export interface MatchEvent {
  id: string;
  matchId: string;
  side: 'home' | 'away';
  playerId: string;
  assistPlayerId?: string;
  type: EventType;
  minute: number;
  timestamp: number;
}

export interface Match {
  id: string;
  homeTeamName: string; 
  awayTeamName: string;
  homePlayerIds: string[];
  awayPlayerIds: string[];
  homeScore: number;
  awayScore: number;
  date: string;
  isFinished: boolean;
  events: MatchEvent[];
  aiAnalysis?: string;
}