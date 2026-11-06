// Telegram menus for the equipment stat calculator.
// All callback_data values start with "eq:" and stay under Telegram's 64-byte limit
// (items are referenced by index, not by name).
import fs from "fs";
import type { PostgresStore } from "../storage/postgres";
import path from "path";
import {
  SLOTS, SLOT_INFO, Slot, EMPTY, ITEM_NAMES, RACES, RACE_BUTTONS,
  TOGGLES, TOGGLE_GROUPS, CLAN_BUFFS, CLAN_BUFF_MAX, PARAMS, RANKS,
  CHAOS_SLOTS, ChaosSlot, CHAOS_STONES, GRADES, formatGrade,
  EquipProfile, defaultProfile, defaultChaos, toggleBuff, calculate, activeSets,
} from "./calculator";

export type Button =
  | { text: string; callback_data: string }
  | { text: string; switch_inline_query_current_chat: string };

export interface EquipReply {
  reply: string;
  keyboard?: Button[][];
  /** true when the reply should replace the message the button belongs to */
  edit?: boolean;
  /** short popup text for answerCallbackQuery */
  alert?: string;
}

// ---------- Persistence ----------
const DB_FILE = path.join(process.cwd(), "data", "equip.json");
let profiles: Record<string, EquipProfile> = {};

function load() {
  try {
    if (fs.existsSync(DB_FILE)) profiles = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    console.error("[equip] failed to load profiles:", e);
  }
}
let equipmentStore: PostgresStore | undefined;
export function configureEquipmentStore(store: PostgresStore) { equipmentStore = store; }

function save() {
  if (equipmentStore) return;
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(profiles, null, 2), "utf-8");
  } catch (e) {
    console.error("[equip] failed to save profiles:", e);
  }
}
load();
// Immutable import source: concurrent requests must not seed from uncommitted cache.
const legacyProfiles = structuredClone(profiles);

export function getProfile(userId: number | string): EquipProfile {
  const id = String(userId);
  const base = defaultProfile();
  const p = profiles[id];
  if (!p) {
    profiles[id] = base;
    return base;
  }
  // Fill in fields added in later versions
  p.equipment = { ...base.equipment, ...p.equipment };
  p.params = { ...base.params, ...p.params };
  p.clan = { ...base.clan, ...p.clan };
  p.toggles = p.toggles || {};
  p.chaos = { ...defaultChaos(), ...p.chaos };
  p.race = p.race || base.race;
  p.rank = p.rank || base.rank;
  return p;
}

export function setProfile(userId: number | string, profile: EquipProfile) {
  profiles[String(userId)] = profile;
  save();
}

// Pending free-text input per user
type Pending = { kind: "item"; slot: Slot } | { kind: "param"; key: string };
const pending = new Map<string, Pending>();

// ---------- Helpers ----------
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cb = (text: string, data: string): Button => ({ text, callback_data: data });
const check = (on: boolean) => (on ? "✅" : "❌");
const BACK_MAIN = cb("⬅️ Меню", "eq:menu");
const PAGE_SIZE = 8;

const isSlot = (s: string): s is Slot => (SLOTS as readonly string[]).includes(s);
const isChaosSlot = (s: string): s is ChaosSlot => (CHAOS_SLOTS as readonly string[]).includes(s);

// ---------- Screens ----------
function mainMenu(): EquipReply {
  return {
    reply: "🧮 <b>Калькулятор статов</b>\n\nВыберите раздел:",
    keyboard: [
      [cb("🎒 Экипировка", "eq:gear"), cb("🧬 Статы", "eq:stats")],
      [cb("☕️ Бафы", "eq:buffs")],
    ],
  };
}

function gearScreen(p: EquipProfile): EquipReply {
  let text = "🎒 <b>Экипировка в расчете</b>\n\n";
  for (const slot of SLOTS) {
    const e = p.equipment[slot];
    text += `${SLOT_INFO[slot].title}: ${esc(e.item)}${e.item !== EMPTY ? ` +${e.enchant}` : ""}\n`;
  }
  text += `\n🧝‍♂️ Раса: ${esc(p.race)}`;
  const sets = activeSets(p);
  if (sets.length) text += `\n🧥 Комплект: ${sets.map(esc).join(", ")}`;

  const rows: Button[][] = [];
  for (let i = 0; i < SLOTS.length; i += 2) {
    rows.push(SLOTS.slice(i, i + 2).map(s => cb(SLOT_INFO[s].button, `eq:slot:${s}`)));
  }
  rows.push([cb("🧝‍♂️ Расы", "eq:race")]);
  rows.push([cb("🔄 Сброс", "eq:reset"), BACK_MAIN]);
  return { reply: text, keyboard: rows };
}

