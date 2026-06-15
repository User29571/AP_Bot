import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Player, BattleLogEntry, Settings, DatabaseState } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "database.json");

// Default initial state
const defaultSettings: Settings = {
  startingPoints: {
    '🗡': 0,
    '🛡': 0,
    '🥊': 0,
    '🌬': 0,
    '⚡️': 0,
    '🤺': 0,
  },
};

let dbState: DatabaseState = {
  players: [],
  history: [],
  settings: defaultSettings,
  currentTurn: 0,
  processedTurns: [],
  language: 'en'
};

// Ensure database file exists
function loadDB() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(content);
      dbState = {
        players: parsed.players || [],
        history: parsed.history || [],
        settings: parsed.settings || defaultSettings,
        currentTurn: parsed.currentTurn || 0,
        processedTurns: parsed.processedTurns || [],
        language: parsed.language || 'en'
      };
      
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
      
      dbState.players = dbState.players.filter(p => {
        const lower = p.name.toLowerCase();
        return !blacklistWords.some(word => lower.includes(word));
      });
      console.log(`Database loaded successfully with ${dbState.players.length} players after filtering.`);
    } else {
      saveDB();
      console.log("Database initialized with default seed data.");
    }
  } catch (error) {
    console.error("Failed to load database:", error);
  }
}

function saveDB() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save database:", error);
  }
}

loadDB();

// Robust Helper to clean names from emojis
function cleanPlayerName(str: string): string {
  // Take first part if it has 🔸 level separator
  const baseStr = str.split('🔸')[0];
  // Match first Cyrillic/Latin letter or number, and keep consecutive letter/number/space/hyphen characters
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

// Parse emoji ability price notation like "🗡3", "3🗡" or repeating "🗡🗡🗡"
function parseAbilityCost(costStr: string) {
  const costs: Record<string, number> = {};
  const emojis = ['🗡', '🛡', '🥊', '⚡️', '🤺', '🌬'];
  
  for (const em of emojis) {
    const escapedEm = em.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\uFE0F/g, '\\uFE0F?');
    
    // Check for "number before emoji" e.g., 3🗡
    const numBeforeRegex = new RegExp(`(\\d+)\\s*${escapedEm}`);
    const matchBefore = costStr.match(numBeforeRegex);
    
    // Check for "emoji before number" e.g., 🗡3
    const numAfterRegex = new RegExp(`${escapedEm}\\s*(\\d+)`);
    const matchAfter = costStr.match(numAfterRegex);
    
    if (matchBefore) {
      costs[em] = parseInt(matchBefore[1], 10);
    } else if (matchAfter) {
      costs[em] = parseInt(matchAfter[1], 10);
    } else {
      // If emoji is present at all without a number, it defaults to a cost of 1
      const cleanCostStr = costStr.replace(/\uFE0F/g, '');
      const cleanEm = em.replace(/\uFE0F/g, '');
      if (cleanCostStr.includes(cleanEm)) {
        costs[em] = 1;
      }
    }
  }
  return costs;
}

