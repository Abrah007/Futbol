import { GoogleGenAI } from "@google/genai";
import { Match, Player, EventType } from "../types";

const apiKey = process.env.API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generateMatchReport = async (
  match: Match,
  allPlayers: Player[]
): Promise<string> => {
  if (!ai) return "API Key no configurada. No se puede generar el reporte.";

  // Helper to get player name
  const getName = (id: string) => allPlayers.find(p => p.id === id)?.name || "Jugador Desconocido";

  // Construct a detailed text representation of the match
  const eventsList = match.events.map(e => {
    const playerName = getName(e.playerId);
    const teamName = e.side === 'home' ? match.homeTeamName : match.awayTeamName;
    
    let detail: string = e.type;
    if (e.type === EventType.GOAL && e.assistPlayerId) {
        detail += ` (Asistencia: ${getName(e.assistPlayerId)})`;
    }
    return `- Min ${e.minute}: ${detail} por ${playerName} para ${teamName}`;
  }).join('\n');

  const prompt = `
    Actúa como un narrador de fútbol de barrio apasionado pero analítico. Escribe la crónica de este partido amistoso/amateur.
    
    EQUIPOS: ${match.homeTeamName} vs ${match.awayTeamName}
    MARCADOR FINAL: ${match.homeScore} - ${match.awayScore}
    
    JUGADORES DESTACADOS (Goleadores):
    ${match.events.filter(e => e.type === EventType.GOAL).map(e => getName(e.playerId)).join(', ')}
    
    CRONOLOGÍA:
    ${eventsList}
    
    ESTRUCTURA:
    1. **Titular**: Divertido o Épico.
    2. **Resumen**: Cómo se sintió el partido.
    3. **El MVP**: Quién se lució más (básate en goles/asistencias).
    4. **El Dato**: Alguna estadística curiosa o táctica simple.

    Formato Markdown. Tono cercano, futbolero español.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No se pudo generar el análisis.";
  } catch (error) {
    console.error("Error generating report:", error);
    return "Error al conectar con la IA para generar el reporte.";
  }
};