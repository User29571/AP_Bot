// Stat calculator for Epsilion War equipment.
// Ported from heckertopgg/equip_bot (MIT, see equip/data/LICENSE).
import fs from "fs";
import path from "path";

export const SLOTS = [
  "weapon", "helmet", "chestplate", "gloves", "boots",
  "shield", "ring", "necklace", "accessories", "talisman",
] as const;
export type Slot = typeof SLOTS[number];

export const SLOT_INFO: Record<Slot, { file: string; title: string; button: string }> = {
  weapon:      { file: "weapons.json",     title: "🔪 Оружие",    button: "🔪 Оружие" },
  helmet:      { file: "helments.json",    title: "🎩 Шлем",      button: "🎩 Шлемы" },
  chestplate:  { file: "chestplates.json", title: "🎽 Доспех",    button: "🎽 Доспехи" },
  gloves:      { file: "gloves.json",      title: "🧤 Перчатки",  button: "🧤 Перчатки" },
  boots:       { file: "boots.json",       title: "🥾 Сапоги",    button: "🥾 Сапоги" },
  shield:      { file: "shields.json",     title: "🛡 Щит",       button: "🛡 Щиты" },
  ring:        { file: "rings.json",       title: "💍 Кольцо",    button: "💍 Кольца" },
  necklace:    { file: "necklaces.json",   title: "📿 Колье",     button: "📿 Колье" },
  accessories: { file: "accessories.json", title: "🌂 Аксессуар", button: "🌂 Аксессуары" },
  talisman:    { file: "talismans.json",   title: "🎐 Талисман",  button: "🎐 Талисманы" },
};

export const EMPTY = "Пусто";

// ---------- Item database ----------
type RawItem = Record<string, number | string | boolean>;
const DATA_DIR = path.join(process.cwd(), "equip", "data");

function loadJson(file: string): Record<string, RawItem> {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
  } catch (e) {
    console.error(`[equip] failed to load ${file}:`, e);
    return {};
  }
}

export const ITEMS: Record<Slot, Record<string, RawItem>> = Object.fromEntries(
  SLOTS.map(s => [s, loadJson(SLOT_INFO[s].file)])
) as Record<Slot, Record<string, RawItem>>;
export const ITEM_NAMES: Record<Slot, string[]> = Object.fromEntries(
  SLOTS.map(s => [s, Object.keys(ITEMS[s])])
) as Record<Slot, string[]>;
export const RACES: Record<string, RawItem> = loadJson("race.json");

// ---------- Stats ----------
export const STAT_KEYS = [
  "health", "attack", "defense", "crit_chance", "crit_damage", "prediction",
  "dodge", "counter", "accuracy", "combo_power", "exp_bonus", "gold_bonus",
  "drop_bonus", "speed",
] as const;
export type StatKey = typeof STAT_KEYS[number];
export type Stats = Record<StatKey, number>;

const STAT_MAPPING: Record<string, StatKey> = {
  hp: "health", atk: "attack", def: "defense", krit: "crit_chance", sk: "crit_damage",
  pred: "prediction", yvorot: "dodge", kontratk: "counter", tochn: "accuracy",
  exp: "exp_bonus", gold: "gold_bonus", drop: "drop_bonus", skc: "combo_power", speed: "speed",
};

const GRADE_IV_STAT_INCREASES: Record<string, Partial<Record<StatKey, number>>> = {
  "Гладиатор": { prediction: 4, health: 3 },
  "Целитель": { accuracy: 2, prediction: 3, attack: 4 },
  "Инквизитор": { accuracy: 2, prediction: 3, attack: 3 },
};

// ---------- Buffs catalogue ----------
// Toggles that are mutually exclusive in pairs (e.g. fish dish I vs III).
export const TOGGLE_PAIRS: Record<string, string> = {
  fish_eat_1: "fish_eat_3", fish_eat_3: "fish_eat_1",
  meat_eat_1: "meat_eat_3", meat_eat_3: "meat_eat_1",
  akvel_eat_1: "akvel_eat_3", akvel_eat_3: "akvel_eat_1",
  tree: "snowman", snowman: "tree",
  eye_tal: "eye_tal_4", eye_tal_4: "eye_tal",
  pred_tal: "pred_tal_4", pred_tal_4: "pred_tal",
};