// Global Core parser function
function parseCombatLog(logText: string): { turnNumber: number; addedPoints: boolean; parsedEvents: any[] } {
  let matchedTurn = 0;
  let pointsWereAdded = false;
  const parsedEvents: any[] = [];

  const findMatchedPlayer = (segment: string): Player | null => {
    if (!segment) return null;
    const sortedPlayers = [...dbState.players].sort((a, b) => b.name.length - a.name.length);
    for (const player of sortedPlayers) {
      if (segment.includes(player.name)) {
        return player;
      }
    }
    const cleaned = cleanPlayerName(segment);
    if (cleaned) {
      return dbState.players.find(p => p.id === cleaned) || null;
    }
    return null;
  };

  // 1. Detect Turn Number
  // E.g. "Ход 29  👀: 12"
  const turnMatch = logText.match(/(?:Ход|Turn)\s*(\d+)/i);
  if (turnMatch) {
    matchedTurn = parseInt(turnMatch[1], 10);
  }

  // Turn Hits Map to accumulate actions during this parse session
  const turnHitsMap: Record<string, string[]> = {};

  // 2. Discover Players under Defenders and Attackers lists
  // 🔵 Защитники: ...
  // 🔴 Нападающие: ...
  // Match lines like: "1. 💝🔨 🤴️иЛИЧленин 🔸32 ❤️(1893/5071)"
  const lines = logText.split("\n");

  // Pre-parse targetHits and alternative player formats from the lines
  let lastMatchedPlayer: Player | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for "👊:" line
    if (trimmed.startsWith("👊:") || trimmed.includes("👊:")) {
      const idx = trimmed.indexOf("👊:");
      const zonesStr = trimmed.substring(idx + 2).trim();
      const rawZones = zonesStr.split(/[\s,]+/);
      const zones: string[] = [];
      const mapWordToFriendly = (w: string): string | null => {
        const lowerW = w.toLowerCase().trim();
        if (lowerW === 'го' || lowerW.includes('голов') || lowerW.includes('🧠')) return 'го';
        if (lowerW === 'гр' || lowerW.includes('груд') || lowerW.includes('👔')) return 'гр';
        if (lowerW === 'жи' || lowerW.includes('живот') || lowerW.includes('🥩')) return 'жи';
        if (lowerW === 'по' || lowerW.includes('пояс') || lowerW.includes('🩳')) return 'по';
        if (lowerW === 'но' || lowerW.includes('ног') || lowerW.includes('🦵')) return 'но';
        return null;
      };
      for (const z of rawZones) {
        const code = mapWordToFriendly(z);
        if (code) {
          zones.push(code);
        }
      }
      if (lastMatchedPlayer && zones.length > 0) {
        if (!turnHitsMap[lastMatchedPlayer.id]) {
          turnHitsMap[lastMatchedPlayer.id] = [];
        }
        for (const zone of zones) {
          if (!turnHitsMap[lastMatchedPlayer.id].includes(zone)) {
            turnHitsMap[lastMatchedPlayer.id].push(zone);
          }
        }
      }
      continue;
    }

    // Check for "пропускает ход" (skips turn)
    if (trimmed.includes("пропускает ход") || trimmed.includes("skips turn") || trimmed.includes("пропустил ход") || trimmed.includes("skipped turn") || trimmed.includes("пропускает раунд") || trimmed.includes("skips round")) {
      const actorPlayer = findMatchedPlayer(trimmed);
      if (actorPlayer) {
        if (!turnHitsMap[actorPlayer.id]) {
          turnHitsMap[actorPlayer.id] = [];
        }
        if (!turnHitsMap[actorPlayer.id].includes('-')) {
          turnHitsMap[actorPlayer.id].push('-');
        }
      }
    }

    // Check for bracket hits line like "[🥩 жи, 👔 гр]"
    if (trimmed.includes('[') && trimmed.includes(']')) {
      const startIdx = trimmed.indexOf('[');
      const endIdx = trimmed.indexOf(']');
      const content = trimmed.substring(startIdx + 1, endIdx).trim();
      const list = content.split(/[\s,]+/);
      const zones: string[] = [];
      const mapWordToCode = (w: string): string | null => {
        const lowerW = w.toLowerCase().trim();
        if (lowerW.includes('го') || lowerW.includes('глав') || lowerW.includes('🧠') || lowerW.includes('голов')) return 'го';
        if (lowerW.includes('гр') || lowerW.includes('👔') || lowerW.includes('груд')) return 'гр';
        if (lowerW.includes('жи') || lowerW.includes('🥩') || lowerW.includes('живот')) return 'жи';
        if (lowerW.includes('по') || lowerW.includes('🩳') || lowerW.includes('пояс')) return 'по';
        if (lowerW.includes('но') || lowerW.includes('🦵') || lowerW.includes('ног')) return 'но';
        return null;
      };
      for (const item of list) {
        const code = mapWordToCode(item);
        if (code) {
          zones.push(code);
        }
      }
      if (lastMatchedPlayer && zones.length > 0) {
        if (!turnHitsMap[lastMatchedPlayer.id]) {
          turnHitsMap[lastMatchedPlayer.id] = [];
        }
        for (const zone of zones) {
          if (!turnHitsMap[lastMatchedPlayer.id].includes(zone)) {
            turnHitsMap[lastMatchedPlayer.id].push(zone);
          }
        }
      }
      continue;
    }

    // Try to match player definition with emojis in this format: "Player: 🗡2" or similar
    const playerWithPointsMatch = trimmed.match(/^([^👊\s:][^:]*?):\s*([🗡🛡🥊⚡️🤺🌬\d\uFE0F\s]+)/u);
    if (playerWithPointsMatch) {
      const rawName = playerWithPointsMatch[1];
      const pointsStr = playerWithPointsMatch[2];
      const cleanName = cleanPlayerName(rawName);
      if (cleanName) {
        let player = dbState.players.find(p => p.id === cleanName);
        if (!player) {
          player = {
            id: cleanName,
            name: cleanName,
            team: 'unknown',
            level: 1,
            hp: "100/100",
            isAlive: true,
            points: { '🗡': 0, '🛡': 0, '🥊': 0, '⚡️': 0, '🤺': 0, '🌬': 0 },
            updatedAt: new Date().toISOString()
          };
          dbState.players.push(player);
        }
        // Sync points if explicitly in log
        const parsedPoints = parseAbilityCost(pointsStr);
        for (const em of ['🗡', '🛡', '🥊', '⚡️', '🤺', '🌬'] as const) {
          if (parsedPoints[em] !== undefined) {
            player.points[em] = parsedPoints[em];
          }
        }
        player.updatedAt = new Date().toISOString();
        lastMatchedPlayer = player;
        continue;
      }
    }

    // Otherwise, check if it's a list player
    const listPlayerMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
    if (listPlayerMatch) {
      const cleanName = cleanPlayerName(listPlayerMatch[2]);
      if (cleanName) {
        let player = dbState.players.find(p => p.id === cleanName);
        if (!player) {
          player = {
            id: cleanName,
            name: cleanName,
            team: 'unknown',
            level: 1,
            hp: "100/100",
            isAlive: true,
            points: { '🗡': 0, '🛡': 0, '🥊': 0, '⚡️': 0, '🤺': 0, '🌬': 0 },
            updatedAt: new Date().toISOString()
          };
          dbState.players.push(player);
        }
        lastMatchedPlayer = player;
      }
    }
  }

  let currentTeam: 'defenders' | 'attackers' | 'unknown' = 'unknown';
  const newlyActivePlayerIds: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.includes("🔵 Защитники") || trimmed.includes("Defenders")) {
      currentTeam = 'defenders';
      continue;
    }
    if (trimmed.includes("🔴 Нападающие") || trimmed.includes("Attackers")) {
      currentTeam = 'attackers';
      continue;
    }
    if (trimmed.includes("Ход боя:") || trimmed.includes("Следующий ход:") || trimmed.includes("Next turn:") || trimmed.includes("Battle log:") || trimmed.includes("Ход раунда:")) {
      currentTeam = 'unknown';
      continue;
    }

    // Match player row e.g. "2. 🎃💝🔨 🧟‍♂️WinnieThePooh 🔸34 ❤️(2743/5174)"
    const listPlayerMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
    if (listPlayerMatch && currentTeam !== 'unknown') {
      const restOfLine = listPlayerMatch[2];
      
      // Extract level
      let level = 1;
      const lvlMatch = restOfLine.match(/🔸\s*(\d+)/);
      if (lvlMatch) {
        level = parseInt(lvlMatch[1], 10);
      }

      // Extract health
      let hp = "";
      const hpMatch = restOfLine.match(/❤️\s*\((\d+\/\d+)\)/);
      if (hpMatch) {
        hp = hpMatch[1];
      } else if (restOfLine.includes("💀")) {
        hp = "0/Dead";
      }

      const isDead = restOfLine.includes("💀") || hp.startsWith("0/");
      const cleanName = cleanPlayerName(restOfLine);

      if (cleanName) {
        newlyActivePlayerIds.push(cleanName);
        let player = dbState.players.find(p => p.id === cleanName);
        if (!player) {
          player = {
            id: cleanName,
            name: cleanName,
            team: currentTeam,
            level: level,
            hp: hp,
            isAlive: !isDead,
            points: {
              '🗡': 0,
              '🛡': 0,
              '🥊': 0,
              '🌬': 0,
              '⚡️': 0,
              '🤺': 0,
            }, // All players start with exactly 0 of each point
            updatedAt: new Date().toISOString()
          };
          dbState.players.push(player);
        } else {
          player.team = currentTeam;
          player.level = level;
          player.hp = hp;
          player.isAlive = !isDead;
          player.updatedAt = new Date().toISOString();
        }
      }
    }
  }

  // 3. Keep track of turn numbers
  if (matchedTurn > 0 && !dbState.processedTurns.includes(matchedTurn)) {
    dbState.processedTurns.push(matchedTurn);
    dbState.currentTurn = matchedTurn;
    pointsWereAdded = true;
  }

  // 4. Parse Combat Actions (Abilities Used and Point Gains)
  // E.g. "🎃💝🔨 🧟♂️ WinnieThePooh 🔸34 использует комбинацию Замедляющий выстрел I(⚡️1)"
  // First, find lines matching " использует комбинацию "
  for (const line of lines) {
    if (line.includes("использует комбинацию") || line.includes("uses combination")) {
      const match = line.match(/(.*?)(?:\s+🔸\d+)?\s+(?:использует комбинацию|uses combination)\s+(.*?)\((.*?)\)/i);
      if (match) {
        const rawSender = match[1];
        const abilityName = match[2].trim();
        const costText = match[3].trim();

        const senderName = cleanPlayerName(rawSender);
        const emojiCosts = parseAbilityCost(costText);

        const player = dbState.players.find(p => p.id === senderName);
        if (player) {
          // Deduct points
          for (const [em, costVal] of Object.entries(emojiCosts)) {
            const castEm = em as '🗡'|'🛡'|'🥊'|'🌬'|'⚡️'|'🤺';
            player.points[castEm] = Math.max(0, (player.points[castEm] || 0) - costVal);
          }
          player.updatedAt = new Date().toISOString();

          parsedEvents.push({
            playerName: player.name,
            actionType: 'use_ability',
            detail: `${abilityName} (${costText})`,
            cost: emojiCosts
          });
        }
      }
    } else if (line.includes("💫")) {
      // E.g. "🎃💝☦ 🧟♂️ Гасандрий 🔸32 💫 Провидение IV"
      const match = line.match(/(.*?)\s+💫\s+(.*)/i);
      if (match) {
        const rawSender = match[1];
        const passiveName = match[2].trim();
        const senderName = cleanPlayerName(rawSender);

        const player = dbState.players.find(p => p.id === senderName);
        if (player) {
          parsedEvents.push({
            playerName: player.name,
            actionType: 'passive',
            detail: `💫 ${passiveName}`
          });
        }
      }
    } else {
      // Check for dynamic point crediting rules specified by user!

      // 1. Check for counter-attacks:
      // " Пока соперник был в замешательстве 🎃💝🔨 🧟♂️WinnieThePooh 🔸34 ❤️(1412/5174) нанес 🤺 контрударом 202 урона "
      const counterMatch = line.match(/(?:Пока соперник был в замешательстве|While opponent was confused)(.+?)нане(?:с|сла)\s+🤺/iu);
      if (counterMatch) {
        const actorPlayer = findMatchedPlayer(counterMatch[1]);
        if (actorPlayer) {
          actorPlayer.points['🤺'] = (actorPlayer.points['🤺'] || 0) + 1;
          actorPlayer.updatedAt = new Date().toISOString();
          parsedEvents.push({
            playerName: actorPlayer.name,
            actionType: 'point_gain',
            detail: `Dealt counter-attack ➡️ +1 🤺`
          });
        }
        continue;
      }

      // 3. Check for standard hits, blocks, critical block breaks:
      // Format A: "WinnieThePooh бьет DrMyIT в грудь. И попадает в блок"
      // Format B: "DrMyIT бьет в пояс по WinnieThePooh. И ⚡️ промахивается по сопернику"
      if (line.includes("бьет") || line.includes("бьёт")) {
        let attackPart = line;
        let outcomePart = "";
        
        const dotAndIPos = line.search(/\.\s+И\s+/i);
        if (dotAndIPos !== -1) {
          attackPart = line.substring(0, dotAndIPos);
          outcomePart = line.substring(dotAndIPos + 4);
        } else {
          const iPos = line.indexOf(" И ");
          if (iPos !== -1) {
            attackPart = line.substring(0, iPos);
            outcomePart = line.substring(iPos + 3);
          }
        }

        let attackerPlayer: Player | null = null;
        let defenderPlayer: Player | null = null;
        let hitZoneStr = "";

        // Try Format B: Attacker бьет в Target по Defender
        const hitMatchB = attackPart.match(/(.+?)\s+бьет\s+в\s+(.+?)\s+по\s+(.+)/iu);
        if (hitMatchB) {
          attackerPlayer = findMatchedPlayer(hitMatchB[1]);
          defenderPlayer = findMatchedPlayer(hitMatchB[3]);
          hitZoneStr = hitMatchB[2];
        } else {
          // Try Format A: Attacker бьет Defender в Target
          const hitMatch = attackPart.match(/(.+?)\s+бьет\s+(.+?)\s+в\s+(.+)/iu);
          if (hitMatch) {
            attackerPlayer = findMatchedPlayer(hitMatch[1]);
            defenderPlayer = findMatchedPlayer(hitMatch[2]);
            hitZoneStr = hitMatch[3];
          }
        }

        if (attackerPlayer && hitZoneStr) {
          const mapZoneToCode = (str: string): string | null => {
            const s = str.trim().toLowerCase();
            if (s.includes('голов')) return 'го';
            if (s.includes('груд')) return 'гр';
            if (s.includes('живот') || s.includes('жив')) return 'жи';
            if (s.includes('пояс')) return 'по';
            if (s.includes('ног')) return 'но';
            return null;
          };
          const code = mapZoneToCode(hitZoneStr);
          if (code) {
            if (!turnHitsMap[attackerPlayer.id]) {
              turnHitsMap[attackerPlayer.id] = [];
            }
            if (!turnHitsMap[attackerPlayer.id].includes(code)) {
              turnHitsMap[attackerPlayer.id].push(code);
            }
          }
        }

        if (attackerPlayer) {
          const outcomeLower = outcomePart.toLowerCase();

          if (outcomeLower.includes("промахивается") || outcomeLower.includes("промахнулся") || outcomeLower.includes("промах")) {
            // Miss: Attacker gets 🌬, Defender gets ⚡️
            attackerPlayer.points['🌬'] = (attackerPlayer.points['🌬'] || 0) + 1;
            attackerPlayer.updatedAt = new Date().toISOString();
            parsedEvents.push({
              playerName: attackerPlayer.name,
              actionType: 'point_gain',
              detail: `Missed attack on ${defenderPlayer ? defenderPlayer.name : 'enemy'} ➡️ +1 🌬`
            });

            if (defenderPlayer) {
              defenderPlayer.points['⚡️'] = (defenderPlayer.points['⚡️'] || 0) + 1;
              defenderPlayer.updatedAt = new Date().toISOString();
              parsedEvents.push({
                playerName: defenderPlayer.name,
                actionType: 'point_gain',
                detail: `Evaded attack from ${attackerPlayer.name} ➡️ +1 ⚡️`
              });
            }
          } else if (outcomeLower.includes("попадает в блок") || outcomeLower.includes("попал в блок") || outcomeLower.includes("в блок")) {
            // Block: Attacker gets 🌬, Defender gets 🛡
            attackerPlayer.points['🌬'] = (attackerPlayer.points['🌬'] || 0) + 1;
            attackerPlayer.updatedAt = new Date().toISOString();
            parsedEvents.push({
              playerName: attackerPlayer.name,
              actionType: 'point_gain',
              detail: `Attack got blocked ➡️ +1 🌬`
            });

            if (defenderPlayer) {
              defenderPlayer.points['🛡'] = (defenderPlayer.points['🛡'] || 0) + 1;
              defenderPlayer.updatedAt = new Date().toISOString();
              parsedEvents.push({
                playerName: defenderPlayer.name,
                actionType: 'point_gain',
                detail: `Blocked attack from ${attackerPlayer.name} ➡️ +1 🛡`
              });
            }
          } else if (outcomeLower.includes("пробивает блок") || outcomeLower.includes("критическ") || outcomeLower.includes("🥊")) {
            // Critical Strike or Block breaker: Attacker gets 🥊
            attackerPlayer.points['🥊'] = (attackerPlayer.points['🥊'] || 0) + 1;
            attackerPlayer.updatedAt = new Date().toISOString();
            parsedEvents.push({
              playerName: attackerPlayer.name,
              actionType: 'point_gain',
              detail: `Critical or Block-breaker strike ➡️ +1 🥊`
            });
          } else if (outcomeLower.includes("наносит") || outcomeLower.includes("нанес") || outcomeLower.includes("нанесла") || outcomeLower.includes("урон")) {
            // Hit deals damage: Attacker gets 🗡
            attackerPlayer.points['🗡'] = (attackerPlayer.points['🗡'] || 0) + 1;
            attackerPlayer.updatedAt = new Date().toISOString();
            parsedEvents.push({
              playerName: attackerPlayer.name,
              actionType: 'point_gain',
              detail: `Hit successfully dealt damage ➡️ +1 🗡`
            });
          }
        }
      }
    }
  }

  // Set default skip turn indicator or append the turn hits for active players
  for (const player of dbState.players) {
    if (newlyActivePlayerIds.includes(player.id)) {
      if (!player.targetHits) {
        player.targetHits = [];
      }
      const p_id = player.id;
      const hitsThisTurn = turnHitsMap[p_id] || [];
      if (hitsThisTurn.length === 0) {
        player.targetHits.push('-');
      } else {
        for (const h of hitsThisTurn) {
          player.targetHits.push(h);
        }
      }
    }
  }

  // Save changes to database disk
  saveDB();

  return {
    turnNumber: matchedTurn,
    addedPoints: pointsWereAdded,
    parsedEvents
  };
}

