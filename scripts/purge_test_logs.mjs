/**
 * Dọn nhật ký thử nghiệm MỘT LẦN trước khi chạy thật (audit_logs + inventory_logs).
 *
 * Mặc định chỉ ĐẾM, không xoá gì:
 *   node scripts/purge_test_logs.mjs --before=2026-11-05
 *
 * Xoá thật (xuất file lưu trữ .jsonl.gz vào backups/log-archive trước, ghi file xong mới xoá):
 *   node scripts/purge_test_logs.mjs --before=2026-11-05 --apply
 *
 * --before  : xoá mọi dòng nhật ký tạo TRƯỚC ngày này (giờ Việt Nam, 00:00). Bắt buộc.
 * Nên chạy pg_dump sao lưu toàn bộ DB trước khi dùng --apply.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { gzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const apply = args.apply === true;
const before = typeof args.before === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.before) ? args.before : null;
if (!before) {
  console.error('Thiếu --before=YYYY-MM-DD (ví dụ --before=2026-11-05).');
  process.exit(1);
}
const cutoff = `${before}T00:00:00+07:00`;

if (!process.env.DATABASE_URL) {
  console.error('Chưa có DATABASE_URL trong .env.');
  process.exit(1);
}
const isRemote = !/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
});

const TABLES = ['audit_logs', 'inventory_logs'];

async function main() {
  const dbName = (await pool.query('SELECT current_database() AS db')).rows[0].db;
  console.log(`DB: ${dbName} | Xoá nhật ký trước: ${cutoff} | Chế độ: ${apply ? 'XOÁ THẬT' : 'chỉ đếm'}\n`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveDir = join(__dirname, '..', 'backups', 'log-archive', `purge_${stamp}`);

  for (const table of TABLES) {
    const exists = (await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`])).rows[0].t;
    if (!exists) {
      console.log(`- ${table}: chưa có bảng, bỏ qua`);
      continue;
    }
    const { total, old } = (
      await pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at < $1)::int AS old FROM ${table}`,
        [cutoff]
      )
    ).rows[0];
    console.log(`- ${table}: ${old}/${total} dòng sẽ bị xoá`);
    if (!apply || old === 0) continue;

    const rows = (await pool.query(`SELECT * FROM ${table} WHERE created_at < $1 ORDER BY created_at`, [cutoff])).rows;
    mkdirSync(archiveDir, { recursive: true });
    const file = join(archiveDir, `${table}.jsonl.gz`);
    writeFileSync(file, gzipSync(Buffer.from(rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')));
    console.log(`  Đã lưu ${rows.length} dòng vào ${file}`);

    const del = await pool.query(`DELETE FROM ${table} WHERE created_at < $1`, [cutoff]);
    console.log(`  Đã xoá ${del.rowCount} dòng`);
  }

  if (!apply) console.log('\nChưa xoá gì. Thêm --apply để xoá thật.');
}

main()
  .catch((err) => {
    console.error('Lỗi:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
