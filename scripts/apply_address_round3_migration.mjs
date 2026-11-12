/**
 * Áp (hoặc hoàn tác với --rollback) migration ô địa chỉ. Dùng DATABASE_URL (biến môi trường, rồi .env.local / .env).
 * Chạy: node scripts/apply_address_round3_migration.mjs [--round 3|4|catchup] [--rollback]   (mặc định vòng 3)
 */
import fs from 'node:fs';
import pg from 'pg';

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const env = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url) throw new Error('Thiếu DATABASE_URL');
const rollback = process.argv.includes('--rollback');
const ri = process.argv.indexOf('--round');
const round = ri > 0 ? String(process.argv[ri + 1]) : '3';
if (!/^([34]|catchup)$/.test(round)) throw new Error('--round phải là 3, 4 hoặc catchup');
// catchup = bù lược đồ của các phần khác mà bộ khởi tạo tự động từng tạo (scripts/migrations/bootstrap_catchup_20261106_*.sql)
const file =
  round === 'catchup'
    ? new URL(`./migrations/bootstrap_catchup_20261106_${rollback ? 'rollback' : 'schema'}.sql`, import.meta.url)
    : new URL(`./migrations/address_round${round}_${rollback ? 'rollback' : 'schema'}.sql`, import.meta.url);
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(fs.readFileSync(file, 'utf8'));
  await client.query('COMMIT');
  console.log(rollback ? `Đã hoàn tác migration ô địa chỉ vòng ${round}.` : `Đã áp migration ô địa chỉ vòng ${round}.`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
