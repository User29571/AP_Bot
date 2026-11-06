import pg from 'pg';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export interface Leader {
  client: pg.Client;
  signal: AbortSignal;
  release(): Promise<void>;
}

/** Requires a direct or session-pooler connection (Supabase port 5432). */
export class PostgresStore {
  private config: pg.ClientConfig;
  private pool: pg.Pool;
  private lockKey: string;

  constructor(url: string, readonly namespace: string) {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.pooler.supabase.com') && parsed.port !== '5432') {
      throw new Error('DATABASE_URL must use the Supabase session pooler on port 5432');
    }
    if ([...parsed.searchParams.keys()].some(key => key.toLowerCase().startsWith('ssl'))) {
      throw new Error('Remove SSL query parameters from DATABASE_URL; TLS verification is configured by the app');
    }
    this.config = { connectionString: url, ssl: { rejectUnauthorized: true, ca: fs.readFileSync('database/supabase-ca.crt', 'utf8') }, connectionTimeoutMillis: 10000, query_timeout: 10000, keepAlive: true };
    this.pool = new pg.Pool({ ...this.config, max: 2, idleTimeoutMillis: 30000 });
    this.pool.on('error', () => console.error('[database] idle connection lost'));
    this.lockKey = createHash('sha256').update('poller:' + namespace).digest().readBigInt64BE().toString();
  }

  async withState<T, R>(userId: string, initial: T, handle: (state: T) => Promise<{state: T; result: R}>, receiptId?: number): Promise<R> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [this.namespace + ':' + userId]);
      if (receiptId !== undefined) {
        const receipt = await client.query('select result from ap_bot.receipts where namespace=$1 and update_id=$2 and user_id=$3', [this.namespace, receiptId, userId]);
        if (receipt.rows.length) {
          await client.query('commit');
          return receipt.rows[0].result as R;
        }
      }
      const row = await client.query('select state from ap_bot.equipment where namespace=$1 and user_id=$2', [this.namespace, userId]);
      const { state, result } = await handle(row.rows[0]?.state ?? initial);
      await client.query('insert into ap_bot.equipment(namespace,user_id,state) values($1,$2,$3) on conflict(namespace,user_id) do update set state=excluded.state', [this.namespace, userId, JSON.stringify(state)]);
      if (receiptId !== undefined && result !== null) {
        await client.query('insert into ap_bot.receipts(namespace,update_id,user_id,result) values($1,$2,$3,$4)', [this.namespace,receiptId,userId,JSON.stringify(result)]);
      }
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally { client.release(); }
  }

  async tryLeader(): Promise<Leader | null> {
    const client = new pg.Client(this.config);
    const abort = new AbortController();
    client.on('error', () => abort.abort());
    client.on('end', () => abort.abort());
    try {
      await client.connect();
      const result = await client.query('select pg_try_advisory_lock($1::bigint) as acquired', [this.lockKey]);
      if (!result.rows[0].acquired) { await client.end(); return null; }
      let released = false;
      return { client, signal: abort.signal, release: async () => {
        if (released) return;
        released = true;
        abort.abort();
        try { await client.query('select pg_advisory_unlock($1::bigint)', [this.lockKey]); }
        finally { await client.end().catch(() => {}); }
      } };
    } catch (e) { await client.end().catch(() => {}); throw e; }
  }

  async loadOffset(): Promise<number> {
    const r = await this.pool.query('select next_offset from ap_bot.polling where namespace=$1', [this.namespace]);
    return Number(r.rows[0]?.next_offset ?? 0);
  }
  async saveOffset(offset: number) {
    await this.pool.query('insert into ap_bot.polling(namespace,next_offset) values($1,$2) on conflict(namespace) do update set next_offset=greatest(ap_bot.polling.next_offset,excluded.next_offset)', [this.namespace, offset]);
    await this.pool.query('delete from ap_bot.receipts where namespace=$1 and update_id < $2', [this.namespace, offset - 10000]);
  }
  async close() { await this.pool.end(); }
}
