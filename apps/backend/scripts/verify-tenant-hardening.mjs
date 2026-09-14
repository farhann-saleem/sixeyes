import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const tables = ['profiles','sessions','billing_orders','avatar_jobs','swap_jobs','audio_jobs','identities','studio_projects','studio_uploads','studio_renders','cost_ledger','user_resources'];
let failures = 0;
for (const table of tables) {
  const statuses = {};
  for (const [role, key] of [['service', process.env.SUPABASE_SERVICE_ROLE_KEY], ['anon', process.env.SUPABASE_ANON_KEY]]) {
    if (!key) throw new Error(`${role} key missing`);
    const res = await fetch(`${base}/rest/v1/${table}?select=id&limit=0`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    statuses[role] = res.status;
    await res.body?.cancel();
  }
  const ok = statuses.service === 200 && [401,403].includes(statuses.anon);
  if (!ok) failures++;
  console.log(`${table}: service=${statuses.service}, anon=${statuses.anon}, ${ok ? 'PASS' : 'FAIL'}`);
}
// Invalid kind deliberately raises BEFORE any mutation. Checks function availability only.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rpc = await fetch(`${base}/rest/v1/rpc/record_usage`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_email: 'unused-verification', p_kind: 'invalid-verification', p_month: 'unused' }), signal: AbortSignal.timeout(15000) });
const body = await rpc.json();
const validRpc = body.code === 'P0001' && body.message === 'Invalid quota';
console.log(`record_usage RPC: ${validRpc ? 'PASS' : 'FAIL'}`); if (!validRpc) failures++;
process.exitCode = failures ? 1 : 0;