function slotScreen(p: EquipProfile, slot: Slot): EquipReply {
  const e = p.equipment[slot];
  let text = `${SLOT_INFO[slot].title}\n\n`;
  text += e.item === EMPTY ? "Нет активной экипировки в этом слоте" : `Экипировано: ${esc(e.item)} +${e.enchant}`;
  if (isChaosSlot(slot)) {
    text += "\n\n♎️ Камни хаоса:\n" + p.chaos[slot].map((st, i) => `📦 Слот ${i + 1}: ${st.type} ${st.type !== EMPTY ? formatGrade(st.grade) : ""}`).join("\n");
  }
  const rows: Button[][] = [
    [cb("📜 Список", `eq:pick:${slot}:0`), cb("🔎 Поиск", `eq:find:${slot}`)],
    [cb("🔖 Уровень заточки", `eq:ench:${slot}`)],
  ];
  if (isChaosSlot(slot)) rows.push([cb("♎️ Камни хаоса", `eq:chaos:${slot}`)]);
  rows.push([cb("⬅️ Назад", "eq:gear")]);
  return { reply: text, keyboard: rows };
}

function pickScreen(slot: Slot, page: number, names: { name: string; idx: number }[], title: string): EquipReply {
  const pages = Math.max(1, Math.ceil(names.length / PAGE_SIZE));
  page = Math.min(Math.max(0, page), pages - 1);
  const chunk = names.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const rows: Button[][] = chunk.map(n => [cb(n.name, `eq:set:${slot}:${n.idx}`)]);
  if (page === 0) rows.unshift([cb("🚫 Пусто (снять)", `eq:set:${slot}:-1`)]);
  const nav: Button[] = [];
  if (page > 0) nav.push(cb("◀️", `eq:pick:${slot}:${page - 1}`));
  nav.push(cb(`${page + 1}/${pages}`, `eq:pick:${slot}:${page}`));
  if (page < pages - 1) nav.push(cb("▶️", `eq:pick:${slot}:${page + 1}`));
  rows.push(nav);
  rows.push([cb("⬅️ Назад", `eq:slot:${slot}`)]);
  return { reply: `${SLOT_INFO[slot].title} — ${title}`, keyboard: rows };
}

function allNames(slot: Slot) {
  return ITEM_NAMES[slot].map((name, idx) => ({ name, idx }));
}

function enchantScreen(p: EquipProfile, slot: Slot): EquipReply {
  const cur = p.equipment[slot].enchant;
  const rows: Button[][] = [];
  const btns = Array.from({ length: 11 }, (_, i) => cb(`+${i}${cur === i ? " ✅" : ""}`, `eq:enc:${slot}:${i}`));
  for (let i = 0; i < btns.length; i += 4) rows.push(btns.slice(i, i + 4));
  rows.push([cb("⬅️ Назад", `eq:slot:${slot}`)]);
  return { reply: `${SLOT_INFO[slot].title}\n\n🔖 Выберите уровень заточки:`, keyboard: rows };
}

function raceScreen(p: EquipProfile): EquipReply {
  const rows = Object.keys(RACES).map((r, i) => [cb(`${RACE_BUTTONS[r] || r}${p.race === r ? " ✅" : ""}`, `eq:setrace:${i}`)]);
  rows.push([cb("⬅️ Назад", "eq:gear")]);
  return { reply: `🧝‍♂️ Выберите расу:\n\nТекущая раса: ${esc(p.race)}`, keyboard: rows };
}

