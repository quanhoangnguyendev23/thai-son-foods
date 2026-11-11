/**
 * Kiểm thử tích hợp các route cần PHIÊN ĐĂNG NHẬP (admin, STORE_STAFF, MARKETING, đối tác, đại lý) trên DB RIÊNG "webtsf_review_test".
 * Dùng tests/helpers/review_test_session.mjs: token ký bằng hàm thật, getAdminSession/getPartnerSession/rbac chạy thật; chỉ cookies() của Next là giả.
 * Chạy: npx tsx --test tests/api_sessions_integration.test.mjs
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupReviewTestEnv, lockReviewTestDb } from './helpers/review_test_db.mjs';
import { installFakeNextHeaders, loginAdmin, logoutAdmin, partnerBearer, jsonRequest, readJson } from './helpers/review_test_session.mjs';

setupReviewTestEnv();
installFakeNextHeaders();

const { pool, initDatabase } = await import('@/lib/db');
const adminOrders = await import('@/app/api/admin/orders/route');
const adminCombos = await import('@/app/api/admin/combos/route');
const adminProducts = await import('@/app/api/admin/products/route');
const dealerOrders = await import('@/app/api/dealer/orders/route');
const dealerProducts = await import('@/app/api/dealer/products/route');

const STORE_A = 'TST1';
const STORE_B = 'TST2';
const PRODUCT = 'prod-test-01';

async function call(handler, path, { method, body, headers } = {}) {
  const res = await handler(jsonRequest(`http://localhost${path}`, { method, body, headers }));
  return { status: res.status, json: await readJson(res) };
}

async function seedBase() {
  await pool.query(
    `TRUNCATE partner_ledger, order_attributions, payout_requests, partner_profiles, dealer_tiers, users, admin_users, audit_logs,
              combo_items, combos, orders, order_items, stock_reservations, inventory_logs, store_inventory, product_variants, products, stores CASCADE;`
  );
  for (const [i, code] of [STORE_A, STORE_B].entries()) {
    await pool.query(
      `INSERT INTO stores (id, code, name, address, province, district, latitude, longitude, is_active)
       VALUES ($1, $2, $3, '12 Đường Test', 'Hồ Chí Minh', 'Quận 1', 10.7769, 106.7009, true);`,
      [`st-${i}`, code, `Cửa hàng ${code}`]
    );
  }
  await pool.query(
    `INSERT INTO products (id, slug, name, sku, price, unit, thumbnail, cost_price, is_active)
     VALUES ($1, 'sua-test', 'Sữa Test', 'TS', 18000, '1 chai', '/images/test.jpg', 9000, true);`,
    [PRODUCT]
  );
  await pool.query(
    `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock) VALUES ('inv-1', $1, $2, 5000, 0, 0);`,
    [STORE_A, PRODUCT]
  );
  await pool.query(
    `INSERT INTO dealer_tiers (id, tier_name, tier_code, discount_rate) VALUES ('tier_zero', 'Hạng 0%', 'TIER_Z', 0), ('tier_15', 'Hạng 15%', 'TIER_15', 15);`
  );
}

async function addOrder(id, { store = STORE_A, status = 'PENDING' } = {}) {
  await pool.query(
    `INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, subtotal, total, store_code, status)
     VALUES ($1, $2, 'Khách', '0901234567', 'Hồ Chí Minh', 'Quận 1', 'P1', '1 Đường Test, Quận 1', 126000, 156000, $3, $4);`,
    [id, `TSF-${id}`, store, status]
  );
}

let releaseDbLock = async () => {};

before(async () => {
  releaseDbLock = await lockReviewTestDb(pool);
  await initDatabase();
  // initDatabase() không tạo cột products.volume (có trong prisma/schema.prisma) nên PUT /api/admin/products lỗi 500 trên DB dựng từ initDatabase
  await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS volume VARCHAR(50);');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id VARCHAR(100) PRIMARY KEY, store_code VARCHAR(50) NOT NULL,
      product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      old_stock INTEGER NOT NULL, new_stock INTEGER NOT NULL,
      old_reserved INTEGER NOT NULL DEFAULT 0, new_reserved INTEGER NOT NULL DEFAULT 0,
      change_type VARCHAR(50) NOT NULL, order_id VARCHAR(50), actor VARCHAR(100) NOT NULL, note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
});

beforeEach(async () => {
  logoutAdmin();
  await seedBase();
});

after(async () => {
  await releaseDbLock();
  await pool.end();
});

describe('bộ dựng phiên: kiểm tra hoạt động đúng trước khi dùng cho test khác', () => {
  test('không đăng nhập: PUT /api/admin/orders trả 401', async () => {
    await addOrder('o1');
    const r = await call(adminOrders.PUT, '/api/admin/orders', { method: 'PUT', body: { id: 'o1', note: 'x' } });
    assert.equal(r.status, 401);
  });

  test('SUPER_ADMIN ghi chú đơn: 200; STORE_STAFF cửa hàng khác: 403; STORE_STAFF đúng cửa hàng: 200; MARKETING: 403', async () => {
    await addOrder('o1', { store: STORE_A });

    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    assert.equal((await call(adminOrders.PUT, '/api/admin/orders', { method: 'PUT', body: { id: 'o1', note: 'a' } })).status, 200);

    await loginAdmin(pool, { role: 'STORE_STAFF', storeCode: STORE_B });
    const other = await call(adminOrders.PUT, '/api/admin/orders', { method: 'PUT', body: { id: 'o1', note: 'b' } });
    assert.equal(other.status, 403, JSON.stringify(other.json));

    await loginAdmin(pool, { role: 'STORE_STAFF', storeCode: STORE_A });
    assert.equal((await call(adminOrders.PUT, '/api/admin/orders', { method: 'PUT', body: { id: 'o1', note: 'c' } })).status, 200);

    await loginAdmin(pool, { role: 'MARKETING' });
    assert.equal((await call(adminOrders.PUT, '/api/admin/orders', { method: 'PUT', body: { id: 'o1', note: 'd' } })).status, 403);
  });

  test('tài khoản admin bị khóa (is_active = false): mất phiên ngay (401)', async () => {
    await addOrder('o1');
    const a = await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    await pool.query('UPDATE admin_users SET is_active = false WHERE id = $1', [a.id]);
    const { invalidateAdminSessionCache } = await import('@/lib/auth');
    invalidateAdminSessionCache();
    assert.equal((await call(adminOrders.PUT, '/api/admin/orders', { method: 'PUT', body: { id: 'o1', note: 'x' } })).status, 401);
  });

  test('đại lý: không phiên 401, CTV 403, đại lý ACTIVE 200, đại lý SUSPENDED 403', async () => {
    assert.equal((await call(dealerProducts.GET, '/api/dealer/products')).status, 401);
    const ctv = await partnerBearer(pool, { type: 'CTV' });
    assert.equal((await call(dealerProducts.GET, '/api/dealer/products', { headers: ctv.headers })).status, 403);
    const ok = await partnerBearer(pool, { type: 'DEALER', tierId: 'tier_15' });
    assert.equal((await call(dealerProducts.GET, '/api/dealer/products', { headers: ok.headers })).status, 200);
    const sus = await partnerBearer(pool, { type: 'DEALER', status: 'SUSPENDED', tierId: 'tier_15' });
    assert.equal((await call(dealerProducts.GET, '/api/dealer/products', { headers: sus.headers })).status, 403);
  });
});

describe('R23: chiết khấu hạng đại lý (route thật, phiên đại lý thật)', () => {
  const order50 = (headers) =>
    call(dealerOrders.POST, '/api/dealer/orders', {
      method: 'POST',
      headers,
      body: { items: [{ productId: PRODUCT, quantity: 50 }], storeCode: STORE_A, shippingFee: 0, address: 'Kho đại lý 123 Đường Test' },
    });

  test('hạng 15% (đối chứng): 50 chai x 18.000đ giảm 15% còn 765.000đ', async () => {
    const d = await partnerBearer(pool, { type: 'DEALER', tierId: 'tier_15' });
    const r = await order50(d.headers);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.discountRate, 15);
    assert.equal(r.json.wholesaleSubtotal, 765000);
  });

  test('R23: hạng 0%: 50 chai x 18.000đ giữ nguyên giá 900.000đ (không bị giảm 15%)', async () => {
    const d = await partnerBearer(pool, { type: 'DEALER', tierId: 'tier_zero' });
    const r = await order50(d.headers);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.discountRate, 0);
    assert.equal(r.json.wholesaleSubtotal, 900000);
  });

  test('R23: danh sách sản phẩm sỉ của hạng 0%: giá sỉ bằng giá lẻ', async () => {
    const d = await partnerBearer(pool, { type: 'DEALER', tierId: 'tier_zero' });
    const r = await call(dealerProducts.GET, '/api/dealer/products', { headers: d.headers });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const p = (r.json.products || r.json.data || []).find((x) => x.id === PRODUCT);
    assert.ok(p, JSON.stringify(r.json).slice(0, 300));
    assert.equal(p.wholesalePrice, p.retailPrice);
  });
});

describe('R24: PUT combo và sản phẩm kiểm tra giá vốn (route thật, phiên admin thật)', () => {
  async function seedCombo() {
    await pool.query(
      `INSERT INTO combos (id, slug, name, original_price, sale_price, cost_price, total_items) VALUES ('combo_t1', 'combo-t1', 'Combo test', 100000, 90000, 1000, 10);`
    );
  }
  const putCombo = (body) => call(adminCombos.PUT, '/api/admin/combos', { method: 'PUT', body });
  const putProduct = (body) => call(adminProducts.PUT, '/api/admin/products', { method: 'PUT', body });
  const comboCost = async () => Number((await pool.query("SELECT cost_price FROM combos WHERE id='combo_t1'")).rows[0].cost_price);
  const productCost = async () => Number((await pool.query('SELECT cost_price FROM products WHERE id=$1', [PRODUCT])).rows[0].cost_price);

  test('combo: giá vốn hợp lệ 200 và được lưu', async () => {
    await seedCombo();
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    const r = await putCombo({ id: 'combo_t1', cost_price: '2500' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(await comboCost(), 2500);
  });

  test('R24: combo: giá vốn không phải số, âm, số lẻ, quá lớn: 400 và giá vốn trong DB không đổi', async () => {
    await seedCombo();
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    for (const bad of ['abc', -5, 1.5, 100_000_001, null, '']) {
      const r = await putCombo({ id: 'combo_t1', cost_price: bad });
      assert.equal(r.status, 400, `cost_price = ${JSON.stringify(bad)} trả ${r.status}: ${JSON.stringify(r.json)}`);
    }
    assert.equal(await comboCost(), 1000);
  });

  test('R24: combo: tổng số món ngoài 1 đến 1000 hoặc không phải số nguyên: 400', async () => {
    await seedCombo();
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    for (const bad of [0, -1, 1001, 2.5, 'abc']) {
      const r = await putCombo({ id: 'combo_t1', total_items: bad });
      assert.equal(r.status, 400, `total_items = ${JSON.stringify(bad)} trả ${r.status}`);
    }
    assert.equal((await putCombo({ id: 'combo_t1', total_items: 5 })).status, 200);
  });

  test('combo: tài khoản không có quyền sửa giá vốn (MARKETING) gửi giá vốn khác: 403', async () => {
    await seedCombo();
    await loginAdmin(pool, { role: 'MARKETING' });
    const r = await putCombo({ id: 'combo_t1', cost_price: 7777 });
    assert.equal(r.status, 403, JSON.stringify(r.json));
    assert.equal(await comboCost(), 1000);
  });

  test('sản phẩm: giá vốn hợp lệ 200 và được lưu', async () => {
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    const r = await putProduct({ id: PRODUCT, cost_price: 3000 });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(await productCost(), 3000);
  });

  test('R24: sản phẩm: giá vốn không phải số, âm, số lẻ, quá lớn: 400 và giá vốn trong DB không đổi', async () => {
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    for (const bad of ['abc', -1, 2.5, 100_000_001, null, '']) {
      const r = await putProduct({ id: PRODUCT, cost_price: bad });
      assert.equal(r.status, 400, `cost_price = ${JSON.stringify(bad)} trả ${r.status}: ${JSON.stringify(r.json)}`);
    }
    assert.equal(await productCost(), 9000);
  });
});

describe('R25 và R19: hủy đơn, xác nhận đơn thiếu hàng qua PUT /api/admin/orders', () => {
  async function seedReservedOrder(id, { stock = 5000, reserved = 7, qty = 7, store = STORE_A } = {}) {
    await addOrder(id, { store });
    await pool.query('UPDATE store_inventory SET stock_quantity = $1, reserved = $2 WHERE store_code = $3 AND product_id = $4', [stock, reserved, store, PRODUCT]);
    await pool.query(
      `INSERT INTO stock_reservations (id, order_id, store_code, product_id, quantity, status, expires_at) VALUES ($1, $2, $3, $4, $5, 'active', NOW() + INTERVAL '1 day');`,
      [`res-${id}`, id, store, PRODUCT, qty]
    );
  }
  const put = (body) => call(adminOrders.PUT, '/api/admin/orders', { method: 'PUT', body });

  test('xác nhận đơn đủ hàng: 200, trừ kho và nhả giữ chỗ', async () => {
    await seedReservedOrder('o1');
    await loginAdmin(pool, { role: 'STORE_STAFF', storeCode: STORE_A });
    const r = await put({ id: 'o1', status: 'CONFIRMED' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const inv = (await pool.query('SELECT stock_quantity, reserved FROM store_inventory')).rows[0];
    assert.deepEqual([Number(inv.stock_quantity), Number(inv.reserved)], [4993, 0]);
  });

  test('xác nhận đơn khi tồn thực tế thấp hơn số cần xuất, không có cờ ép: bị từ chối, tồn kho không đổi', async () => {
    await seedReservedOrder('o1', { stock: 3, reserved: 7 });
    await loginAdmin(pool, { role: 'STORE_STAFF', storeCode: STORE_A });
    const r = await put({ id: 'o1', status: 'CONFIRMED' });
    assert.notEqual(r.status, 200, JSON.stringify(r.json));
    assert.equal((await pool.query("SELECT status FROM orders WHERE id='o1'")).rows[0].status, 'PENDING');
    assert.equal(Number((await pool.query('SELECT stock_quantity FROM store_inventory')).rows[0].stock_quantity), 3);
    console.log(`[R25 thông tin] xác nhận đơn thiếu hàng không cờ: HTTP ${r.status} ${JSON.stringify(r.json)}`);
  });

  // R25: chờ quyết định nghiệp vụ (ô quyết định để trống): nhân viên cửa hàng có được gửi cờ allowOversell/forceConfirm không?
  test(
    'R25: STORE_STAFF gửi allowOversell để xác nhận đơn thiếu hàng phải bị từ chối (chỉ quản lý được ép)',
    { todo: 'Chờ quyết định nghiệp vụ R25: nhân viên cửa hàng có được dùng nút ép xuất kho thiếu hàng không' },
    async () => {
      await seedReservedOrder('o1', { stock: 3, reserved: 7 });
      await loginAdmin(pool, { role: 'STORE_STAFF', storeCode: STORE_A });
      const r = await put({ id: 'o1', status: 'CONFIRMED', allowOversell: true });
      assert.notEqual(r.status, 200, 'STORE_STAFF đang ép được xuất kho thiếu hàng');
    }
  );

  test('SUPER_ADMIN gửi allowOversell: xác nhận được, ghi nhật ký oversell_clamped, tồn kẹp về 0', async () => {
    await seedReservedOrder('o1', { stock: 3, reserved: 7 });
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    const r = await put({ id: 'o1', status: 'CONFIRMED', allowOversell: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(Number((await pool.query('SELECT stock_quantity FROM store_inventory')).rows[0].stock_quantity), 0);
    assert.equal((await pool.query("SELECT count(*)::int c FROM inventory_logs WHERE change_type='oversell_clamped'")).rows[0].c, 1);
  });

  test('R19: hủy đơn của đối tác qua PUT: hoa hồng ước tính chuyển VOID một lần, giữ chỗ được nhả, đơn CANCELLED', async () => {
    await seedReservedOrder('o1');
    await pool.query(`INSERT INTO users (id, email, password_hash, full_name) VALUES ('u1', 'ctv@example.com', 'x', 'Đối tác');`);
    await pool.query(`INSERT INTO partner_profiles (id, user_id, partner_code, phone, full_name) VALUES ('pp1', 'u1', 'CTV1', '0911111111', 'Đối tác');`);
    await pool.query(
      `INSERT INTO order_attributions (id, order_id, partner_id, referral_code, snapshot_commission_rate, eligible_order_amount, estimated_commission, status)
       VALUES ('attr1', 'o1', 'pp1', 'CTV1', 10, 126000, 12600, 'ESTIMATED');`
    );
    await pool.query(
      `INSERT INTO partner_ledger (id, partner_id, order_id, entry_type, amount, direction, status) VALUES ('led1', 'pp1', 'o1', 'COMMISSION', 12600, 'CREDIT', 'ESTIMATED');`
    );
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    const r = await put({ id: 'o1', status: 'CANCELLED', note: 'Khách hủy' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await pool.query("SELECT status FROM orders WHERE id='o1'")).rows[0].status, 'CANCELLED');
    assert.equal((await pool.query("SELECT status FROM partner_ledger WHERE id='led1'")).rows[0].status, 'VOID');
    assert.equal((await pool.query("SELECT status FROM order_attributions WHERE id='attr1'")).rows[0].status, 'VOID');
    assert.equal(Number((await pool.query('SELECT reserved FROM store_inventory')).rows[0].reserved), 0);
    assert.equal((await pool.query("SELECT count(*)::int c FROM partner_ledger WHERE entry_type='CLAWBACK'")).rows[0].c, 0);
  });

  test('hủy đơn đã hoàn tất: bị chặn 409 (trạng thái cuối)', async () => {
    await addOrder('o1', { status: 'COMPLETED' });
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    const r = await put({ id: 'o1', status: 'CANCELLED' });
    assert.equal(r.status, 409, JSON.stringify(r.json));
  });
});
