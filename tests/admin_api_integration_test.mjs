/**
 * Kiểm thử tích hợp các API admin đã được vá (cần: server đang chạy + CSDL dev/staging).
 * Tự tạo dữ liệu thử có tiền tố TEST_/test_tmp_ và DỌN SẠCH khi xong.
 *
 * Chạy:  npm run dev   (cổng 3000)   rồi   node tests/admin_api_integration_test.mjs
 * Tuỳ chọn: BASE_URL=http://127.0.0.1:3300  (khi chạy bản production với JWT_SECRET riêng — đặt cùng JWT_SECRET cho script)
 */
import { createRequire } from 'node:module';

import { assertSafeDatabase } from '../scripts/db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

const require = createRequire(import.meta.url);
require('dotenv').config({ path: '.env', quiet: true });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { SignJWT } = await import('jose');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'tsf_super_secret_jwt_key_2026_thai_son_foods');
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); cond ? pass++ : fail++; };

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const mintAdmin = (u) => new SignJWT({ id: u.id, userId: u.id, username: u.username, email: 'x@x.vn', role: u.role, storeCode: u.store_code })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(SECRET);
const mintUser = (id) => new SignJWT({ id, email: 'tmp@test.vn', fullName: 'Test' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(SECRET);

const call = async (cookieName, tok, method, path, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { cookie: `${cookieName}=${tok}`, origin: BASE, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: r.status, json, text };
};

const cleanup = async () => {
  await db.query(`DELETE FROM orders WHERE id LIKE 'TEST\\_%' AND id NOT LIKE 'TEST-%'`);
  await db.query(`DELETE FROM payout_requests WHERE id LIKE 'TEST\\_%'`);
  await db.query(`DELETE FROM partner_ledger WHERE id LIKE 'TEST\\_%'`);
  await db.query(`DELETE FROM partner_profiles WHERE id LIKE 'TEST\\_%'`);
  await db.query(`DELETE FROM combos WHERE id LIKE 'combo\\_%' AND name LIKE 'TEST %'`);
  await db.query(`DELETE FROM products WHERE name LIKE 'TEST %'`);
  await db.query(`DELETE FROM categories WHERE name LIKE 'TEST %'`);
  await db.query(`DELETE FROM banners WHERE title LIKE 'TEST %'`);
  await db.query(`DELETE FROM users WHERE id LIKE 'test\\_tmp\\_%'`);
};

try {
  await cleanup();
  const superU = (await db.query(`SELECT * FROM admin_users WHERE id='qa_admin_super_id'`)).rows[0];
  const staffU = (await db.query(`SELECT * FROM admin_users WHERE id='qa_admin_staff_d1_id'`)).rows[0];
  const SUP = await mintAdmin(superU), STF = await mintAdmin(staffU);
  const A = (m, p, b) => call('tsf_admin_token', SUP, m, p, b);
  const S = (m, p, b) => call('tsf_admin_token', STF, m, p, b);
  const mkOrder = (id, { status = 'PENDING', pay = 'cod', total = 10000 } = {}) => db.query(
    `INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, subtotal, total, status, store_code, payment_method)
     VALUES ($1,$1,'TEST KH','0900000000','HCM','Q1','P1','1 Test',$3,$3,$2,'D1',$4)`, [id, status, total, pay]);

  // ───── 1. Đối soát COD & hoàn hàng ─────
  await mkOrder('TEST_C1', { status: 'CONFIRMED' });
  let r = await A('POST', '/api/admin/orders/reconcile', { action: 'reconcile_cod', orderId: 'TEST_C1', amount: -5 });
  ok('COD: số tiền âm → 400', r.status === 400 && r.json?.code === 'INVALID_AMOUNT');
  r = await A('POST', '/api/admin/orders/reconcile', { action: 'reconcile_cod', orderId: 'TEST_C1', amount: 99999999 });
  ok('COD: số tiền vượt tổng đơn → 400', r.status === 400);
  r = await A('POST', '/api/admin/orders/reconcile', { action: 'reconcile_cod', orderId: 'TEST_C1', amount: 10000 });
  ok('COD: số tiền hợp lệ → 200', r.status === 200 && r.json?.success === true, r.json?.error || '');
  const note1 = (await db.query(`SELECT note, cod_collected_amount FROM orders WHERE id='TEST_C1'`)).rows[0];
  r = await A('POST', '/api/admin/orders/reconcile', { action: 'reconcile_cod', orderId: 'TEST_C1', amount: 5000 });
  const note2 = (await db.query(`SELECT note, cod_collected_amount FROM orders WHERE id='TEST_C1'`)).rows[0];
  ok('COD: đối soát lần 2 idempotent, không ghi đè số tiền / không nối ghi chú', r.json?.alreadyReconciled === true && note1.note === note2.note && Number(note2.cod_collected_amount) === 10000);
  await mkOrder('TEST_C2', { status: 'CONFIRMED', pay: 'bank' });
  r = await A('POST', '/api/admin/orders/reconcile', { action: 'reconcile_cod', orderId: 'TEST_C2', amount: 100 });
  ok('COD: đơn chuyển khoản không đối soát COD → 409', r.status === 409 && r.json?.code === 'ORDER_NOT_COD');
  await mkOrder('TEST_C3', { status: 'PENDING' });
  r = await A('POST', '/api/admin/orders/reconcile', { action: 'reconcile_cod', orderId: 'TEST_C3' });
  ok('COD: đơn Chờ xử lý → 409', r.status === 409);
  r = await A('POST', '/api/admin/orders/reconcile', { action: 'process_return', orderId: 'TEST_C3' });
  ok('Hoàn hàng: đơn Chờ xử lý (chưa giao) → 409', r.status === 409 && r.json?.code === 'INVALID_ORDER_STATE');
  await mkOrder('TEST_C4', { status: 'SHIPPING' });
  r = await A('POST', '/api/admin/orders/reconcile', { action: 'process_return', orderId: 'TEST_C4', disposition: 'restocked', reason: 'Khách từ chối' });
  ok('Hoàn hàng: đơn đang giao → 200 và chuyển CANCELLED', r.status === 200 && (await db.query(`SELECT status FROM orders WHERE id='TEST_C4'`)).rows[0].status === 'CANCELLED', r.json?.error || '');
  r = await A('POST', '/api/admin/orders/reconcile', { action: 'process_return', orderId: 'TEST_C4' });
  ok('Hoàn hàng lần 2 → 409 (không nhập kho hai lần)', r.status === 409 && r.json?.code === 'ALREADY_CANCELLED');

  // ───── 2. Tồn kho ─────
  const prod = (await db.query(`SELECT id FROM products WHERE is_active = true ORDER BY id LIMIT 2`)).rows;
  const [p1, p2] = [prod[0].id, prod[1].id];
  const stock = async (pid) => Number((await db.query(`SELECT stock_quantity FROM store_inventory WHERE store_code='D1' AND product_id=$1`, [pid])).rows[0]?.stock_quantity ?? 0);
  const s1 = await stock(p1);
  r = await S('PUT', '/api/admin/inventory', { productId: p1, stockQuantity: 'abc' });
  ok('Tồn kho: chữ → 400 (không âm thầm đặt về 0)', r.status === 400 && (await stock(p1)) === s1);
  r = await S('PUT', '/api/admin/inventory', { productId: p1 });
  ok('Tồn kho: thiếu stockQuantity → 400 (không đặt về 0)', r.status === 400 && (await stock(p1)) === s1);
  r = await S('PUT', '/api/admin/inventory', { productId: p1, stockQuantity: -3 });
  ok('Tồn kho: số âm → 400', r.status === 400);
  r = await S('PUT', '/api/admin/inventory', { productId: p1, stockQuantity: 2.5 });
  ok('Tồn kho: số thập phân → 400', r.status === 400);
  r = await S('PUT', '/api/admin/inventory', { productId: 'khong-ton-tai', stockQuantity: 5 });
  ok('Tồn kho: sản phẩm không tồn tại → 404', r.status === 404);
  r = await S('PUT', '/api/admin/inventory', { items: [{ productId: p1, stockQuantity: s1 + 1 }, { productId: 'khong-ton-tai', stockQuantity: 5 }] });
  ok('Tồn kho: batch có 1 mã sai → cả lô bị hủy (nguyên tử), mã đầu KHÔNG bị đổi', r.status === 404 && (await stock(p1)) === s1, `stock=${await stock(p1)} (gốc ${s1})`);
  r = await S('PUT', '/api/admin/inventory', { items: [{ productId: p1, stockQuantity: s1 }, { productId: p1, stockQuantity: s1 }] });
  ok('Tồn kho: mã lặp trong batch → 400', r.status === 400);
  r = await A('PUT', '/api/admin/inventory', { storeCode: 'KHONG_CO', productId: p1, stockQuantity: 1 });
  ok('Tồn kho: chi nhánh không tồn tại → 400', r.status === 400);
  r = await S('PUT', '/api/admin/inventory', { items: [{ productId: p1, stockQuantity: s1 + 1 }, { productId: p2, stockQuantity: await stock(p2) }] });
  ok('Tồn kho: batch hợp lệ → 200 và áp dụng', r.status === 200 && (await stock(p1)) === s1 + 1);
  await S('PUT', '/api/admin/inventory', { productId: p1, stockQuantity: s1 }); // hoàn lại
  ok('Tồn kho: đã hoàn lại giá trị gốc', (await stock(p1)) === s1);

  // ───── 3. Cửa hàng ─────
  const before = (await db.query(`SELECT * FROM stores WHERE code='adminCH1'`)).rows[0];
  r = await A('PUT', '/api/admin/stores', { code: 'adminCH1', phone: '0999000111' });
  const after = (await db.query(`SELECT * FROM stores WHERE code='adminCH1'`)).rows[0];
  ok('Cửa hàng: chỉ gửi phone → tên/địa chỉ/quận/phường KHÔNG bị xóa', r.status === 200 && after.name === before.name && after.address === before.address && after.district === before.district && after.ward === before.ward, `${after.name}|${after.address}`);
  ok('Cửa hàng: không bật lại cửa hàng đang tắt khi sửa thông tin', after.is_active === before.is_active, `is_active ${before.is_active} → ${after.is_active}`);
  r = await A('PUT', '/api/admin/stores', { code: 'adminCH1', map_url: 'javascript:alert(1)' });
  ok('Cửa hàng: map_url javascript: → 400', r.status === 400);
  r = await A('PUT', '/api/admin/stores', { code: 'adminCH1', latitude: 200 });
  ok('Cửa hàng: vĩ độ ngoài khoảng → 400', r.status === 400);
  r = await S('PUT', '/api/admin/stores', { status: 0, name: before.name });
  const staffStore = (await db.query(`SELECT is_active, status FROM stores WHERE code='D1'`)).rows[0];
  ok('Cửa hàng: nhân viên KHÔNG tự tắt được chi nhánh của mình', staffStore?.is_active !== false, JSON.stringify(staffStore));
  await db.query(`UPDATE stores SET phone=$1, name=$2, address=$3, district=$4, ward=$5, map_url=$6, is_active=$7, status=$8 WHERE code='adminCH1'`,
    [before.phone, before.name, before.address, before.district, before.ward, before.map_url, before.is_active, before.status]);

  // ───── 4. Sản phẩm ─────
  for (const bad of ['abc', -5, 0, 1e12]) {
    r = await A('POST', '/api/admin/products', { name: 'TEST Sp', price: bad });
    ok(`Sản phẩm: giá không hợp lệ (${bad}) → 400`, r.status === 400);
  }
  r = await A('POST', '/api/admin/products', { name: 'TEST Sp Variant', price: 10000, variants: [{ name: '6 chai', price: 'xx', quantity: 6, bottle_multiplier: 6 }] });
  ok('Sản phẩm: biến thể giá sai → 400 và không tạo sản phẩm', r.status === 400 && (await db.query(`SELECT 1 FROM products WHERE name='TEST Sp Variant'`)).rowCount === 0);
  r = await A('POST', '/api/admin/products', { name: 'TEST Sp Ok', price: 15000 });
  const newProdId = r.json?.data?.id;
  ok('Sản phẩm: tạo hợp lệ → 200', r.status === 200 && !!newProdId, r.json?.error || '');
  r = await A('PUT', '/api/admin/products', { id: newProdId, price: -1 });
  ok('Sản phẩm: sửa giá âm → 400', r.status === 400);
  r = await A('DELETE', `/api/admin/products?id=${newProdId}`);
  ok('Sản phẩm: xóa sản phẩm không dùng → 200', r.status === 200);
  // Sản phẩm đang là món của một combo (tham chiếu trực tiếp mã bảng products) → chặn xóa
  r = await A('POST', '/api/admin/products', { name: 'TEST Sp Trong Combo', price: 12000 });
  const usedProdId = r.json?.data?.id;
  await db.query(`INSERT INTO combos (id, slug, name, original_price, sale_price, total_items, discount, image) VALUES ('combo_test_guard','test-guard','TEST Combo Guard',20000,20000,1,0,'/images/combos/combo-1.jpg')`);
  await db.query(`INSERT INTO combo_items (id, combo_id, product_id, quantity, unit) VALUES ('combo_test_guard_i1','combo_test_guard',$1,1,'chai')`, [usedProdId]);
  r = await A('DELETE', `/api/admin/products?id=${usedProdId}`);
  ok('Sản phẩm: đang nằm trong combo → 409, KHÔNG bị xóa', r.status === 409 && r.json?.code === 'PRODUCT_IN_USE' && (await db.query(`SELECT 1 FROM products WHERE id=$1`, [usedProdId])).rowCount === 1);
  await db.query(`DELETE FROM combos WHERE id='combo_test_guard'`);
  // Combo tham chiếu sản phẩm bằng SLUG (không phải mã bảng) — giống combo cũ lưu mã danh mục tĩnh: vẫn phải chặn xóa.
  // (Dùng sản phẩm thử + slug thử để không bao giờ động tới sản phẩm thật.)
  const usedSlug = (await db.query(`SELECT slug FROM products WHERE id=$1`, [usedProdId])).rows[0].slug;
  await db.query(`INSERT INTO combos (id, slug, name, original_price, sale_price, total_items, discount, image) VALUES ('combo_test_guard2','test-guard2','TEST Combo Guard 2',20000,20000,1,0,'/images/combos/combo-1.jpg')`);
  await db.query(`INSERT INTO combo_items (id, combo_id, product_id, quantity, unit) VALUES ('combo_test_guard2_i1','combo_test_guard2',$1,1,'chai')`, [usedSlug]);
  r = await A('DELETE', `/api/admin/products?id=${usedProdId}`);
  ok('Sản phẩm: combo tham chiếu bằng slug/mã quy đổi vẫn chặn xóa → 409', r.status === 409 && r.json?.code === 'PRODUCT_IN_USE' && (await db.query(`SELECT 1 FROM products WHERE id=$1`, [usedProdId])).rowCount === 1);
  await db.query(`DELETE FROM combos WHERE id='combo_test_guard2'`);
  // Sản phẩm có đơn chưa hoàn tất → chặn xóa
  await mkOrder('TEST_PO_ORD', { status: 'PENDING' });
  await db.query(`INSERT INTO order_items (id, order_id, product_id, canonical_product_id, name, price, quantity) VALUES ('TEST_PO_ORD_i1','TEST_PO_ORD',$1,$1,'TEST item',12000,1)`, [usedProdId]);
  r = await A('DELETE', `/api/admin/products?id=${usedProdId}`);
  ok('Sản phẩm: còn đơn chưa hoàn tất → 409, KHÔNG bị xóa', r.status === 409 && (await db.query(`SELECT 1 FROM products WHERE id=$1`, [usedProdId])).rowCount === 1);
  await db.query(`DELETE FROM orders WHERE id='TEST_PO_ORD'`);
  r = await A('DELETE', `/api/admin/products?id=${usedProdId}`);
  ok('Sản phẩm: hết ràng buộc → xóa được', r.status === 200);

  // ───── 5. Combo ─────
  r = await A('POST', '/api/admin/combos', { name: 'TEST Combo', sale_price: 100, original_price: 50 });
  ok('Combo: giá gốc < giá bán → 400', r.status === 400);
  r = await A('POST', '/api/admin/combos', { name: 'TEST Combo', sale_price: 100000, items: [{ product_id: 'khong-ton-tai', quantity: 1 }] });
  ok('Combo: món có sản phẩm không tồn tại → 400, không tạo combo dở', r.status === 400 && (await db.query(`SELECT 1 FROM combos WHERE name='TEST Combo'`)).rowCount === 0);
  r = await A('POST', '/api/admin/combos', { name: 'TEST Combo', sale_price: 100000, items: [{ product_id: p1, quantity: 1 }, { product_id: p1, quantity: 2 }] });
  ok('Combo: món lặp → 400', r.status === 400);
  r = await A('POST', '/api/admin/combos', { name: 'TEST Combo', sale_price: 150000, original_price: 200000, discount: 99, items: [{ product_id: p1, quantity: 2 }] });
  const comboId = r.json?.data?.id;
  const combo = (await db.query(`SELECT discount, slug FROM combos WHERE id=$1`, [comboId])).rows[0];
  ok('Combo: tạo hợp lệ; % giảm do máy chủ tính (25, bỏ qua 99 client gửi)', r.status === 200 && combo?.discount === 25, `discount=${combo?.discount}`);
  r = await A('POST', '/api/admin/combos', { name: 'TEST Combo', sale_price: 150000, original_price: 200000, items: [{ product_id: p1, quantity: 1 }] });
  const combo2 = (await db.query(`SELECT slug FROM combos WHERE id=$1`, [r.json?.data?.id])).rows[0];
  ok('Combo: trùng tên → slug khác nhau (không lỗi 500)', r.status === 200 && combo2?.slug && combo2.slug !== combo?.slug, `${combo?.slug} / ${combo2?.slug}`);
  // Combo hiện hữu trong CSDL lưu mã danh mục tĩnh (vd. "sua-bap-nep"): tạo/sửa bằng mã đó phải còn hoạt động
  r = await A('POST', '/api/admin/combos', { name: 'TEST Combo Alias', sale_price: 90000, original_price: 100000, items: [{ product_id: 'sua-bap-nep', quantity: 3 }, { product_id: 'tra-sua-go', quantity: 2 }] });
  ok('Combo: món dùng mã danh mục tĩnh (sua-bap-nep) vẫn được chấp nhận', r.status === 200, r.json?.error || '');
  r = await A('POST', '/api/admin/combos', { name: 'TEST Combo Alias 2', sale_price: 90000, items: [{ product_id: 'sua-bap-nep', quantity: 1 }, { product_id: 'prod-sb-01', quantity: 1 }] });
  ok('Combo: hai mã khác nhau của CÙNG sản phẩm bị coi là lặp → 400', r.status === 400, r.json?.error || '');
  r = await A('PUT', '/api/admin/combos', { id: comboId, sale_price: 999999999 });
  ok('Combo: sửa giá bán quá lớn → 400', r.status === 400);
  r = await A('PUT', '/api/admin/combos', { id: comboId, items: [{ product_id: 'khong-ton-tai', quantity: 1 }] });
  const itemsLeft = (await db.query(`SELECT COUNT(*)::int n FROM combo_items WHERE combo_id=$1`, [comboId])).rows[0].n;
  ok('Combo: sửa món sai → 400 và combo VẪN còn món cũ (không bị xóa trắng)', r.status === 400 && itemsLeft === 1, `items=${itemsLeft}`);

  // ───── 6. Danh mục ─────
  const usedCat = (await db.query(`SELECT category_id FROM products WHERE category_id IS NOT NULL LIMIT 1`)).rows[0]?.category_id;
  r = await A('DELETE', `/api/admin/categories?id=${usedCat}`);
  ok('Danh mục: còn sản phẩm → 409, không bị xóa', r.status === 409 && r.json?.code === 'CATEGORY_IN_USE' && (await db.query(`SELECT 1 FROM categories WHERE id=$1`, [usedCat])).rowCount === 1);
  r = await A('DELETE', '/api/admin/categories?id=khong-ton-tai');
  ok('Danh mục: xóa id không tồn tại → 404 (không báo thành công giả)', r.status === 404);
  r = await A('POST', '/api/admin/categories', { name: 'TEST Danh Muc', slug: 'test-danh-muc-x' });
  const catId = r.json?.data?.id;
  r = await A('POST', '/api/admin/categories', { name: 'TEST Danh Muc 2', slug: 'test-danh-muc-x' });
  ok('Danh mục: trùng slug → 409 (không lỗi 500)', r.status === 409 && r.json?.code === 'SLUG_TAKEN');
  r = await A('PUT', '/api/admin/categories', { id: 'khong-ton-tai', name: 'TEST X' });
  ok('Danh mục: sửa id không tồn tại → 404', r.status === 404);
  r = await A('DELETE', `/api/admin/categories?id=${catId}`);
  ok('Danh mục: xóa danh mục rỗng → 200', r.status === 200);

  // ───── 7. Banner & upload ─────
  r = await A('POST', '/api/admin/banners', { title: 'TEST Banner', image: '/images/banners/banner-1600x900.png', link: 'javascript:alert(1)' });
  ok('Banner: link javascript: → 400', r.status === 400);
  r = await A('POST', '/api/admin/banners', { title: 'TEST Banner', image: '/uploads/../../.env' });
  ok('Banner: ảnh có ../ → 400', r.status === 400);
  r = await A('POST', '/api/admin/banners', { title: 'TEST Banner', image: '/images/banners/banner-1600x900.png', link: '/#san-pham', placement: 'hero' });
  const banId = r.json?.data?.id;
  ok('Banner: tạo hợp lệ → 200', r.status === 200 && !!banId, r.json?.error || '');
  r = await A('PUT', '/api/admin/banners', { id: banId, image: '/uploads/../../.env' });
  ok('Banner: sửa ảnh thành đường dẫn thoát ra ngoài → 400', r.status === 400);
  r = await A('PUT', '/api/admin/banners', { id: banId, sort_order: 'abc' });
  ok('Banner: sort_order không phải số → 400 (không lỗi 500)', r.status === 400);
  // Mô phỏng dữ liệu cũ đã bị cài đường dẫn độc hại → xóa banner không được xóa file ngoài uploads
  await db.query(`UPDATE banners SET image='/uploads/../../package.json' WHERE id=$1`, [banId]);
  r = await A('DELETE', `/api/admin/banners?id=${banId}`);
  const fs = await import('node:fs');
  ok('Banner: xóa banner có ảnh dạng ../ KHÔNG xóa file ngoài thư mục uploads', r.status === 200 && fs.existsSync('package.json'));

  // ───── 8. Đánh giá ─────
  r = await A('PUT', '/api/admin/reviews/khong-co', { status: 'HACKED' });
  ok('Đánh giá: trạng thái lạ → 400', r.status === 400);
  r = await A('PUT', '/api/admin/reviews/khong-co', { adminReply: 'x'.repeat(2500) });
  ok('Đánh giá: phản hồi quá dài → 400', r.status === 400);
  r = await A('PUT', '/api/admin/reviews/khong-co', {});
  ok('Đánh giá: không có thay đổi → 400', r.status === 400);

  // ───── 9. Thành viên: khóa phải có hiệu lực ─────
  const memId = 'test_tmp_member';
  await db.query(`INSERT INTO users (id, email, password_hash, full_name, is_active) VALUES ($1,'test_tmp_member@test.vn',$2,'Test Member',true)`, [memId, await bcrypt.hash('Matkhau123', 10)]);
  const UT = await mintUser(memId);
  let me = await call('tsf_user_session', UT, 'GET', '/api/auth/me');
  ok('Thành viên: trước khi khóa, phiên hợp lệ', me.json?.user?.id === memId, JSON.stringify(me.json)?.slice(0, 80));
  r = await A('PUT', '/api/admin/members', { id: memId, isActive: false });
  ok('Admin khóa thành viên → 200', r.status === 200, r.json?.error || '');
  me = await call('tsf_user_session', UT, 'GET', '/api/auth/me');
  ok('Thành viên bị khóa: phiên cũ mất hiệu lực NGAY (/api/auth/me → user null)', me.json?.user === null);
  const loginBad = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ email: 'test_tmp_member@test.vn', password: 'SaiMatKhau1' }) });
  ok('Thành viên bị khóa + sai mật khẩu → 401 (không lộ trạng thái khóa)', loginBad.status === 401);
  const loginGood = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ email: 'test_tmp_member@test.vn', password: 'Matkhau123' }) });
  const loginGoodJson = await loginGood.json().catch(() => ({}));
  ok('Thành viên bị khóa + đúng mật khẩu → 403 ACCOUNT_LOCKED', loginGood.status === 403 && loginGoodJson.code === 'ACCOUNT_LOCKED', `status=${loginGood.status}`);
  r = await A('PUT', '/api/admin/members', { id: memId, isActive: true });
  me = await call('tsf_user_session', UT, 'GET', '/api/auth/me');
  ok('Mở khóa → phiên dùng lại được', r.status === 200 && me.json?.user?.id === memId);
  r = await A('DELETE', '/api/admin/members?id=khong-ton-tai');
  ok('Xóa thành viên không tồn tại → 404', r.status === 404);
  r = await A('DELETE', `/api/admin/members?id=${memId}`);
  ok('Xóa thành viên → 200', r.status === 200);

  // ───── 9b. Thống kê, báo cáo, nhật ký ─────
  r = await A('GET', '/api/admin/audit?limit=abc&page=xyz');
  ok('Nhật ký: limit/page không phải số → dùng mặc định (200, không lỗi 500)', r.status === 200 && r.json?.pagination?.limit === 50 && r.json?.pagination?.page === 1, `status=${r.status}`);
  r = await A('GET', '/api/admin/audit?search=%25&limit=5');
  const allLogs = (await A('GET', '/api/admin/audit?limit=1')).json?.pagination?.total;
  ok('Nhật ký: tìm "%" không khớp tất cả', r.status === 200 && r.json.pagination.total < allLogs, `${r.json?.pagination?.total} < ${allLogs}`);
  r = await A('GET', '/api/admin/reports/profit?startDate=khong-phai-ngay');
  ok('Báo cáo lợi nhuận: ngày sai định dạng → 400 (không lỗi 500)', r.status === 400);
  r = await A('GET', '/api/admin/reports/profit?status=HACKED');
  ok('Báo cáo lợi nhuận: trạng thái lạ → 400', r.status === 400);
  r = await A('GET', '/api/admin/reports/profit?groupBy=month');
  const sm = r.json?.summary || {};
  const rowsOk = (r.json?.breakdown || []).every((row) => {
    const costed = Number(row.revenue) - Number(row.revenue_without_cost || 0);
    const expected = costed > 0 ? Math.round((Number(row.profit) / costed) * 1000) / 10 : 0;
    return row.margin === expected;
  });
  ok('Báo cáo lợi nhuận: biên lợi nhuận từng dòng tính trên doanh thu CÓ giá vốn', r.status === 200 && (r.json?.breakdown || []).length > 0 && rowsOk);
  const costedRev = Number(sm.totalRevenue) - Number(sm.revenueWithoutCost);
  ok('Báo cáo lợi nhuận: giá vốn 0đ (chưa nhập) không bị tính là lãi 100%', Number(sm.grossProfit) === costedRev - Number(sm.totalCost) && (Number(sm.itemsWithCost) > 0 ? true : Number(sm.grossProfit) === 0), `profit=${sm.grossProfit} costedRevenue=${costedRev} cost=${sm.totalCost}`);
  const stfStats = await S('GET', '/api/admin/stats');
  ok('Thống kê: nhân viên chi nhánh không thấy tổng số khách hàng toàn công ty', stfStats.status === 200 && Object.keys(stfStats.json?.members || {}).length === 0, JSON.stringify(stfStats.json?.members));
  const supStats = await A('GET', '/api/admin/stats');
  ok('Thống kê: super admin vẫn thấy số khách hàng', supStats.status === 200 && Number(supStats.json?.members?.total_members) >= 0 && 'total_members' in (supStats.json?.members || {}));
  const top = supStats.json?.topProducts || [];
  const topCheck = (await db.query(`SELECT p.id, COALESCE(SUM(oi.quantity),0)::int AS sold FROM products p JOIN order_items oi ON COALESCE(oi.canonical_product_id, oi.product_id) = p.id JOIN orders o ON o.id = oi.order_id AND o.status = 'COMPLETED' GROUP BY p.id ORDER BY sold DESC, MAX(p.price) DESC LIMIT 1`)).rows[0];
  ok('Thống kê: "Sản phẩm bán chạy" tính cả đơn dùng mã quy đổi (khớp truy vấn đối chiếu)', top.length > 0 && top[0].id === topCheck?.id, `${top[0]?.id} vs ${topCheck?.id}`);

  // ───── 10. Chi trả hoa hồng & đối tác ─────
  await db.query(`INSERT INTO users (id, email, password_hash, full_name) VALUES ('test_tmp_pu','test_tmp_pu@test.vn','x','Partner Test')`);
  await db.query(`INSERT INTO partner_profiles (id, user_id, partner_code, phone, full_name, lifecycle_status, current_balance) VALUES ('TEST_PP','test_tmp_pu','TESTPP01','0900000001','Partner Test','ACTIVE',0)`);
  await db.query(`INSERT INTO payout_requests (id, partner_id, amount, bank_name, bank_account_number, bank_account_name) VALUES ('TEST_PO1','TEST_PP',100000,'VCB','123','TEST')`);
  r = await A('PUT', '/api/admin/payouts/TEST_PO1', { action: 'MARK_AS_PAID', bankReference: 'FT1' });
  ok('Chi trả: trả tiền khi chưa duyệt → 409', r.status === 409 && r.json?.code === 'INVALID_PAYOUT_STATE');
  r = await A('PUT', '/api/admin/payouts/TEST_PO1', { action: 'APPROVE' });
  ok('Chi trả: duyệt → 200', r.status === 200);
  r = await A('PUT', '/api/admin/payouts/TEST_PO1', { action: 'APPROVE' });
  ok('Chi trả: duyệt lần 2 → 409', r.status === 409);
  const [rej1, rej2] = await Promise.all([
    A('PUT', '/api/admin/payouts/TEST_PO1', { action: 'REJECT', reason: 'Test' }),
    A('PUT', '/api/admin/payouts/TEST_PO1', { action: 'REJECT', reason: 'Test' }),
  ]);
  const bal = Number((await db.query(`SELECT current_balance FROM partner_profiles WHERE id='TEST_PP'`)).rows[0].current_balance);
  ok('Chi trả: hai lệnh TỪ CHỐI đồng thời → đúng 1 lệnh thành công', [rej1.status, rej2.status].sort().join() === '200,409', `${rej1.status},${rej2.status}`);
  ok('Chi trả: số dư đối tác chỉ được hoàn ĐÚNG 1 LẦN (100.000)', bal === 100000, `balance=${bal}`);
  r = await A('PUT', '/api/admin/partners/TEST_PP', { action: 'ACTIVATE' });
  ok('Đối tác ACTIVE: "kích hoạt lại" → 409', r.status === 409 && r.json?.code === 'INVALID_PARTNER_STATE');
  r = await A('PUT', '/api/admin/partners/TEST_PP', { action: 'SUSPEND', reason: 'Test' });
  ok('Đối tác ACTIVE → tạm khóa → 200', r.status === 200);
  r = await A('PUT', '/api/admin/partners/TEST_PP', { action: 'UPGRADE_DEALER' });
  ok('Đối tác đang bị khóa KHÔNG nâng cấp đại lý được → 409', r.status === 409);
  r = await A('PUT', '/api/admin/partners/TEST_PP', { action: 'ACTIVATE' });
  ok('Đối tác SUSPENDED → kích hoạt lại → 200', r.status === 200);
  r = await A('PUT', '/api/admin/partners/TEST_PP', { action: 'UPGRADE_DEALER', tierId: 'khong-co-hang' });
  ok('Nâng cấp đại lý: hạng không tồn tại → 400', r.status === 400);
  await db.query(`UPDATE partner_profiles SET lifecycle_status='REJECTED' WHERE id='TEST_PP'`);
  r = await A('PUT', '/api/admin/partners/TEST_PP', { action: 'ACTIVATE' });
  ok('Đối tác bị REJECTED không thể "kích hoạt lại" qua đường tắt → 409', r.status === 409);
} finally {
  await cleanup();
  await db.end();
}
console.log(`\n${fail ? fail + ' THẤT BẠI' : 'Tất cả đạt'} (${pass} đạt / ${fail} lỗi)`);
process.exit(fail ? 1 : 0);
