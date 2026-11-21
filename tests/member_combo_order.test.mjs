/**
 * Kiểm thử tích hợp: combo Member chỉ thành viên đã đăng nhập mới đặt được (21/11/2026).
 *
 * ⚠ CÓ GHI DB — chỉ chạy trên DB RIÊNG "webtsf_review_test" (setupReviewTestEnv đổi DATABASE_URL sang DB này,
 *   từ chối host không phải localhost). Không đụng DB staging, không đụng server cổng 3000.
 *   Chỉ chạy khi đặt QA_ALLOW_DB_WRITE=yes.
 *
 * Chạy: QA_ALLOW_DB_WRITE=yes npx tsx --test tests/member_combo_order.test.mjs
 *
 *  - khách chưa đăng nhập đặt combo MEMBER → 401 MEMBER_COMBO_LOGIN_REQUIRED, KHÔNG tạo đơn
 *  - thành viên đăng nhập đặt combo MEMBER → tạo đơn, gắn user_id
 *  - khách chưa đăng nhập đặt combo thường → vẫn tạo đơn
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { setupReviewTestEnv, lockReviewTestDb, REVIEW_TEST_DB } from './helpers/review_test_db.mjs';
import { assertSafeDatabase } from '../scripts/db-guard.mjs';

const ALLOWED = process.env.QA_ALLOW_DB_WRITE === 'yes';
const skip = ALLOWED ? false : 'Có ghi DB test — đặt QA_ALLOW_DB_WRITE=yes sau khi được duyệt';

let pool, POST, auth, db, jar;
const STORE = { code: 'TMC1', name: 'Cửa hàng test combo member', address: '12 Đường Test, Quận 1, TP. Hồ Chí Minh' };
const PRODUCT_ID = 'prod-test-mc';
const MEMBER_COMBO = { id: 'combo_test_member', slug: 'combo-test-member' };
const NORMAL_COMBO = { id: 'combo_test_normal', slug: 'combo-test-normal' };

function uniquePhone() {
  return `09${[0, 1, 2, 3, 4, 6, 7, 8, 9][crypto.randomInt(0, 9)]}${crypto.randomInt(1000000, 9999999)}`;
}
async function postOrder(phone, comboId) {
  const res = await POST(
    new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Khách Test Combo Member',
        phone,
        province: 'Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường Bến Nghé',
        address: '1 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        paymentMethod: 'cod',
        shippingFee: 30000,
        latitude: 10.7805,
        longitude: 106.7005,
        locationConfirmed: true,
        locationConfirmedBy: 'USER_MAP_PIN',
        storeCode: STORE.code,
        items: [{ productId: comboId, name: 'x', price: 1, quantity: 1, unit: 'gói' }],
      }),
    })
  );
  let json = null;
  try { json = await res.json(); } catch { /* không phải JSON */ }
  return { status: res.status, json };
}
const countOrders = async (phone) => (await pool.query('SELECT count(*)::int c FROM orders WHERE phone = $1', [phone])).rows[0].c;

let releaseDbLock = async () => {};

