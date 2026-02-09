import React, { useState, useEffect, useMemo } from 'react';
import { 
  Player, Match, Position, EventType, MatchEvent 
} from './types';
import { 
  IconBall, IconTrophy, IconUsers, IconPlus, IconSparkles, IconWhistle, IconCalendar, IconPencil, IconCheck, IconX
} from './components/Icons';
import { generateMatchReport } from './services/geminiService';
import { dbService } from './services/db';

// --- Helper Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-pitch-600 hover:bg-pitch-800 text-white shadow-md shadow-pitch-600/20",
    secondary: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-500 hover:bg-red-600 text-white",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-600"
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'players' | 'matches' | 'draft' | 'live'>('dashboard');
  
  // Data State
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit Player State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Player>>({});

  // Draft State (Match Setup)
  const [draftHomeName, setDraftHomeName] = useState('Equipo A');
  const [draftAwayName, setDraftAwayName] = useState('Equipo B');
  const [draftHomeIds, setDraftHomeIds] = useState<string[]>([]);
  const [draftAwayIds, setDraftAwayIds] = useState<string[]>([]);

  // Live Match State
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Player Form State
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPos, setNewPlayerPos] = useState<Position>(Position.MID);

  // --- Load Data from DB ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedPlayers, loadedMatches] = await Promise.all([
          dbService.getAllPlayers(),
          dbService.getAllMatches()
        ]);
        setPlayers(loadedPlayers);
        setMatches(loadedMatches);
        
        // Check if there is an unfinished match to resume
        const unfinished = loadedMatches.find(m => !m.isFinished);
        if (unfinished) {
            setActiveMatchId(unfinished.id);
        }
      } catch (error) {
        console.error("Error loading DB", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Handlers: Players ---

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    const newPlayer: Player = {
      id: Date.now().toString(),
      name: newPlayerName,
      position: newPlayerPos,
      initialGoals: 0,
      initialAssists: 0,
      initialMatches: 0
    };
    
    // Save to DB
    await dbService.addPlayer(newPlayer);
    // Update State
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
  };

  const deletePlayer = async (id: string) => {
    if(window.confirm('¿Seguro que quieres borrar este jugador?')) {
        await dbService.deletePlayer(id);
        setPlayers(players.filter(p => p.id !== id));
    }
  }

  const startEditing = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditFormData({ 
      name: player.name,
      position: player.position,
      initialGoals: player.initialGoals || 0,
      initialAssists: player.initialAssists || 0,
      initialMatches: player.initialMatches || 0
    });
  };

  const saveEdit = async () => {
    if (!editingPlayerId) return;
    
    const originalPlayer = players.find(p => p.id === editingPlayerId);
    if (!originalPlayer) return;

    const updatedPlayer: Player = { ...originalPlayer, ...editFormData } as Player;

    // Update DB
    await dbService.updatePlayer(updatedPlayer);
    
    // Update State
    setPlayers(players.map(p => 
      p.id === editingPlayerId 
      ? updatedPlayer
      : p
    ));
    setEditingPlayerId(null);
    setEditFormData({});
  };

  const cancelEdit = () => {
    setEditingPlayerId(null);
    setEditFormData({});
  };

  // --- Handlers: Draft & Match Start ---

  const toggleDraftSelection = (playerId: string, side: 'home' | 'away') => {
    const cleanHome = draftHomeIds.filter(id => id !== playerId);
    const cleanAway = draftAwayIds.filter(id => id !== playerId);

    if (side === 'home') {
      if (draftHomeIds.includes(playerId)) {
        setDraftHomeIds(cleanHome);
      } else {
        setDraftHomeIds([...cleanHome, playerId]);
        setDraftAwayIds(cleanAway);
      }
    } else {
      if (draftAwayIds.includes(playerId)) {
        setDraftAwayIds(cleanAway);
      } else {
        setDraftAwayIds([...cleanAway, playerId]);
        setDraftHomeIds(cleanHome);
      }
    }
  };

  const startMatch = async () => {
    if (draftHomeIds.length === 0 || draftAwayIds.length === 0) {
      alert("Necesitas al menos un jugador en cada equipo");
      return;
    }
    
    const newMatch: Match = {
      id: Date.now().toString(),
      homeTeamName: draftHomeName || 'Equipo A',
      awayTeamName: draftAwayName || 'Equipo B',
      homePlayerIds: draftHomeIds,
      awayPlayerIds: draftAwayIds,
      homeScore: 0,
      awayScore: 0,
      date: new Date().toISOString(),
      isFinished: false,
      events: []
    };
    
    await dbService.addMatch(newMatch);
    setMatches([newMatch, ...matches]);
    setActiveMatchId(newMatch.id);
    setActiveTab('live');
  };

  // --- Handlers: Live Match ---

  const activeMatch = useMemo(() => matches.find(m => m.id === activeMatchId), [matches, activeMatchId]);
  
  const addEvent = async (type: EventType, side: 'home' | 'away', playerId: string) => {
    if (!activeMatch) return;

    const minute = Math.floor(Math.random() * 90) + 1; 

    const newEvent: MatchEvent = {
      id: Date.now().toString(),
      matchId: activeMatch.id,
      side,
      playerId,
      type,
      minute,
      timestamp: Date.now()
    };

    let updatedHomeScore = activeMatch.homeScore;
    let updatedAwayScore = activeMatch.awayScore;

    if (type === EventType.GOAL) {
      if (side === 'home') updatedHomeScore++;
      else updatedAwayScore++;
    }

    const updatedMatch = {
      ...activeMatch,
      homeScore: updatedHomeScore,
      awayScore: updatedAwayScore,
      events: [newEvent, ...activeMatch.events]
    };

    // Save update to DB instantly
    await dbService.updateMatch(updatedMatch);
    setMatches(matches.map(m => m.id === activeMatch.id ? updatedMatch : m));
  };

  const finishMatch = async () => {
    if (!activeMatch) return;
    
    setGeneratingReport(true);
    
    const report = await generateMatchReport(activeMatch, players);

    const finishedMatch = {
      ...activeMatch,
      isFinished: true,
      aiAnalysis: report
    };

    await dbService.updateMatch(finishedMatch);

    setMatches(matches.map(m => m.id === activeMatch.id ? finishedMatch : m));
    setActiveMatchId(null);
    setGeneratingReport(false);
    
    setDraftHomeIds([]);
    setDraftAwayIds([]);
    setActiveTab('matches');
  };

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    const s: Record<string, { goals: number, assists: number, matches: number }> = {};
    
    players.forEach(p => {
        s[p.id] = { 
            goals: Number(p.initialGoals || 0), 
            assists: Number(p.initialAssists || 0), 
            matches: Number(p.initialMatches || 0) 
        };
    });

    matches.filter(m => m.isFinished).forEach(match => {
      [...match.homePlayerIds, ...match.awayPlayerIds].forEach(pid => {
        if(s[pid]) s[pid].matches++;
      });
      match.events.forEach(e => {
        if (e.type === EventType.GOAL && s[e.playerId]) s[e.playerId].goals++;
        if (e.type === EventType.GOAL && e.assistPlayerId && s[e.assistPlayerId]) s[e.assistPlayerId].assists++;
      });
    });

    return Object.entries(s)
      .map(([id, data]) => ({ ...data, id, player: players.find(p => p.id === id) }))
      .sort((a, b) => b.goals - a.goals);
  }, [matches, players]);


  // --- Views ---

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-pitch-600 font-bold">Cargando base de datos...</div>;
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 flex items-center gap-4 border-l-4 border-pitch-500">
          <div className="p-3 bg-pitch-50 rounded-full text-pitch-600">
            <IconTrophy />
          </div>
          <div>
            <p className="text-sm text-gray-500">Partidos Jugados</p>
            <p className="text-2xl font-bold">{matches.filter(m => m.isFinished).length}</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4 border-l-4 border-brand-500">
          <div className="p-3 bg-brand-50 rounded-full text-brand-600">
            <IconUsers />
          </div>
          <div>
            <p className="text-sm text-gray-500">Jugadores</p>
            <p className="text-2xl font-bold">{players.length}</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4 border-l-4 border-orange-500">
          <div className="p-3 bg-orange-50 rounded-full text-orange-600">
            <IconBall />
          </div>
          <div>
            <p className="text-sm text-gray-500">Goles Totales</p>
            <p className="text-2xl font-bold">
              {stats.reduce((acc, curr) => acc + curr.goals, 0)}
            </p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
           <h2 className="font-bold text-lg flex items-center gap-2">
             <IconSparkles className="text-yellow-500" /> Tabla de Goleadores
           </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-gray-500 bg-gray-50 uppercase font-bold text-xs">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Jugador</th>
                <th className="px-4 py-3 text-center">Partidos</th>
                <th className="px-4 py-3 text-center">Asist.</th>
                <th className="px-4 py-3 text-right">Goles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.slice(0, 10).map((stat, idx) => (
                <tr key={stat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{stat.player?.name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{stat.matches}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{stat.assists}</td>
                  <td className="px-4 py-3 text-right font-bold text-pitch-600">{stat.goals}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Aún no hay estadísticas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderPlayers = () => (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-gray-50 to-white">
        <h3 className="text-lg font-semibold mb-4">Registrar Jugador</h3>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Nombre / Apodo" 
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-pitch-500 outline-none"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
          />
           <select 
            className="border rounded-lg px-2 py-2 bg-white"
            value={newPlayerPos}
            onChange={(e) => setNewPlayerPos(e.target.value as Position)}
          >
            {Object.values(Position).map(pos => <option key={pos} value={pos}>{pos}</option>)}
          </select>
          <Button onClick={handleAddPlayer}>
            <IconPlus className="w-5 h-5" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {players.map(player => {
           const isEditing = editingPlayerId === player.id;
           const playerStats = stats.find(s => s.id === player.id) || { goals: 0, assists: 0, matches: 0 };

           if (isEditing) {
             return (
               <Card key={player.id} className="p-4 border-brand-500 shadow-md ring-2 ring-brand-100">
                 <div className="space-y-3">
                   <div>
                     <label className="text-xs font-bold text-gray-400 uppercase">Nombre</label>
                     <input 
                       value={editFormData.name} 
                       onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                       className="w-full border rounded p-1 text-sm" 
                     />
                   </div>
                   <div>
                     <label className="text-xs font-bold text-gray-400 uppercase">Posición</label>
                     <select 
                       value={editFormData.position} 
                       onChange={e => setEditFormData({...editFormData, position: e.target.value as Position})}
                       className="w-full border rounded p-1 text-sm bg-white"
                     >
                       {Object.values(Position).map(pos => <option key={pos} value={pos}>{pos}</option>)}
                     </select>
                   </div>
                   
                   <div className="pt-2 border-t mt-2">
                     <p className="text-xs font-bold text-brand-600 uppercase mb-2">Stats Iniciales (Manuales)</p>
                     <div className="grid grid-cols-3 gap-2">
                       <div>
                         <label className="text-[10px] text-gray-500 block">Goles</label>
                         <input 
                           type="number"
                           value={editFormData.initialGoals} 
                           onChange={e => setEditFormData({...editFormData, initialGoals: parseInt(e.target.value) || 0})}
                           className="w-full border rounded p-1 text-sm" 
                         />
                       </div>
                       <div>
                         <label className="text-[10px] text-gray-500 block">Asist.</label>
                         <input 
                           type="number"
                           value={editFormData.initialAssists} 
                           onChange={e => setEditFormData({...editFormData, initialAssists: parseInt(e.target.value) || 0})}
                           className="w-full border rounded p-1 text-sm" 
                         />
                       </div>
                       <div>
                         <label className="text-[10px] text-gray-500 block">Partidos</label>
                         <input 
                           type="number"
                           value={editFormData.initialMatches} 
                           onChange={e => setEditFormData({...editFormData, initialMatches: parseInt(e.target.value) || 0})}
                           className="w-full border rounded p-1 text-sm" 
                         />
                       </div>
                     </div>
                   </div>

                   <div className="flex justify-end gap-2 mt-2">
                     <Button onClick={saveEdit} variant="primary" className="p-2 h-8 w-8 rounded-full bg-green-500 hover:bg-green-600"><IconCheck className="w-4 h-4" /></Button>
                     <Button onClick={cancelEdit} variant="ghost" className="p-2 h-8 w-8 rounded-full hover:bg-gray-100"><IconX className="w-4 h-4 text-gray-500" /></Button>
                   </div>
                 </div>
               </Card>
             );
           }

           return (
            <Card key={player.id} className="p-4 flex flex-col gap-3 group hover:border-pitch-200 transition-all relative">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-lg">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{player.name}</p>
                    <p className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full inline-block">{player.position}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => startEditing(player)} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="Editar">
                     <IconPencil className="w-4 h-4" />
                   </button>
                   <button onClick={() => deletePlayer(player.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                     <IconX className="w-4 h-4" />
                   </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-1 border-t pt-3">
                 <div className="text-center">
                    <span className="block text-xs text-gray-400 uppercase">Goles</span>
                    <span className="font-bold text-pitch-600">{playerStats.goals}</span>
                 </div>
                 <div className="text-center border-l border-r border-gray-100">
                    <span className="block text-xs text-gray-400 uppercase">Asist.</span>
                    <span className="font-bold text-gray-700">{playerStats.assists}</span>
                 </div>
                 <div className="text-center">
                    <span className="block text-xs text-gray-400 uppercase">Partidos</span>
                    <span className="font-bold text-gray-700">{playerStats.matches}</span>
                 </div>
              </div>
            </Card>
          );
        })}
        {players.length === 0 && <p className="col-span-full text-center text-gray-400 py-10">Agrega jugadores para empezar.</p>}
      </div>
    </div>
  );

  const renderDraft = () => (
    <div className="space-y-6">
      <Card className="p-6 sticky top-20 z-10 shadow-lg border-pitch-100 bg-white/95 backdrop-blur">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
           <div className="w-full md:w-1/3">
             <label className="text-xs font-bold text-pitch-600 uppercase mb-1 block">Equipo Local</label>
             <input value={draftHomeName} onChange={e => setDraftHomeName(e.target.value)} className="w-full font-bold text-lg border-b-2 border-pitch-500 focus:outline-none bg-transparent" />
             <p className="text-sm text-gray-500 mt-1">{draftHomeIds.length} Jugadores</p>
           </div>
           
           <div className="bg-gray-100 rounded-full p-2">
             <span className="font-black text-gray-400">VS</span>
           </div>

           <div className="w-full md:w-1/3 text-right">
             <label className="text-xs font-bold text-brand-600 uppercase mb-1 block">Equipo Visitante</label>
             <input value={draftAwayName} onChange={e => setDraftAwayName(e.target.value)} className="w-full font-bold text-lg border-b-2 border-brand-500 focus:outline-none bg-transparent text-right" />
             <p className="text-sm text-gray-500 mt-1">{draftAwayIds.length} Jugadores</p>
           </div>
        </div>
        <Button onClick={startMatch} className="w-full py-3 text-lg">
          <IconWhistle /> ¡Iniciar Partido!
        </Button>
      </Card>

      <h3 className="text-center text-gray-500 font-medium mb-4">Selecciona los jugadores para cada equipo</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {players.map(player => {
          const isHome = draftHomeIds.includes(player.id);
          const isAway = draftAwayIds.includes(player.id);
          
          return (
            <div key={player.id} className={`
              border rounded-lg p-3 flex justify-between items-center transition-all
              ${isHome ? 'bg-pitch-50 border-pitch-500 shadow-md' : ''}
              ${isAway ? 'bg-brand-50 border-brand-500 shadow-md' : ''}
              ${!isHome && !isAway ? 'bg-white border-gray-200' : ''}
            `}>
              <span className="font-semibold truncate pr-2">{player.name}</span>
              <div className="flex gap-1 shrink-0">
                <button 
                  onClick={() => toggleDraftSelection(player.id, 'home')}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${isHome ? 'bg-pitch-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-pitch-100'}`}
                >
                  A
                </button>
                <button 
                  onClick={() => toggleDraftSelection(player.id, 'away')}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${isAway ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-brand-100'}`}
                >
                  B
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMatches = () => (
    <div className="space-y-6">
      {!activeMatchId && (
        <Card className="p-8 text-center bg-gradient-to-b from-white to-gray-50">
          <div className="inline-flex p-4 rounded-full bg-pitch-50 text-pitch-600 mb-4">
            <IconWhistle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Nuevo Partido</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Selecciona jugadores de tu lista, forma dos equipos y registra todo lo que pase en la cancha.</p>
          <Button onClick={() => setActiveTab('draft')} className="mx-auto text-lg px-8">
            Armar Equipos
          </Button>
        </Card>
      )}

      {activeMatchId && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex justify-between items-center animate-pulse cursor-pointer" onClick={() => setActiveTab('live')}>
          <div className="flex items-center gap-2 text-orange-800">
             <span className="relative flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
             </span>
             <span className="font-bold">Partido en Juego</span>
          </div>
          <Button onClick={() => setActiveTab('live')} variant="primary" className="bg-orange-500 hover:bg-orange-600 text-sm py-1">Ir</Button>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-bold text-gray-700 mt-8 mb-4">Historial</h3>
        {matches.filter(m => m.isFinished).length === 0 && <p className="text-gray-400 italic">No hay partidos finalizados.</p>}
        {matches.filter(m => m.isFinished).map(match => (
             <div key={match.id} className="space-y-2">
                <Card className="p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4 border-b pb-4">
                     <span className="text-xs text-gray-400 font-mono">{new Date(match.date).toLocaleDateString()}</span>
                     <span className="text-xs font-bold text-pitch-600 bg-pitch-50 px-2 py-1 rounded-full">Finalizado</span>
                  </div>
                  <div className="flex justify-between items-center text-xl font-bold mb-4 px-2">
                    <span className="text-pitch-700 w-1/3 text-right">{match.homeTeamName}</span>
                    <span className="bg-gray-900 text-white px-4 py-2 rounded-lg font-mono text-2xl mx-4">{match.homeScore} - {match.awayScore}</span>
                    <span className="text-brand-700 w-1/3 text-left">{match.awayTeamName}</span>
                  </div>
                  
                  {/* Goalscorers summary */}
                  <div className="text-xs text-gray-500 text-center mb-4 space-y-1">
                      {match.events.filter(e => e.type === EventType.GOAL).map(e => {
                          const pName = players.find(p => p.id === e.playerId)?.name;
                          return <span key={e.id} className="inline-block mx-1">⚽ {pName}</span>
                      })}
                  </div>

                  {match.aiAnalysis && (
                    <div className="mt-4 bg-gray-50 p-4 rounded-lg text-sm text-gray-700 border-l-4 border-purple-500">
                      <div className="flex items-center gap-2 mb-2 text-purple-700 font-bold">
                        <IconSparkles className="w-4 h-4" /> Crónica IA
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
                         {match.aiAnalysis.split('\n').map((line, i) => (
                           <p key={i} className="mb-2 last:mb-0">{line}</p>
                         ))}
                      </div>
                    </div>
                  )}
                </Card>
             </div>
        ))}
      </div>
    </div>
  );

  const renderLiveMatch = () => {
    if (!activeMatch) return <div>Cargando...</div>;

    const homePlayersList = players.filter(p => activeMatch.homePlayerIds.includes(p.id));
    const awayPlayersList = players.filter(p => activeMatch.awayPlayerIds.includes(p.id));

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Scoreboard */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1/2 h-1 bg-pitch-500"></div>
          <div className="absolute top-0 right-0 w-1/2 h-1 bg-brand-500"></div>
          <div className="flex justify-between items-center relative z-10">
            <div className="text-center w-1/3">
              <div className="text-2xl md:text-3xl font-bold mb-1 text-pitch-400">{activeMatch.homeTeamName}</div>
            </div>
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-mono font-black tracking-tighter bg-white/10 px-6 py-3 rounded-lg backdrop-blur-sm shadow-inner">
                {activeMatch.homeScore}:{activeMatch.awayScore}
              </div>
              <div className="mt-2 text-red-500 font-bold uppercase tracking-widest text-[10px] animate-pulse">● En Vivo</div>
            </div>
            <div className="text-center w-1/3">
              <div className="text-2xl md:text-3xl font-bold mb-1 text-brand-400">{activeMatch.awayTeamName}</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Home Team Controls */}
            <div className="bg-pitch-50/50 rounded-xl p-4 border border-pitch-100">
                <h4 className="font-bold text-center text-pitch-800 mb-3 border-b border-pitch-200 pb-2">{activeMatch.homeTeamName}</h4>
                <div className="grid grid-cols-1 gap-2">
                    {homePlayersList.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                            <span className="text-sm font-medium pl-2">{p.name}</span>
                            <div className="flex gap-1">
                                <button onClick={() => addEvent(EventType.GOAL, 'home', p.id)} className="p-2 hover:bg-green-100 rounded-lg text-green-600 transition-colors" title="Gol"><IconBall /></button>
                                <button onClick={() => addEvent(EventType.ASSIST, 'home', p.id)} className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors font-bold text-xs w-9" title="Asistencia">AST</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Away Team Controls */}
            <div className="bg-brand-50/50 rounded-xl p-4 border border-brand-100">
                <h4 className="font-bold text-center text-brand-800 mb-3 border-b border-brand-200 pb-2">{activeMatch.awayTeamName}</h4>
                <div className="grid grid-cols-1 gap-2">
                    {awayPlayersList.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                            <span className="text-sm font-medium pl-2">{p.name}</span>
                            <div className="flex gap-1">
                                <button onClick={() => addEvent(EventType.GOAL, 'away', p.id)} className="p-2 hover:bg-green-100 rounded-lg text-green-600 transition-colors" title="Gol"><IconBall /></button>
                                <button onClick={() => addEvent(EventType.ASSIST, 'away', p.id)} className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors font-bold text-xs w-9" title="Asistencia">AST</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Event Log */}
        <Card className="p-4">
            <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Minuto a Minuto</h4>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {activeMatch.events.length === 0 && <p className="text-sm text-gray-400 text-center italic py-4">El árbitro pita el inicio...</p>}
                {[...activeMatch.events].reverse().map(e => { // Show newest first
                    const player = players.find(p => p.id === e.playerId);
                    const isHome = e.side === 'home';
                    const isGoal = e.type === EventType.GOAL;
                    return (
                        <div key={e.id} className={`flex items-center justify-between text-sm p-2 rounded border-l-4 ${isHome ? 'border-pitch-500 bg-pitch-50' : 'border-brand-500 bg-brand-50'}`}>
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-gray-500 text-xs w-8">{e.minute}'</span>
                                <span className={`font-bold ${isGoal ? 'text-gray-900' : 'text-gray-600'}`}>{isGoal ? '¡GOL!' : e.type}</span>
                                <span>{player?.name}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>

        {/* Finish Action */}
        <div className="flex justify-center pt-6 pb-10">
            <Button onClick={finishMatch} disabled={generatingReport} className="w-full md:w-auto text-lg py-4 px-10 bg-black hover:bg-gray-800 shadow-xl rounded-full transition-transform transform active:scale-95">
               {generatingReport ? (
                 <>
                   <span className="animate-spin mr-2">⏳</span> Escribiendo la crónica...
                 </>
               ) : (
                 <>
                   <IconWhistle className="mr-2" /> Finalizar Partido
                 </>
               )}
            </Button>
        </div>
      </div>
    );
  };

  // --- Layout ---

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-pitch-600 font-black text-xl tracking-tight">
             <IconBall className="w-6 h-6" />
             <span>GolStats<span className="text-gray-900 font-light">AI</span></span>
          </div>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-1">
            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-pitch-50 text-pitch-700' : 'text-gray-500 hover:text-gray-900'}`}>Dashboard</button>
            <button onClick={() => setActiveTab('players')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'players' ? 'bg-pitch-50 text-pitch-700' : 'text-gray-500 hover:text-gray-900'}`}>Jugadores</button>
            <button onClick={() => setActiveTab('matches')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'matches' ? 'bg-pitch-50 text-pitch-700' : 'text-gray-500 hover:text-gray-900'}`}>Partidos</button>
            {activeMatchId && (
                <button onClick={() => setActiveTab('live')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors animate-pulse text-orange-600 bg-orange-50`}>● En Vivo</button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'players' && renderPlayers()}
        {activeTab === 'matches' && renderMatches()}
        {activeTab === 'draft' && renderDraft()}
        {activeTab === 'live' && renderLiveMatch()}
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around py-3 z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-pitch-600' : 'text-gray-400'}`}>
           <IconTrophy className="w-6 h-6" />
           <span className="text-[10px] font-medium">Stats</span>
        </button>
        <button onClick={() => setActiveTab('players')} className={`flex flex-col items-center gap-1 ${activeTab === 'players' ? 'text-pitch-600' : 'text-gray-400'}`}>
           <IconUsers className="w-6 h-6" />
           <span className="text-[10px] font-medium">Jugadores</span>
        </button>
        <button onClick={() => setActiveTab('matches')} className={`flex flex-col items-center gap-1 ${activeTab === 'matches' ? 'text-pitch-600' : 'text-gray-400'}`}>
           <IconCalendar className="w-6 h-6" />
           <span className="text-[10px] font-medium">Partidos</span>
        </button>
        
        {activeMatchId ? (
            <button onClick={() => setActiveTab('live')} className={`flex flex-col items-center gap-1 text-orange-500`}>
                <div className="relative">
                    <IconWhistle className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-ping"></span>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                </div>
                <span className="text-[10px] font-bold">Jugar</span>
            </button>
        ) : (
            <button onClick={() => setActiveTab('draft')} className={`flex flex-col items-center gap-1 ${activeTab === 'draft' ? 'text-pitch-600' : 'text-gray-400'}`}>
                <IconPlus className="w-6 h-6" />
                <span className="text-[10px] font-medium">Nuevo</span>
            </button>
        )}
      </nav>
    </div>
  );
}