// ----------------------------------------------------
// Express API Route Enforcers
// ----------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/state", (req, res) => {
  res.json({
    ...dbState,
    hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
  });
});

app.post("/api/settings", (req, res) => {
  const { startingPoints } = req.body;
  if (startingPoints) {
    dbState.settings = {
      startingPoints,
    };
    saveDB();
    return res.json({ success: true, settings: dbState.settings });
  }
  res.status(400).json({ error: "Invalid settings format" });
});

app.post("/api/players", (req, res) => {
  const { name, team, level, hp, points, isAlive } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Player name is required" });
  }

  const cleanName = cleanPlayerName(name);
  let player = dbState.players.find(p => p.id === cleanName);

  if (!player) {
    player = {
      id: cleanName,
      name: cleanName,
      team: team || 'unknown',
      level: Number(level) || 1,
      hp: hp || "100/100",
      isAlive: isAlive !== undefined ? !!isAlive : true,
      points: points || {
        '🗡': dbState.settings.startingPoints?.['🗡'] ?? 0,
        '🛡': dbState.settings.startingPoints?.['🛡'] ?? 0,
        '🥊': dbState.settings.startingPoints?.['🥊'] ?? 0,
        '🌬': dbState.settings.startingPoints?.['🌬'] ?? 0,
        '⚡️': dbState.settings.startingPoints?.['⚡️'] ?? 0,
        '🤺': dbState.settings.startingPoints?.['🤺'] ?? 0,
      },
      updatedAt: new Date().toISOString()
    };
    dbState.players.push(player);
  } else {
    // Edit existing
    player.name = cleanName;
    if (team) player.team = team;
    if (level !== undefined) player.level = Number(level);
    if (hp !== undefined) player.hp = hp;
    if (isAlive !== undefined) player.isAlive = !!isAlive;
    if (points) player.points = points;
    player.updatedAt = new Date().toISOString();
  }

  saveDB();
  res.json({ success: true, player });
});

