import assert from 'node:assert/strict';
import pg from 'pg';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PostgresStore } from '../storage/postgres';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL required for integration tests');
const namespace = 'test-' + randomUUID();
const a = new PostgresStore(process.env.TEST_DATABASE_URL, namespace);
const b = new PostgresStore(process.env.TEST_DATABASE_URL, namespace);
try {
  const first = await a.tryLeader();
  assert.ok(first, 'first instance acquires lock');
  assert.equal(await b.tryLeader(), null, 'second instance cannot poll');
  await first.release();
  const next = await b.tryLeader();
  assert.ok(next, 'standby takes over after release');
  await next.release();
  await a.withState('user', { count: 0 }, async state => ({ state: { count: state.count + 1 }, result: null }));
  await Promise.all(Array.from({length: 6}, (_, i) => (i % 2 ? a : b).withState('user', { count: 0 }, async state => ({state: { count: state.count + 1 }, result: null}))));
  assert.equal(await b.withState('user', {count: 0}, async state => ({state, result: state.count})), 7, 'updates across instances are serialized');
  await assert.rejects(a.withState('user', {count:0}, async () => { throw new Error('rollback'); }));
  assert.equal(await b.withState('user', {count:0}, async state => ({state,result:state.count})), 7, 'failed updates roll back');
  assert.equal(await b.withState('other-user', {count:0}, async state => ({state,result:state.count})), 0, 'users isolated');
  const once = await a.withState('receipt-user', {enabled:false}, async state => ({state:{enabled:!state.enabled},result:'original response'}), 100);
  const replay = await b.withState('receipt-user', {enabled:false}, async state => ({state:{enabled:!state.enabled},result:'wrong replay'}), 100);
  assert.equal(replay, once, 'retry returns committed result without toggling again');
  assert.equal(await a.withState('receipt-user',{enabled:false},async state=>({state,result:state.enabled})), true);
  await a.saveOffset(123);
  assert.equal(await b.loadOffset(),123,'cursor survives instance change');
  await b.saveOffset(120);
  assert.equal(await a.loadOffset(),123,'cursor cannot move backward');
  const lost = await a.tryLeader();
  assert.ok(lost);
  await lost.client.end();
  assert.ok(lost.signal.aborted, 'lost connection cancels polling');
  const takeover = await b.tryLeader();
  assert.ok(takeover,'lock released after disconnect');
  await takeover.release();
  console.log('PASS shared profiles, concurrency, rollback, isolation, cursor, leader handover and connection loss');
} finally {
  const cleanup = new pg.Client({connectionString: process.env.TEST_DATABASE_URL, ssl: {rejectUnauthorized:true,ca:fs.readFileSync('database/supabase-ca.crt','utf8')}});
  await cleanup.connect();
  await cleanup.query('delete from ap_bot.equipment where namespace=$1', [namespace]);
  await cleanup.query('delete from ap_bot.receipts where namespace=$1', [namespace]);
  await cleanup.query('delete from ap_bot.polling where namespace=$1', [namespace]);
  await cleanup.end();
  await Promise.all([a.close(),b.close()]);
}
