/**
 * GO-LIVE: POST /api/orders không được tin userId từ body.
 *
 * Case 1 (spoof): khách KHÔNG có cookie gửi userId/user_id của khách khác + saveDefaultAddress=true + lat/lng
 *   → đơn lưu user_id = NULL, địa chỉ mặc định của nạn nhân KHÔNG đổi.
 * Case 2 (positive): khách đăng nhập (cookie phiên thật từ /api/auth/login) + saveDefaultAddress=true
 *   → đơn gắn đúng user_id của mình, địa chỉ mặc định của chính mình được cập nhật.
 *
 * Tự tạo dữ liệu (tiền tố QA_TEST_) và tự dọn. Chỉ chạy trên DB local (assertSafeTestEnvironment).
 * Chạy: BASE_URL=http://localhost:3000 node --env-file=.env tests/golive_order_userid_spoof_test.mjs
 */
import pg from 'pg';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { assertSafeTestEnvironment } from './helpers/safe_test_env.mjs';

assertSafeTestEnvironment();

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const RUN = `${Date.now().toString().slice(-7)}${crypto.randomInt(100, 999)}`;

const createdUserIds = [];
const createdOrderCodes = [];
let failures = 0;

function check(cond, label, extra) {
  if (cond) console.log(`  ✅ ${label}`);
  else {
    failures++;
    console.error(`  ❌ ${label}`, extra ?? '');
  }
}

// Đầu số hợp lệ theo COD_VALIDATION.PHONE_REGEX: 09[0-46-9] + 7 chữ số
function uniquePhone() {
  const third = [0, 1, 2, 3, 4, 6, 7, 8, 9][crypto.randomInt(0, 9)];
  return `09${third}${crypto.randomInt(1000000, 9999999)}`;
}

/** fetch tôn trọng giới hạn 60 req/phút của middleware: gặp 429 thì chờ Retry-After rồi thử lại */
async function apiFetch(url, init) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    const waitSec = Math.min(65, Number(res.headers.get('retry-after')) || 30);
    console.log(`  … bị giới hạn tốc độ, chờ ${waitSec}s`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
  return fetch(url, init);
}

async function pickStoreAndProduct() {
  const r = await pool.query(
    `SELECT si.store_code, si.product_id, s.latitude, s.longitude
     FROM store_inventory si JOIN stores s ON s.code = si.store_code
     WHERE s.is_active = true AND si.stock_quantity >= 20 AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
       AND (s.province ILIKE '%Hồ Chí Minh%' OR s.province ILIKE '%HCM%')
     ORDER BY si.stock_quantity DESC LIMIT 1;`
  );
  if (!r.rows.length) throw new Error('Không tìm thấy chi nhánh TP.HCM có tồn kho để test');
  const row = r.rows[0];
  return { storeCode: row.store_code, productId: row.product_id, lat: Number(row.latitude), lng: Number(row.longitude) };
}

function orderBody({ orderCode, phone, storeCode, productId, lat, lng, extra = {} }) {
  return {
    orderCode,
    fullName: 'QA_TEST Khách',
    phone,
    email: '',
    province: 'Thành phố Hồ Chí Minh',
    district: 'QA_TEST Quận',
    ward: 'QA_TEST Phường',
    address: `QA_TEST địa chỉ mới ${orderCode} đường kiểm thử`,
    paymentMethod: 'cod',
    storeCode,
    latitude: lat,
    longitude: lng,
    locationConfirmed: true,
    locationConfirmedBy: 'USER_MAP_PIN',
    saveDefaultAddress: true,
    items: [{ productId, name: 'QA_TEST item', price: 1, quantity: 1, unit: 'Chai' }],
    ...extra,
  };
}

