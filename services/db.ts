import { createClient } from '@supabase/supabase-js';
import { Player, Match } from '../types';

// --- CONFIGURACIÓN DE SUPABASE ---
// @ts-ignore
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || 'https://frykdjywsipexvsdoovq.supabase.co';
// @ts-ignore
const SUPABASE_KEY = (import.meta as any).env.VITE_SUPABASE_KEY || 'sb_publishable_WWhkNJpHWf_T9HT-xTAAgw_lVcVwobv';

// Inicialización segura: Evita que la app se rompa si la URL no es válida aún
let supabase: any = null;

if (SUPABASE_URL.startsWith('https://')) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
        console.error("Error al inicializar Supabase:", e);
    }
} else {
    console.warn("⚠️ SUPABASE NO CONFIGURADO: La app está en modo solo lectura/vacío porque faltan las claves en services/db.ts");
}

export const dbService = {
  // --- Players ---
  async getAllPlayers(): Promise<Player[]> {
    if (!supabase) return [];
    
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
    if (!supabase) {
        alert("Error: No hay conexión a base de datos. Configura Supabase primero.");
        return;
    }
    const { error } = await supabase
      .from('players')
      .insert({ id: player.id, json: player });

    if (error) console.error('Error adding player:', error);
  },

  async updatePlayer(player: Player): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('players')
      .update({ json: player })
      .eq('id', player.id);

    if (error) console.error('Error updating player:', error);
  },

  async deletePlayer(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting player:', error);
  },

  // --- Matches ---
  async getAllMatches(): Promise<Match[]> {
    if (!supabase) return [];
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
    if (!supabase) return;
    const { error } = await supabase
      .from('matches')
      .insert({ id: match.id, json: match });

    if (error) console.error('Error adding match:', error);
  },

  async updateMatch(match: Match): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('matches')
      .update({ json: match })
      .eq('id', match.id);

    if (error) console.error('Error updating match:', error);
  },
  
  async deleteMatch(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting match:', error);
  }
};