import assert from 'node:assert/strict';
import { SLOTS, ITEM_NAMES, RACES } from '../equip/calculator';
import { handleEquipInlineQuery } from '../equip/bot';

for (const slot of SLOTS) {
  const names = ITEM_NAMES[slot];
  assert.ok(names.length > 0, `${slot}: equipment database must not be empty`);
  let offset = 0;
  const found: string[] = [];
  do {
    const page = handleEquipInlineQuery(`Поиск ${slot}: `, offset)!;
    assert.ok(page.results.length <= 50);
    found.push(...page.results.filter(r => r.id !== 'empty').map(r => r.title));
    offset = page.next_offset ? Number(page.next_offset) : 0;
  } while (offset);
  assert.deepEqual(found, names, `${slot}: all equipment must appear across pages`);
  const page = handleEquipInlineQuery(`Поиск ${slot}: ${names[0].toLowerCase()}`, 0)!;
  assert.ok(page.results.some(r => r.title === names[0]));
  console.log(`PASS ${slot}: ${names.length} items`);
}
assert.ok(Object.keys(RACES).length > 0);
console.log('PASS races loaded');