export const TOGGLES: Record<string, string> = {
  fish_eat_1: "🍲 Блюдо из рыбы [I] +50❤️",
  fish_eat_3: "🍲 Блюдо из рыбы [III] +100❤️",
  meat_eat_1: "🥘 Блюдо из мяса [I] +10🗡",
  meat_eat_3: "🥘 Блюдо из мяса [III] +20🗡",
  akvel_eat_1: "🍛 Аквельский обед [I] +15🗡 +75❤️",
  akvel_eat_3: "🍛 Аквельский обед [III] +25🗡 +125❤️",
  garlic_eat: "🍲 Чесночная похлебка [I] +4%🎯",
  carrot_eat: "🥮 Пастуший хлеб [I] +4%🥊",
  pepper_eat: "🥘 Острое лечо [I] +4%👁",
  onion_eat: "🍛 Луковый суп [I] +4%⚡️",
  eye_tal: "💟 Орлиный глаз +50🎯",
  eye_tal_4: "💟 Орлиный глаз [IV] +150🎯",
  arm_tal: "💟 Блестящие латы +10%🔰",
  hp_tal: "💟 Закалка +10%❤️",
  pred_tal: "💟 Оракул +50👁",
  pred_tal_4: "💟 Оракул [IV] +150👁",
  atk_tal: "💟 Потрошитель +5%🗡",
  kompl: "💝 Комплимент +14❤️",
  karma: "💩 Карма -10❤️",
  hell_tikva: "🎃 Тыквенная голова +20🗡 +60% опыта",
  snowman: "☃️ Новогодний снеговик +15🔰 +25% золота",
  tree: "🎄 Новогодняя елка +70❤️ +25% дропа",
};

export const TOGGLE_GROUPS: Record<string, string[]> = {
  fish: ["fish_eat_1", "fish_eat_3"],
  meat: ["meat_eat_1", "meat_eat_3"],
  akvel: ["akvel_eat_1", "akvel_eat_3"],
  food: ["garlic_eat", "carrot_eat", "pepper_eat", "onion_eat"],
  talents: ["eye_tal", "eye_tal_4", "arm_tal", "hp_tal", "pred_tal", "pred_tal_4", "atk_tal"],
  other: ["kompl", "karma", "hell_tikva", "snowman", "tree"],
};

export const CLAN_BUFFS: Record<string, string> = {
  atk: "🗡 Уход за оружием",
  hp: "❤️ Тренировка выносливости",
  def: "🔰 Гильдейский кузнец",
  krityvr: "🥊 ⚡️ Внимательность",
  predtoch: "👁 🎯 Живая интуиция",
};
export const CLAN_BUFF_MAX = 11;

export const PARAMS: Record<string, string> = {
  strength: "✊ Сила",
  endur: "♥️ Выносливость",
  lovk: "💫 Ловкость",
  intyat: "🧿 Интуиция",
};

export const PARAMETER_POINT_BUDGET = 222;

export function parameterPointCost(level: number): number {
  return Math.min(level, 80) + 2 * Math.max(0, Math.min(level, 110) - 80) + 3 * Math.max(0, level - 110);
}

export const RANKS: { id: string; name: string; desc: string; bonus: Partial<Stats> }[] = [
  { id: "novobranec", name: "Новобранец", desc: "от 0 до 50 🏵", bonus: {} },
  { id: "oryjenosec", name: "Оруженосец", desc: "от 50 до 100 🏵 (1 скорость)", bonus: { speed: 1 } },
  { id: "soldier", name: "Солдат", desc: "от 100 до 200 🏵 (1 скорость, 1 атака)", bonus: { speed: 1, attack: 1 } },
  { id: "knight", name: "Рыцарь", desc: "от 200 до 500 🏵 (2 скорости, 1 атака)", bonus: { speed: 2, attack: 1 } },
  { id: "baron", name: "Барон", desc: "от 500 до 1000 🏵 (2 скорости, 2 атаки)", bonus: { speed: 2, attack: 2 } },
  { id: "vikont", name: "Виконт", desc: "от 1000 до 2000 🏵 (3 скорости, 2 атаки)", bonus: { speed: 3, attack: 2 } },
  { id: "graf", name: "Граф", desc: "от 2000 до 5000 🏵 (3 скорости, 3 атаки)", bonus: { speed: 3, attack: 3 } },
  { id: "markiz", name: "Маркиз", desc: "от 5000 до 10000 🏵 (4 скорости, 4 атаки, 50 здоровья)", bonus: { speed: 4, attack: 4, health: 50 } },
  { id: "gercog", name: "Герцог", desc: "от 10000 🏵 (5 скорости, 5 атаки, 5 брони, 100 здоровья)", bonus: { speed: 5, attack: 5, defense: 5, health: 100 } },
  { id: "hero", name: "Герой", desc: "победитель предыдущей 🏆Олимпиады (5 скорости, 5 атаки, 5 брони, 100 здоровья, +10% дроп)", bonus: { speed: 5, attack: 5, defense: 5, health: 100, drop_bonus: 10 } },
];

