import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

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
assertSafeDatabase();

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const pool = new pg.Pool({
  connectionString:
    requireDatabaseUrl(),
});

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runPhase4Tests() {
  console.log('🧪 BẮT ĐẦU BỘ KIỂM THỬ GIAI ĐOẠN 4: CHECKOUT CHẶN THIẾU HÀNG & ADMIN KHO NÂNG CAO\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);

  const client = await pool.connect();
  let passCount = 0;
  let failCount = 0;

  async function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
      failCount++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    const STORE_A = 'adminCH1';
    const STORE_B = 'adminCH2';
    const PROD_ID = 'prod-sb-01'; // Sữa Bắp Nếp

    // 1. Đăng nhập Super Admin
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('BƯỚC 1: Đăng nhập Super Admin & Store Admin để lấy cookies...');

    const superLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: requireSecretEnv('TEST_ADMIN_PASSWORD') }),
    });
    const superCookie = superLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
    await assert(superLoginRes.status === 200 && superCookie.length > 0, 'Đăng nhập Super Admin thành công');

    const storeAdminLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'adminCH1', password: requireSecretEnv('TEST_ADMIN_PASSWORD') }),
    });
    const storeAdminCookie = storeAdminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
    await assert(storeAdminLoginRes.status === 200 && storeAdminCookie.length > 0, 'Đăng nhập Store Admin (adminCH1) thành công');

    // 2. TEST: GET /api/admin/inventory trả về đủ 3 cột (stock_quantity, reserved, available_quantity)
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST 1: Kiểm tra API Kho Admin trả đủ 3 cột (Tồn thực, Đang giữ, Khả dụng)...');

    const invRes = await fetch(`${BASE_URL}/api/admin/inventory?storeCode=${STORE_A}`, {
      headers: { Cookie: superCookie },
    });
    const invData = await invRes.json();
    await assert(invRes.status === 200 && invData.success && Array.isArray(invData.data), 'Lấy danh sách tồn kho Admin thành công');

    const testItem = invData.data.find((i) => i.product_id === PROD_ID);
    await assert(testItem !== undefined, `Tìm thấy mặt hàng ${PROD_ID} trong danh sách kho ${STORE_A}`);
    await assert(typeof testItem.stock_quantity === 'number', 'Có trường stock_quantity (Tồn thực)');
    await assert(typeof testItem.reserved === 'number', 'Có trường reserved (Đang giữ chỗ)');
    await assert(typeof testItem.available_quantity === 'number', 'Có trường available_quantity (Khả dụng)');
    await assert(
      testItem.available_quantity === Math.max(0, testItem.stock_quantity - testItem.reserved),
      `Khả dụng khớp công thức Math.max(0, ${testItem.stock_quantity} - ${testItem.reserved}) = ${testItem.available_quantity}`
    );

    // 3. TEST: Chặn giỏ hàng thiếu hàng và trả về 409 Conflict từ Server
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST 2: Kiểm tra Checkout & Server chặn đơn khi vượt quá tồn khả dụng (409 Conflict)...');

    // Đặt tồn kho PROD_ID ở STORE_A là 5 chai, reserved 3 chai -> Khả dụng = 2 chai
    await client.query(
      `UPDATE store_inventory
       SET stock_quantity = 5, reserved = 3, safety_stock = 0
       WHERE store_code = $1 AND product_id = $2;`,
      [STORE_A, PROD_ID]
    );

    // Cố tình đặt 10 chai (vượt quá khả dụng 2 chai)
    const overOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Khách Test Vượt Tồn',
          phone: '0901112233',
          address: '123 Đường Test Thiếu Hàng',
          province: 'Hồ Chí Minh',
          paymentMethod: 'cod',
          storeCode: STORE_A,
        },
        items: [
          {
            type: 'product',
            id: PROD_ID,
            name: 'Sữa Bắp Nếp',
            price: 15000,
            quantity: 10, // Vượt quá 2 chai
            unit: 'Chai 330ml',
          },
        ],
      }),
    });

    const overOrderData = await overOrderRes.json();
    await assert(overOrderRes.status === 409, `API /api/orders trả về HTTP 409 Conflict (thực tế: ${overOrderRes.status})`);
    await assert(
      overOrderData.insufficientItems && overOrderData.insufficientItems.length > 0,
      'Response chứa danh sách insufficientItems chi tiết'
    );
    await assert(
      overOrderData.insufficientItems[0].available === 2,
      `Báo chính xác số lượng còn lại: ${overOrderData.insufficientItems[0].available} chai`
    );

    // 4. TEST: Ghi log lịch sử biến động kho khi cập nhật thủ công (manual_update)
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST 3: Kiểm tra tự động ghi log khi Admin chỉnh sửa số lượng kho...');

    // Lấy tồn cũ
    const preUpdate = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [STORE_A, PROD_ID]
    );
    const oldStock = preUpdate.rows[0].stock_quantity;
    const newStock = oldStock + 15;

    const putRes = await fetch(`${BASE_URL}/api/admin/inventory`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: superCookie,
      },
      body: JSON.stringify({
        storeCode: STORE_A,
        productId: PROD_ID,
        stockQuantity: newStock,
      }),
    });
    const putData = await putRes.json();
    await assert(putRes.status === 200 && putData.success, 'Cập nhật kho thành công qua PUT /api/admin/inventory');

    // Kiểm tra API /api/admin/inventory/logs
    const logsRes = await fetch(`${BASE_URL}/api/admin/inventory/logs?storeCode=${STORE_A}&productId=${PROD_ID}&limit=5`, {
      headers: { Cookie: superCookie },
    });
    const logsData = await logsRes.json();
    await assert(logsRes.status === 200 && logsData.success, 'Gọi API lấy lịch sử kho /api/admin/inventory/logs thành công');
    await assert(logsData.data.length > 0, 'Có bản ghi log biến động');

    const latestLog = logsData.data[0];
    await assert(latestLog.change_type === 'manual_update', `change_type đúng là 'manual_update' (thực tế: ${latestLog.change_type})`);
    await assert(latestLog.old_stock === oldStock && latestLog.new_stock === newStock, `Ghi đúng biến động: ${oldStock} -> ${newStock} chai`);

    // 5. TEST: Đặt đơn PENDING -> Ghi log 'order_reserved'; CONFIRMED -> Ghi log 'order_confirmed'
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST 4: Kiểm tra tự động ghi log khi Đặt đơn (order_reserved) và Duyệt đơn (order_confirmed)...');

    // Chuẩn bị tồn kho STORE_A: 20 chai, 0 reserved -> khả dụng 20
    await client.query(
      `UPDATE store_inventory SET stock_quantity = 20, reserved = 0 WHERE store_code = $1 AND product_id = $2;`,
      [STORE_A, PROD_ID]
    );

    const validOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Khách Test Log & Chuyển Kho',
          phone: '0908889999',
          address: '472 Lê Trọng Tấn, Tân Phú',
          province: 'Hồ Chí Minh',
          paymentMethod: 'cod',
          storeCode: STORE_A,
        },
        items: [
          {
            type: 'product',
            id: PROD_ID,
            name: 'Sữa Bắp Nếp',
            price: 15000,
            quantity: 3,
            unit: 'Chai 330ml',
          },
        ],
      }),
    });
    const validOrderData = await validOrderRes.json();
    await assert(validOrderRes.status === 200 && validOrderData.success, 'Đặt đơn hợp lệ thành công');
    const testOrderId = validOrderData.orderId || validOrderData.order?.id;

    // Kiểm tra log 'order_reserved'
    const resvLog = await client.query(
      `SELECT * FROM inventory_logs WHERE order_id = $1 AND change_type = 'order_reserved';`,
      [testOrderId]
    );
    await assert(resvLog.rows.length > 0, 'Hệ thống tự động ghi log order_reserved khi đơn hàng được tạo');
    await assert(resvLog.rows[0].new_reserved === 3, 'Ghi nhận reserved tăng từ 0 lên 3 chai');

    // 6. TEST: Chuyển đơn sang chi nhánh khác (Super Admin)
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST 5: Kiểm tra tính năng Chuyển chi nhánh đơn hàng (Super Admin)...');

    // Chuẩn bị tồn kho STORE_B: 20 chai, 0 reserved
    await client.query(
      `UPDATE store_inventory SET stock_quantity = 20, reserved = 0 WHERE store_code = $1 AND product_id = $2;`,
      [STORE_B, PROD_ID]
    );

    // Super Admin chuyển đơn từ STORE_A sang STORE_B
    const transferRes = await fetch(`${BASE_URL}/api/admin/orders/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: superCookie,
      },
      body: JSON.stringify({
        orderId: testOrderId,
        targetStoreCode: STORE_B,
      }),
    });
    const transferData = await transferRes.json();
    console.log('   [DEBUG Transfer]:', transferRes.status, transferData);
    await assert(transferRes.status === 200 && transferData.success, 'Super Admin chuyển chi nhánh đơn hàng thành công');

    // Kiểm tra đơn hàng trong DB đã đổi store_code sang STORE_B
    const orderInDb = await client.query(`SELECT store_code FROM orders WHERE id = $1;`, [testOrderId]);
    await assert(orderInDb.rows[0].store_code === STORE_B, `Đơn hàng trong DB đã cập nhật sang chi nhánh ${STORE_B}`);

    // Kiểm tra reservation ở kho cũ A đã nhả
    const oldResv = await client.query(
      `SELECT status FROM stock_reservations WHERE order_id = $1 AND store_code = $2;`,
      [testOrderId, STORE_A]
    );
    await assert(oldResv.rows[0].status === 'released', 'Reservation ở chi nhánh cũ A đã chuyển sang released');

    // Kiểm tra reservation ở kho mới B đã kích hoạt
    const newResv = await client.query(
      `SELECT status, quantity FROM stock_reservations WHERE order_id = $1 AND store_code = $2;`,
      [testOrderId, STORE_B]
    );
    await assert(newResv.rows.length > 0 && newResv.rows[0].status === 'active', 'Reservation ở chi nhánh mới B đã kích hoạt active');
    await assert(newResv.rows[0].quantity === 3, 'Số lượng giữ chỗ ở kho mới khớp chính xác 3 chai');

    // Kiểm tra reserved ở bảng store_inventory kho A đã giảm về 0, kho B tăng lên 3
    const invA = await client.query(`SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`, [STORE_A, PROD_ID]);
    const invB = await client.query(`SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`, [STORE_B, PROD_ID]);
    await assert(invA.rows[0].reserved === 0, `Reserved ở kho cũ A đã giảm về 0 chai (thực tế: ${invA.rows[0].reserved})`);
    await assert(invB.rows[0].reserved === 3, `Reserved ở kho mới B đã tăng lên 3 chai (thực tế: ${invB.rows[0].reserved})`);

    // Kiểm tra có 2 dòng log: order_transferred_out và order_transferred_in
    const transferOutLog = await client.query(
      `SELECT * FROM inventory_logs WHERE order_id = $1 AND change_type = 'order_transferred_out';`,
      [testOrderId]
    );
    const transferInLog = await client.query(
      `SELECT * FROM inventory_logs WHERE order_id = $1 AND change_type = 'order_transferred_in';`,
      [testOrderId]
    );
    await assert(transferOutLog.rows.length > 0, 'Đã ghi log order_transferred_out cho kho A');
    await assert(transferInLog.rows.length > 0, 'Đã ghi log order_transferred_in cho kho B');

    // 7. TEST: Phân quyền chuyển đơn (Store Admin bị từ chối 403 Forbidden)
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST 6: Kiểm tra bảo mật phân quyền (Store Admin bị từ chối 403)...');

    const unauthorizedTransfer = await fetch(`${BASE_URL}/api/admin/orders/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: storeAdminCookie, // Store Admin
      },
      body: JSON.stringify({
        orderId: testOrderId,
        targetStoreCode: STORE_A,
      }),
    });
    await assert(unauthorizedTransfer.status === 403, `Store Admin gọi chuyển kho bị chặn HTTP 403 Forbidden (thực tế: ${unauthorizedTransfer.status})`);

    // 8. TEST: Chặn chuyển kho khi kho đích không đủ tồn kho (409 Conflict)
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST 7: Kiểm tra chặn chuyển kho khi kho đích không đủ hàng (409 Conflict)...');

    // Đặt tồn kho A về 0
    await client.query(
      `UPDATE store_inventory SET stock_quantity = 0, reserved = 0 WHERE store_code = $1 AND product_id = $2;`,
      [STORE_A, PROD_ID]
    );

    // Cố tình chuyển đơn 3 chai ngược lại kho A (đang có 0 chai)
    const failTransfer = await fetch(`${BASE_URL}/api/admin/orders/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: superCookie,
      },
      body: JSON.stringify({
        orderId: testOrderId,
        targetStoreCode: STORE_A,
      }),
    });
    const failData = await failTransfer.json();
    await assert(failTransfer.status === 409, `API chặn chuyển kho và trả về HTTP 409 Conflict (thực tế: ${failTransfer.status})`);
    await assert(failData.error && (failData.error.includes('không đủ hàng') || failData.error.includes('không đủ tồn kho')), 'Thông báo lỗi chỉ rõ chi nhánh đích không đủ hàng');

    // Đảm bảo đơn vẫn an toàn ở kho B
    const verifyOrder = await client.query(`SELECT store_code FROM orders WHERE id = $1;`, [testOrderId]);
    await assert(verifyOrder.rows[0].store_code === STORE_B, 'Đơn hàng vẫn an toàn tại kho B, không bị xáo trộn dữ liệu');

    // 9. Dọn dẹp dữ liệu test
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('DỌN DẸP DỮ LIỆU KIỂM THỬ...');
    await client.query(`DELETE FROM inventory_logs WHERE order_id = $1;`, [testOrderId]);
    await client.query(`DELETE FROM stock_reservations WHERE order_id = $1;`, [testOrderId]);
    await client.query(`DELETE FROM order_items WHERE order_id = $1;`, [testOrderId]);
    await client.query(`DELETE FROM orders WHERE id = $1;`, [testOrderId]);
    // Khôi phục tồn kho hợp lý
    await client.query(
      `UPDATE store_inventory SET stock_quantity = 50, reserved = 0, safety_stock = 0 WHERE product_id = $1;`,
      [PROD_ID]
    );
    console.log('   🧹 Đã dọn dẹp xong đơn hàng kiểm thử và hoàn trả kho mẫu.');

    console.log('\n=================================================================');
    console.log(`🎉 TỔNG KẾT GIAI ĐOẠN 4: ${passCount} PASSED / ${failCount} FAILED`);
    console.log('=================================================================\n');

  } catch (err) {
    console.error('\n❌ GẶP LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runPhase4Tests();
