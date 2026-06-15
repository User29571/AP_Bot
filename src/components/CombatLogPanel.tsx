import React, { useState } from 'react';
import { BattleLogEntry, Player } from '../types';
import { Clipboard, Send, RefreshCw, Layers, Sparkles, BookOpen, Clock, Calendar } from 'lucide-react';

function cleanPlayerName(str: string): string {
  const baseStr = str.split('🔸')[0];
  const match = baseStr.match(/[a-zA-Z0-9\u0400-\u04FF_][a-zA-Z0-9\u0400-\u04FF_\s-]*/);
  const cleaned = match ? match[0].trim() : baseStr.trim();
  
  const lower = cleaned.toLowerCase();
  const blacklistWords = [
    'ход', 'turn', 'раунд', 'round', 'бой', 'battle', 
    'защитник', 'defender', 'защитники', 'defenders', 
    'нападающий', 'attacker', 'нападающие', 'attackers', 
    'нейтрал', 'neutral', 'нейтралы', 'neutrals',
    'след', 'next', 'лог', 'log', '👊',
    'на себя', 'на противник', 'на союзник', 'кол-во', 'использован',
    'эффект', 'цель', 'цели', 'способност', 'действие', 'урон', 'лечение', 
    'восстановление', 'активн', 'пассивн'
  ];
  
  if (blacklistWords.some(word => lower.includes(word))) {
    return "";
  }
  return cleaned;
}

interface HitSummaryItem {
  playerName: string;
  zones: string[];
}

function parseHitLocationsFromLog(rawText: string): HitSummaryItem[] {
  if (!rawText) return [];
  const lines = rawText.split('\n');
  const summaryMap: Record<string, string[]> = {};

  const mapToFriendly = (str: string): string | null => {
    const s = str.trim().toLowerCase();
    if (s === 'го' || s.includes('голов')) return 'го';
    if (s === 'гр' || s.includes('груд')) return 'гр';
    if (s === 'жи' || s.includes('живот')) return 'жи';
    if (s === 'по' || s.includes('пояс')) return 'по';
    if (s === 'но' || s.includes('ног') || s.includes('нос')) {
      return 'но';
    }
    return null;
  };

  const playersInLog: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const listPlayerMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
    if (listPlayerMatch) {
      const name = cleanPlayerName(listPlayerMatch[2]);
      if (name && !playersInLog.includes(name)) {
        playersInLog.push(name);
      }
      continue;
    }

    const playerWithPointsMatch = trimmed.match(/^([^👊\s:][^:]*?):\s*([🗡🛡🥊⚡️🤺🌬\d\uFE0F\s]+)/u);
    if (playerWithPointsMatch) {
      const name = cleanPlayerName(playerWithPointsMatch[1]);
      if (name && !playersInLog.includes(name)) {
        playersInLog.push(name);
      }
    }
  }

  const findMatchedPlayer = (segment: string): string | null => {
    if (!segment) return null;
    const sorted = [...playersInLog].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      if (segment.includes(name)) {
        return name;
      }
    }
    const cleaned = cleanPlayerName(segment);
    if (cleaned && playersInLog.includes(cleaned)) {
      return cleaned;
    }
    return cleaned || null;
  };

  let lastMatchedPlayer: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const listPlayerMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
    if (listPlayerMatch) {
      const name = cleanPlayerName(listPlayerMatch[2]);
      if (name) lastMatchedPlayer = name;
    } else {
      const playerWithPointsMatch = trimmed.match(/^([^👊\s:][^:]*?):\s*([🗡🛡🥊⚡️🤺🌬\d\uFE0F\s]+)/u);
      if (playerWithPointsMatch) {
        const name = cleanPlayerName(playerWithPointsMatch[1]);
        if (name) lastMatchedPlayer = name;
      }
    }

    if (trimmed.startsWith('👊:') || trimmed.includes('👊:')) {
      const idx = trimmed.indexOf('👊:');
      const zonesStr = trimmed.substring(idx + 2).trim();
      const rawZones = zonesStr.split(/[\s,]+/);
      const zones: string[] = [];
      for (const z of rawZones) {
        const friendly = mapToFriendly(z);
        if (friendly) {
          zones.push(friendly);
        }
      }
      if (lastMatchedPlayer && zones.length > 0) {
        if (!summaryMap[lastMatchedPlayer]) {
          summaryMap[lastMatchedPlayer] = [];
        }
        summaryMap[lastMatchedPlayer].push(...zones);
      }
      continue;
    }

    if (trimmed.includes('бьет') || trimmed.includes('бьёт')) {
      let attackPart = trimmed;
      const dotAndIPos = trimmed.search(/\.\s+И\s+/i);
      if (dotAndIPos !== -1) {
        attackPart = trimmed.substring(0, dotAndIPos);
      } else {
        const iPos = trimmed.indexOf(' И ');
        if (iPos !== -1) {
          attackPart = trimmed.substring(0, iPos);
        }
      }

      let attacker: string | null = null;
      let hitZoneStr = '';

      const hitMatchB = attackPart.match(/(.+?)\s+бьет\s+в\s+(.+?)\s+по\s+(.+)/iu);
      if (hitMatchB) {
        attacker = findMatchedPlayer(hitMatchB[1]);
        hitZoneStr = hitMatchB[2];
      } else {
        const hitMatch = attackPart.match(/(.+?)\s+бьет\s+(.+?)\s+в\s+(.+)/iu);
        if (hitMatch) {
          attacker = findMatchedPlayer(hitMatch[1]);
          hitZoneStr = hitMatch[3];
        }
      }

      if (attacker && hitZoneStr) {
        const friendly = mapToFriendly(hitZoneStr);
        if (friendly) {
          if (!summaryMap[attacker]) {
            summaryMap[attacker] = [];
          }
          summaryMap[attacker].push(friendly);
        }
      }
    }
  }

  for (const name of playersInLog) {
    if (!summaryMap[name] || summaryMap[name].length === 0) {
      summaryMap[name] = ['-'];
    }
  }

  return Object.entries(summaryMap).map(([playerName, zones]) => ({
    playerName,
    zones
  }));
}