export const RACE_BUTTONS: Record<string, string> = {
  "Человек": "🤴️ Человек",
  "Эльф": "🧝‍♂️ Эльф",
  "Орк": "🧟‍♂️ Орк",
};

// ---------- Chaos stones ----------
export const CHAOS_SLOTS = ["weapon", "helmet", "boots"] as const;
export type ChaosSlot = typeof CHAOS_SLOTS[number];

export const CHAOS_STONES: Record<ChaosSlot, { id: string; label: string; stat: StatKey; values: number[] }[]> = {
  weapon: [
    { id: "Атаки", label: "🗡 Камень атаки", stat: "attack", values: [3, 7, 12, 18, 25] },
  ],
  helmet: [
    { id: "Защиты", label: "🔰 Камень защиты", stat: "defense", values: [3, 7, 12, 18, 25] },
    { id: "Точности", label: "🎯 Камень точности", stat: "accuracy", values: [5, 11, 20, 31, 44] },
    { id: "Предвидения", label: "👁 Камень предвидения", stat: "prediction", values: [5, 11, 20, 31, 44] },
  ],
  boots: [
    { id: "Здоровья", label: "❤️ Камень здоровья", stat: "health", values: [8, 26, 53, 86, 125] },
    { id: "Крита", label: "🥊 Камень крита", stat: "crit_chance", values: [10, 22, 40, 62, 114] },
    { id: "Уворота", label: "⚡️ Камень уворота", stat: "dodge", values: [10, 22, 40, 62, 88] },
  ],
};

export const GRADES = ["I", "II", "III", "III+", "IV"];
export function formatGrade(g: number): string {
  return GRADES[g - 1] ?? String(g);
}

// ---------- Equipment sets ----------
export const EQUIPMENT_SETS: Record<string, { items: Partial<Record<Slot, string>>; bonus: Partial<Stats> }> = {
  "Рока ⚔️": {
    items: { helmet: "🎩 Панцирный шлем Рока⚔️ [IV]", chestplate: "🎽 Панцирь Рока⚔️ [IV]", gloves: "🧤 Панцирные перчатки Рока⚔️ [IV]", boots: "🥾 Панцирные сапоги Рока⚔️ [IV]" },
    bonus: { crit_chance: 157, prediction: 117, dodge: 300, accuracy: 195 },
  },
  "Фракийца ⚔️": {
    items: { helmet: "🎩 Панцирный шлем Фракийца⚔️ [IV]", chestplate: "🎽 Панцирь Фракийца⚔️ [IV]", gloves: "🧤 Панцирные перчатки Фракийца⚔️ [IV]", boots: "🥾 Панцирные сапоги Фракийца⚔️ [IV]" },
    bonus: { health: 132, attack: 30, defense: 57, prediction: 47, dodge: 260, accuracy: 101 },
  },
  "Тьмы 🏹": {
    items: { helmet: "🎩 Кожаный шлем тьмы🏹 [IV]", chestplate: "🎽 Кожаный доспех тьмы🏹 [IV]", gloves: "🧤 Кожаные перчатки тьмы🏹 [IV]", boots: "🥾 Кожаные сапоги тьмы🏹 [IV]" },
    bonus: { health: 250, attack: 150, defense: 44, prediction: 85, dodge: 150, counter: 5, accuracy: 50 },
  },
  "Тьмы 🗡": {
    items: { helmet: "🎩 Кожаный шлем тьмы🗡 [IV]", chestplate: "🎽 Кожаный доспех тьмы🗡 [IV]", gloves: "🧤 Кожаные перчатки тьмы🗡 [IV]", boots: "🥾 Кожаные сапоги тьмы🗡 [IV]" },
    bonus: { health: 250, crit_chance: 140, crit_damage: 10, accuracy: 139 },
  },
  "Света 🏹": {
    items: { helmet: "🎩 Кожаный шлем света🏹 [IV]", chestplate: "🎽 Кожаный доспех света🏹 [IV]", gloves: "🧤 Кожаные перчатки света🏹 [IV]", boots: "🥾 Кожаные сапоги света🏹 [IV]" },
    bonus: { attack: 100, prediction: 115, dodge: 300, counter: 10, accuracy: 100 },
  },
  "Света 🗡": {
    items: { helmet: "🎩 Кожаный шлем света🗡 [IV]", chestplate: "🎽 Кожаный доспех света🗡 [IV]", gloves: "🧤 Кожаные перчатки света🗡 [IV]", boots: "🥾 Кожаные сапоги света🗡 [IV]" },
    bonus: { attack: 55, defense: 44, crit_chance: 238, prediction: 108, accuracy: 103 },
  },
  "Божественной Силы 💓": {
    items: { helmet: "🎩 Диадема божественной силы💓 [IV]", chestplate: "🎽 Мантия божественной силы💓 [IV]", gloves: "🧤 Перчатки божественной силы💓 [IV]", boots: "🥾 Ботинки божественной силы💓 [IV]" },
    bonus: { defense: 30, prediction: 133, accuracy: 50 },
  },
  "Демонической силы 💓": {
    items: { helmet: "🎩 Диадема демонической силы💓 [IV]", chestplate: "🎽 Мантия демонической силы💓 [IV]", gloves: "🧤 Перчатки демонической силы💓 [IV]", boots: "🥾 Ботинки демонической силы💓 [IV]" },
    bonus: { attack: 30, crit_chance: 200, prediction: 78, accuracy: 184 },
  },
  "Паладина 🌟": {
    items: { helmet: "🎩 Латный шлем паладина 🌟 [IV]", chestplate: "🎽 Латы паладина 🌟 [IV]", gloves: "🧤 Латные рукавицы паладина 🌟 [IV]", boots: "🥾 Латные сапоги паладина 🌟 [IV]" },
    bonus: { health: 200, defense: 51, crit_chance: 240, prediction: 37, accuracy: 68 },
  },
  "Венеры 🛡": {
    items: { helmet: "🎩 Латный шлем Венеры🛡 [IV]", chestplate: "🎽 Латы Венеры🛡 [IV]", gloves: "🧤 Латные рукавицы Венеры🛡 [IV]", boots: "🥾 Латные сапоги Венеры🛡 [IV]", shield: "🛡 Щит Венеры🛡 [IV]" },
    bonus: { health: 100, attack: -75, defense: 50, prediction: 65, accuracy: 43 },
  },
  "Марса 🛡": {
    items: { helmet: "🎩 Латный шлем Марса🛡 [IV]", chestplate: "🎽 Латы Марса🛡 [IV]", gloves: "🧤 Латные рукавицы Марса🛡 [IV]", boots: "🥾 Латные сапоги Марса🛡 [IV]" },
    bonus: { attack: 20, crit_chance: 400, accuracy: 98 },
  },
  "Гибели 🌟": {
    items: { helmet: "🎩 Латный шлем гибели 🌟 [IV]", chestplate: "🎽 Латы гибели 🌟 [IV]", gloves: "🧤 Латные рукавицы гибели 🌟 [IV]", boots: "🥾 Латные сапоги гибели 🌟 [IV]" },
    bonus: { attack: 50, crit_chance: 100, prediction: 79, accuracy: 104 },
  },
};