async function postOrder(body, cookie) {
  const headers = { 'Content-Type': 'application/json', Origin: BASE_URL };
  if (cookie) headers.Cookie = cookie;
  const res = await apiFetch(`${BASE_URL}/api/orders`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function cleanup() {
  try {
    if (createdOrderCodes.length) {
      const o = await pool.query(`SELECT id FROM orders WHERE order_code = ANY($1);`, [createdOrderCodes]);
      const ids = o.rows.map((r) => r.id);
      if (ids.length) {
        // Trả lại số chai đang giữ chỗ (store_inventory.reserved) trước khi xóa reservation
        const active = await pool.query(
          `SELECT store_code, product_id, SUM(quantity)::int AS qty FROM stock_reservations
           WHERE order_id = ANY($1) AND status = 'active' GROUP BY store_code, product_id;`,
          [ids]
        );
        for (const r of active.rows) {
          await pool.query(
            `UPDATE store_inventory SET reserved = GREATEST(0, reserved - $1) WHERE store_code = $2 AND product_id = $3;`,
            [r.qty, r.store_code, r.product_id]
          );
        }
        await pool.query(`DELETE FROM inventory_logs WHERE order_id = ANY($1);`, [ids]).catch(() => {});
        await pool.query(`DELETE FROM stock_reservations WHERE order_id = ANY($1);`, [ids]).catch(() => {});
        await pool.query(`DELETE FROM order_items WHERE order_id = ANY($1);`, [ids]).catch(() => {});
        await pool.query(`DELETE FROM orders WHERE id = ANY($1);`, [ids]);
      }
      await pool.query(`DELETE FROM email_logs WHERE order_code = ANY($1);`, [createdOrderCodes]).catch(() => {});
    }
    if (createdUserIds.length) {
      await pool.query(`DELETE FROM users WHERE id = ANY($1);`, [createdUserIds]);
    }
    await pool.query(`DELETE FROM users WHERE email LIKE 'qa_test_${RUN}%';`).catch(() => {});
    console.log('🧹 Đã dọn dữ liệu QA_TEST_');
  } catch (err) {
    console.error('⚠️ Lỗi dọn dữ liệu:', err.message);
  }
}

async function main() {
  console.log(`🧪 GO-LIVE: chống giả mạo userId ở POST /api/orders (${BASE_URL})`);
  const { storeCode, productId, lat, lng } = await pickStoreAndProduct();
  // Tọa độ khách lệch nhẹ so với chi nhánh để không vượt bán kính giao hàng
  const custLat = Number((lat + 0.001).toFixed(6));
  const custLng = Number((lng + 0.001).toFixed(6));

  // ── Case 1: spoof userId không có cookie ──
  console.log('\n[Case 1] Không cookie + userId của khách khác + saveDefaultAddress');
  const victimId = `QA_TEST_victim_${RUN}`;
  const victimAddress = 'QA_TEST địa chỉ gốc của nạn nhân';
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, phone, address, province, district, ward, latitude, longitude)
     VALUES ($1, $2, 'QA_TEST_no_login', 'QA_TEST Nạn nhân', $3, $4, 'QA_TEST Tỉnh', 'QA_TEST Quận gốc', 'QA_TEST Phường gốc', 1.111111, 2.222222);`,
    [victimId, `qa_test_${RUN}_victim@example.invalid`, uniquePhone(), victimAddress]
  );
  createdUserIds.push(victimId);

  const spoofCode = `QA_TEST_S${RUN}`;
  createdOrderCodes.push(spoofCode);
  const spoof = await postOrder(
    orderBody({ orderCode: spoofCode, phone: uniquePhone(), storeCode, productId, lat: custLat, lng: custLng, extra: { userId: victimId, user_id: victimId } })
  );
  check(spoof.status === 200 && spoof.json.success, 'Đơn guest vẫn tạo được', spoof);
  const finalSpoofCode = spoof.json.orderCode || spoof.json.order?.orderCode || spoofCode;
  if (finalSpoofCode !== spoofCode) createdOrderCodes.push(finalSpoofCode);

  const spoofOrder = await pool.query(`SELECT user_id, email FROM orders WHERE order_code = ANY($1) LIMIT 1;`, [createdOrderCodes]);
  check(spoofOrder.rows.length === 1, 'Tìm thấy đơn trong DB');
  check(spoofOrder.rows[0]?.user_id === null, 'orders.user_id = NULL (không gắn vào tài khoản nạn nhân)', spoofOrder.rows[0]);
  check(!spoofOrder.rows[0]?.email || !spoofOrder.rows[0].email.includes('victim'), 'Email đơn không lấy email nạn nhân', spoofOrder.rows[0]);

  const victimAfter = await pool.query(`SELECT address, district, ward, latitude, longitude FROM users WHERE id = $1;`, [victimId]);
  const v = victimAfter.rows[0];
  check(
    v.address === victimAddress && v.district === 'QA_TEST Quận gốc' && v.ward === 'QA_TEST Phường gốc' &&
      Number(v.latitude) === 1.111111 && Number(v.longitude) === 2.222222,
    'Địa chỉ mặc định của nạn nhân KHÔNG đổi',
    v
  );

  // ── Case 2: khách đăng nhập thật cập nhật địa chỉ của chính mình ──
  console.log('\n[Case 2] Đăng nhập (cookie phiên thật) + saveDefaultAddress');
  // Tạo user trực tiếp trong DB rồi đăng nhập qua /api/auth/login để lấy cookie phiên thật
  // (không dùng /api/auth/register vì giới hạn 5 lần đăng ký/giờ/IP)
  const ownEmail = `qa_test_${RUN}_owner@example.invalid`;
  const ownPassword = `QaTest@${RUN}`;
  const ownId = `QA_TEST_owner_${RUN}`;
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, phone) VALUES ($1, $2, $3, 'QA_TEST Chủ tài khoản', $4);`,
    [ownId, ownEmail, await bcrypt.hash(ownPassword, 10), uniquePhone()]
  );
  createdUserIds.push(ownId);
  const login = await apiFetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ email: ownEmail, password: ownPassword }),
  });
  const loginJson = await login.json().catch(() => ({}));
  const setCookie = login.headers.getSetCookie?.() || [login.headers.get('set-cookie') || ''];
  const sessionCookie = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('tsf_user_session='));
  check(login.ok && sessionCookie, 'Đăng nhập + nhận cookie phiên', { status: login.status, loginJson });

  if (sessionCookie && ownId) {
    const ownCode = `QA_TEST_P${RUN}`;
    createdOrderCodes.push(ownCode);
    // Gửi kèm userId của nạn nhân: server vẫn phải dùng userId trong session
    const own = await postOrder(
      orderBody({ orderCode: ownCode, phone: uniquePhone(), storeCode, productId, lat: custLat, lng: custLng, extra: { userId: victimId } }),
      sessionCookie
    );
    check(own.status === 200 && own.json.success, 'Đơn của khách đăng nhập tạo được', own);
    const finalOwnCode = own.json.orderCode || own.json.order?.orderCode || ownCode;
    if (finalOwnCode !== ownCode) createdOrderCodes.push(finalOwnCode);

    const ownOrder = await pool.query(`SELECT user_id FROM orders WHERE order_code = ANY($1);`, [[ownCode, finalOwnCode]]);
    check(ownOrder.rows[0]?.user_id === ownId, 'orders.user_id = id trong session', ownOrder.rows[0]);

    const ownAfter = await pool.query(`SELECT address, latitude, longitude FROM users WHERE id = $1;`, [ownId]);
    const o = ownAfter.rows[0];
    check(
      o.address === `QA_TEST địa chỉ mới ${ownCode} đường kiểm thử` && Number(o.latitude) === custLat && Number(o.longitude) === custLng,
      'Địa chỉ mặc định của chính khách được cập nhật',
      o
    );

    const victimAgain = await pool.query(`SELECT address FROM users WHERE id = $1;`, [victimId]);
    check(victimAgain.rows[0].address === victimAddress, 'Nạn nhân vẫn không đổi sau Case 2');
  }
}

try {
  await main();
} catch (err) {
  failures++;
  console.error('❌ Lỗi test:', err);
} finally {
  await cleanup();
  await pool.end();
}

console.log(failures === 0 ? '\n🎉 PASS' : `\n💥 FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
