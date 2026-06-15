export interface Player {
  id: string;
  name: string;
  team: 'defenders' | 'attackers' | 'unknown';
  level: number;
  hp: string;
  isAlive: boolean;
  points: {
    '🗡': number;
    '🛡': number;
    '🥊': number;
    '🌬': number;
    '⚡️': number;
    '🤺': number;
  };
  targetHits?: string[];
  updatedAt: string;
}

export interface BattleLogEntry {
  id: string;
  timestamp: string;
  turnNumber: number;
  rawText: string;
  parsedEvents: {
    playerName: string;
    actionType: 'use_ability' | 'hit' | 'passive';
    detail: string;
    cost?: Record<string, number>;
  }[];
}

export interface Settings {
  startingPoints: {
    '🗡': number;
    '🛡': number;
    '🥊': number;
    '🌬': number;
    '⚡️': number;
    '🤺': number;
  };
}

export interface DatabaseState {
  players: Player[];
  history: BattleLogEntry[];
  settings: Settings;
  currentTurn: number;
  processedTurns: number[];
  language?: 'en' | 'ru';
}

export const DEFAULT_EMOJIS = ['🗡', '🛡', '🥊', '⚡️', '🤺', '🌬'] as const;

export type AP_Emoji = typeof DEFAULT_EMOJIS[number];
