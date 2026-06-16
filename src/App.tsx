import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Clipboard, 
  Swords, 
  Settings as SettingsIcon, 
  Cpu, 
  RefreshCw, 
  Flame, 
  MessageCircle, 
  History,
  Activity
} from 'lucide-react';

import { Player, BattleLogEntry, Settings } from './types';
import PlayersPanel from './components/PlayersPanel';
import CombatLogPanel from './components/CombatLogPanel';
import TelegramPanel from './components/TelegramPanel';
import SettingsPanel from './components/SettingsPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState<'players' | 'parser' | 'telegram' | 'settings'>('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<BattleLogEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [hasBotToken, setHasBotToken] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedChatId, setSelectedChatId] = useState<string>(
    localStorage.getItem("selected_chat_id") || "default"
  );
  const [chatList, setChatList] = useState<{ id: string; label: string; playerCount: number; currentTurn: number }[]>([]);
  const [authError, setAuthError] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("dashboard_token") || "";
    const headers: Record<string, string> = {
      ...(options.headers as any),
      "x-dashboard-token": token,
    };
    return fetch(url, { ...options, headers });
  };

  // Sync state with backend database
  const loadState = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/state?chatId=${encodeURIComponent(selectedChatId)}`);
      if (res.status === 401) {
        setAuthError(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        setAuthError(false);
        const data = await res.json();
        setPlayers(data.players || []);
        setHistory(data.history || []);
        setSettings(data.settings || null);
        setCurrentTurn(data.currentTurn || 0);
        setHasBotToken(data.hasBotToken || false);
        setChatList(data.chatList || []);
      }
    } catch (err) {
      // Avoid printing noisy errors during active dev server restarts
      if (!isSilent) {
        console.warn('Backend is booting or updating. Connection will retry automatically.', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadState();
    // Poll state silently every 5 seconds to keep synced with live Telegram Bot updates
    const timer = setInterval(() => loadState(true), 5000);
    return () => clearInterval(timer);
  }, [selectedChatId]);

  const handleUpdatePlayer = async (player: Player) => {
    try {
      const res = await authenticatedFetch(`/api/players?chatId=${encodeURIComponent(selectedChatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(player),
      });
      if (res.ok) {
        await loadState(true);
      }
    } catch (err) {
      console.error('Failed to update player:', err);
    }
  };

  const handleAddPlayer = async (playerData: any) => {
    try {
      const res = await authenticatedFetch(`/api/players?chatId=${encodeURIComponent(selectedChatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerData),
      });
      if (res.ok) {
        await loadState(true);
      }
    } catch (err) {
      console.error('Failed to add player:', err);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/players/${encodeURIComponent(id)}?chatId=${encodeURIComponent(selectedChatId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await loadState(true);
      }
    } catch (err) {
      console.error('Failed to remove player:', err);
    }
  };

  const handleParseLog = async (logText: string) => {
    try {
      const res = await authenticatedFetch(`/api/parse?chatId=${encodeURIComponent(selectedChatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logText }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadState(true);
        return data;
      }
    } catch (err) {
      console.error('Failed to parse log:', err);
    }
    return null;
  };

  const handleResetDB = async (option: 'all' | 'pointsOnly' | 'players') => {
    const confirmText = option === 'all' 
      ? 'Are you sure you want to reset all players, turn counts and ability points?' 
      : (option === 'pointsOnly' ? 'Reset all player Action Point banks to base defaults?' : 'Clear all player references?');
    if (!window.confirm(confirmText)) return;

    try {
      const res = await authenticatedFetch(`/api/reset?chatId=${encodeURIComponent(selectedChatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option }),
      });
      if (res.ok) {
        await loadState(true);
      }
    } catch (err) {
      console.error('Failed to reset DB:', err);
    }
  };

  const handleSaveSettings = async (updatedSettings: Settings) => {
    try {
      const res = await authenticatedFetch(`/api/settings?chatId=${encodeURIComponent(selectedChatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });
      if (res.ok) {
        await loadState(true);
      }
    } catch (err) {
      console.error('Failed to update config settings:', err);
    }
  };

  const handleSimulateBotMessage = async (text: string): Promise<{ reply: string; buttons?: { text: string; callback_data: string }[] }> => {
    try {
      const res = await authenticatedFetch(`/api/simulate-bot?chatId=${encodeURIComponent(selectedChatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.error('Simulated message failed:', err);
    }
    return { reply: '❌ Failed to connect to local simulated chat engine.' };
  };

  const forceRefresh = async () => {
    setRefreshing(true);
    await loadState();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    localStorage.setItem("dashboard_token", passwordInput);
    setPasswordInput("");
    setPasswordError("");
    loadState();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center font-sans">
        <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-sm font-semibold text-zinc-300 font-display uppercase tracking-widest animate-pulse">
          Loading war archives...
        </h2>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center font-sans px-4">
        <div className="max-w-md w-full bg-zinc-900/50 border border-zinc-805/85 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center border border-indigo-400/30">
              <Swords className="h-6 w-6 text-white animate-pulse" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100 font-display">
              Dashboard Protected
            </h2>
            <p className="text-xs text-zinc-500 font-medium text-center">
              Please enter your dashboard access password to proceed.
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-zinc-100 placeholder-zinc-600 transition-all font-mono"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-zinc-100 rounded-xl py-3 text-sm font-semibold transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              Unlock HUD
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Banner / Hero HUD Header */}
      <header className="bg-zinc-900/60 border-b border-zinc-900/90 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo Identity */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-505/20 border border-indigo-400/30">
              <Swords className="h-4.5 w-4.5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black font-display tracking-wider uppercase text-zinc-100">
                Epsilion War AP Tracker
              </h1>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">Tactical Ability Point Manager</span>
            </div>
          </div>

          {/* HUD Battle Status Details */}
          <div className="flex items-center gap-4">
            {/* Session Selector */}
            {chatList.length > 0 && (
              <div className="flex items-center gap-2 bg-zinc-950 px-3.5 py-1.5 rounded-xl border border-zinc-900">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider hidden sm:inline">Session:</span>
                <select
                  value={selectedChatId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedChatId(val);
                    localStorage.setItem("selected_chat_id", val);
                  }}
                  className="bg-transparent border-none text-xs text-indigo-400 font-black font-mono focus:outline-none cursor-pointer pr-1"
                >
                  {chatList.map((chat) => (
                    <option key={chat.id} value={chat.id} className="bg-zinc-950 text-zinc-300 font-mono text-xs">
                      {chat.label} ({chat.playerCount}p)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="hidden md:flex items-center gap-3 bg-zinc-950 px-3.5 py-1.5 rounded-xl border border-zinc-900">
              <Activity className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              <div className="text-right">
                <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider">Current Round</span>
                <span className="text-xs font-black text-rose-400 font-mono">
                  {currentTurn > 0 ? `Turn ${currentTurn}` : 'PENDING LOG'}
                </span>
              </div>
            </div>

            <button
              id="btn-force-refresh"
              onClick={forceRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-zinc-850 bg-zinc-900/30 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all font-semibold"
              title="Sync Stats"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Primary Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 overflow-y-auto">
        {/* Navigation Tabs Bar */}
        <section className="flex gap-1 bg-zinc-900/70 p-1.5 rounded-2xl border border-zinc-900 max-w-fit shadow-md">
          {[
            { id: 'players', label: 'Combatants', icon: Users },
            { id: 'parser', label: 'Parse Logs', icon: Clipboard },
            { id: 'telegram', label: 'Bot Simulator', icon: MessageCircle },
            { id: 'settings', label: 'Credit Rules', icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-4 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  active 
                    ? 'bg-zinc-800 text-zinc-100 shadow border border-zinc-700/60 font-bold' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-indigo-400' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </section>

        {/* Tab Layout Render Frame */}
        <section className="min-h-[400px]">
          {activeTab === 'players' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <PlayersPanel 
                players={players} 
                onUpdatePlayer={handleUpdatePlayer} 
                onDeletePlayer={handleDeletePlayer}
                onAddPlayer={handleAddPlayer}
                settings={settings}
              />
            </motion.div>
          )}

          {activeTab === 'parser' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <CombatLogPanel 
                history={history} 
                onParseLog={handleParseLog} 
                onResetDB={handleResetDB} 
              />
            </motion.div>
          )}

          {activeTab === 'telegram' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <TelegramPanel 
                onSimulateMessage={handleSimulateBotMessage} 
                hasBotToken={hasBotToken}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && settings && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <SettingsPanel 
                settings={settings} 
                onSaveSettings={handleSaveSettings} 
              />
            </motion.div>
          )}
        </section>
      </main>

      {/* Aesthetic System Footer (Zero clutter, literal and beautiful) */}
      <footer className="shrink-0 border-t border-zinc-900/60 bg-zinc-950/40 text-[10px] text-zinc-600 py-4 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Epsilon War Tactical Hub © 2026</span>
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" /> NODE ENGINE OFFLINE-PERSISTING STATE VIA JSON DB
          </span>
        </div>
      </footer>
    </div>
  );
}