app.delete("/api/players/:id", (req, res) => {
  const { id } = req.params;
  dbState.players = dbState.players.filter(p => p.id !== id);
  saveDB();
  res.json({ success: true });
});

app.post("/api/parse", (req, res) => {
  const { logText } = req.body;
  if (!logText) {
    return res.status(400).json({ error: "No combat log text provided" });
  }

  const result = parseCombatLog(logText);

  // Add historical record
  const logEntry: BattleLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    turnNumber: result.turnNumber,
    rawText: logText,
    parsedEvents: result.parsedEvents
  };
  dbState.history.unshift(logEntry);
  if (dbState.history.length > 30) {
    dbState.history.pop();
  }
  saveDB();

  res.json({
    success: true,
    turnNumber: result.turnNumber,
    addedPoints: result.addedPoints,
    parsedEvents: result.parsedEvents,
    state: dbState
  });
});

app.post("/api/reset", (req, res) => {
  const { option } = req.body; // "all", "pointsOnly", "players"
  
  if (option === "all") {
    dbState.players = [];
    dbState.history = [];
    dbState.currentTurn = 0;
    dbState.processedTurns = [];
  } else if (option === "pointsOnly") {
    for (const player of dbState.players) {
      player.points = {
        '🗡': 0,
        '🛡': 0,
        '🥊': 0,
        '🌬': 0,
        '⚡️': 0,
        '🤺': 0
      };
    }
    dbState.currentTurn = 0;
    dbState.processedTurns = [];
  } else if (option === "players") {
    dbState.players = [];
  }
  
  saveDB();
  res.json({ success: true, state: dbState });
});

