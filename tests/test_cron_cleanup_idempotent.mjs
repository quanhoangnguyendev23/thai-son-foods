/**
 * TEST IDEMPOTENT: HÀM CLEANUP EXPIRED RESERVATIONS
 * Mục tiêu: Chứng minh chạy dọn dẹp 2 lần liên tiếp không gây lỗi,
 * không trừ kho 2 lần và hoàn toàn Idempotent.
 */

import pg from 'pg';
import { cleanupExpiredReservations } from '../src/lib/inventory.ts';
import { assertSafeTestEnvironment } from './helpers/safe_test_env.mjs';

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const connectionString =
  requireDatabaseUrl();

assertSafeTestEnvironment(connectionString);

const pool = new pg.Pool({ connectionString });

async function runIdempotentTest() {
  const client = await pool.connect();
  const testOrderId = `test_ord_idem_${Date.now()}`;
  const testOrderCode = `TSF-IDEM-${Date.now().toString().slice(-4)}`;
  const storeCode = 'AMA';
  const productId = 'prod-sb-01';

  console.log('================================================================');
  console.log('TEST TÍNH IDEMPOTENT CỦA CLEANUP EXPIRED RESERVATIONS');
  console.log('================================================================');

  try {
    // 1. Chuẩn bị dữ liệu mẫu: 1 đơn hàng PENDING + 1 reservation đã quá hạn
    console.log(`[Bước 1] Chuẩn bị đơn hàng mẫu ${testOrderCode} và reservation quá hạn...`);

    // Lấy reserved hiện tại
    const invBefore = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [storeCode, productId]
    );
    const initialReserved = Number(invBefore.rows[0]?.reserved) || 0;
    const testQty = 5;

    // Tăng reserved thêm testQty
    await client.query(
      `UPDATE store_inventory SET reserved = reserved + $1 WHERE store_code = $2 AND product_id = $3;`,
      [testQty, storeCode, productId]
    );

    // Tạo order PENDING
    await client.query(
      `INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, subtotal, total, status, store_code)
       VALUES ($1, $2, 'Khách Test Idempotent', '0900000000', 'Đồng Nai', 'Biên Hòa', 'Tân Hiệp', 'C225 Tân Hiệp', 100000, 100000, 'PENDING', $3);`,
      [testOrderId, testOrderCode, storeCode]
    );

    // Tạo reservation hết hạn (expires_at là 1 giờ trước)
    const testResId = `res_idem_${Date.now()}`;
    await client.query(
      `INSERT INTO stock_reservations (id, store_code, order_id, product_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP - INTERVAL '1 hour');`,
      [testResId, storeCode, testOrderId, productId, testQty]
    );

    console.log(`   -> Đã tạo reservation ${testResId} hết hạn lúc 1 giờ trước.`);
    console.log(`   -> Kho ${storeCode}: reserved ban đầu=${initialReserved}, sau khi giữ chỗ=${initialReserved + testQty}`);

    // 2. Chạy cleanup lần 1
    console.log('\n[Bước 2] Chạy cleanupExpiredReservations lần 1...');
    const result1 = await cleanupExpiredReservations(client);
    console.log('   -> Kết quả lần 1:', result1);

    if (result1.releasedReservationsCount < 1) {
      throw new Error(`Lần 1 thất bại: Mong đợi >= 1 reservation được giải phóng, thực tế: ${result1.releasedReservationsCount}`);
    }

    const invAfter1 = await client.query(
      `SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [storeCode, productId]
    );
    console.log(`   -> Reserved sau lần 1: ${invAfter1.rows[0].reserved} (Kỳ vọng: ${initialReserved})`);

    // 3. Chạy cleanup lần 2 LIÊN TIẾP
    console.log('\n[Bước 3] Chạy cleanupExpiredReservations lần 2 LIÊN TIẾP...');
    const result2 = await cleanupExpiredReservations(client);
    console.log('   -> Kết quả lần 2:', result2);

    if (result2.releasedReservationsCount !== 0) {
      throw new Error(`Lần 2 vi phạm Idempotent: Lẽ ra phải = 0 nhưng trả về: ${result2.releasedReservationsCount}`);
    }

    const invAfter2 = await client.query(
      `SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [storeCode, productId]
    );
    console.log(`   -> Reserved sau lần 2: ${invAfter2.rows[0].reserved} (Kỳ vọng: ${initialReserved})`);

    if (Number(invAfter2.rows[0].reserved) !== Number(invAfter1.rows[0].reserved)) {
      throw new Error('Lần 2 làm thay đổi số lượng reserved, vi phạm tính Idempotent!');
    }

    console.log('\n================================================================');
    console.log('✓ XÁC NHẬN: CLEANUP HOÀN TOÀN IDEMPOTENT (CHẠY 2 LẦN KHÔNG PHÁT SINH TÁC DỤNG PHỤ)');
    console.log('================================================================');

  } finally {
    // Dọn dẹp dữ liệu test
    await client.query(`DELETE FROM stock_reservations WHERE order_id = $1;`, [testOrderId]);
    await client.query(`DELETE FROM inventory_logs WHERE order_id = $1;`, [testOrderId]);
    await client.query(`DELETE FROM orders WHERE id = $1;`, [testOrderId]);
    client.release();
    await pool.end();
  }
}

runIdempotentTest().catch((err) => {
  console.error('Test thất bại:', err);
  process.exit(1);
});
