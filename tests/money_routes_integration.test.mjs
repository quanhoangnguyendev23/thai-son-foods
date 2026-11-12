/**
 * Kiểm thử tích hợp vòng 3 (theo tiền) trên DB RIÊNG "webtsf_review_test": rút tiền đối tác, số dư hiển thị, cron sinh đơn định kỳ.
 * Dùng phiên giả của tests/helpers/review_test_session.mjs (token ký bằng hàm thật). Các test "Rxx" phản ánh REVIEW.md.
 * Chạy: npx tsx --test tests/money_routes_integration.test.mjs
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { setupReviewTestEnv, lockReviewTestDb } from './helpers/review_test_db.mjs';
import { installFakeNextHeaders, loginAdmin, logoutAdmin, partnerBearer, jsonRequest, readJson } from './helpers/review_test_session.mjs';

setupReviewTestEnv();
installFakeNextHeaders();
process.env.CRON_SECRET = 'test-cron-secret-0123456789abcdef';

const { pool, initDatabase } = await import('@/lib/db');
const { ensureMembershipSchema } = await import('@/lib/membership/repository');
const payouts = await import('@/app/api/partner/payouts/route');
const ledgerRoute = await import('@/app/api/partner/ledger/route');
const statsRoute = await import('@/app/api/partner/stats/route');
const cronGenerate = await import('@/app/api/cron/subscriptions/generate-orders/route');
const adminOrders = await import('@/app/api/admin/orders/route');

const STORE = 'TST1';
const PRODUCT = 'prod-test-01';

async function call(handler, path, { method, body, headers } = {}) {
  const res = await handler(jsonRequest(`http://localhost${path}`, { method, body, headers }));
  return { status: res.status, json: await readJson(res) };
}

async function seedBase() {
  await pool.query(
    `TRUNCATE subscription_schedules, subscription_items, subscriptions, partner_ledger, order_attributions, payout_requests, partner_profiles,
              users, orders, order_items, stock_reservations, inventory_logs, store_inventory, product_variants, products, stores CASCADE;`
  );
  await pool.query(
    `INSERT INTO stores (id, code, name, address, province, district, latitude, longitude, is_active)
     VALUES ('st-1', $1, 'Cửa hàng test', '12 Đường Test', 'Hồ Chí Minh', 'Quận 1', 10.7769, 106.7009, true);`,
    [STORE]
  );
  await pool.query(
    `INSERT INTO products (id, slug, name, sku, price, unit, thumbnail, cost_price, is_active)
     VALUES ($1, 'sua-test', 'Sữa Test', 'TS', 18000, '1 chai', '/images/test.jpg', 9000, true);`,
    [PRODUCT]
  );
  await pool.query(
    `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock) VALUES ('inv-1', $1, $2, 5000, 0, 0);`,
    [STORE, PRODUCT]
  );
}

let releaseDbLock = async () => {};

before(async () => {
  releaseDbLock = await lockReviewTestDb(pool);
  await initDatabase();
  await ensureMembershipSchema();
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
  await pool.query('TRUNCATE admin_users, audit_logs CASCADE;');
  await seedBase();
});

after(async () => {
  await releaseDbLock();
  await pool.end();
});

describe('rút tiền đối tác (partner/payouts) và số dư hiển thị', () => {
  /**
   * Đối tác ACTIVE có 2 khoản hoa hồng 500.000đ: A đã qua 7 ngày (AVAILABLE), B còn đang chờ 7 ngày (CONFIRMED, available_at ở tương lai).
   * current_balance = 1.000.000 (đã cộng cả hai lúc xác nhận), đã có tài khoản ngân hàng.
   */
  async function seedPartnerWithTwoCommissions() {
    const p = await partnerBearer(pool, { type: 'CTV', status: 'ACTIVE' });
    await pool.query(
      `UPDATE partner_profiles SET current_balance = 1000000, total_commission_earned = 1000000,
              bank_name = 'VCB', bank_account_number = '0123456789', bank_account_name = 'Doi Tac Test' WHERE id = $1`,
      [p.partnerId]
    );
    await pool.query(
      `INSERT INTO partner_ledger (id, partner_id, entry_type, amount, direction, status, available_at)
       VALUES ('ledA', $1, 'COMMISSION', 500000, 'CREDIT', 'CONFIRMED', NOW() - INTERVAL '1 day'),
              ('ledB', $1, 'COMMISSION', 500000, 'CREDIT', 'CONFIRMED', NOW() + INTERVAL '6 days');`,
      [p.partnerId]
    );
    return p;
  }
  const requestPayout = (p, amount) => call(payouts.POST, '/api/partner/payouts', { method: 'POST', headers: p.headers, body: { amount } });

  test('rút số tiền lớn hơn khả dụng (khoản chưa qua 7 ngày): bị từ chối', async () => {
    const p = await seedPartnerWithTwoCommissions();
    const r = await requestPayout(p, 800000);
    assert.equal(r.status, 400, JSON.stringify(r.json));
    assert.equal(r.json.code, 'INSUFFICIENT_AVAILABLE_BALANCE');
  });

  test('rút đúng số khả dụng 500.000đ: tạo yêu cầu PENDING, trừ ví, ghi dòng giữ tiền', async () => {
    const p = await seedPartnerWithTwoCommissions();
    const r = await requestPayout(p, 500000);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(Number((await pool.query('SELECT current_balance FROM partner_profiles WHERE id=$1', [p.partnerId])).rows[0].current_balance), 500000);
    assert.equal((await pool.query("SELECT count(*)::int c FROM partner_ledger WHERE entry_type='PAYOUT_HOLD' AND status='PENDING'")).rows[0].c, 1);
  });

  test('có yêu cầu đang chờ thì không tạo thêm yêu cầu thứ hai (409)', async () => {
    const p = await seedPartnerWithTwoCommissions();
    assert.equal((await requestPayout(p, 200000)).status, 200);
    const second = await requestPayout(p, 200000);
    assert.equal(second.status, 409, JSON.stringify(second.json));
  });

  test('Lỗi 6 (đã báo 10/11): sau khi đã chi 500.000đ, yêu cầu rút thêm 500.000đ từ khoản chưa qua 7 ngày phải bị từ chối', async () => {
    const p = await seedPartnerWithTwoCommissions();
    const first = await requestPayout(p, 500000);
    assert.equal(first.status, 200, JSON.stringify(first.json));
    // Kế toán duyệt và chi trả yêu cầu đầu (giữ đúng cách admin/payouts/[id] ghi: yêu cầu PAID, dòng giữ tiền PAID)
    await pool.query("UPDATE payout_requests SET status = 'PAID', bank_reference = 'REF1' WHERE partner_id = $1", [p.partnerId]);
    await pool.query("UPDATE partner_ledger SET status = 'PAID' WHERE entry_type = 'PAYOUT_HOLD'");
    const second = await requestPayout(p, 500000);
    assert.equal(second.status, 400, `yêu cầu thứ hai trả ${second.status}: ${JSON.stringify(second.json)}`);
  });

  test('R30: số dư "khả dụng" hiển thị cho đối tác phải trừ khoản đã rút (500.000đ đã chi thì khả dụng còn 0)', async () => {
    const p = await seedPartnerWithTwoCommissions();
    assert.equal((await requestPayout(p, 500000)).status, 200);
    await pool.query("UPDATE payout_requests SET status = 'PAID', bank_reference = 'REF1' WHERE partner_id = $1", [p.partnerId]);
    await pool.query("UPDATE partner_ledger SET status = 'PAID' WHERE entry_type = 'PAYOUT_HOLD'");
    const led = await call(ledgerRoute.GET, '/api/partner/ledger', { headers: p.headers });
    assert.equal(led.status, 200, JSON.stringify(led.json));
    assert.equal(led.json.balances.available, 0, `balances = ${JSON.stringify(led.json.balances)}`);
    const st = await call(statsRoute.GET, '/api/partner/stats', { headers: p.headers });
    assert.equal(st.status, 200, JSON.stringify(st.json));
    const availableOnStats = st.json.income?.available ?? st.json.balances?.available ?? st.json.available_income ?? st.json.availableIncome;
    assert.ok(availableOnStats === 0 || availableOnStats === undefined, `stats khả dụng = ${availableOnStats} (${JSON.stringify(st.json).slice(0, 400)})`);
  });
});