// ---------- Profile ----------
export interface EquipProfile {
  race: string;
  rank: string;
  equipment: Record<Slot, { item: string; enchant: number }>;
  params: Record<string, number>;
  toggles: Record<string, boolean>;
  clan: Record<string, number>;
  chaos: Record<ChaosSlot, { type: string; grade: number }[]>;
}

export function defaultChaos(): Record<ChaosSlot, { type: string; grade: number }[]> {
  return Object.fromEntries(
    CHAOS_SLOTS.map(s => [s, [1, 2, 3].map(() => ({ type: EMPTY, grade: 1 }))])
  ) as Record<ChaosSlot, { type: string; grade: number }[]>;
}

export function defaultProfile(): EquipProfile {
  return {
    race: "Человек",
    rank: "novobranec",
    equipment: Object.fromEntries(SLOTS.map(s => [s, { item: EMPTY, enchant: 0 }])) as EquipProfile["equipment"],
    params: { strength: 0, endur: 0, lovk: 0, intyat: 0 },
    toggles: {},
    clan: { atk: 0, hp: 0, def: 0, krityvr: 0, predtoch: 0 },
    chaos: defaultChaos(),
  };
}

export function toggleBuff(p: EquipProfile, key: string) {
  const next = !p.toggles[key];
  p.toggles[key] = next;
  const opposite = TOGGLE_PAIRS[key];
  if (opposite && next) p.toggles[opposite] = false;
}

// Enchant bonus percent per level (+1 .. +10)
const ENCHANT_PERCENT: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 8, 6: 10, 7: 13, 8: 16, 9: 20, 10: 25 };

function enchantBonus(base: number, level: number): number {
  const pct = ENCHANT_PERCENT[level];
  if (!pct) return 0;
  const v = base * pct / 100;
  if (v > 0 && v < 1) return 1;
  return Math.trunc(v);
}

