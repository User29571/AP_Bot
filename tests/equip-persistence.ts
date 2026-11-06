import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import fs from 'node:fs';
import { ITEM_NAMES } from '../equip/calculator';
const namespace = 'test-' + randomUUID();
const run = async (text: string) => {
  const result = await promisify(execFile)(process.execPath, ['--import','tsx','tests/equip-fixture.ts',text], {
    env: {...process.env, TEST_NAMESPACE: namespace},
  });
  return JSON.parse(result.stdout);
};
try {
  await run('eq:set:weapon:0');
  assert.ok((await run('/gear')).reply.includes(ITEM_NAMES.weapon[0]), 'another process sees equipped weapon');
  await run('eq:find:weapon');
  const selected = await run(ITEM_NAMES.weapon[1]);
  assert.ok(selected.reply.includes('Экипировано: ' + ITEM_NAMES.weapon[1]), 'pending search survives process change');
  assert.ok((await run('/gear')).reply.includes(ITEM_NAMES.weapon[1]), 'selection survives restart');
  console.log('PASS equipment and pending search across independent processes');
} finally {
  const cleanup = new pg.Client({connectionString: process.env.TEST_DATABASE_URL, ssl:{rejectUnauthorized:true,ca:fs.readFileSync('database/supabase-ca.crt','utf8')}});
  await cleanup.connect();
  await cleanup.query('delete from ap_bot.equipment where namespace=$1',[namespace]);
  await cleanup.end();
}
