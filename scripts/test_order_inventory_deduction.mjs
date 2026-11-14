import { Pool } from 'pg';

import { assertSafeDatabase } from './db-guard.mjs';

// F-02: mật khẩu tài khoản test / secret đọc từ biến môi trường, không viết cứng trong Git
// (đặt trong .env local, xem docs/golive/F-02-SECRET-PRODUCTION.md)
function requireSecretEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Thiếu biến môi trường ${name}. Đặt trong .env local (xem docs/golive/F-02-SECRET-PRODUCTION.md).`);
    process.exit(1);
  }
  return value;
}

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase('WebTSF');

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

async function testInventoryFlow() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: dbPasswordFromEnv(),
    database: 'WebTSF',
  });

  console.log('=== BẮT ĐẦU KIỂM THỬ TÍNH NĂNG QUẢN LÝ KHO & XÁC NHẬN ĐƠN HÀNG ===');

  const productId = 'prod-sb-01';
  const storeCode = 'adminCH1';

  // 1. Đặt tồn kho ban đầu của sua-bap-nep tại adminCH1 thành 50 chai như ví dụ của khách
  await pool.query(
    `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, updated_by)
     VALUES ($1, $2, $3, 50, 'test')
     ON CONFLICT (store_code, product_id) DO UPDATE SET stock_quantity = 50;`,
    [`inv_${storeCode}_${productId}`, storeCode, productId]
  );
  console.log('1. Đã thiết lập tồn kho mẫu: sua-bap-nep tại adminCH1 = 50 chai');

  // 2. Tạo một đơn hàng test đặt 40 chai sữa bắp tại adminCH1
  const testOrderId = `test_ord_${Date.now()}`;
  const testOrderCode = `TSF-TEST-${Date.now().toString().slice(-4)}`;

  await pool.query(
    `INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, payment_method, shipping_fee, subtotal, total, status, store_code, store_address, inventory_deducted)
     VALUES ($1, $2, 'Nguyễn Văn Test', '0901234567', 'Hồ Chí Minh', 'Tân Phú', 'Tây Thạnh', '472 Lê Trọng Tấn', 'cod', 0, 800000, 800000, 'PENDING', $3, '472 - 474 Lê Trọng Tấn, P. Tây Thạnh, Q. Tân Phú, TP. HCM', false);`,
    [testOrderId, testOrderCode, storeCode]
  );

  await pool.query(
    `INSERT INTO order_items (id, order_id, product_id, name, price, quantity, unit)
     VALUES ($1, $2, $3, 'Sữa Bắp Nếp Thái Sơn', 20000, 40, 'chai');`,
    [`test_item_${Date.now()}`, testOrderId, productId]
  );
  console.log(`2. Đã tạo đơn hàng test ${testOrderCode} đặt 40 chai sữa bắp tại ${storeCode}`);

  // 3. Giả lập gọi API PUT /api/admin/orders xác nhận đơn hàng (status = CONFIRMED)
  // Thực thi logic trừ kho giống trong route
  const currentInvRes = await pool.query(
    `SELECT stock_quantity FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
    [storeCode, productId]
  );
  const beforeStock = currentInvRes.rows[0]?.stock_quantity;
  console.log(`3. Tồn kho trước khi xác nhận: ${beforeStock} chai`);

  // Đăng nhập tài khoản adminCH1 để lấy cookie xác thực
  const loginRes = await fetch('http://localhost:3000/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'adminCH1', password: requireSecretEnv('TEST_ADMIN_PASSWORD') }),
  });
  const cookie = loginRes.headers.get('set-cookie') || '';
  console.log('Đã đăng nhập adminCH1, cookie:', cookie ? 'OK' : 'None');

  // Thực hiện update trừ kho theo đúng logic route:
  const fetchResponse = await fetch('http://localhost:3000/api/admin/orders', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ id: testOrderId, status: 'CONFIRMED' }),
  });
  const putResult = await fetchResponse.json();
  console.log('4. Kết quả phản hồi từ API xác nhận đơn hàng:', putResult);

  // 4. Kiểm tra tồn kho sau khi xác nhận
  const afterInvRes = await pool.query(
    `SELECT stock_quantity FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
    [storeCode, productId]
  );
  const afterStock = afterInvRes.rows[0]?.stock_quantity;
  console.log(`5. Tồn kho sau khi xác nhận đơn: ${afterStock} chai`);

  if (afterStock === 10) {
    console.log('✅ CHÍNH XÁC: 50 chai - 40 chai = 10 chai còn tồn kho!');
  } else {
    console.log(`⚠️ Số lượng tồn: ${afterStock}`);
  }

  // Dọn dẹp đơn hàng test
  await pool.query(`DELETE FROM order_items WHERE order_id = $1;`, [testOrderId]);
  await pool.query(`DELETE FROM orders WHERE id = $1;`, [testOrderId]);
  // Khôi phục lại kho 100 chai
  await pool.query(
    `UPDATE store_inventory SET stock_quantity = 100 WHERE store_code = $1 AND product_id = $2;`,
    [storeCode, productId]
  );
  console.log('6. Đã dọn dẹp đơn hàng test và khôi phục tồn kho chuẩn.');

  await pool.end();
}

testInventoryFlow().catch(console.error);