export function activeSets(p: EquipProfile): string[] {
  return Object.entries(EQUIPMENT_SETS)
    .filter(([, set]) => Object.entries(set.items).every(([slot, name]) => p.equipment[slot as Slot]?.item === name))
    .map(([name]) => name);
}

function addRaw(stats: Stats, raw: RawItem, transform: (v: number, stat: StatKey) => number = v => v) {
  for (const [k, v] of Object.entries(raw)) {
    const key = STAT_MAPPING[k];
    if (key && typeof v === "number") stats[key] += transform(v, key);
  }
}

export function calculate(p: EquipProfile): Stats {
  const s = Object.fromEntries(STAT_KEYS.map(k => [k, 0])) as Stats;
  const { strength = 0, endur = 0, lovk = 0, intyat = 0 } = p.params;

  // 1. Race + hero parameters
  addRaw(s, RACES[p.race] || {});
  s.attack += strength * 3;
  s.health += endur * 10;
  s.defense += endur;
  s.prediction += endur;
  s.accuracy += endur;
  s.dodge += lovk * 5;
  s.accuracy += lovk * 2;
  s.prediction += lovk;
  s.crit_chance += intyat * 5;
  s.prediction += intyat * 2;
  s.accuracy += intyat;

  // 2. Equipment + 3. enchant
  for (const slot of SLOTS) {
    const { item, enchant } = p.equipment[slot];
    if (item === EMPTY) continue;
    const raw = ITEMS[slot][item];
    if (!raw) continue;
    const increases = item.includes("[IV]") && typeof raw.class === "string"
      ? GRADE_IV_STAT_INCREASES[raw.class]
      : undefined;
    const boosted = (value: number, stat: StatKey) => value * (100 + (increases?.[stat] ?? 0)) / 100;
    addRaw(s, raw, boosted);
    addRaw(s, raw, (value, stat) => enchantBonus(boosted(value, stat), enchant));
  }

  // Set bonuses
  for (const name of activeSets(p)) {
    for (const [k, v] of Object.entries(EQUIPMENT_SETS[name].bonus)) s[k as StatKey] += v as number;
  }

  // 4. Clan buffs (percent)
  const c = p.clan;
  s.attack *= 1 + (c.atk || 0) / 100;
  s.health *= 1 + (c.hp || 0) / 100;
  s.defense *= 1 + (c.def || 0) / 100;
  s.crit_chance *= 1 + (c.krityvr || 0) / 100;
  s.dodge *= 1 + (c.krityvr || 0) / 100;
  s.prediction *= 1 + (c.predtoch || 0) / 100;
  s.accuracy *= 1 + (c.predtoch || 0) / 100;

  // 5. Talents
  const t = p.toggles;
  if (t.arm_tal) s.defense *= 1.10;
  if (t.hp_tal) s.health *= 1.10;
  if (t.atk_tal) s.attack *= 1.05;
  if (t.eye_tal_4) s.accuracy += 150;
  else if (t.eye_tal) s.accuracy += 50;
  if (t.pred_tal_4) s.prediction += 150;
  else if (t.pred_tal) s.prediction += 50;

  // 6. Food
  if (t.garlic_eat) s.accuracy *= 1.04;
  if (t.carrot_eat) s.crit_chance *= 1.04;
  if (t.pepper_eat) s.prediction *= 1.04;
  if (t.onion_eat) s.dodge *= 1.04;
  if (t.fish_eat_1) s.health += 50;
  if (t.fish_eat_3) s.health += 100;
  if (t.meat_eat_1) s.attack += 10;
  if (t.meat_eat_3) s.attack += 20;
  if (t.akvel_eat_1) { s.attack += 15; s.health += 75; }
  if (t.akvel_eat_3) { s.attack += 25; s.health += 125; }
  if (t.hell_tikva) { s.attack += 20; s.exp_bonus += 60; }
  if (t.kompl) s.health += 14;
  if (t.karma) s.health -= 10;
  if (t.tree) { s.health += 70; s.drop_bonus += 25; }
  if (t.snowman) { s.defense += 15; s.gold_bonus += 25; }

  // Rank
  const rank = RANKS.find(r => r.id === p.rank);
  if (rank) for (const [k, v] of Object.entries(rank.bonus)) s[k as StatKey] += v as number;

  // Chaos stones
  for (const slot of CHAOS_SLOTS) {
    for (const stone of p.chaos[slot]) {
      const def = CHAOS_STONES[slot].find(d => d.id === stone.type);
      if (def) s[def.stat] += def.values[stone.grade - 1] ?? 0;
    }
  }

  for (const k of STAT_KEYS) s[k] = Math.trunc(s[k]);
  return s;
}