function statsScreen(p: EquipProfile): EquipReply {
  const s = calculate(p);
  const rank = RANKS.find(r => r.id === p.rank);
  const sets = activeSets(p);
  let text =
    "🧬 <b>Характеристики</b>\n\n" +
    `🧝‍♂️ Раса: ${esc(p.race)}\n` +
    `🏵 Звание: ${rank?.name ?? "-"}\n\n` +
    `❤️ Здоровье: ${s.health}\n` +
    `🗡 Атака: ${s.attack}\n` +
    `🔰 Защита: ${s.defense}\n` +
    `🥊 Крит: ${s.crit_chance}\n` +
    `💥 Сила крита: ${s.crit_damage}\n` +
    `👁 Предвидение: ${s.prediction}\n` +
    `⚡️ Уворот: ${s.dodge}\n` +
    `🤺 Контрудар: ${s.counter}\n` +
    `🎯 Точность: ${s.accuracy}\n` +
    `🧡 Сила комбо: ${s.combo_power}\n\n` +
    `🏃🏻‍♂️ Скорость: ${s.speed}/минуту\n\n` +
    `➕ Бонус к опыту: ${s.exp_bonus}%\n` +
    `➕ Бонус к золоту: ${s.gold_bonus}%\n` +
    `➕ Бонус к дропу: ${s.drop_bonus}%\n\n` +
    "🧬 Параметры героя:\n" +
    Object.entries(PARAMS).map(([k, label]) => `${label}: ${p.params[k] || 0}`).join("\n");
  if (sets.length) text += `\n\n🧥 Активный комплект: ${sets.map(esc).join(", ")}`;
  return { reply: text, keyboard: [[cb("🔄 Обновить", "eq:stats"), BACK_MAIN]] };
}

function buffsScreen(): EquipReply {
  return {
    reply: "☕️ <b>Бафы</b>\n\nВыберите раздел:",
    keyboard: [
      [cb("🍛 Еда", "eq:tg:food"), cb("💟 Таланты", "eq:tg:talents")],
      [cb("📯 Клановые", "eq:clan"), cb("🧬 Параметры", "eq:params")],
      [cb("🏵 Звания", "eq:ranks"), cb("📚 Прочие", "eq:tg:other")],
      [BACK_MAIN],
    ],
  };
}

const GROUP_TITLES: Record<string, string> = {
  food: "🍛 Еда", talents: "💟 Таланты", other: "📚 Прочие",
  fish: "🍲 Блюдо из рыбы", meat: "🥘 Блюдо из мяса", akvel: "🍛 Аквельский обед",
};

function toggleScreen(p: EquipProfile, group: string): EquipReply {
  const keys = TOGGLE_GROUPS[group] || [];
  const rows: Button[][] = [];
  if (group === "food") {
    for (const sub of ["fish", "meat", "akvel"]) {
      const active = TOGGLE_GROUPS[sub].find(k => p.toggles[k]);
      rows.push([cb(`${GROUP_TITLES[sub]}${active ? " ✅" : ""}`, `eq:tg:${sub}`)]);
    }
  }
  for (const k of keys) rows.push([cb(`${TOGGLES[k]} ${check(!!p.toggles[k])}`, `eq:t:${group}:${k}`)]);
  const parent = ["fish", "meat", "akvel"].includes(group) ? "eq:tg:food" : "eq:buffs";
  rows.push([cb("⬅️ Назад", parent)]);
  return { reply: `${GROUP_TITLES[group] || group}\n\nНажмите, чтобы включить/выключить:`, keyboard: rows };
}

function clanScreen(p: EquipProfile): EquipReply {
  const text = "📯 <b>Клановые навыки</b>\n\nТекущие значения:\n" +
    Object.entries(CLAN_BUFFS).map(([k, l]) => `${l}: +${p.clan[k] || 0}%`).join("\n") +
    "\n\nВыберите клановый навык:";
  const rows = Object.entries(CLAN_BUFFS).map(([k, l]) => [cb(l, `eq:clan:${k}`)]);
  rows.push([cb("⬅️ Назад", "eq:buffs")]);
  return { reply: text, keyboard: rows };
}

function clanBuffScreen(p: EquipProfile, key: string): EquipReply {
  const cur = p.clan[key] || 0;
  const btns = Array.from({ length: CLAN_BUFF_MAX + 1 }, (_, i) => cb(`+${i}%${cur === i ? " ✅" : ""}`, `eq:clanset:${key}:${i}`));
  const rows: Button[][] = [];
  for (let i = 0; i < btns.length; i += 4) rows.push(btns.slice(i, i + 4));
  rows.push([cb("⬅️ Назад", "eq:clan")]);
  return { reply: `${CLAN_BUFFS[key]}\n\nВыберите бонус навыка:`, keyboard: rows };
}

function paramsScreen(p: EquipProfile): EquipReply {
  const text = "🧬 <b>Текущие параметры героя:</b>\n\n" +
    Object.entries(PARAMS).map(([k, l]) => `${l}: ${p.params[k] || 0}`).join("\n");
  const rows = Object.entries(PARAMS).map(([k, l]) => [cb(l, `eq:param:${k}`)]);
  rows.push([cb("⬅️ Назад", "eq:buffs")]);
  return { reply: text, keyboard: rows };
}

