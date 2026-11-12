/**
 * Kiểm thử API cho các chức năng admin bổ sung: phân trang đơn, lô hàng,
 * xác nhận chuyển khoản (trừ kho + idempotent). Tự dọn dữ liệu.
 * Chạy: JWT_SECRET=... node tests/admin_features_e2e_test.mjs
 */
import 'dotenv/config';
import pg from 'pg';
import { SignJWT } from 'jose';

import { assertSafeDatabase } from '../scripts/db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let failed = 0;
const ok = (n, c, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); if (!c) failed++; };
const u = (await db.query(`SELECT * FROM admin_users WHERE id='qa_admin_super_id'`)).rows[0];
const tok = await new SignJWT({ id: u.id, userId: u.id, username: u.username, email: 'x@x.vn', role: u.role, storeCode: u.store_code })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(SECRET);
const A = async (m, p, b) => {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', Origin: BASE, Cookie: `tsf_admin_token=${tok}` }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const stock = async () => (await db.query(`SELECT stock_quantity AS quantity, reserved FROM store_inventory WHERE store_code='NH' AND product_id='prod-sb-01'`)).rows[0];
let orderId, lotCode = 'E2E-LOT-' + Date.now();
try {
  // 1. Phân trang
  const p1 = await A('GET', '/api/admin/orders?page=1&limit=20');
  const p2 = await A('GET', '/api/admin/orders?page=2&limit=20');
  ok('Phân trang: trang 1 trả ≤ 20 đơn + pagination', p1.json.data?.length <= 20 && p1.json.pagination?.total > 20, `rows=${p1.json.data?.length} total=${p1.json.pagination?.total} pages=${p1.json.pagination?.totalPages}`);
  ok('Phân trang: trang 2 khác trang 1', p2.json.data?.length > 0 && p2.json.data[0].id !== p1.json.data[0].id);
  ok('Phân trang: có statusCounts', !!p1.json.statusCounts);

  // 2. Đơn chuyển khoản + xác nhận
  const before = await stock();
  const cr = await fetch(BASE + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: JSON.stringify({
    fullName: 'E2E Bank', phone: '0900000001', email: 'e2e@test.vn', address: '1 Test', paymentMethod: 'bank_transfer', storeCode: 'NH',
    shippingFee: 0, subtotal: 18000, total: 18000, items: [{ productId: 'prod-sb-01', name: 'Sữa Bắp Nếp', price: 9000, quantity: 2, unit: 'Chai' }] }) });
  const cj = await cr.json();
  orderId = cj.order?.id || cj.orderId || cj.data?.id;
  if (!orderId && cj.orderCode) orderId = (await db.query(`SELECT id FROM orders WHERE order_code=$1`, [cj.orderCode])).rows[0]?.id;
  ok('Tạo đơn chuyển khoản', !!orderId, JSON.stringify(cj).slice(0, 160));
  const reserved = await stock();
  const o0 = (await db.query(`SELECT status,payment_status,payment_method FROM orders WHERE id=$1`, [orderId])).rows[0];
  ok('Đơn mới: PENDING / chưa trả', o0.status === 'PENDING' && o0.payment_status !== 'PAID', JSON.stringify(o0));

  const c1 = await A('POST', `/api/admin/orders/${orderId}/confirm-payment`, { paymentReference: 'FT-E2E-001' });
  const after1 = await stock();
  const o1 = (await db.query(`SELECT status,payment_status,note FROM orders WHERE id=$1`, [orderId])).rows[0];
  ok('Xác nhận lần 1 → 200, CONFIRMED + PAID', c1.status === 200 && o1.status === 'CONFIRMED' && o1.payment_status === 'PAID', `status=${c1.status}`);
  ok('Xác nhận lần 1 TRỪ tồn kho 2', Number(before.quantity) - Number(after1.quantity) === 2, `before=${before.quantity} after=${after1.quantity}`);
  const c2 = await A('POST', `/api/admin/orders/${orderId}/confirm-payment`, { paymentReference: 'FT-E2E-001' });
  const after2 = await stock();
  const o2 = (await db.query(`SELECT note FROM orders WHERE id=$1`, [orderId])).rows[0];
  ok('Gọi lại cùng mã → 200 alreadyPaid, không trừ kho thêm', c2.status === 200 && c2.json.alreadyPaid === true && after2.quantity === after1.quantity);
  ok('Gọi lại không nối thêm ghi chú', (o2.note.match(/Đã khớp lệnh/g) || []).length === 1, o2.note);
  const c3 = await A('POST', `/api/admin/orders/${orderId}/confirm-payment`, { paymentReference: 'OTHER-999' });
  ok('Gọi lại khác mã giao dịch → 409', c3.status === 409);

  // 3. Lô hàng
  const lp = await A('POST', '/api/admin/inventory/lots', { storeCode: 'NH', productId: 'prod-sb-01', lotCode, quantity: 5, manufacturingDate: '2026-01-01', expiryDate: '2027-01-01' });
  const lg = await A('GET', '/api/admin/inventory/lots?storeCode=NH&productId=prod-sb-01');
  const found = JSON.stringify(lg.json).includes(lotCode);
  ok('Nhập lô hàng → 200 và liệt kê được lô', lp.status < 300 && found, `post=${lp.status}`);
  const bad = await A('POST', '/api/admin/inventory/lots', { storeCode: 'NH', productId: 'prod-sb-01', lotCode: 'X', quantity: 5, manufacturingDate: '2026-01-01', expiryDate: '2025-01-01' });
  ok('Lô có hạn dùng trước ngày sản xuất → 400', bad.status === 400);
} finally {
  if (orderId) {
    await db.query(`UPDATE store_inventory SET stock_quantity = stock_quantity + 2 WHERE store_code='NH' AND product_id='prod-sb-01' AND EXISTS (SELECT 1 FROM orders WHERE id=$1 AND status='CONFIRMED')`, [orderId]).catch(() => {});
    await db.query(`DELETE FROM order_items WHERE order_id=$1`, [orderId]).catch(() => {});
    await db.query(`DELETE FROM stock_reservations WHERE order_id=$1`, [orderId]).catch(() => {});
    await db.query(`DELETE FROM orders WHERE id=$1`, [orderId]).catch(() => {});
  }
  await db.query(`DELETE FROM inventory_lots WHERE lot_code=$1`, [lotCode]).catch(() => {});
  await db.end();
}
console.log(failed ? `\n${failed} thất bại` : '\nTất cả đạt');
process.exit(failed ? 1 : 0);