describe('cron sinh đơn định kỳ (cron/subscriptions/generate-orders)', () => {
  // Route cron dùng req.nextUrl nên cần NextRequest thật (không phải Request thường)
  const cronWith = async (secret) => {
    const res = await cronGenerate.POST(
      new NextRequest('http://localhost/api/cron/subscriptions/generate-orders', { method: 'POST', headers: { 'x-cron-secret': secret } })
    );
    return { status: res.status, json: await readJson(res) };
  };
  const cron = () => cronWith(process.env.CRON_SECRET);

  async function seedSubscription({ province = 'Hồ Chí Minh', quantity = 1, finalPrice = 107100, snapshot = 126000 } = {}) {
    const u = await partnerBearer(pool, { type: 'CTV' }); // chỉ để có một khách (users) hợp lệ
    await pool.query(
      `INSERT INTO subscriptions (id, subscription_code, user_id, status, delivery_frequency, preferred_day_of_week, next_delivery_date,
                                  recipient_name, recipient_phone, shipping_address, province, district, ward, store_code, payment_method)
       VALUES ('sub1', 'SUB-1', $1, 'ACTIVE', '1_WEEK', 2, CURRENT_DATE, 'Khách', '0901234567', '1 Đường Test', $2, 'Quận 1', 'P1', $3, 'cod');`,
      [u.userId, province, STORE]
    );
    await pool.query(
      `INSERT INTO subscription_items (id, subscription_id, product_id, variant_id, name, unit, price_snapshot, discount_rate, final_price, quantity)
       VALUES ('si1', 'sub1', $1, NULL, 'Sữa Test (Lốc 7 chai)', 'Lốc 7 chai', $2, 0.15, $3, $4);`,
      [PRODUCT, snapshot, finalPrice, quantity]
    );
    await pool.query(`INSERT INTO subscription_schedules (id, subscription_id, scheduled_date, status) VALUES ('sch1', 'sub1', CURRENT_DATE, 'SCHEDULED');`);
  }

  test('không có/ sai CRON_SECRET: 401', async () => {
    const r = await cronWith('sai');
    assert.equal(r.status, 401);
  });

  test('R31: đơn định kỳ sinh ra phải tính đúng giá lốc đã chốt (107.100đ), không phải giá một chai (15.300đ)', async () => {
    await seedSubscription();
    const r = await cron();
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const o = (await pool.query("SELECT subtotal, total FROM orders WHERE order_channel = 'SUBSCRIBE_AND_SAVE'")).rows[0];
    assert.ok(o, 'không sinh được đơn: ' + JSON.stringify(r.json));
    assert.equal(Number(o.subtotal), 107100, `subtotal = ${o.subtotal}`);
  });

  test('R34: đơn định kỳ tạo từ mã sản phẩm do giao diện gửi ("sub-sb-01", như SubscribeSaveSection) phải xác nhận được bằng PUT admin', async () => {
    await seedSubscription();
    await pool.query("UPDATE subscription_items SET product_id = 'sub-sb-01'");
    const gen = await cron();
    assert.equal(gen.status, 200, JSON.stringify(gen.json));
    const order = (await pool.query("SELECT id, subtotal FROM orders WHERE order_channel = 'SUBSCRIBE_AND_SAVE'")).rows[0];
    assert.ok(order, 'cron không sinh đơn: ' + JSON.stringify(gen.json));
    assert.equal(Number(order.subtotal), 107100, 'đối chứng: mã không có trong catalog thì giá lấy từ giá đã chốt');
    await loginAdmin(pool, { role: 'SUPER_ADMIN' });
    const r = await call(adminOrders.PUT, '/api/admin/orders', { method: 'PUT', body: { id: order.id, status: 'CONFIRMED' } });
    assert.equal(r.status, 200, `xác nhận đơn định kỳ trả ${r.status}: ${JSON.stringify(r.json)}`);
  });

  test('R32: một kỳ giao lỗi giữa chừng không được để lại kết nối trong giao dịch dang dở', async () => {
    await seedSubscription({ province: null }); // orders.province NOT NULL → INSERT đơn lỗi sau BEGIN
    const r = await cron();
    assert.equal(r.status, 500, JSON.stringify(r.json));
    // Dùng hết kết nối trong pool: mọi truy vấn phải chạy bình thường
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => pool.query('SELECT 1 AS ok')));
    const bad = results.filter((x) => x.status === 'rejected').map((x) => String(x.reason?.message));
    assert.deepEqual(bad, [], `có kết nối bị hỏng sau lỗi: ${bad.slice(0, 2).join(' | ')}`);
  });

  test(
    'R33: tồn kho không đủ giữ chỗ trọn đơn định kỳ thì không được tạo đơn với giữ chỗ một phần (theo comment "Zero-Oversell")',
    { todo: 'Chờ quyết định nghiệp vụ: thiếu hàng thì bỏ qua kỳ và thử lại, hay tạo đơn chờ bổ sung hàng' },
    async () => {
      await seedSubscription({ quantity: 10 }); // 70 chai
      await pool.query('UPDATE store_inventory SET stock_quantity = 20 WHERE store_code = $1 AND product_id = $2', [STORE, PRODUCT]);
      await cron();
      const reserved = Number((await pool.query('SELECT COALESCE(SUM(quantity),0)::int q FROM stock_reservations')).rows[0].q);
      const orders = (await pool.query('SELECT count(*)::int c FROM orders')).rows[0].c;
      assert.ok(orders === 0 || reserved === 70, `đơn ${orders}, giữ chỗ ${reserved}/70 chai`);
    }
  );
});
