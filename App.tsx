import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Player, Position 
} from './types';
import { 
  IconBall, IconUsers, IconPlus, IconSparkles, IconPencil, IconCheck, IconX, IconTrophy
} from './components/Icons';
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

// --- Image Processing Helper ---
const processImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Resize logic to keep DB size small
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400; // Max 400px width or height
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG 0.7 quality
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- Main App ---

export default function App() {
  // Navigation State (Simplified)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'players'>('dashboard');
  
  // Data State
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit Player State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Player>>({});

  // New Player Form State
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhoto, setNewPlayerPhoto] = useState(''); // Base64 string
  const [newPlayerPos, setNewPlayerPos] = useState<Position>(Position.MID);
  
  // File Input Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // --- Load Data from DB ---
  useEffect(() => {
    const loadData = async () => {
      try {
        // We only need players now
        const loadedPlayers = await dbService.getAllPlayers();
        setPlayers(loadedPlayers);
      } catch (error) {
        console.error("Error loading DB", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Handlers: Image Upload ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Image = await processImage(file);
      if (isEditMode) {
        setEditFormData(prev => ({ ...prev, photoUrl: base64Image }));
      } else {
        setNewPlayerPhoto(base64Image);
      }
    } catch (error) {
      console.error("Error processing image", error);
      alert("Error al procesar la imagen. Intenta con otra.");
    }
  };

  // --- Handlers: Players ---

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    const newPlayer: Player = {
      id: Date.now().toString(),
      name: newPlayerName,
      photoUrl: newPlayerPhoto,
      position: newPlayerPos,
      initialGoals: 0,
      initialAssists: 0,
      initialMatches: 0,
      initialSaves: 0,
      initialClearances: 0
    };
    
    // Save to DB
    await dbService.addPlayer(newPlayer);
    // Update State
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setNewPlayerPhoto('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      photoUrl: player.photoUrl || '',
      position: player.position,
      initialGoals: player.initialGoals || 0,
      initialAssists: player.initialAssists || 0,
      initialMatches: player.initialMatches || 0,
      initialSaves: player.initialSaves || 0,
      initialClearances: player.initialClearances || 0,
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

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    // With matches removed, stats are purely based on the manual "initial" values
    return players.map(p => {
      const goals = Number(p.initialGoals || 0);
      const assists = Number(p.initialAssists || 0);
      const saves = Number(p.initialSaves || 0);
      const clearances = Number(p.initialClearances || 0);
      return {
        id: p.id,
        player: p,
        goals: goals,
        assists: assists,
        saves: saves,
        clearances: clearances,
        matches: Number(p.initialMatches || 0),
        ga: goals + assists // G/A Calculation
      };
    }).sort((a, b) => {
       // Custom sort: GKs by saves, others by G/A
       if (a.player.position === Position.GK && b.player.position === Position.GK) {
           return b.saves - a.saves;
       }
       return b.goals - a.goals;
    });
  }, [players]);

  // --- Views ---

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-pitch-600 font-bold">Cargando base de datos...</div>;
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card className="p-6 flex items-center gap-4 border-l-4 border-purple-500">
          <div className="p-3 bg-purple-50 rounded-full text-purple-600">
            <IconSparkles />
          </div>
          <div>
            <p className="text-sm text-gray-500">G/A Total</p>
            <p className="text-2xl font-bold">
              {stats.reduce((acc, curr) => acc + curr.ga, 0)}
            </p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
           <h2 className="font-bold text-lg flex items-center gap-2">
             <IconSparkles className="text-yellow-500" /> Clasificación
           </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-gray-500 bg-gray-50 uppercase font-bold text-xs">
              <tr>
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">Jugador</th>
                <th className="px-4 py-3 text-center" title="Partidos">P</th>
                <th className="px-4 py-3 text-center bg-orange-50">Goles</th>
                <th className="px-4 py-3 text-center">Asist.</th>
                <th className="px-4 py-3 text-center bg-blue-50" title="Paradas (Porteros)">Prd</th>
                <th className="px-4 py-3 text-center" title="Despejes (Porteros)">Des</th>
                <th className="px-4 py-3 text-right bg-gray-100">G/A</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.map((stat, idx) => (
                <tr key={stat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono text-center">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 relative border border-gray-100">
                      {stat.player?.photoUrl ? (
                        <img src={stat.player.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                          {stat.player?.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                        <div className="leading-none">{stat.player?.name}</div>
                        <div className="text-[10px] text-gray-400 font-normal uppercase">{stat.player.position}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{stat.matches}</td>
                  <td className="px-4 py-3 text-center font-bold text-orange-600 bg-orange-50/50">{stat.goals}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{stat.assists}</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600 bg-blue-50/50">
                    {stat.saves > 0 || stat.player.position === Position.GK ? stat.saves : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {stat.clearances > 0 || stat.player.position === Position.GK ? stat.clearances : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-pitch-600 bg-gray-50">{stat.ga}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
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
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-pitch-500 transition-colors overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                 {newPlayerPhoto ? (
                   <img src={newPlayerPhoto} alt="Preview" className="w-full h-full object-cover" />
                 ) : (
                   <span className="text-gray-400 text-xs text-center px-1">Subir Foto</span>
                 )}
              </div>
              <input 
                 type="file" 
                 accept="image/*" 
                 className="hidden" 
                 ref={fileInputRef}
                 onChange={(e) => handleImageUpload(e, false)}
              />
              <div className="flex-1 flex flex-col md:flex-row gap-2">
                <input 
                  type="text" 
                  placeholder="Nombre" 
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
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {players.map(player => {
           const isEditing = editingPlayerId === player.id;
           const playerStats = stats.find(s => s.id === player.id) || { goals: 0, assists: 0, matches: 0, ga: 0, saves: 0, clearances: 0 };
           const isGK = player.position === Position.GK;

           if (isEditing) {
             return (
               <Card key={player.id} className="p-4 border-brand-500 shadow-md ring-2 ring-brand-100 z-10">
                 <div className="space-y-3">
                   <div className="flex justify-center mb-2">
                      <div 
                        className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-pitch-500 transition-colors overflow-hidden relative"
                        onClick={() => editFileInputRef.current?.click()}
                      >
                         {editFormData.photoUrl ? (
                           <img src={editFormData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                         ) : (
                           <span className="text-gray-400 text-xs">Cambiar</span>
                         )}
                         <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <IconPencil className="text-white w-5 h-5" />
                         </div>
                      </div>
                      <input 
                         type="file" 
                         accept="image/*" 
                         className="hidden" 
                         ref={editFileInputRef}
                         onChange={(e) => handleImageUpload(e, true)}
                      />
                   </div>

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
                     <p className="text-xs font-bold text-brand-600 uppercase mb-2">Estadísticas</p>
                     <div className="grid grid-cols-2 gap-2 mb-2">
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
                     <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="text-[10px] text-gray-500 block">Goles</label>
                         <input 
                           type="number"
                           value={editFormData.initialGoals} 
                           onChange={e => setEditFormData({...editFormData, initialGoals: parseInt(e.target.value) || 0})}
                           className="w-full border rounded p-1 text-sm font-bold" 
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
                         <label className="text-[10px] text-blue-600 font-bold block">Paradas</label>
                         <input 
                           type="number"
                           value={editFormData.initialSaves} 
                           onChange={e => setEditFormData({...editFormData, initialSaves: parseInt(e.target.value) || 0})}
                           className="w-full border rounded p-1 text-sm border-blue-200" 
                         />
                       </div>
                       <div>
                         <label className="text-[10px] text-blue-600 font-bold block">Despejes</label>
                         <input 
                           type="number"
                           value={editFormData.initialClearances} 
                           onChange={e => setEditFormData({...editFormData, initialClearances: parseInt(e.target.value) || 0})}
                           className="w-full border rounded p-1 text-sm border-blue-200" 
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
            <Card key={player.id} className="p-0 overflow-hidden flex flex-col group hover:shadow-lg transition-all relative">
              {/* Header */}
              <div className={`relative h-24 bg-gradient-to-br ${isGK ? 'from-purple-600 to-indigo-800' : 'from-pitch-600 to-pitch-800'}`}>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                   <button onClick={() => startEditing(player)} className="p-1.5 bg-white/20 text-white hover:bg-white hover:text-brand-600 rounded backdrop-blur-sm transition-colors" title="Editar">
                     <IconPencil className="w-3 h-3" />
                   </button>
                   <button onClick={() => deletePlayer(player.id)} className="p-1.5 bg-white/20 text-white hover:bg-white hover:text-red-600 rounded backdrop-blur-sm transition-colors" title="Eliminar">
                     <IconX className="w-3 h-3" />
                   </button>
                </div>
                
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                   <div className="w-16 h-16 rounded-full border-4 border-white bg-gray-200 overflow-hidden shadow-sm bg-white">
                      {player.photoUrl ? (
                          <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-gray-400 bg-gray-100">
                              {player.name.charAt(0)}
                          </div>
                      )}
                   </div>
                </div>
              </div>

              <div className="pt-10 pb-4 px-4 text-center flex-1">
                <h3 className="font-bold text-gray-800 truncate">{player.name}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{player.position}</p>
                
                {/* Dynamic Stats Grid based on Position */}
                {isGK ? (
                  <div className="grid grid-cols-2 gap-1 py-2 bg-blue-50 rounded-lg border border-blue-100">
                     <div className="flex flex-col">
                        <span className="text-[10px] text-blue-400 uppercase font-bold">Paradas</span>
                        <span className="font-bold text-blue-900 text-lg">{playerStats.saves}</span>
                     </div>
                     <div className="flex flex-col border-l border-blue-200">
                         <span className="text-[10px] text-blue-400 uppercase font-bold">Despejes</span>
                        <span className="font-bold text-blue-900 text-lg">{playerStats.clearances}</span>
                     </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 py-2 bg-gray-50 rounded-lg">
                      <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 uppercase">Goles</span>
                          <span className="font-bold text-gray-800">{playerStats.goals}</span>
                      </div>
                      <div className="flex flex-col border-l border-gray-200">
                          <span className="text-[10px] text-gray-400 uppercase">Asist.</span>
                          <span className="font-bold text-gray-800">{playerStats.assists}</span>
                      </div>
                      <div className="flex flex-col border-l border-gray-200">
                          <span className="text-[10px] text-pitch-600 font-black uppercase">G/A</span>
                          <span className="font-black text-pitch-600">{playerStats.ga}</span>
                      </div>
                  </div>
                )}
                
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        {/* Navbar */}
        <nav className="sticky top-0 z-30 bg-pitch-600 text-white shadow-lg backdrop-blur-md bg-opacity-95">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-2">
                        <div className="bg-white p-1.5 rounded-full text-pitch-600">
                           <IconBall className="w-6 h-6" />
                        </div>
                        <span className="font-black text-xl tracking-tight uppercase">Futbol Poli</span>
                    </div>
                    <div className="flex space-x-1 bg-pitch-800/30 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                activeTab === 'dashboard' 
                                ? 'bg-white text-pitch-600 shadow-sm' 
                                : 'text-pitch-100 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <IconTrophy className="w-4 h-4" />
                                <span>Dashboard</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('players')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                activeTab === 'players' 
                                ? 'bg-white text-pitch-600 shadow-sm' 
                                : 'text-pitch-100 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                             <div className="flex items-center gap-2">
                                <IconUsers className="w-4 h-4" />
                                <span>Jugadores</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {activeTab === 'dashboard' ? renderDashboard() : renderPlayers()}
        </main>
    </div>
  );
}