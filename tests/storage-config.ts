import assert from 'node:assert/strict';
import { PostgresStore } from '../storage/postgres';
assert.throws(() => new PostgresStore('postgresql://test:test@aws-1-eu-central-1.pooler.supabase.com:6543/postgres', 'test'), /session pooler/);
assert.throws(() => new PostgresStore('postgresql://test:test@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=disable', 'test'), /SSL query/);
console.log('PASS session-mode and strict TLS configuration');