// ----------------------------------------------------
// Telegram Bot Simulator Sandbox Trigger
// ----------------------------------------------------
app.post("/api/simulate-bot", async (req, res) => {
  const { text, userId, username } = req.body;
  if (!text) {
    return res.status(400).json({ error: "No text message provided" });
  }

  const responseObj = await processBotMessageWithOptions(text, userId || 12345, username || "PlayerSimulator");
  res.json(responseObj);
});

// ----------------------------------------------------
// Shared Bot Message Handling Logic
// ----------------------------------------------------
async function processBotMessage(text: string, userId: number, username: string): Promise<string> {
  const resObj = await processBotMessageWithOptions(text, userId, username);
  return resObj.reply;
}

async function processBotMessageWithOptions(
  text: string, 
  userId: number, 
  username: string
): Promise<{ reply: string; buttons?: { text: string; callback_data: string }[] }> {
  const trimmed = text.trim();
  const command = trimmed.split(/\s+/)[0].toLowerCase();

  // Language customization command triggers
  if (command === "/setlang_ru" || command === "/setlang ru") {
    dbState.language = 'ru';
    saveDB();
    return {
      reply: `🇷🇺 <b>Язык бота успешно изменен на Русский!</b>\n\nВведите /help для просмотра справки.`,
      buttons: [
        { text: "🇬🇧 Change Language to English", callback_data: "/setlang_en" }
      ]
    };
  }

  if (command === "/setlang_en" || command === "/setlang en") {
    dbState.language = 'en';
    saveDB();
    return {
      reply: `🇬🇧 <b>Bot language set to English successfully!</b>\n\nType /help to query assistance.`,
      buttons: [
        { text: "🇷🇺 Сменить язык на Русский", callback_data: "/setlang_ru" }
      ]
    };
  }

  const isRu = dbState.language === 'ru';

  // Command handlers
  if (command === "/start" || command === "/help") {
    if (isRu) {
      return {
        reply: `⚔️ <b>Очки Действий Epsilon War</b> ⚔️

Приветствуем, боец! Я помогу тебе автоматически отслеживать <b>Очки Действий (AP)</b> из твоих боевых логов.

<b>Команды:</b>
🔹 /points - Показать текущий баланс очков всех участников боя.
🔹 /status - Показать номер текущего хода и состояние игроков.
🔹 /reset - Сбросить все пулы очков и логи ходов.
🔹 /help - Показать это меню помощи.

👉 <b>Как отслеживать:</b>
Просто перешли или вставь <b>боевой лог</b> прямо в этот чат!
Бот автоматически:
1️⃣ Обновит пулы активного боя живыми бойцами и текущим номером хода.
2️⃣ Распознает полученные очки (🗡 🛡 🥊 ⚡️ 🤺 🌬) по ударам, блокам, уклонениям или контратакам из лога.
3️⃣ Сопоставит и вычтет стоимость использованных способностей (например, <i>использует комбинацию ...</i>).
4️⃣ Покажет сводку баланса каждого бойца и сработавших пассивных перков.`,
        buttons: [
          { text: "🇬🇧 English", callback_data: "/setlang_en" }
        ]
      };
    } else {
      return {
        reply: `⚔️ <b>Epsilon War AP Bot</b> ⚔️

Welcome, fighter! I will help you track <b>Ability Points (AP)</b> automatically from your combat logs.

<b>Commands:</b>
🔹 /points - View point pools for everyone in battle.
🔹 /status - Show current active Turn and player conditions.
🔹 /reset - Reset all point pools and Turn logs.
🔹 /help - Show this help menu.

👉 <b>How to track:</b>
Just forward or paste the <b>combat log</b> directly into this chat!
The bot will:
1️⃣ Update the active combat pools with living fighters and current turn index.
2️⃣ Capture point gains (🗡 🛡 🥊 ⚡️ 🤺 🌬) dynamically from combat hits, block triggers, or counter/evasion actions in the log.
3️⃣ Match and deduct costs of used abilities (e.g. <i>uses combination ...</i>).
4️⃣ Display an summary of each fighter's balance and passive perks.`,
        buttons: [
          { text: "🇷🇺 Русский", callback_data: "/setlang_ru" }
        ]
      };
    }
  }

  if (command === "/points") {
    if (dbState.players.length === 0) {
      return {
        reply: isRu
          ? `❌ В базе данных активного боя пока нет зарегистрированных бойцов. Вставь или перешли боевой лог, чтобы добавить их!`
          : `❌ No players recorded in active battle database yet. Paste or forward a battle log to register them!`
      };
    }
    
    let summary = isRu
      ? `🛡 <b>Текущий баланс Очков Действий:</b>\n\n`
      : `🛡 <b>Current Ability Points Balance:</b>\n\n`;

    const defenders = dbState.players.filter(p => p.team === 'defenders');
    const attackers = dbState.players.filter(p => p.team === 'attackers');
    const others = dbState.players.filter(p => p.team !== 'defenders' && p.team !== 'attackers');

    const blocks: string[] = [];

    if (defenders.length > 0) {
      let defStr = '';
      for (const p of defenders) {
        const health = p.isAlive ? `(❤️ ${p.hp})` : (isRu ? '💀 <i>МЕРТВ</i>' : '💀 <i>DEAD</i>');
        defStr += `🔵 <b>${p.name}</b> Lvl ${p.level} ${health}\n`;
        defStr += `Points: 🗡<b>${p.points['🗡']}</b> 🛡<b>${p.points['🛡']}</b> 🥊<b>${p.points['🥊']}</b> ⚡️<b>${p.points['⚡️']}</b> 🤺<b>${p.points['🤺']}</b> 🌬<b>${p.points['🌬']}</b>\n\n`;
      }
      blocks.push(defStr.trim());
    }

    if (attackers.length > 0) {
      let atkStr = '';
      for (const p of attackers) {
        const health = p.isAlive ? `(❤️ ${p.hp})` : (isRu ? '💀 <i>МЕРТВ</i>' : '💀 <i>DEAD</i>');
        atkStr += `🔴 <b>${p.name}</b> Lvl ${p.level} ${health}\n`;
        atkStr += `Points: 🗡<b>${p.points['🗡']}</b> 🛡<b>${p.points['🛡']}</b> 🥊<b>${p.points['🥊']}</b> ⚡️<b>${p.points['⚡️']}</b> 🤺<b>${p.points['🤺']}</b> 🌬<b>${p.points['🌬']}</b>\n\n`;
      }
      blocks.push(atkStr.trim());
    }

    if (others.length > 0) {
      let othStr = '';
      for (const p of others) {
        const health = p.isAlive ? `(❤️ ${p.hp})` : (isRu ? '💀 <i>МЕРТВ</i>' : '💀 <i>DEAD</i>');
        othStr += `⚪️ <b>${p.name}</b> Lvl ${p.level} ${health}\n`;
        othStr += `Points: 🗡<b>${p.points['🗡']}</b> 🛡<b>${p.points['🛡']}</b> 🥊<b>${p.points['🥊']}</b> ⚡️<b>${p.points['⚡️']}</b> 🤺<b>${p.points['🤺']}</b> 🌬<b>${p.points['🌬']}</b>\n\n`;
      }
      blocks.push(othStr.trim());
    }

    summary += blocks.join('\n\n\n') + '\n';
    return { reply: summary };
  }

  if (command === "/status") {
    const active = dbState.players.filter(p => p.isAlive).length;
    const dead = dbState.players.filter(p => !p.isAlive).length;
    if (isRu) {
      return {
        reply: `📊 <b>Статус битвы Epsilon War:</b>
Ход: <b>${dbState.currentTurn || 'Нет (логи еще не загружались)'}</b>
Обработано ходов: <b>${dbState.processedTurns.length}</b> [${dbState.processedTurns.join(', ')}]
Живых участников: <b>${active}</b>
Павших участников: <b>${dead}</b>`
      };
    } else {
      return {
        reply: `📊 <b>Epsilon War Battle Status:</b>
Turn: <b>${dbState.currentTurn || 'None (No logs yet)'}</b>
Processed Turns count: <b>${dbState.processedTurns.length}</b> [${dbState.processedTurns.join(', ')}]
Living Combatants: <b>${active}</b>
Fallen Combatants: <b>${dead}</b>`
      };
    }
  }

  if (command === "/reset") {
    dbState.players = [];
    dbState.currentTurn = 0;
    dbState.processedTurns = [];
    saveDB();
    return {
      reply: isRu
        ? `🧹 <b>База данных успешно сброшена:</b> все игроки и активные очки действий очищены.`
        : `🧹 <b>Database Reset Successful:</b> All players and active battle points have been cleared.`
    };
  }

  // Treat as raw combat log
  if (trimmed.includes("Ход") || trimmed.includes("использует комбинацию") || trimmed.includes("Защитники") || trimmed.includes("Нападающие") || trimmed.includes("vs")) {
    const result = parseCombatLog(trimmed);
    
    // Create entry in log history
    const logEntry: BattleLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      turnNumber: result.turnNumber,
      rawText: trimmed,
      parsedEvents: result.parsedEvents
    };
    dbState.history.unshift(logEntry);
    if (dbState.history.length > 30) dbState.history.pop();
    saveDB();

    // Group passive/perk activations in this turn by player
    const passivesMap: Record<string, string[]> = {};
    for (const ev of result.parsedEvents) {
      if (ev.actionType === 'passive') {
        if (!passivesMap[ev.playerName]) {
          passivesMap[ev.playerName] = [];
        }
        const cleanedText = ev.detail.replace('Activated passive: ', '').trim();
        if (!passivesMap[ev.playerName].includes(cleanedText)) {
          passivesMap[ev.playerName].push(cleanedText);
        }
      }
    }

    let reply = isRu
      ? `✅ <b>Боевой лог успешно обработан!</b>\n`
      : `✅ <b>Combat Log Parsed Successfully!</b>\n`;

    if (result.turnNumber > 0) {
      reply += isRu
        ? `🎯 <b>Обнаружен ход:</b> ${result.turnNumber}\n`
        : `🎯 <b>Turn Detected:</b> ${result.turnNumber}\n`;
    }
    reply += `━━━━━━━━━━━━━━━━━\n`;

    if (dbState.players.length === 0) {
      reply += isRu
        ? `⚠️ <i>Активные бойцы еще не зарегистрированы.</i>\n`
        : `⚠️ <i>No active fighters registered yet.</i>\n`;
    } else {
      reply += isRu
        ? `🛡 <b>Баланс бойцов:</b>\n`
        : `🛡 <b>Fighter Balances:</b>\n`;

      const defenders = dbState.players.filter(p => p.team === 'defenders');
      const attackers = dbState.players.filter(p => p.team === 'attackers');
      const others = dbState.players.filter(p => p.team !== 'defenders' && p.team !== 'attackers');

      const blocks: string[] = [];

      if (defenders.length > 0) {
        let blockStr = '';
        for (const player of defenders) {
          const health = player.isAlive ? `(❤️ ${player.hp})` : (isRu ? '💀 <i>МЕРТВ</i>' : '💀 <i>DEAD</i>');
          const triggeredPassives = passivesMap[player.name] || [];
          const passivesStr = triggeredPassives.length > 0 ? ` [<b>${triggeredPassives.join(', ')}</b>]` : '';
          blockStr += `🔵 <b>${player.name}</b> ${health}${passivesStr}\n`;
          if (player.targetHits && player.targetHits.length > 0) {
            blockStr += `├─ 🗡<b>${player.points['🗡']}</b> 🛡<b>${player.points['🛡']}</b> 🥊<b>${player.points['🥊']}</b> ⚡️<b>${player.points['⚡️']}</b> 🤺<b>${player.points['🤺']}</b> 🌬<b>${player.points['🌬']}</b>\n`;
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
            const lastHits = player.targetHits.slice(-5);
            const hitEmojis = lastHits.map(z => zoneEmojiMap[z] || z).join(', ');
            blockStr += `└─ [${hitEmojis}]\n`;
          } else {
            blockStr += `└─ 🗡<b>${player.points['🗡']}</b> 🛡<b>${player.points['🛡']}</b> 🥊<b>${player.points['🥊']}</b> ⚡️<b>${player.points['⚡️']}</b> 🤺<b>${player.points['🤺']}</b> 🌬<b>${player.points['🌬']}</b>\n`;
          }
        }
        blocks.push(blockStr.trim());
      }

      if (attackers.length > 0) {
        let blockStr = '';
        for (const player of attackers) {
          const health = player.isAlive ? `(❤️ ${player.hp})` : (isRu ? '💀 <i>МЕРТВ</i>' : '💀 <i>DEAD</i>');
          const triggeredPassives = passivesMap[player.name] || [];
          const passivesStr = triggeredPassives.length > 0 ? ` [<b>${triggeredPassives.join(', ')}</b>]` : '';
          blockStr += `🔴 <b>${player.name}</b> ${health}${passivesStr}\n`;
          if (player.targetHits && player.targetHits.length > 0) {
            blockStr += `├─ 🗡<b>${player.points['🗡']}</b> 🛡<b>${player.points['🛡']}</b> 🥊<b>${player.points['🥊']}</b> ⚡️<b>${player.points['⚡️']}</b> 🤺<b>${player.points['🤺']}</b> 🌬<b>${player.points['🌬']}</b>\n`;
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
            const lastHits = player.targetHits.slice(-5);
            const hitEmojis = lastHits.map(z => zoneEmojiMap[z] || z).join(', ');
            blockStr += `└─ [${hitEmojis}]\n`;
          } else {
            blockStr += `└─ 🗡<b>${player.points['🗡']}</b> 🛡<b>${player.points['🛡']}</b> 🥊<b>${player.points['🥊']}</b> ⚡️<b>${player.points['⚡️']}</b> 🤺<b>${player.points['🤺']}</b> 🌬<b>${player.points['🌬']}</b>\n`;
          }
        }
        blocks.push(blockStr.trim());
      }

      if (others.length > 0) {
        let blockStr = '';
        for (const player of others) {
          const health = player.isAlive ? `(❤️ ${player.hp})` : (isRu ? '💀 <i>МЕРТВ</i>' : '💀 <i>DEAD</i>');
          const triggeredPassives = passivesMap[player.name] || [];
          const passivesStr = triggeredPassives.length > 0 ? ` [<b>${triggeredPassives.join(', ')}</b>]` : '';
          blockStr += `⚪️ <b>${player.name}</b> ${health}${passivesStr}\n`;
          if (player.targetHits && player.targetHits.length > 0) {
            blockStr += `├─ 🗡<b>${player.points['🗡']}</b> 🛡<b>${player.points['🛡']}</b> 🥊<b>${player.points['🥊']}</b> ⚡️<b>${player.points['⚡️']}</b> 🤺<b>${player.points['🤺']}</b> 🌬<b>${player.points['🌬']}</b>\n`;
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
            const lastHits = player.targetHits.slice(-5);
            const hitEmojis = lastHits.map(z => zoneEmojiMap[z] || z).join(', ');
            blockStr += `└─ [${hitEmojis}]\n`;
          } else {
            blockStr += `└─ 🗡<b>${player.points['🗡']}</b> 🛡<b>${player.points['🛡']}</b> 🥊<b>${player.points['🥊']}</b> ⚡️<b>${player.points['⚡️']}</b> 🤺<b>${player.points['🤺']}</b> 🌬<b>${player.points['🌬']}</b>\n`;
          }
        }
        blocks.push(blockStr.trim());
      }

      reply += blocks.join('\n\n') + '\n';
    }

    const activeEvents = result.parsedEvents.filter(ev => ev.actionType !== 'passive');
    if (activeEvents.length > 0) {
      reply += isRu
        ? `\n📝 <b>Распознанные действия:</b>\n`
        : `\n📝 <b>Actions Captured:</b>\n`;

      for (const ev of activeEvents) {
        if (ev.actionType === 'use_ability') {
          reply += isRu
            ? `• 👤 <b>${ev.playerName}</b> использовал <b>${ev.detail}</b>\n`
            : `• 👤 <b>${ev.playerName}</b> cast <b>${ev.detail}</b>\n`;
        }
      }
    }

    return { reply };
  }

  return {
    reply: isRu
      ? `❓ Команда или синтаксис лога не распознаны. Отправьте /help для просмотра справки по командам или вставьте боевой лог Epsilon War для автоматической обработки.`
      : `❓ I didn't recognize that command or log syntax. Send /help to view command assistance or paste your Epsilon War combat log to parse automatically.`
  };
}

