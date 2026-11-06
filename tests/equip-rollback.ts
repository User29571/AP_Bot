import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import fs from 'node:fs';
import { PostgresStore } from '../storage/postgres';
import { configureEquipmentStore, handleEquipMessage } from '../equip/bot';
const namespace = 'test-' + randomUUID();
class FailingStore extends PostgresStore {
  fail = true;
  override withState<T,R>(user: string, initial: T, handle: (state:T)=>Promise<{state:T;result:R}>, receipt?:number):Promise<R> {
    return super.withState(user,initial,async state => {
      const response = await handle(state);
      if(this.fail) { this.fail=false; throw new Error('simulated transaction failure'); }
      return response;
    },receipt);
  }
}
const store = new FailingStore(process.env.TEST_DATABASE_URL!, namespace);
configureEquipmentStore(store);
try {
  await assert.rejects(handleEquipMessage('eq:t:other:karma','rollback-user',123));
  const reply = await handleEquipMessage('eq:t:other:karma','rollback-user',123);
  const karma = reply!.keyboard!.flat().find(b=>b.text.includes('Карма'))!;
  assert.ok(karma.text.includes('✅'),'failed first transaction must not seed retry with uncommitted toggle');
  const replay = await handleEquipMessage('eq:t:other:karma','rollback-user',123);
  assert.deepEqual(replay,JSON.parse(JSON.stringify(reply)),'replayed Telegram update must return original response');
  console.log('PASS first-request rollback and Telegram callback replay');
} finally {
  const cleanup=new pg.Client({connectionString:process.env.TEST_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:fs.readFileSync('database/supabase-ca.crt','utf8')}});
  await cleanup.connect();
  await cleanup.query('delete from ap_bot.receipts where namespace=$1',[namespace]);
  await cleanup.query('delete from ap_bot.equipment where namespace=$1',[namespace]);
  await cleanup.end();
  await store.close();
}
