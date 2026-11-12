import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from './db-guard.mjs';

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

async function runAllTests() {
  console.log('🧪 BẮT ĐẦU BỘ KIỂM THỬ GIAI ĐOẠN 1: NỀN TẢNG DỮ LIỆU & CHỐNG BÁN LỐ\n');
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
    const TEST_STORE = 'adminCH2';

    // Đăng nhập tài khoản admin để lấy cookie cho các API quản trị
    const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'adminCH1', password: 'Admin@123' }),
    });
    const adminCookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
    await assert(loginRes.status === 200 && adminCookie.length > 0, 'Đăng nhập admin thành công, đã lấy session cookie');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST (a): 2 request đồng thời mua chai cuối cùng, chỉ 1 thành công
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST (a): 2 request đồng thời mua chai cuối cùng (Chống bán lố)...');

    const testProdA = 'prod-sb-01'; // Sữa Bắp Nếp
    // Chuẩn bị tồn kho: 10 tồn thật, 9 đang giữ -> Khả dụng = 1 chai duy nhất!
    await client.query(
      `UPDATE store_inventory
       SET stock_quantity = 10, reserved = 9, safety_stock = 0
       WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdA]
    );

    const payloadA1 = {
      fullName: 'Khách Test A1',
      phone: '0901111111',
      storeCode: TEST_STORE,
      items: [{ productId: 'sua-bap-nep', name: 'Sữa Bắp Nếp', quantity: 1, price: 18000 }],
    };
    const payloadA2 = {
      fullName: 'Khách Test A2',
      phone: '0902222222',
      storeCode: TEST_STORE,
      items: [{ productId: 'sua-bap-nep', name: 'Sữa Bắp Nếp', quantity: 1, price: 18000 }],
    };

    // Bắn 2 request đồng thời cùng 1 tích tắc
    const [resA1, resA2] = await Promise.all([
      fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadA1),
      }),
      fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadA2),
      }),
    ]);

    const statusA1 = resA1.status;
    const statusA2 = resA2.status;
    const dataA1 = await resA1.json();
    const dataA2 = await resA2.json();

    console.log(`   Kết quả: Req 1 status = ${statusA1}, Req 2 status = ${statusA2}`);

    const hasOne200 = (statusA1 === 200 && statusA2 === 409) || (statusA1 === 409 && statusA2 === 200);
    await assert(hasOne200, 'Đúng 1 request trả về HTTP 200 Thành công và 1 request trả về HTTP 409 Conflict!');

    const conflictData = statusA1 === 409 ? dataA1 : dataA2;
    await assert(
      conflictData.insufficientItems && conflictData.insufficientItems.length > 0,
      'Request bị chặn 409 trả về danh sách insufficientItems chi tiết.'
    );

    // Kiểm tra DB sau test (a): reserved phải là 10, không bao giờ vượt quá stock_quantity 10
    const invCheckA = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdA]
    );
    const { stock_quantity: sqA, reserved: resA } = invCheckA.rows[0];
    await assert(
      sqA === 10 && resA === 10,
      `Tồn kho DB chính xác: stock_quantity = ${sqA}, reserved = ${resA} (không bị bán lố âm).`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST (b): Hủy đơn nhả reserved đúng
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST (b): Hủy đơn nhả reserved đúng...');

    const testProdB = 'prod-td-01'; // Táo Đỏ Hạt Chia
    await client.query(
      `UPDATE store_inventory
       SET stock_quantity = 50, reserved = 10, safety_stock = 0
       WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdB]
    );

    // Đặt đơn 2 chai
    const orderResB = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Khách Test B',
        phone: '0903333333',
        storeCode: TEST_STORE,
        items: [{ productId: 'tao-do-hat-chia', name: 'Táo Đỏ Hạt Chia', quantity: 2, price: 18000 }],
      }),
    });
    const orderDataB = await orderResB.json();
    await assert(orderResB.status === 200, 'Đặt đơn hàng mới thành công');

    // Kiểm tra reserved đã tăng lên 12
    const invBAfterOrder = await client.query(
      `SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdB]
    );
    await assert(invBAfterOrder.rows[0].reserved === 12, 'Reserved tăng từ 10 lên 12 sau khi đặt hàng');

    // Hủy đơn qua Admin API
    const cancelResB = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ id: orderDataB.orderId, status: 'CANCELLED', note: 'Test hủy đơn' }),
    });
    const cancelDataB = await cancelResB.json();
    await assert(cancelResB.status === 200, 'Admin đổi trạng thái CANCELLED thành công');

    // Kiểm tra reserved đã nhả về lại 10
    const invBAfterCancel = await client.query(
      `SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdB]
    );
    await assert(invBAfterCancel.rows[0].reserved === 10, 'Reserved được nhả chính xác về lại 10');

    // Kiểm tra trạng thái reservation
    const resStatusB = await client.query(
      `SELECT status FROM stock_reservations WHERE order_id = $1;`,
      [orderDataB.orderId]
    );
    await assert(
      resStatusB.rows.every((r) => r.status === 'released'),
      'Toàn bộ reservation của đơn chuyển sang status = released'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST (c): Confirm 2 lần không trừ 2 lần (Idempotency)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST (c): Confirm 2 lần không trừ 2 lần (Idempotency)...');

    const testProdC = 'prod-lh-01'; // Sâm La Hán Hoa Cúc
    await client.query(
      `UPDATE store_inventory
       SET stock_quantity = 50, reserved = 0, safety_stock = 0
       WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdC]
    );

    // Đặt đơn 3 chai
    const orderResC = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Khách Test C',
        phone: '0904444444',
        storeCode: TEST_STORE,
        items: [{ productId: 'sam-la-han-hoa-cuc', name: 'Sâm La Hán Hoa Cúc', quantity: 3, price: 18000 }],
      }),
    });
    const orderDataC = await orderResC.json();
    await assert(orderResC.status === 200, 'Tạo đơn mới thành công');

    // Lần 1: Confirm đơn
    const confirm1Res = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ id: orderDataC.orderId, status: 'CONFIRMED' }),
    });
    await assert(confirm1Res.status === 200, 'Confirm lần 1 thành công');

    const invCAfter1 = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdC]
    );
    await assert(
      invCAfter1.rows[0].stock_quantity === 47 && invCAfter1.rows[0].reserved === 0,
      'Sau Confirm lần 1: stock_quantity giảm từ 50 xuống 47, reserved giảm từ 3 về 0'
    );

    // Lần 2: Bấm Confirm LẦN NỮA
    const confirm2Res = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ id: orderDataC.orderId, status: 'CONFIRMED' }),
    });
    await assert(confirm2Res.status === 200, 'Confirm lần 2 (PATCH) trả về HTTP 200');

    const invCAfter2 = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdC]
    );
    await assert(
      invCAfter2.rows[0].stock_quantity === 47 && invCAfter2.rows[0].reserved === 0,
      'Sau Confirm lần 2: Tồn kho VẪN LÀ 47, KHÔNG BỊ TRỪ LẦN THỨ HAI (Idempotent 100%)'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST (d): Đơn quá hạn nhả reserved
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST (d): Đơn quá hạn nhả reserved...');

    const testProdD = 'prod-mac-01'; // Matcha Trà Sữa Ciao
    await client.query(
      `UPDATE store_inventory
       SET stock_quantity = 30, reserved = 0, safety_stock = 0
       WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdD]
    );

    // Đặt đơn 4 chai
    const orderResD = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Khách Test D',
        phone: '0905555555',
        storeCode: TEST_STORE,
        items: [{ productId: 'matcha-tra-sua-ciao', name: 'Matcha Trà Sữa Ciao', quantity: 4, price: 20000 }],
      }),
    });
    const orderDataD = await orderResD.json();
    await assert(orderResD.status === 200, 'Tạo đơn mới thành công');

    const invDBeforeExpiry = await client.query(
      `SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdD]
    );
    await assert(invDBeforeExpiry.rows[0].reserved === 4, 'Reserved ban đầu = 4');

    // Làm giả thời hạn: cập nhật expires_at lùi về 1 giờ trước
    await client.query(
      `UPDATE stock_reservations
       SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
       WHERE order_id = $1;`,
      [orderDataD.orderId]
    );

    // Kích hoạt Cron Cleanup API
    const cronRes = await fetch(`${BASE_URL}/api/cron/cleanup-reservations`);
    const cronData = await cronRes.json();
    await assert(cronRes.status === 200, 'Cron cleanup endpoint gọi thành công');
    await assert(cronData.releasedReservationsCount >= 1, 'Cron phát hiện và nhả các reservation hết hạn');

    // Kiểm tra DB sau khi nhả
    const invDAfterExpiry = await client.query(
      `SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [TEST_STORE, testProdD]
    );
    await assert(invDAfterExpiry.rows[0].reserved === 0, 'Reserved được nhả về 0 do đơn quá hạn');

    const orderDStatus = await client.query(
      `SELECT status, note FROM orders WHERE id = $1;`,
      [orderDataD.orderId]
    );
    await assert(
      orderDStatus.rows[0].status === 'CANCELLED',
      'Đơn quá hạn tự động chuyển trạng thái CANCELLED'
    );
    await assert(
      orderDStatus.rows[0].note.includes('quá hạn'),
      'Ghi chú đơn thể hiện lý do tự động hủy do quá hạn giữ chỗ 24h'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST (e): Combo bóc đúng từng chai
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST (e): Combo bóc đúng từng chai...');

    // Chuẩn bị tồn kho cho các chai thành phần của combo-van-phong
    await client.query(
      `UPDATE store_inventory
       SET stock_quantity = 100, reserved = 0, safety_stock = 0
       WHERE store_code = $1 AND product_id IN ('prod-sb-01', 'prod-lh-01', 'prod-tsg-01');`,
      [TEST_STORE]
    );

    // Đặt 2 combo-van-phong (gồm: 5 sua-bap-nep, 3 sam-la-han, 2 tra-sua-go mỗi combo)
    // -> Tổng số chai: 10 sua-bap-nep, 6 sam-la-han, 4 tra-sua-go
    const orderResE = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Khách Mua Combo',
        phone: '0906666666',
        storeCode: TEST_STORE,
        items: [
          {
            productId: 'combo-van-phong',
            name: 'Combo khám phá văn phòng',
            quantity: 2,
            price: 160000,
            unit: '10 chai',
          },
        ],
      }),
    });
    const orderDataE = await orderResE.json();
    await assert(orderResE.status === 200, 'Đặt đơn hàng combo thành công');

    // Kiểm tra combo_snapshot trong order_items
    const orderItemsE = await client.query(
      `SELECT combo_snapshot FROM order_items WHERE order_id = $1;`,
      [orderDataE.orderId]
    );
    const snapshot = orderItemsE.rows[0].combo_snapshot;
    await assert(snapshot && snapshot.length === 3, 'order_items lưu snapshot đầy đủ 3 thành phần combo');

    // Kiểm tra stock_reservations đã bóc đúng từng chai
    const resE = await client.query(
      `SELECT product_id, quantity, status FROM stock_reservations WHERE order_id = $1 ORDER BY product_id ASC;`,
      [orderDataE.orderId]
    );
    await assert(resE.rows.length === 3, 'Tạo chính xác 3 dòng reservation cho 3 loại chai thành phần');

    const expectedBottles = {
      'prod-sb-01': 10, // 5 x 2
      'prod-lh-01': 6,  // 3 x 2
      'prod-tsg-01': 4, // 2 x 2
    };

    for (const r of resE.rows) {
      const exp = expectedBottles[r.product_id];
      await assert(
        r.quantity === exp && r.status === 'active',
        `Chai ${r.product_id}: Giữ chỗ đúng ${r.quantity} chai (kỳ vọng ${exp} chai, status active)`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST (f): Tồn khả dụng không âm
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('TEST (f): Tồn khả dụng không âm (Ngăn chặn triệt để đặt quá tồn)...');

    // Cố tình đặt số lượng khổng lồ 99.999 chai
    const orderResF = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Khách Đặt Quá Tải',
        phone: '0907777777',
        storeCode: TEST_STORE,
        items: [{ productId: 'sua-bap-nep', name: 'Sữa Bắp Nếp', quantity: 99999, price: 18000 }],
      }),
    });
    await assert(
      orderResF.status === 409,
      'Server từ chối HTTP 409 khi đặt vượt số lượng tồn khả dụng'
    );

    // Kiểm tra toàn bộ cơ sở dữ liệu: không có dòng store_inventory nào có stock_quantity < 0 hoặc reserved < 0 hoặc (stock_quantity - reserved) < 0
    const invNegativeCheck = await client.query(`
      SELECT count(*) as negative_count
      FROM store_inventory
      WHERE stock_quantity < 0 OR reserved < 0 OR (stock_quantity - reserved) < 0;
    `);
    const negCount = parseInt(invNegativeCheck.rows[0].negative_count, 10);
    await assert(
      negCount === 0,
      `Kiểm toán toàn bộ cơ sở dữ liệu: ${negCount} dòng âm (Tồn khả dụng luôn >= 0 tuyệt đối!)`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TỔNG KẾT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log(`🏆 TẤT CẢ TEST ĐÃ HOÀN TẤT: ${passCount} PASS / ${failCount} FAIL`);
    console.log('═════════════════════════════════════════════════════════════════\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runAllTests();
