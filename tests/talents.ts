import assert from 'node:assert/strict';
import { calculate, defaultProfile, toggleBuff } from '../equip/calculator';
import { handleEquipCallback } from '../equip/bot';

for (const [key, lower, stat, name, food] of [
  ['pred_tal_4','pred_tal','prediction','Оракул [IV]','pepper_eat'],
  ['eye_tal_4','eye_tal','accuracy','Орлиный глаз [IV]','garlic_eat'],
] as const) {
  const menu = handleEquipCallback('eq:tg:talents','talent-menu-test')!;
  const button = menu.keyboard!.flat().find(b => 'callback_data' in b && b.callback_data === `eq:t:talents:${key}`);
  assert.ok(button?.text.includes(name), `${name} appears in talent menu`);
  assert.ok(button.text.includes('+150'));
  const p = defaultProfile();
  p.params.endur = 13;
  const base = calculate(p);
  toggleBuff(p, lower);
  assert.equal(calculate(p)[stat], base[stat]+50, 'existing talent still adds 50');
  toggleBuff(p, key);
  assert.equal(p.toggles[lower],false,'higher rank disables lower rank');
  assert.equal(calculate(p)[stat],base[stat]+150,'IV adds exactly 150');
  p.toggles[lower]=true;
  assert.equal(calculate(p)[stat],base[stat]+150,'inconsistent saved ranks do not stack');
  p.toggles[lower]=false;
  toggleBuff(p, food);
  assert.equal(calculate(p)[stat],Math.trunc((base[stat]+150)*1.04),'food applies after talent');
  toggleBuff(p, food);
  toggleBuff(p, lower);
  assert.equal(p.toggles[key],false,'lower rank disables IV');
  assert.equal(calculate(p)[stat],base[stat]+50);
  toggleBuff(p, lower);
  assert.deepEqual(calculate(p),base,'turning talents off restores base stats');
}
const p=defaultProfile();const base=calculate(p);
toggleBuff(p,'pred_tal_4');toggleBuff(p,'eye_tal_4');
assert.equal(calculate(p).prediction,base.prediction+150);
assert.equal(calculate(p).accuracy,base.accuracy+150);
console.log('PASS IV talent menu, bonuses, rank exclusivity, food order and independent activation');