function ranksScreen(p: EquipProfile): EquipReply {
  const text = "🏵 <b>Список званий</b>\n\n" + RANKS.map(r => `• ${r.name} - ${r.desc}`).join("\n");
  const rows = RANKS.map(r => [cb(`🏵 ${r.name}${p.rank === r.id ? " ✅" : ""}`, `eq:rank:${r.id}`)]);
  rows.push([cb("⬅️ Назад", "eq:buffs")]);
  return { reply: text, keyboard: rows };
}

function chaosScreen(p: EquipProfile, slot: ChaosSlot): EquipReply {
  const text = `♎️ Камни хаоса — ${SLOT_INFO[slot].title}\n\nКамни в слотах:\n` +
    p.chaos[slot].map((st, i) => `📦 Слот ${i + 1}: ${st.type} ${formatGrade(st.grade)}`).join("\n");
  const rows = [0, 1, 2].map(i => [cb(`📦 Слот ${i + 1}`, `eq:chs:${slot}:${i}`)]);
  rows.push([cb("⬅️ Назад", `eq:slot:${slot}`)]);
  return { reply: text, keyboard: rows };
}

function chaosSlotScreen(p: EquipProfile, slot: ChaosSlot, n: number): EquipReply {
  const st = p.chaos[slot][n];
  const rows: Button[][] = [];
  rows.push(...CHAOS_STONES[slot].map((d, i) => [cb(`${d.label}${st.type === d.id ? " ✅" : ""}`, `eq:cht:${slot}:${n}:${i}`)]));
  rows.push([cb(`Пусто${st.type === EMPTY ? " ✅" : ""}`, `eq:cht:${slot}:${n}:-1`)]);
  rows.push(GRADES.map((g, i) => cb(`${g}${st.grade === i + 1 ? "✅" : ""}`, `eq:chg:${slot}:${n}:${i + 1}`)));
  rows.push([cb("⬅️ Назад", `eq:chaos:${slot}`)]);
  return {
    reply: `♎️ Камни хаоса — ${SLOT_INFO[slot].title}\n└ Слот ${n + 1}\n\n📦 Камень в слоте: ${st.type} ${formatGrade(st.grade)}\n\nВыберите тип и грейд камня:`,
    keyboard: rows,
  };
}

function inputPrompt(text: string, cancelTo: string): EquipReply {
  return { reply: text, keyboard: [[cb("🚫 Отмена", `eq:cancel:${cancelTo}`)]] };
}

// ---------- Entry points ----------

/** Text commands that open the calculator. Returns null if not an equip command. */
export function handleEquipCommand(text: string, userId: number | string): EquipReply | null {
  const cmd = text.trim().split(/\s+/)[0].toLowerCase().replace(/@\w+$/, "");
  const p = getProfile(userId);
  if (cmd === "/equip" || cmd === "/eq" || cmd === "/calc") { pending.delete(String(userId)); return mainMenu(); }
  if (cmd === "/gear") { pending.delete(String(userId)); return gearScreen(p); }
  if (cmd === "/stats") { pending.delete(String(userId)); return statsScreen(p); }
  if (cmd === "/buffs") { pending.delete(String(userId)); return buffsScreen(); }
  return null;
}

/** Free-text input the user was asked for (item name, parameter value). */
export function handlePendingInput(text: string, userId: number | string): EquipReply | null {
  const id = String(userId);
  const pend = pending.get(id);
  if (!pend || text.trim().startsWith("/")) return null;
  const p = getProfile(userId);
  const value = text.trim();

  if (pend.kind === "param") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      return inputPrompt("Поддерживаются только целые числа (0–1000). Попробуйте ещё раз:", "params");
    }
    pending.delete(id);
    p.params[pend.key] = n;
    setProfile(userId, p);
    return paramsScreen(p);
  }

  const slot = pend.slot;
  const names = ITEM_NAMES[slot];
  if (value === EMPTY) {
    pending.delete(id);
    p.equipment[slot] = { item: EMPTY, enchant: 0 };
    setProfile(userId, p);
    return slotScreen(p, slot);
  }
  const exact = names.indexOf(value);
  if (exact >= 0) {
    pending.delete(id);
    p.equipment[slot] = { item: names[exact], enchant: p.equipment[slot].enchant };
    setProfile(userId, p);
    return slotScreen(p, slot);
  }
  const q = value.toLowerCase();
  const found = allNames(slot).filter(n => n.name.toLowerCase().includes(q));
  if (found.length === 0) {
    return inputPrompt(`Ничего не найдено по запросу «${esc(value)}». Введите другое название:`, `slot:${slot}`);
  }
  pending.delete(id);
  const res = pickScreen(slot, 0, found.slice(0, 40), `найдено: ${found.length}${found.length > 40 ? " (показаны первые 40)" : ""}`);
  return res;
}

