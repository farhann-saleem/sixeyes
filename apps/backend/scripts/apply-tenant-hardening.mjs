import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!raw) throw new Error('DIRECT_URL or DATABASE_URL required');
const url = new URL(raw);
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: '15', PGSSLMODE: 'require' };
const sql = path.join(root, 'supabase/migrations/20260914160000_tenant_hardening.sql');
const args = process.argv.includes('--check') ? ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', 'select 1'] : ['-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', sql];
const result = spawnSync('psql', args, { env, encoding: 'utf8', timeout: 60000 });
// Never echo a connection URI, credentials, database rows, or full process environment.
if (result.status !== 0) {
  const msg = result.stderr || result.error?.message || 'unknown failure';
  console.error(msg.replaceAll(decodeURIComponent(url.password), '[redacted]'));
  process.exit(1);
}
console.log(process.argv.includes('--check') ? 'Database connection verified.' : 'Tenant hardening migration applied in one transaction.');
