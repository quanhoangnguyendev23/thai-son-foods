/**
 * TẢI: N khách (mặc định 20) cùng bấm đặt đơn một lúc vào CÙNG một chi nhánh.
 * Đo: số đơn thành công, lỗi, thời gian phản hồi; kiểm tra tồn giữ chỗ đúng bằng tổng số chai.
 * Báo Telegram (nếu server có TELEGRAM_*) sẽ gửi N tin — xem bot để đếm.
 *
 * Tự tạo dữ liệu (QA_TEST_) và tự dọn. Chỉ chạy trên DB local (assertSafeTestEnvironment).
 * Chạy: BASE_URL=http://localhost:3100 N=20 node --env-file=.env tests/load_20_orders_test.mjs
 */
import pg from 'pg';
import crypto from 'node:crypto';
import { assertSafeTestEnvironment } from './helpers/safe_test_env.mjs';

assertSafeTestEnvironment();

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/$/, '');
const N = Number(process.env.N) || 20;
// FAKE_IPS=1: mỗi khách 1 IP riêng (server phải chạy TRUSTED_PROXY_COUNT=1) — giống 20 người ở 20 máy khác nhau
const FAKE_IPS = process.env.FAKE_IPS === '1';
const KEEP = process.env.KEEP === '1'; // KEEP=1: không dọn đơn (để xem trong admin)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PRODUCT = 'prod-sb-01';
const CART_ID = 'sua-bap-nep-var_prod-sb-01_sb-7chai';
const BOTTLES_PER_ORDER = 7;

function uniquePhone() {
  const third = [0, 1, 2, 3, 4, 6, 7, 8, 9][crypto.randomInt(0, 9)];
  return `09${third}${crypto.randomInt(1000000, 9999999)}`;
}

async function pickStore(bottles) {
  const r = await pool.query(
    `SELECT s.code, s.latitude, s.longitude,
            si.stock_quantity - COALESCE(si.reserved, 0) - COALESCE(si.safety_stock, 0) AS sellable
     FROM store_inventory si JOIN stores s ON s.code = si.store_code
     WHERE si.product_id = $1 AND s.is_active = true AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
       AND (s.province ILIKE '%Hồ Chí Minh%' OR s.province ILIKE '%HCM%')
     ORDER BY sellable DESC LIMIT 1;`,
    [PRODUCT]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    storeCode: row.code,
    sellable: Number(row.sellable),
    lat: Number((Number(row.latitude) + 0.001).toFixed(6)),
    lng: Number((Number(row.longitude) + 0.001).toFixed(6)),
    enough: Number(row.sellable) >= bottles,
  };
}

async function reservedOf(storeCode) {
  const r = await pool.query(`SELECT COALESCE(reserved,0)::int AS reserved FROM store_inventory WHERE store_code=$1 AND product_id=$2;`, [storeCode, PRODUCT]);
  return r.rows[0]?.reserved ?? 0;
}

async function cleanup(ids, codes) {
  if (!ids.length) return;
  const active = await pool.query(
    `SELECT store_code, product_id, SUM(quantity)::int AS qty FROM stock_reservations
     WHERE order_id = ANY($1) AND status = 'active' GROUP BY store_code, product_id;`,
    [ids]
  );
  for (const r of active.rows) {
    await pool.query(`UPDATE store_inventory SET reserved = GREATEST(0, reserved - $1) WHERE store_code = $2 AND product_id = $3;`, [r.qty, r.store_code, r.product_id]);
  }
  await pool.query(`DELETE FROM inventory_logs WHERE order_id = ANY($1);`, [ids]).catch(() => {});
  await pool.query(`DELETE FROM stock_reservations WHERE order_id = ANY($1);`, [ids]).catch(() => {});
  await pool.query(`DELETE FROM order_items WHERE order_id = ANY($1);`, [ids]).catch(() => {});
  await pool.query(`DELETE FROM orders WHERE id = ANY($1);`, [ids]);
  await pool.query(`DELETE FROM email_logs WHERE order_code = ANY($1);`, [codes]).catch(() => {});
  console.log(`🧹 Đã dọn ${ids.length} đơn test và trả lại tồn giữ chỗ`);
}

async function main() {
  const store = await pickStore(N * BOTTLES_PER_ORDER);
  if (!store) throw new Error('Không có chi nhánh HCM nào có tồn ' + PRODUCT);
  console.log(`🧪 ${N} đơn cùng lúc → ${BASE_URL}, chi nhánh ${store.storeCode} (bán được ${store.sellable} chai, cần ${N * BOTTLES_PER_ORDER})`);
  const reservedBefore = await reservedOf(store.storeCode);

  // Làm nóng route (dev server biên dịch lần đầu) bằng 1 GET nhẹ
  await fetch(`${BASE_URL}/api/orders?code=TSF-0`).catch(() => {});

  const t0 = Date.now();
  const results = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const s = Date.now();
      try {
        const res = await fetch(`${BASE_URL}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: BASE_URL, ...(FAKE_IPS ? { 'X-Forwarded-For': `10.20.0.${i + 1}` } : {}) },
          body: JSON.stringify({
            fullName: `QA_TEST Khách tải ${i + 1}`,
            phone: uniquePhone(),
            email: '',
            province: 'Thành phố Hồ Chí Minh',
            district: 'QA_TEST Quận',
            ward: 'QA_TEST Phường',
            address: `QA_TEST địa chỉ test tải số ${i + 1}`,
            paymentMethod: 'cod',
            storeCode: store.storeCode,
            latitude: store.lat,
            longitude: store.lng,
            items: [{ productId: CART_ID, name: 'x', unit: 'x', price: 1, quantity: 1 }],
          }),
        });
        const json = await res.json().catch(() => ({}));
        return { i, status: res.status, ms: Date.now() - s, json };
      } catch (err) {
        return { i, status: 0, ms: Date.now() - s, json: { error: err.message } };
      }
    })
  );
  const totalMs = Date.now() - t0;

  const ok = results.filter((r) => r.status === 200 && r.json.success);
  const fail = results.filter((r) => !(r.status === 200 && r.json.success));
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const p = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
  const codes = ok.map((r) => r.json.orderCode);
  const ids = ok.map((r) => r.json.orderId);

  console.log(`\nKết quả: ${ok.length}/${N} đơn thành công trong ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`Thời gian phản hồi: nhanh nhất ${times[0]}ms, trung vị ${p(0.5)}ms, chậm nhất ${times[times.length - 1]}ms`);
  const byStatus = {};
  for (const r of fail) {
    const key = `${r.status} ${r.json.error || ''}`.slice(0, 120);
    byStatus[key] = (byStatus[key] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byStatus)) console.log(`  ❌ ${v} đơn: ${k}`);

  const dupCodes = codes.length - new Set(codes).size;
  console.log(`Mã đơn trùng: ${dupCodes}`);
  const reservedAfter = await reservedOf(store.storeCode);
  const expected = ok.length * BOTTLES_PER_ORDER;
  console.log(`Tồn giữ chỗ tăng ${reservedAfter - reservedBefore} chai (mong đợi ${expected}) ${reservedAfter - reservedBefore === expected ? '✅' : '❌'}`);

  if (!KEEP) await cleanup(ids, codes);
  else console.log('KEEP=1 → giữ lại đơn test:', codes.join(', '));
  await pool.end();
  process.exit(ok.length === N && dupCodes === 0 && reservedAfter - reservedBefore === expected ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
