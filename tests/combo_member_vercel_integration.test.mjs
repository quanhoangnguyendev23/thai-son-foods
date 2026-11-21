/**
 * Bước thêm 3 combo Member một lần trên Vercel (src/lib/comboMember20261121.ts), chạy trên DB test "webtsf_review_test".
 *  - không có VERCEL: không làm gì
 *  - có VERCEL: thêm đúng 3 combo Member (giá, ảnh, loại), không đụng combo khác; chạy lại không đổi gì
 *  - đã có sẵn 1 slug Member: chỉ thêm 2 combo còn lại
 *  - thiếu sản phẩm theo SKU: không ghi gì, chưa đánh dấu
 * Chạy: QA_ALLOW_DB_WRITE=yes npx tsx --test tests/combo_member_vercel_integration.test.mjs
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
const MEMBER_SLUGS = ['dang-ki-tai-khoan-giam-10', 'don-hang-tu-180k-la-freeship', 'combo-thanh-vien-yoo-matcha'];

// Mã SKU dạng "SB-01" giống DB cloud của Vercel; 1 combo thường có sẵn để chắc chắn không bị đụng tới
async function seed({ withAllSkus = true, existingMemberSlug = null } = {}) {
  await pool.query(`TRUNCATE combos, combo_items, combo_images, products CASCADE;`);
  await pool.query(`DELETE FROM site_settings WHERE key = 'combo_member_2026_11_21';`).catch(() => undefined);
  for (const [sku, price] of Object.entries(PRICES)) {
    if (!withAllSkus && sku === 'MAC') continue;
    const id = `prod-${sku.toLowerCase()}-01`;
    await pool.query(`INSERT INTO products (id, slug, name, sku, price, unit, thumbnail, is_active) VALUES ($1, $1, $2, $3, $4, 'chai', '/images/test.jpg', true);`, [id, `SP ${sku}`, `${sku}-01`, price]);
  }
  await pool.query(
    `INSERT INTO combos (id, slug, name, original_price, sale_price, total_items, image, combo_type) VALUES ('combo-keep', 'bo-san-pham-ciao', 'Giữ nguyên', 268000, 228800, 14, '/images/combos/combo-stt-17.jpg', 'GIA');`
  );
  if (existingMemberSlug) {
    await pool.query(
      `INSERT INTO combos (id, slug, name, original_price, sale_price, total_items, image, combo_type) VALUES ('combo-member-old', $1, 'Đã có', 1, 1, 1, '/x.jpg', 'MEMBER');`,
      [existingMemberSlug]
    );
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

test('không có VERCEL: không thêm gì', async () => {
  await seed();
  const { ensureMemberCombos20261121 } = await import('@/lib/comboMember20261121');
  await ensureMemberCombos20261121();
  assert.equal((await pool.query(`SELECT count(*)::int n FROM combos`)).rows[0].n, 1);
});

test('có VERCEL: thêm đúng 3 combo Member, không đụng combo khác; chạy lại không đổi', async () => {
  await seed();
  process.env.VERCEL = '1';
  const mod = await import(`../src/lib/comboMember20261121.ts?fresh=${Date.now()}`);
  await mod.ensureMemberCombos20261121();
  const rows = (await pool.query(`SELECT slug, name, image, combo_type, original_price, sale_price, total_items, is_active FROM combos WHERE combo_type = 'MEMBER' ORDER BY created_at`)).rows;
  assert.deepEqual(rows.map((r) => r.slug), MEMBER_SLUGS);
  assert.ok(rows.every((r) => r.name === '?' && r.is_active));
  assert.deepEqual(rows.map((r) => r.image), ['/images/combos/combo-stt-21.jpg', '/images/combos/combo-stt-22.jpg', '/images/combos/combo-stt-23.jpg']);
  assert.deepEqual(rows.map((r) => [Number(r.original_price), Number(r.sale_price), r.total_items]), [
    [216000, 179200, 12],
    [252000, 207200, 14],
    [280000, 244800, 12],
  ]);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM combo_items`)).rows[0].n, 11);
  const keep = (await pool.query(`SELECT name, combo_type FROM combos WHERE id = 'combo-keep'`)).rows[0];
  assert.deepEqual(keep, { name: 'Giữ nguyên', combo_type: 'GIA' });

  // Chạy lại: đã đánh dấu → admin sửa gì cũng giữ nguyên
  await pool.query(`UPDATE combos SET name = 'Admin đã đổi tên' WHERE slug = $1;`, [MEMBER_SLUGS[0]]);
  await mod.ensureMemberCombos20261121();
  assert.equal((await pool.query(`SELECT name FROM combos WHERE slug = $1`, [MEMBER_SLUGS[0]])).rows[0].name, 'Admin đã đổi tên');
  assert.equal((await pool.query(`SELECT count(*)::int n FROM combos WHERE combo_type = 'MEMBER'`)).rows[0].n, 3);
});

test('đã có sẵn 1 combo Member: chỉ thêm 2 combo còn lại, không sửa combo có sẵn', async () => {
  await seed({ existingMemberSlug: MEMBER_SLUGS[1] });
  process.env.VERCEL = '1';
  const mod = await import(`../src/lib/comboMember20261121.ts?fresh=${Date.now()}`);
  await mod.ensureMemberCombos20261121();
  assert.equal((await pool.query(`SELECT count(*)::int n FROM combos WHERE combo_type = 'MEMBER'`)).rows[0].n, 3);
  assert.equal((await pool.query(`SELECT name FROM combos WHERE id = 'combo-member-old'`)).rows[0].name, 'Đã có');
});

test('thiếu sản phẩm theo SKU: không ghi gì, chưa đánh dấu', async () => {
  await seed({ withAllSkus: false });
  process.env.VERCEL = '1';
  const mod = await import(`../src/lib/comboMember20261121.ts?fresh=${Date.now()}`);
  await mod.ensureMemberCombos20261121();
  assert.equal((await pool.query(`SELECT count(*)::int n FROM combos WHERE combo_type = 'MEMBER'`)).rows[0].n, 0);
  assert.equal((await pool.query(`SELECT 1 FROM site_settings WHERE key = 'combo_member_2026_11_21'`)).rows.length, 0);
});
