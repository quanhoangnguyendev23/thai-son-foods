/**
 * Bước thay combo một lần trên Vercel (src/lib/comboReplace20261119.ts), chạy trên DB test "webtsf_review_test".
 *  - không có VERCEL: không làm gì
 *  - có VERCEL: 12 combo cũ (slug demo) → 12 combo theo bảng tính giá, có ảnh + loại; combo cũ bị xoá, bản sao lưu nằm trong site_settings
 *  - chạy lại: không làm gì (đã đánh dấu); thiếu sản phẩm theo SKU: không ghi gì
 * Chạy: QA_ALLOW_DB_WRITE=yes npx tsx --test tests/combo_replace_vercel_integration.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupReviewTestEnv, lockReviewTestDb } from './helpers/review_test_db.mjs';
import { assertSafeDatabase } from '../scripts/db-guard.mjs';

assertSafeDatabase();
setupReviewTestEnv();
delete process.env.VERCEL;

const { pool, initDatabase } = await import('@/lib/db');
const PRICES = { SB: 18000, SHS: 18000, SGL: 18000, SS: 25000, SL: 25000, MD: 18000, TD: 18000, LH: 18000, TSA: 20000, MAC: 20000, TSG: 18000, TXG: 18000 };

async function seed({ withAllSkus = true } = {}) {
  await pool.query(`TRUNCATE combos, combo_items, combo_images, products CASCADE;`);
  await pool.query(`DELETE FROM site_settings WHERE key IN ('combo_replace_2026_11_19', 'combo_backup_2026_11_19');`).catch(() => undefined);
  for (const [sku, price] of Object.entries(PRICES)) {
    if (!withAllSkus && sku === 'MAC') continue;
    const id = `prod-${sku.toLowerCase()}-01`;
    await pool.query(`INSERT INTO products (id, slug, name, sku, price, unit, thumbnail, is_active) VALUES ($1, $1, $2, $3, $4, 'chai', '/images/test.jpg', true);`, [id, `SP ${sku}`, sku, price]);
  }
  for (let i = 1; i <= 12; i++) {
    const slug = i === 1 ? 'combo-van-phong' : `combo-${i}`;
    await pool.query(
      `INSERT INTO combos (id, slug, name, original_price, sale_price, total_items, image) VALUES ($1, $2, 'Combo cũ', 100000, 90000, 10, '/images/combos/combo-1.jpg');`,
      [`combo-old-${i}`, slug]
    );
    await pool.query(`INSERT INTO combo_items (id, combo_id, product_id, quantity, unit) VALUES ($1, $2, 'prod-sb-01', 10, 'chai');`, [`ci-old-${i}`, `combo-old-${i}`]);
  }
}

let release = async () => {};
before(async () => {
  release = await lockReviewTestDb(pool);
  await initDatabase();
  const { SITE_SETTINGS_DDL } = await import('@/lib/site-settings');
  await pool.query(SITE_SETTINGS_DDL);
});
after(async () => {
  delete process.env.VERCEL;
  await release();
  await pool.end();
});

test('không có VERCEL: không đụng combo', async () => {
  await seed();
  const { ensureComboReplacement20261119 } = await import('@/lib/comboReplace20261119');
  await ensureComboReplacement20261119();
  const n = (await pool.query(`SELECT count(*)::int n FROM combos WHERE slug LIKE 'combo-%' AND id LIKE 'combo-old-%'`)).rows[0].n;
  assert.equal(n, 12);
});

test('có VERCEL: thay đúng 12 combo, có ảnh + loại + giá, xoá combo cũ, có sao lưu; chạy lại không đổi', async () => {
  await seed();
  process.env.VERCEL = '1';
  const mod = await import('@/lib/comboReplace20261119');
  await mod.ensureComboReplacement20261119();
  const rows = (await pool.query(`SELECT slug, name, image, combo_type, original_price, sale_price, total_items FROM combos ORDER BY created_at`)).rows;
  assert.equal(rows.length, 12);
  assert.ok(rows.every((r) => r.name === '?'));
  assert.ok(rows.every((r) => /^\/images\/combos\/combo-stt-\d\d\.jpg$/.test(r.image)));
  assert.deepEqual([...new Set(rows.map((r) => r.combo_type))].sort(), ['CHI_DINH', 'DA_DANG', 'GIA', 'TANG_SO_LUONG']);
  const tao = rows.find((r) => r.slug === 'combo-chi-dinh-tao-do');
  assert.equal(Number(tao.original_price), 216000);
  assert.equal(Number(tao.sale_price), 193500);
  assert.equal(tao.total_items, 12);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM combos WHERE id LIKE 'combo-old-%'`)).rows[0].n, 0);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM combo_items`)).rows[0].n, 46);
  const backup = (await pool.query(`SELECT value FROM site_settings WHERE key = 'combo_backup_2026_11_19'`)).rows[0].value;
  assert.equal(backup.combos.length, 12);
  assert.equal(backup.combo_items.length, 12);

  // Chạy lại trong cùng tiến trình và sau khi "khởi động lại" (đánh dấu trong DB): không đổi gì
  await pool.query(`UPDATE combos SET name = 'Admin đã đổi tên' WHERE slug = 'bo-san-pham-ciao';`);
  await mod.ensureComboReplacement20261119();
  assert.equal((await pool.query(`SELECT name FROM combos WHERE slug = 'bo-san-pham-ciao'`)).rows[0].name, 'Admin đã đổi tên');
});

test('thiếu sản phẩm theo SKU: không ghi gì, chưa đánh dấu', async () => {
  await seed({ withAllSkus: false });
  process.env.VERCEL = '1';
  // Module mới (bỏ bộ nhớ "đã chạy" của lần trước)
  const mod = await import(`../src/lib/comboReplace20261119.ts?fresh=${Date.now()}`);
  await mod.ensureComboReplacement20261119();
  assert.equal((await pool.query(`SELECT count(*)::int n FROM combos WHERE id LIKE 'combo-old-%'`)).rows[0].n, 12);
  assert.equal((await pool.query(`SELECT 1 FROM site_settings WHERE key = 'combo_replace_2026_11_19'`)).rows.length, 0);
});
