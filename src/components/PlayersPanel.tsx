import React, { useState } from 'react';
import { Player, DEFAULT_EMOJIS, AP_Emoji } from '../types';
import { Shield, Sword, Heart, Skull, Zap, Plus, Minus, Edit, Trash2, UserPlus, Sparkles } from 'lucide-react';

interface PlayersPanelProps {
  players: Player[];
  onUpdatePlayer: (player: Player) => Promise<void>;
  onDeletePlayer: (id: string) => Promise<void>;
  onAddPlayer: (player: any) => Promise<void>;
  settings: any;
}

export default function PlayersPanel({
  players,
  onUpdatePlayer,
  onDeletePlayer,
  onAddPlayer,
  settings,
}: PlayersPanelProps) {
  const [filterTeam, setFilterTeam] = useState<'all' | 'defenders' | 'attackers'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // New Player Form State
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState<'defenders' | 'attackers' | 'unknown'>('defenders');
  const [newLevel, setNewLevel] = useState(30);
  const [newHp, setNewHp] = useState('3000/3000');
  const [newPoints, setNewPoints] = useState<Record<string, number>>({
    '🗡': 2, '🛡': 2, '🥊': 2, '🌬': 2, '⚡️': 2, '🤺': 2
  });

  const defenders = players.filter(p => p.team === 'defenders');
  const attackers = players.filter(p => p.team === 'attackers');
  const others = players.filter(p => p.team !== 'defenders' && p.team !== 'attackers');

  const handleAdjustPoint = async (player: Player, emoji: AP_Emoji, offset: number) => {
    const updated = { ...player };
    updated.points = { ...player.points };
    updated.points[emoji] = Math.max(0, (player.points[emoji] || 0) + offset);
    await onUpdatePlayer(updated);
  };

  const handleToggleAlive = async (player: Player) => {
    const updated = { ...player };
    updated.isAlive = !player.isAlive;
    if (!updated.isAlive) {
      updated.hp = "0/Dead";
    } else {
      updated.hp = player.hp === "0/Dead" ? "2500/5000" : player.hp;
    }
    await onUpdatePlayer(updated);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onAddPlayer({
      name: newName,
      team: newTeam,
      level: newLevel,
      hp: newHp,
      points: newPoints,
      isAlive: !newHp.includes("Dead") && !newHp.startsWith("0/"),
    });
    setNewName('');
    setShowAddModal(false);
  };

  const renderPlayerCard = (player: Player) => {
    const teamBadge = player.team === 'defenders' 
      ? 'bg-blue-950/40 text-blue-400 border-blue-900/50' 
      : (player.team === 'attackers' ? 'bg-red-950/40 text-red-400 border-red-900/50' : 'bg-zinc-800 text-zinc-400 border-zinc-700');

    return (
      <div 
        key={player.id} 
        id={`player-card-${player.id}`}
        className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 ${
          player.isAlive 
            ? 'bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-700/80 shadow-md hover:shadow-lg' 
            : 'bg-zinc-950/50 border-zinc-900/90 filter saturate-50'
        }`}
      >
        <div>
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-lg border uppercase tracking-wider ${teamBadge}`}>
                  {player.team === 'defenders' ? '🛡 Защитник' : (player.team === 'attackers' ? '🗡 Нападающий' : 'Нейтрал')}
                </span>
                <span className="text-zinc-500 text-xs font-mono">🔸{player.level}</span>
              </div>
              <h3 className={`text-base font-bold mt-1 tracking-tight truncate max-w-[190px] ${player.isAlive ? 'text-zinc-100' : 'text-zinc-500 line-through'}`}>
                {player.name}
              </h3>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button 
                id={`toggle-alive-btn-${player.id}`}
                onClick={() => handleToggleAlive(player)}
                className={`p-1.5 rounded-lg border transition-all ${
                  player.isAlive 
                    ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/30' 
                    : 'bg-rose-950/30 border-rose-900/50 text-rose-400 hover:bg-rose-900/30'
                }`}
                title={player.isAlive ? "Mark as Fallen" : "Mark as Alive"}
              >
                {player.isAlive ? <Heart className="h-3.5 w-3.5" /> : <Skull className="h-3.5 w-3.5" />}
              </button>
              <button
                id={`delete-player-btn-${player.id}`}
                onClick={() => onDeletePlayer(player.id)}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950/40 text-zinc-500 hover:text-rose-400 hover:border-zinc-700 transition-all"
                title="Remove Player"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* HP Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
              <span>Health Points</span>
              <span className={player.isAlive ? 'text-emerald-400' : 'text-zinc-600'}>
                {player.hp}
              </span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800/30">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${player.isAlive ? 'bg-emerald-500' : 'bg-zinc-800'}`} 
                style={{ width: player.isAlive && player.hp.includes('/') ? `${Math.min(100, Math.max(5, (parseInt(player.hp.split('/')[0]) / parseInt(player.hp.split('/')[1])) * 100))}%` : '0%' }}
              />
            </div>
          </div>

          {/* Points Grid */}
          <div className="grid grid-cols-3 gap-2 py-3 px-2 bg-zinc-950/40 rounded-xl border border-zinc-900/50 mb-4 font-mono">
            {DEFAULT_EMOJIS.map(em => (
              <div key={em} className="flex flex-col items-center bg-zinc-900/30 p-1.5 rounded-lg border border-zinc-900/30">
                <span className="text-sm" title={em}>{em}</span>
                <span className="text-xs font-bold text-zinc-200 my-0.5">{player.points[em] || 0}</span>
                <div className="flex gap-1 mt-1 opacity-70 hover:opacity-100 transition-opacity">
                  <button 
                    id={`sub-point-${player.id}-${em}`}
                    onClick={() => handleAdjustPoint(player, em, -1)}
                    className="p-0.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <button 
                    id={`add-point-${player.id}-${em}`}
                    onClick={() => handleAdjustPoint(player, em, 1)}
                    className="p-0.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mb-4 p-2 bg-zinc-950/40 rounded-xl border border-zinc-900/50">
            <span className="text-zinc-500 text-xs font-mono select-none">👊:</span>
            <div className="flex items-center gap-0.5 flex-wrap font-mono text-[11px] text-zinc-300">
              <span className="text-zinc-500 select-none">[</span>
              {(!player.targetHits || player.targetHits.length === 0) ? (
                <span className="text-zinc-500 mx-0.5 shrink-0 select-none">-</span>
              ) : (() => {
                const lastFiveHits = player.targetHits.slice(-5);
                return lastFiveHits.map((zone, idx) => {
                  const zoneEmojiMap: Record<string, string> = {
                    'го': 'го',
                    'гр': 'гр',
                    'жи': 'жи',
                    'по': 'по',
                    'но': 'но',
                    'голову': 'го',
                    'грудь': 'гр',
                    'живот': 'жи',
                    'пояс': 'по',
                    'ноги': 'но',
                    '-': '-'
                  };
                  return (
                    <span key={idx} className="cursor-help mx-0.5 shrink-0" title={zone === 'голову' || zone === 'го' ? 'Голова (Head)' : zone === 'грудь' || zone === 'гр' ? 'Грудь (Chest)' : zone === 'живот' || zone === 'жи' ? 'Живот (Stomach)' : zone === 'пояс' || zone === 'по' ? 'Пояс (Waist)' : zone === 'ноги' || zone === 'но' ? 'Ноги (Feet)' : 'Skipped / Empty'}>
                      {zoneEmojiMap[zone] || zone}
                      {idx < lastFiveHits.length - 1 && <span className="text-zinc-600">,</span>}
                    </span>
                  );
                });
              })()}
              <span className="text-zinc-500 select-none">]</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-900/80 text-center">
          <p className="text-[10px] text-zinc-500 font-mono italic">
            Last parsed update: {new Date(player.updatedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
        <div className="flex gap-2">
          {(['all', 'defenders', 'attackers'] as const).map(team => (
            <button
              key={team}
              id={`filter-player-team-${team}`}
              onClick={() => setFilterTeam(team)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                filterTeam === team
                  ? 'bg-zinc-100 hover:bg-white text-zinc-950 border-white'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-750 hover:text-zinc-200'
              }`}
            >
              {team === 'all' ? 'All Combatants' : team === 'defenders' ? '🔵 Defenders' : '🔴 Attackers'}
            </button>
          ))}
        </div>

        <button
          id="btn-add-player-modal"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
        >
          <UserPlus className="h-3.5 w-3.5" /> Add Player Manually
        </button>
      </div>

      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/20 rounded-2xl border border-zinc-800/80 text-center">
          <Skull className="h-8 w-8 text-zinc-600 mb-3" />
          <h3 className="text-sm font-semibold text-zinc-300">No active combatant record yet</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Paste or forward an Epsilon War battle log in the Simulator, or add a player manually to begin tracking!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Defenders Group */}
          {(filterTeam === 'all' || filterTeam === 'defenders') && defenders.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500 inline-block"></span> Defenders (🔵 {defenders.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {defenders.map(renderPlayerCard)}
              </div>
            </div>
          )}

          {/* Attackers Group */}
          {(filterTeam === 'all' || filterTeam === 'attackers') && attackers.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500 inline-block"></span> Attackers (🔴 {attackers.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {attackers.map(renderPlayerCard)}
              </div>
            </div>
          )}

          {/* Others/Neutral Group */}
          {filterTeam === 'all' && others.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-500 inline-block"></span> Neutral / Unknown ({others.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {others.map(renderPlayerCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Add Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-1.5">
              <UserPlus className="text-indigo-400 h-5 w-5" /> Add New Player Manual Record
            </h3>
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Player Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. WinnieThePooh"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 text-zinc-200 px-3 py-2 rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Team</label>
                  <select
                    value={newTeam}
                    onChange={(e: any) => setNewTeam(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 text-zinc-200 px-3 py-2 rounded-lg outline-none"
                  >
                    <option value="defenders">🔵 Defenders</option>
                    <option value="attackers">🔴 Attackers</option>
                    <option value="unknown">⚪ Neutral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Level (🔸)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newLevel}
                    onChange={(e) => setNewLevel(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 text-zinc-200 px-3 py-2 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">HP Status (e.g. 2743/5174)</label>
                <input
                  type="text"
                  value={newHp}
                  onChange={(e) => setNewHp(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 text-zinc-200 px-3 py-2 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Initial Point Pools</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEFAULT_EMOJIS.map(em => (
                    <div key={em} className="flex items-center gap-1.5 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                      <span className="text-sm">{em}</span>
                      <input
                        type="number"
                        min="0"
                        value={newPoints[em] || 0}
                        onChange={(e) => setNewPoints({ ...newPoints, [em]: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full bg-transparent text-zinc-200 text-center font-bold outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold py-2 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition-all"
                >
                  Add Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