/** Inline-button presses. Returns null if callback data does not belong to this module. */
export function handleEquipCallback(data: string, userId: number | string): EquipReply | null {
  if (!data.startsWith("eq:")) return null;
  const parts = data.split(":");
  const action = parts[1];
  const id = String(userId);
  const p = getProfile(userId);
  const done = (r: EquipReply, alert?: string): EquipReply => ({ ...r, edit: true, alert });
  const persist = () => setProfile(userId, p);

  switch (action) {
    case "menu": pending.delete(id); return done(mainMenu());
    case "gear": pending.delete(id); return done(gearScreen(p));
    case "stats": return done(statsScreen(p));
    case "buffs": pending.delete(id); return done(buffsScreen());

    case "slot": {
      const slot = parts[2];
      if (!isSlot(slot)) return null;
      pending.delete(id);
      return done(slotScreen(p, slot));
    }
    case "pick": {
      const slot = parts[2];
      if (!isSlot(slot)) return null;
      return done(pickScreen(slot, Number(parts[3]) || 0, allNames(slot), "выберите предмет"));
    }
    case "find": {
      const slot = parts[2];
      if (!isSlot(slot)) return null;
      pending.set(id, { kind: "item", slot });
      const r = inputPrompt(`${SLOT_INFO[slot].title}\n\n🔎 Отправьте полное название или часть названия предмета.`, `slot:${slot}`);
      r.keyboard!.unshift([{ text: "📜 Inline-поиск", switch_inline_query_current_chat: `Поиск ${slot}: ` }]);
      return done(r);
    }
    case "set": {
      const slot = parts[2];
      if (!isSlot(slot)) return null;
      const idx = Number(parts[3]);
      if (idx === -1) p.equipment[slot] = { item: EMPTY, enchant: 0 };
      else {
        const name = ITEM_NAMES[slot][idx];
        if (!name) return done(slotScreen(p, slot), "Предмет не найден");
        p.equipment[slot] = { item: name, enchant: p.equipment[slot].enchant };
      }
      pending.delete(id);
      persist();
      return done(slotScreen(p, slot), "Готово");
    }
    case "ench": {
      const slot = parts[2];
      if (!isSlot(slot)) return null;
      return done(enchantScreen(p, slot));
    }
    case "enc": {
      const slot = parts[2];
      const n = Number(parts[3]);
      if (!isSlot(slot) || !(n >= 0 && n <= 10)) return null;
      p.equipment[slot].enchant = n;
      persist();
      return done(enchantScreen(p, slot));
    }
    case "race": return done(raceScreen(p));
    case "setrace": {
      const race = Object.keys(RACES)[Number(parts[2])];
      if (!race) return null;
      if (race === p.race) return done(raceScreen(p), "Вы уже используете эту расу");
      p.race = race;
      persist();
      return done(raceScreen(p), "Успешно");
    }
    case "reset":
      return done({
        reply: "🔄 <b>Сброс</b>\n\nСбросить выбранную экипировку и камни хаоса?\nЭто действие нельзя будет отменить.",
        keyboard: [[cb("✅ Да", "eq:resetyes"), cb("❌ Нет", "eq:gear")]],
      });
    case "resetyes": {
      const fresh = defaultProfile();
      p.equipment = fresh.equipment;
      p.chaos = fresh.chaos;
      persist();
      return done(gearScreen(p), "Экипировка сброшена");
    }

    case "tg": {
      const group = parts[2];
      if (!TOGGLE_GROUPS[group]) return null;
      return done(toggleScreen(p, group));
    }
    case "t": {
      const group = parts[2];
      const key = parts[3];
      if (!TOGGLE_GROUPS[group]?.includes(key)) return null;
      toggleBuff(p, key);
      persist();
      return done(toggleScreen(p, group));
    }
    case "clan": {
      const key = parts[2];
      if (!key) return done(clanScreen(p));
      if (!CLAN_BUFFS[key]) return null;
      return done(clanBuffScreen(p, key));
    }
    case "clanset": {
      const key = parts[2];
      const n = Number(parts[3]);
      if (!CLAN_BUFFS[key] || !(n >= 0 && n <= CLAN_BUFF_MAX)) return null;
      p.clan[key] = n;
      persist();
      return done(clanBuffScreen(p, key));
    }
    case "params": pending.delete(id); return done(paramsScreen(p));
    case "param": {
      const key = parts[2];
      if (!PARAMS[key]) return null;
      pending.set(id, { kind: "param", key });
      return done(inputPrompt(`${PARAMS[key]}\n\nОтправьте новое значение (сейчас: ${p.params[key] || 0}).\nПодсказка: максимум в игре 102 параметра.`, "params"));
    }
    case "ranks": return done(ranksScreen(p));
    case "rank": {
      const r = RANKS.find(x => x.id === parts[2]);
      if (!r) return null;
      if (p.rank === r.id) return done(ranksScreen(p), "У вас уже выбрано это звание!");
      p.rank = r.id;
      persist();
      return done(ranksScreen(p));
    }

    case "chaos": {
      const slot = parts[2];
      if (!isChaosSlot(slot)) return null;
      return done(chaosScreen(p, slot));
    }
    case "chs": {
      const slot = parts[2];
      const n = Number(parts[3]);
      if (!isChaosSlot(slot) || !(n >= 0 && n <= 2)) return null;
      return done(chaosSlotScreen(p, slot, n));
    }
    case "cht": {
      const slot = parts[2];
      const n = Number(parts[3]);
      const t = Number(parts[4]);
      if (!isChaosSlot(slot) || !(n >= 0 && n <= 2)) return null;
      const def = CHAOS_STONES[slot][t];
      p.chaos[slot][n].type = t === -1 || !def ? EMPTY : def.id;
      persist();
      return done(chaosSlotScreen(p, slot, n));
    }
    case "chg": {
      const slot = parts[2];
      const n = Number(parts[3]);
      const g = Number(parts[4]);
      if (!isChaosSlot(slot) || !(n >= 0 && n <= 2) || !(g >= 1 && g <= GRADES.length)) return null;
      p.chaos[slot][n].grade = g;
      persist();
      return done(chaosSlotScreen(p, slot, n));
    }

    case "cancel": {
      pending.delete(id);
      const target = parts[2];
      if (target === "params") return done(paramsScreen(p), "Ввод отменён");
      if (target === "slot" && isSlot(parts[3])) return done(slotScreen(p, parts[3] as Slot), "Ввод отменён");
      return done(mainMenu(), "Ввод отменён");
    }
  }
  return null;
}

