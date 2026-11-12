// ==============================================================================
// THÁI SƠN FOODS — ĐƯA ĐÁNH GIÁ SẢN PHẨM VỀ TRẠNG THÁI SẠCH
//
// Xóa toàn bộ đánh giá (đánh giá mẫu cài sẵn + đánh giá test) để trang sản phẩm hiện
// "Chưa có đánh giá" và chỉ tính từ đánh giá thật đầu tiên của khách.
// Đi kèm thay đổi code ở src/lib/reviews/repository.ts (tắt tự chèn lại đánh giá mẫu);
// nếu web chưa chạy code mới thì đánh giá mẫu sẽ tự quay lại sau khi xóa.
//
// Cách dùng (PowerShell):
//   node scripts/reset_reviews.mjs                  # chạy thử trên DB máy local (.env)
//   node scripts/reset_reviews.mjs --apply          # sao lưu rồi xóa trên DB local
//   $env:TARGET_DATABASE_URL = "<DATABASE_URL trên Vercel>"
//   node scripts/reset_reviews.mjs                  # chạy thử trên DB cloud
//   node scripts/reset_reviews.mjs --apply          # sao lưu rồi xóa trên DB cloud
//
// Chỉ đụng 2 bảng: product_reviews và review_helpful_votes (lượt "hữu ích" của các đánh giá đó).
// Bản sao lưu JSON được ghi vào scripts/backups/ trước khi xóa.
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes('--apply');

function readLocalUrl() {
  const envPath = path.join(__dirname, '..', '.env');
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  return line ? line.slice('DATABASE_URL='.length).replace(/^"|"$/g, '') : null;
}

const url = process.env.TARGET_DATABASE_URL || readLocalUrl();
if (!url) {
  console.error('Không có chuỗi kết nối DB (TARGET_DATABASE_URL hoặc DATABASE_URL trong .env).');
  process.exit(1);
}
const target = process.env.TARGET_DATABASE_URL ? 'DB CLOUD (TARGET_DATABASE_URL)' : 'DB LOCAL (.env)';
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('sslmode=disable') || url.includes('127.0.0.1') || url.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  console.log(`${apply ? '== GHI THẬT ==' : '== CHẠY THỬ (thêm --apply để xóa) =='} — ${target}`);

  const exists = (await pool.query(`SELECT to_regclass('public.product_reviews') AS t`)).rows[0].t;
  if (!exists) {
    console.log('Không có bảng product_reviews — không có gì để xóa.');
    return;
  }

  const reviews = (await pool.query(`SELECT * FROM product_reviews ORDER BY product_id, created_at`)).rows;
  const votes = (await pool.query(`SELECT * FROM review_helpful_votes`).catch(() => ({ rows: [] }))).rows;

  console.log(`Tổng: ${reviews.length} đánh giá, ${votes.length} lượt "hữu ích".`);
  for (const r of reviews) {
    const when = new Date(r.created_at).toISOString().slice(0, 10);
    const title = String(r.title || '').slice(0, 60);
    console.log(`  ${r.product_id.padEnd(32)} ${r.rating}★ ${r.status.padEnd(8)} ${when}  ${r.id.padEnd(22)} ${title}`);
  }

  if (!apply) return;
  if (reviews.length === 0) {
    console.log('Không còn đánh giá nào.');
    return;
  }

  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 13);
  const label = process.env.TARGET_DATABASE_URL ? 'cloud' : 'local';
  const file = path.join(backupDir, `backup_reviews_${label}_${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ product_reviews: reviews, review_helpful_votes: votes }, null, 2));
  console.log(`Đã sao lưu: ${file}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const v = await client.query(`DELETE FROM review_helpful_votes`).catch(() => ({ rowCount: 0 }));
    const d = await client.query(`DELETE FROM product_reviews`);
    await client.query('COMMIT');
    console.log(`Đã xóa ${d.rowCount} đánh giá và ${v.rowCount} lượt "hữu ích".`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('Lỗi:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
