/**
 * Chuẩn hóa dữ liệu CŨ trong orders.phone cho khớp cách lưu mới của POST /api/orders (REVIEW.md R1):
 * bỏ dấu cách / chấm / gạch, đầu "+84" hoặc "84" đổi thành "0".
 * Cùng quy tắc với hàm normalizePhone trong src/app/api/orders/route.ts — sửa một nơi phải sửa cả hai.
 *
 * MẶC ĐỊNH CHỈ XEM TRƯỚC (không ghi gì). Chỉ ghi khi thêm --apply. Nên sao lưu DB trước khi --apply.
 *   node scripts/normalize_order_phones.mjs            # xem trước
 *   node scripts/normalize_order_phones.mjs --apply    # ghi thật (một giao dịch, lỗi thì hoàn tác)
 * Từ chối chạy với máy chủ không phải localhost, trừ khi thêm --allow-remote.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const APPLY = process.argv.includes('--apply');
const ALLOW_REMOTE = process.argv.includes('--allow-remote');

export function normalizePhone(p) {
  let clean = String(p ?? '').replace(/[\s\-\.]/g, '');
  if (clean.startsWith('+84')) clean = '0' + clean.slice(3);
  else if (clean.startsWith('84') && clean.length > 9) clean = '0' + clean.slice(2);
  return clean;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL');
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host) && !ALLOW_REMOTE) {
    throw new Error(`Từ chối: máy chủ DB (${host}) không phải localhost. Thêm --allow-remote nếu chắc chắn.`);
  }
  console.log(`DB: ${host}:${u.port || 5432}${u.pathname}  |  chế độ: ${APPLY ? 'GHI THẬT (--apply)' : 'XEM TRƯỚC (không ghi)'}`);

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, order_code, phone FROM orders ORDER BY created_at;');
    const changes = res.rows
      .map((r) => ({ ...r, next: normalizePhone(r.phone) }))
      .filter((r) => r.phone !== r.next);
    console.log(`Tổng đơn: ${res.rows.length}. Cần chuẩn hóa: ${changes.length}.`);
    for (const c of changes.slice(0, 50)) console.log(`  ${c.order_code}: "${c.phone}" -> "${c.next}"`);
    if (changes.length > 50) console.log(`  ... và ${changes.length - 50} đơn nữa`);

    if (!APPLY || changes.length === 0) return;
    await client.query('BEGIN;');
    for (const c of changes) await client.query('UPDATE orders SET phone = $1 WHERE id = $2;', [c.next, c.id]);
    await client.query('COMMIT;');
    console.log(`Đã cập nhật ${changes.length} đơn.`);
  } catch (err) {
    try {
      await client.query('ROLLBACK;');
    } catch {
      /* chưa BEGIN */
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Lỗi:', e.message);
  process.exit(1);
});