// ----------------------------------------------------
// Real Live Telegram Bot Long Polling Instance
// ----------------------------------------------------
let liveBotRunning = false;
let liveBotOffset = 0;

async function runTelegramPollingBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("No TELEGRAM_BOT_TOKEN supplied. Running web-only with Simulator mode.");
    return;
  }

  console.log("Starting real Telegram Long Polling server connecting to @BotFather...");
  liveBotRunning = true;

  while (liveBotRunning) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${liveBotOffset}&timeout=20`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error status ${response.status}`);
      }
      const data = await response.json() as any;
      if (data.ok && data.result) {
        for (const update of data.result) {
          liveBotOffset = Math.max(liveBotOffset, update.update_id + 1);
          
          if (update.message) {
            const msg = update.message;
            const text = msg.text || "";
            const chatId = msg.chat.id;
            const fromUser = msg.from?.username || msg.from?.first_name || "TelegramUser";
            const fromId = msg.from?.id || 0;

            console.log(`[TelegramBot] message received from ${fromUser}: ${text.substring(0, 40)}...`);
            
            // Process message details
            const responseObj = await processBotMessageWithOptions(text, fromId, fromUser);

            // Send back simple response using Fetch
            const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
            const sendBody: any = {
              chat_id: chatId,
              text: responseObj.reply,
              parse_mode: "HTML"
            };
            if (responseObj.buttons) {
              sendBody.reply_markup = {
                inline_keyboard: [
                  responseObj.buttons.map(b => ({
                    text: b.text,
                    callback_data: b.callback_data
                  }))
                ]
              };
            }

            await fetch(sendUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(sendBody)
            });
          } else if (update.callback_query) {
            const cb = update.callback_query;
            const dataCmd = cb.data || "";
            const chatId = cb.message?.chat?.id;
            const fromUser = cb.from?.username || cb.from?.first_name || "TelegramUser";
            const fromId = cb.from?.id || 0;

            if (chatId) {
              const responseObj = await processBotMessageWithOptions(dataCmd, fromId, fromUser);
              const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
              const sendBody: any = {
                chat_id: chatId,
                text: responseObj.reply,
                parse_mode: "HTML"
              };
              if (responseObj.buttons) {
                sendBody.reply_markup = {
                  inline_keyboard: [
                    responseObj.buttons.map(b => ({
                      text: b.text,
                      callback_data: b.callback_data
                    }))
                  ]
                };
              }
              await fetch(sendUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sendBody)
              });
            }

            // answer callback query to remove telegram's button loading animation
            const answerUrl = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
            await fetch(answerUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id })
            }).catch(e => console.error("Error answering callback", e));
          }
        }
      }
    } catch (error) {
      console.error("[TelegramBot] Polling Connection Issue. Retrying in 8s.", error);
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  }
}

// Spark up Real bot polling in background safely
runTelegramPollingBot();

// ----------------------------------------------------
// Front-End SPA Build Asset Serving Setup
// ----------------------------------------------------
async function initializeViteOrSPA() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-Stack dev server initialized on http://localhost:${PORT}`);
  });
}

initializeViteOrSPA();