/** Inline mode: "Поиск <slot>: <text>" → list of item names. */
export function handleEquipInlineQuery(query: string, offset: number) {
  const m = query.match(/^Поиск\s+(\w+):\s*(.*)$/);
  if (!m || !isSlot(m[1])) return null;
  const slot = m[1];
  const q = m[2].trim().toLowerCase();
  const names = ITEM_NAMES[slot].filter(n => !q || n.toLowerCase().includes(q));
  const limit = 50;
  const results: any[] = [];
  if (offset === 0) {
    results.push({ type: "article", id: "empty", title: EMPTY, description: "Убрать экипировку из слота", input_message_content: { message_text: EMPTY } });
  }
  const page = names.slice(offset, offset + limit - (offset === 0 ? 1 : 0));
  page.forEach((name, i) => results.push({
    type: "article", id: String(offset + i), title: name, description: SLOT_INFO[slot].title,
    input_message_content: { message_text: name },
  }));
  const next = offset + page.length;
  return { results, next_offset: next < names.length ? String(next) : "" };
}


/** Load, handle, and save one user's equipment interaction atomically. */
export async function handleEquipMessage(text: string, userId: number | string, updateId?: number): Promise<EquipReply | null> {
  const handle = () => handleEquipCallback(text.trim(), userId) ?? handleEquipCommand(text, userId) ?? handlePendingInput(text, userId);
  if (!equipmentStore) return handle();
  const id = String(userId);
  const initial = { profile: structuredClone(legacyProfiles[id] ?? defaultProfile()), pending: null as Pending | null };
  const snapshot = structuredClone(initial);
  try {
    return await equipmentStore.withState(id, initial, async state => {
      profiles[id] = state.profile;
      if (state.pending) pending.set(id, state.pending); else pending.delete(id);
      const result = handle();
      return { state: { profile: getProfile(id), pending: pending.get(id) ?? null }, result };
    }, updateId);
  } catch (error) {
    profiles[id] = snapshot.profile;
    if (snapshot.pending) pending.set(id, snapshot.pending); else pending.delete(id);
    throw error;
  }
}
