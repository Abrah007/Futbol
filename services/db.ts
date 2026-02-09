import { createClient } from '@supabase/supabase-js';
import { Player, Match } from '../types';

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''; 
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || '';

let supabase: any = null;

// Determine if we should use Supabase or LocalStorage
const isSupabaseConfigured = SUPABASE_URL.startsWith('https://') && SUPABASE_KEY.length > 0;

if (isSupabaseConfigured) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
        console.error("Error al inicializar Supabase:", e);
    }
} else {
    console.log("⚠️ Supabase no configurado. Usando LocalStorage para persistencia de datos.");
}

// Helper for LocalStorage
const LS_KEYS = {
    PLAYERS: 'poli_players_data',
    MATCHES: 'poli_matches_data'
};

export const dbService = {
  // --- Players ---
  async getAllPlayers(): Promise<Player[]> {
    if (!isSupabaseConfigured) {
        const stored = localStorage.getItem(LS_KEYS.PLAYERS);
        return stored ? JSON.parse(stored) : [];
    }
    
    const { data, error } = await supabase
      .from('players')
      .select('json');
    
    if (error) {
      console.error('Error fetching players:', error);
      return [];
    }
    return data.map((row: any) => row.json);
  },

  async addPlayer(player: Player): Promise<void> {
    if (!isSupabaseConfigured) {
        const players = await dbService.getAllPlayers();
        players.push(player);
        localStorage.setItem(LS_KEYS.PLAYERS, JSON.stringify(players));
        return;
    }

    const { error } = await supabase
      .from('players')
      .insert({ id: player.id, json: player });

    if (error) console.error('Error adding player:', error);
  },

  async updatePlayer(player: Player): Promise<void> {
    if (!isSupabaseConfigured) {
        const players = await dbService.getAllPlayers();
        const index = players.findIndex(p => p.id === player.id);
        if (index !== -1) {
            players[index] = player;
            localStorage.setItem(LS_KEYS.PLAYERS, JSON.stringify(players));
        }
        return;
    }

    const { error } = await supabase
      .from('players')
      .update({ json: player })
      .eq('id', player.id);

    if (error) console.error('Error updating player:', error);
  },

  async deletePlayer(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
        const players = await dbService.getAllPlayers();
        const filtered = players.filter(p => p.id !== id);
        localStorage.setItem(LS_KEYS.PLAYERS, JSON.stringify(filtered));
        return;
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting player:', error);
  },

  // --- Matches ---
  async getAllMatches(): Promise<Match[]> {
    if (!isSupabaseConfigured) {
        const stored = localStorage.getItem(LS_KEYS.MATCHES);
        const matches = stored ? JSON.parse(stored) : [];
        return matches.sort((a: Match, b: Match) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const { data, error } = await supabase
      .from('matches')
      .select('json');

    if (error) {
      console.error('Error fetching matches:', error);
      return [];
    }
    
    const matches = data.map((row: any) => row.json) as Match[];
    return matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async addMatch(match: Match): Promise<void> {
    if (!isSupabaseConfigured) {
        const matches = await dbService.getAllMatches();
        matches.push(match);
        localStorage.setItem(LS_KEYS.MATCHES, JSON.stringify(matches));
        return;
    }

    const { error } = await supabase
      .from('matches')
      .insert({ id: match.id, json: match });

    if (error) console.error('Error adding match:', error);
  },

  async updateMatch(match: Match): Promise<void> {
     if (!isSupabaseConfigured) {
        const matches = await dbService.getAllMatches();
        const index = matches.findIndex(m => m.id === match.id);
        if (index !== -1) {
            matches[index] = match;
            localStorage.setItem(LS_KEYS.MATCHES, JSON.stringify(matches));
        }
        return;
    }

    const { error } = await supabase
      .from('matches')
      .update({ json: match })
      .eq('id', match.id);

    if (error) console.error('Error updating match:', error);
  },
  
  async deleteMatch(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
        const matches = await dbService.getAllMatches();
        const filtered = matches.filter(m => m.id !== id);
        localStorage.setItem(LS_KEYS.MATCHES, JSON.stringify(filtered));
        return;
    }

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting match:', error);
  }
};