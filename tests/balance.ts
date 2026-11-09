import assert from "node:assert/strict";
import { getProfile, handleEquipCallback } from "../equip/bot";
import { calculate, defaultProfile, ITEMS, parameterPointCost } from "../equip/calculator";

for (const [slot, item, stat, rawKey, percent] of [
  ["ring", "💍 Кольцо Гладиатора [IV]", "health", "hp", 3],
  ["ring", "💍 Кольцо Гладиатора [IV]", "prediction", "pred", 4],
  ["ring", "💍 Кольцо Целителя 💓 [IV]", "accuracy", "tochn", 2],
  ["ring", "💍 Кольцо Целителя 💓 [IV]", "prediction", "pred", 3],
  ["ring", "💍 Кольцо Инквизитора 🌟 [IV]", "accuracy", "tochn", 2],
  ["ring", "💍 Кольцо Инквизитора 🌟 [IV]", "prediction", "pred", 3],
  ["weapon", "🔪 Омела 💓 [IV]", "attack", "atk", 4],
  ["weapon", "🔪 Дюрандаль🌟 [IV]", "attack", "atk", 3],
] as const) {
  const profile = defaultProfile();
  profile.params.strength = profile.params.endur = 50;
  const base = calculate(profile);
  profile.equipment[slot] = { item, enchant: 0 };
  const itemStat = Number(ITEMS[slot][item][rawKey]);
  assert.equal(calculate(profile)[stat], Math.trunc(base[stat] + itemStat * (100 + percent) / 100), `${item}: ${stat}`);
}

for (const [level, cost] of [[0, 0], [80, 80], [81, 82], [110, 140], [111, 143]]) {
  assert.equal(parameterPointCost(level), cost, `cost to reach level ${level}`);
}

const profile = defaultProfile();
profile.equipment.ring = { item: "💍 Кольцо Гладиатора [IV]", enchant: 10 };
const ring = ITEMS.ring[profile.equipment.ring.item];
const boostedHealth = Number(ring.hp) * 103 / 100;
assert.equal(calculate(profile).health, Math.trunc(calculate(defaultProfile()).health + boostedHealth + Math.trunc(boostedHealth * 0.25)));

const otherGradeRing = "💍 Кольцо горной стражи ⚔️ [IV+]";
profile.equipment.ring = { item: otherGradeRing, enchant: 0 };
assert.equal(calculate(profile).health, calculate(defaultProfile()).health + Number(ITEMS.ring[otherGradeRing].hp));

const userId = "parameter-budget-test";
const hero = getProfile(userId);
hero.params.strength = 111;
hero.params.endur = 81;
assert.match(handleEquipCallback("eq:params", userId)!.reply, /Потрачено очков: 225 из 222/);
const prompt = handleEquipCallback("eq:param:strength", userId)!.reply;
for (const text of ["222 очка", "80 включительно — 1", "81 по 110 — 2", "111 — 3"]) {
  assert.ok(prompt.includes(text));
}
console.log("PASS grade IV item bonuses, enchantments, and parameter point tiers");