describe('POST /api/orders — combo Member cần đăng nhập', { skip }, () => {
  before(async () => {
    assertSafeDatabase();
    const { dbName } = setupReviewTestEnv();
    assert.equal(dbName, REVIEW_TEST_DB);
    const requireCjs = createRequire(import.meta.url);
    requireCjs('next/server').after = () => {};
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      if (url.includes('project-osrm.org')) return Promise.reject(new Error('OSRM bị chặn trong test'));
      return realFetch(input, init);
    };
    jar = {};
    const h = requireCjs('next/headers');
    h.cookies = async () => ({
      get: (name) => (jar[name] ? { name, value: jar[name] } : undefined),
      has: (name) => Boolean(jar[name]),
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
    });
    h.headers = async () => new Headers();

    db = await import('@/lib/db');
    pool = db.pool;
    auth = await import('@/lib/auth');
    ({ POST } = await import('@/app/api/orders/route'));

    releaseDbLock = await lockReviewTestDb(pool);
    await db.initDatabase();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id VARCHAR(100) PRIMARY KEY, store_code VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        old_stock INTEGER NOT NULL, new_stock INTEGER NOT NULL, old_reserved INTEGER NOT NULL DEFAULT 0,
        new_reserved INTEGER NOT NULL DEFAULT 0, change_type VARCHAR(50) NOT NULL, order_id VARCHAR(50),
        actor VARCHAR(100) NOT NULL, note TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );`);
    await pool.query('TRUNCATE orders, order_items, stock_reservations, inventory_logs, store_inventory, product_variants, products, stores, combos CASCADE;');
    await pool.query(
      `INSERT INTO stores (id, code, name, address, province, district, latitude, longitude, is_active)
       VALUES ('st-test-mc', $1, $2, $3, 'Hồ Chí Minh', 'Quận 1', 10.7769, 106.7009, true);`,
      [STORE.code, STORE.name, STORE.address]
    );
    await pool.query(
      `INSERT INTO products (id, slug, name, sku, price, unit, thumbnail, is_active)
       VALUES ($1, 'sua-test-mc', 'Sữa Test Combo Member', 'TMC', 18000, '1 chai', '/images/test.jpg', true);`,
      [PRODUCT_ID]
    );
    await pool.query(
      `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
       VALUES ('inv-test-mc', $1, $2, 5000, 0, 0);`,
      [STORE.code, PRODUCT_ID]
    );
    for (const [c, type] of [[MEMBER_COMBO, 'MEMBER'], [NORMAL_COMBO, 'GIA']]) {
      await pool.query(
        `INSERT INTO combos (id, slug, name, original_price, sale_price, total_items, discount, image, combo_type, is_active)
         VALUES ($1, $2, '?', 216000, 180000, 12, 17, '/images/test.jpg', $3, true);`,
        [c.id, c.slug, type]
      );
      await pool.query(
        `INSERT INTO combo_items (id, combo_id, product_id, quantity, unit) VALUES ($1, $2, $3, 12, 'chai');`,
        [`ci_${c.id}`, c.id, PRODUCT_ID]
      );
    }
  });

  after(async () => {
    if (jar) delete jar.tsf_user_session;
    if (pool) {
      await releaseDbLock();
      await pool.end();
    }
  });

  test('khách chưa đăng nhập đặt combo Member → 401, không tạo đơn', async () => {
    delete jar.tsf_user_session;
    const phone = uniquePhone();
    const { status, json } = await postOrder(phone, MEMBER_COMBO.id);
    assert.equal(status, 401, JSON.stringify(json));
    assert.equal(json.code, 'MEMBER_COMBO_LOGIN_REQUIRED');
    assert.equal(await countOrders(phone), 0);
  });

  test('thành viên đăng nhập đặt combo Member → tạo đơn, gắn user_id', async () => {
    const id = `usr_qa_mc_${crypto.randomUUID().slice(0, 8)}`;
    const email = `${id}@example.com`;
    await pool.query(`INSERT INTO users (id, email, password_hash, full_name) VALUES ($1, $2, 'x', 'QA Member');`, [id, email]);
    jar.tsf_user_session = await auth.signUserToken({ id, email, fullName: 'QA Member', phone: null });
    const phone = uniquePhone();
    const { status, json } = await postOrder(phone, MEMBER_COMBO.id);
    assert.equal(status, 200, JSON.stringify(json));
    const row = (await pool.query('SELECT user_id FROM orders WHERE id = $1', [json.orderId])).rows[0];
    assert.equal(row.user_id, id);
  });

  test('khách chưa đăng nhập đặt combo thường → vẫn tạo đơn', async () => {
    delete jar.tsf_user_session;
    const phone = uniquePhone();
    const { status, json } = await postOrder(phone, NORMAL_COMBO.id);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(await countOrders(phone), 1);
  });
});