interface CombatLogPanelProps {
  history: BattleLogEntry[];
  onParseLog: (text: string) => Promise<any>;
  onResetDB: (option: 'all' | 'pointsOnly' | 'players') => Promise<void>;
}

export default function CombatLogPanel({
  history,
  onParseLog,
  onResetDB
}: CombatLogPanelProps) {
  const [logInput, setLogInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<{
    turnNumber: number;
    addedPoints: boolean;
    parsedEvents: { playerName: string; actionType: string; detail: string; cost?: any }[];
    rawText?: string;
  } | null>(null);

  const handleParse = async () => {
    if (!logInput.trim()) return;
    setParsing(true);
    try {
      const res = await onParseLog(logInput);
      if (res && res.success) {
        setParseResult({
          turnNumber: res.turnNumber,
          addedPoints: res.addedPoints,
          parsedEvents: res.parsedEvents,
          rawText: logInput
        });
        setLogInput('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  const handlePasteSample = () => {
    setLogInput(`Ход 29  👀: 12

🔵 Защитники: 🔨 REBORN  💔 (4636/15003)
1. 💝🔨 🤴️иЛИЧленин 🔸32 ❤️(1893/5071)
2. 🎃💝🔨 🧟♂️WinnieThePooh 🔸34 ❤️(2743/5174)
3. 💝🔨 🤴️ Gulo 💀

🔴 Нападающие: ☦ Рим  💔 (4290/19959)
1. 💝☦ 🤴️Fir 🔸31 ❤️(1116/4339) 🕑
2. 🎃💝☦ 🧟♂️Гасандрий 🔸32 ❤️(797/5938)
3. ☃️💝☦ 🧝♂️️Тильт 🔸33 ❤️(1447/4752)
4. 💝☦ 🧝♂️️DrMyIT 🔸34 ❤️(930/4930) 2:00

Ход боя:

🎃💝🔨 🧟♂️ WinnieThePooh 🔸34 использует комбинацию Замедляющий выстрел I(⚡️1)
Меткий выстрел по ногам противника.
На себя: 🗡+10% 
На противника: 🎯-8% 
Кол-во использований: 10

🎃💝☦ 🧟♂️ Гасандрий 🔸32 использует комбинацию Управление небесами I(🗡1🛡1🥊1)
Мощь небес наполняет вас.
На себя: 🥊max 
На противника: 🩸300 
Кол-во использований: 5

🎃💝☦ 🧟♂️ Гасандрий 🔸32 💫 Провидение IV
С вероятностью 30% увеличивает точность на 250ед. и критический удар на 360ед.

 🎃💝🔨 🧟♂️WinnieThePooh 🔸34 ❤️(2743/5174) бьет 🎃💝☦ 🧟♂️Гасандрий 🔸32 ❤️(797/5938) в ноги.  И наносит 390 урона
🎃💝☦ 🧟♂️Гасандрий 🔸32 ❤️(797/5938) бьет в живот по 🎃💝🔨 🧟♂️WinnieThePooh 🔸34 ❤️(2743/5174). И ⚡️ промахивается по сопернику

💝🔨 🤴️иЛИЧленин 🔸32 ❤️(1893/5071) бьет ☃️💝☦ 🧝♂️️Тильт 🔸33 ❤️(1447/4752) в грудь. И попадает в блок
☃️💝☦ 🧝♂️️Тильт 🔸33 ❤️(1447/4752) бьет 💝🔨 🤴️иЛИЧленин 🔸32 ❤️(1893/5071) в пояс. И попадает в блок`);
  };

  const getFormatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Paste Area & Results */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-zinc-900/90 rounded-2xl p-5 border border-zinc-800 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-1.5">
                <Clipboard className="h-4 w-4 text-indigo-400" /> New Combat Log Parser
              </h2>
              <p className="text-xs text-zinc-400">Paste your combat log directly to update pools</p>
            </div>
            <button
              id="btn-sample-log"
              onClick={handlePasteSample}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2.5 py-1 rounded bg-indigo-950/20 border border-indigo-900/40 transition-all cursor-pointer"
            >
              Insert Demo Combat Log
            </button>
          </div>

          <div className="relative">
            <textarea
              id="combat-log-textarea"
              value={logInput}
              onChange={(e) => setLogInput(e.target.value)}
              placeholder="Paste Epsilon War log content here. (Must contain 'Ход <num>' or combination updates)..."
              rows={12}
              className="w-full bg-zinc-950/90 border border-zinc-905 focus:border-indigo-500 rounded-xl px-4 py-3 text-zinc-300 font-mono text-xs outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none transition-all placeholder:text-zinc-640"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              id="btn-analyze-log"
              disabled={!logInput.trim() || parsing}
              onClick={handleParse}
              className={`flex-1 flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl text-xs transition-all ${
                !logInput.trim() || parsing
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-900 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer hover:shadow-lg'
              }`}
            >
              {parsing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Parsers Processing Combat...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> Analyze Combat Log
                </>
              )}
            </button>

            <button
              id="btn-clear-textarea"
              onClick={() => setLogInput('')}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all font-semibold"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Live Parse Assessment */}
        {parseResult && (
          <div className="bg-zinc-900/90 rounded-2xl p-5 border border-zinc-800 shadow-md animate-fade-in">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 border-b border-zinc-800 pb-3 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" /> Parser Output Diagnosis
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-zinc-950/40 p-3 rounded-lg border border-zinc-900/50 text-xs">
                  <span className="text-zinc-500 block mb-0.5 font-medium">Turn Detected</span>
                  <span className="text-base font-extrabold text-zinc-100">
                    {parseResult.turnNumber > 0 ? `Ход ${parseResult.turnNumber}` : "None"}
                  </span>
                </div>
                <div className="flex-1 bg-zinc-950/40 p-3 rounded-lg border border-zinc-900/50 text-xs">
                  <span className="text-zinc-500 block mb-0.5 font-medium">Automatic Point Crediting</span>
                  <span className={`text-xs font-extrabold flex items-center gap-1 ${parseResult.addedPoints ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {parseResult.addedPoints ? '✔ Granted (+1 All Emojis)' : 'Already granted for this Turn'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-zinc-400 font-bold block text-xs uppercase tracking-wider mb-2">Actions Extracted</span>
                {parseResult.parsedEvents.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {parseResult.parsedEvents.map((ev, i) => (
                      <div key={i} className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-900 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-zinc-200">{ev.playerName}</span>
                          <p className="text-zinc-400 mt-1">{ev.detail}</p>
                        </div>
                        {ev.cost && (
                          <div className="flex gap-1.5 font-mono text-zinc-300 bg-zinc-900/50 px-2 py-1 rounded border border-zinc-850">
                            {Object.entries(ev.cost).map(([em, cost]) => (
                              <span key={em} title={`${em} subtracted`}>{em}{cost}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic bg-zinc-950/20 p-4 rounded-xl border border-dashed border-zinc-800 text-center">
                    No active abilities casting or passive actions detected on this turn log.
                  </p>
                )}
              </div>

              {parseResult.rawText && (() => {
                const hits = parseHitLocationsFromLog(parseResult.rawText);
                if (hits.length === 0) return null;
                return (
                  <div className="pt-3 border-t border-zinc-800 space-y-2">
                    <span className="text-zinc-400 font-bold block text-xs uppercase tracking-wider">Hit Locations Summary</span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {hits.map((item, idx) => (
                        <div key={idx} className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-900 flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-300">{item.playerName}</span>
                          <span className="font-mono text-indigo-400 text-[11px] font-semibold">
                            {item.zones.join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Parser Archive / History list */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-zinc-900/90 rounded-2xl p-5 border border-zinc-800 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-indigo-400" /> Parsing Archives
            </h2>
            <div className="flex gap-1.5">
              <button
                id="btn-reset-points-only"
                onClick={() => onResetDB('pointsOnly')}
                className="text-[10px] text-zinc-450 hover:text-zinc-200 hover:border-zinc-700 bg-zinc-950/35 border border-zinc-850 px-2 py-1 rounded transition-all cursor-pointer font-medium"
              >
                Reset AP Pools
              </button>
              <button
                id="btn-reset-all"
                onClick={() => onResetDB('all')}
                className="text-[10px] text-zinc-450 hover:text-zinc-200 hover:border-zinc-750 bg-zinc-950/35 border border-zinc-850 px-2 py-1 rounded transition-all cursor-pointer font-medium"
              >
                Reset All
              </button>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/20 border border-dashed border-zinc-850 rounded-xl text-center">
              <Clock className="h-6 w-6 text-zinc-600 mb-2" />
              <p className="text-xs text-zinc-500 italic">No combat logs processed in this session yet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {history.map((log) => (
                <div key={log.id} className="bg-zinc-950 p-4 rounded-xl border border-zinc-880 space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-900/80">
                    <span className="text-xs font-bold text-zinc-300">
                      {log.turnNumber > 0 ? `Turn (Ход) ${log.turnNumber}` : 'Undetected Turn'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> {getFormatTime(log.timestamp)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {log.parsedEvents && log.parsedEvents.length > 0 ? (
                      log.parsedEvents.map((ev, idx) => (
                        <div key={idx} className="text-[11px] text-zinc-400 flex justify-between">
                          <span className="text-zinc-300 font-medium truncate max-w-[120px]">{ev.playerName}</span>
                          <span className="truncate max-w-[170px] text-zinc-500">{ev.detail}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-zinc-650 italic">Registered combat list without logged actions.</p>
                    )}
                  </div>

                  {log.rawText && (() => {
                    const hits = parseHitLocationsFromLog(log.rawText);
                    if (hits.length === 0) return null;
                    return (
                      <div className="pt-2 mt-2 border-t border-zinc-900 space-y-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Targeted Hit Zones:</span>
                        <div className="space-y-1">
                          {hits.map((item, idx) => (
                            <div key={idx} className="text-[11px] flex justify-between items-center text-zinc-400">
                              <span className="text-zinc-300 font-semibold">{item.playerName}</span>
                              <span className="text-right text-indigo-400 font-mono font-medium text-[10px]">
                                {item.zones.join(', ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
