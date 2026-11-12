import { pool } from '../src/lib/db.ts';

// Import inventory backend logic
import {
  reserveStock,
  confirmStock,
  releaseStock,
  cleanupExpiredReservations,
  getComboStockDetails,
  InsufficientStockError,
  InsufficientStockConfirmError,
} from '../src/lib/inventory.js';

import { assertSafeDatabase } from '../scripts/db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

async function runTestSuite() {
  console.log('================================================================');
  console.log('         PHASE 1 BACKEND AUTOMATED TEST SUITE                   ');
  console.log('================================================================\n');

  const testStore = 'TEST_P1_STORE';
  const prodA = 'prod-sb-01'; // Sữa Bắp Nếp
  const prodB = 'prod-nl-01'; // Nước Mát Nha Đam (or another existing product)
  
  // Setup store test & cleanup residual test data
  const setupClient = await pool.connect();
  try {
    await setupClient.query(`DELETE FROM stock_reservations WHERE store_code = $1;`, [testStore]);
    await setupClient.query(`DELETE FROM store_inventory WHERE store_code = $1;`, [testStore]);
    await setupClient.query(`DELETE FROM orders WHERE store_code = $1;`, [testStore]);
    await setupClient.query(`
      INSERT INTO stores (id, code, name, address, phone, is_active)
      VALUES ('str_test_p1', $1, 'Kho Thử Nghiệm P1', '123 Đường Test', '0901112233', true)
      ON CONFLICT (code) DO NOTHING;
    `, [testStore]);
  } finally {
    setupClient.release();
  }

  // -------------------------------------------------------------------------
  // TEST 1: Đồng thời 2 đơn cho combo cuối cùng (chỉ 1 thành công)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Đồng thời 2 đơn tranh chấp combo cuối cùng ---');
  {
    const ts = Date.now();
    // Setup tồn kho: chỉ đủ đúng 1 combo (cần 4 chai prodA, kho set đúng 4 chai)
    const clientSetup = await pool.connect();
    await clientSetup.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
      VALUES ('inv_p1_1', $1, $2, 4, 0, 0)
      ON CONFLICT (store_code, product_id) DO UPDATE SET stock_quantity = 4, reserved = 0, safety_stock = 0;
    `, [testStore, prodA]);
    clientSetup.release();

    const orderId1 = `ord_race_1_${ts}`;
    const orderId2 = `ord_race_2_${ts}`;

    // Tạo 2 đơn hàng PENDING trong DB
    const oClient = await pool.connect();
    await oClient.query(`
      INSERT INTO orders (id, order_code, full_name, phone, status, store_code, total, subtotal, province, district, ward, address)
      VALUES 
        ($1, 'TSF-RACE-${ts}-1', 'Khách Đua 1', '0901111111', 'PENDING', $3, 100000, 100000, 'TP.HCM', 'Quận 7', 'Tân Thuận', '123 Đường Test'),
        ($2, 'TSF-RACE-${ts}-2', 'Khách Đua 2', '0902222222', 'PENDING', $3, 100000, 100000, 'TP.HCM', 'Quận 7', 'Tân Thuận', '123 Đường Test');
    `, [orderId1, orderId2, testStore]);
    oClient.release();

    const bottlesPerOrder = [
      { productId: prodA, productName: 'Sữa Bắp Nếp', bottleQuantity: 4, originalItemIndex: 0 },
    ];

    // Chạy đồng thời 2 transaction
    const runReserve = async (orderId) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await reserveStock(testStore, orderId, bottlesPerOrder, client);
        await client.query('COMMIT');
        return { success: true };
      } catch (err) {
        await client.query('ROLLBACK');
        return { success: false, error: err.message };
      } finally {
        client.release();
      }
    };

    const [res1, res2] = await Promise.all([runReserve(orderId1), runReserve(orderId2)]);
    const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);

    console.log(`Kết quả: Đơn 1: ${res1.success ? 'THÀNH CÔNG' : 'TỪ CHỐI'} | Đơn 2: ${res2.success ? 'THÀNH CÔNG' : 'TỪ CHỐI'}`);
    if (successCount === 1) {
      console.log('=> PASS: Đúng 1 đơn thành công, đơn còn lại bị chặn do hết tồn khả dụng!');
    } else {
      console.error('=> FAIL: Số đơn thành công không phải 1:', successCount);
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 2: 2 combo chung chai (Cộng gộp trước khi kiểm tra)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: 2 combo cùng chứa 1 loại chai (Cộng gộp nhu cầu) ---');
  {
    // Setup: prodA có 6 chai khả dụng.
    // Combo 1 cần 3 chai prodA.
    // Combo 2 cần 4 chai prodA.
    // Tổng nhu cầu = 7 chai > 6 chai kho có.
    const clientSetup = await pool.connect();
    await clientSetup.query(`
      UPDATE store_inventory SET stock_quantity = 6, reserved = 0 WHERE store_code = $1 AND product_id = $2;
    `, [testStore, prodA]);
    clientSetup.release();

    const orderId3 = `ord_shared_${Date.now()}`;
    const oClient = await pool.connect();
    await oClient.query(`
      INSERT INTO orders (id, order_code, full_name, phone, status, store_code, total, subtotal, province, district, ward, address)
      VALUES ($1, 'TSF-SHARED-01', 'Khách Combo Kép', '0903333333', 'PENDING', $2, 200000, 200000, 'TP.HCM', 'Quận 7', 'Tân Thuận', '123 Đường Test');
    `, [orderId3, testStore]);
    oClient.release();

    const multiComboBottles = [
      { productId: prodA, productName: 'Chai A (từ Combo 1)', bottleQuantity: 3, originalItemIndex: 0 },
      { productId: prodA, productName: 'Chai A (từ Combo 2)', bottleQuantity: 4, originalItemIndex: 1 },
    ];

    const client = await pool.connect();
    let threw = false;
    try {
      await client.query('BEGIN');
      await reserveStock(testStore, orderId3, multiComboBottles, client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      threw = true;
      console.log('Bị chặn như kỳ vọng:', err.message);
    } finally {
      client.release();
    }

    if (threw) {
      console.log('=> PASS: Hệ thống đã cộng gộp đúng 3 + 4 = 7 chai và chặn vì kho chỉ có 6 chai!');
    } else {
      console.error('=> FAIL: Hệ thống không chặn đơn hàng vượt quá tồn kho cộng gộp!');
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 3: Hủy đơn hàng 2 lần (Idempotency)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Hủy đơn 2 lần (Kiểm tra tính Idempotent) ---');
  {
    // Setup tồn kho: prodA có 10 chai, reserve 5 chai
    const clientSetup = await pool.connect();
    await clientSetup.query(`
      UPDATE store_inventory SET stock_quantity = 10, reserved = 0 WHERE store_code = $1 AND product_id = $2;
    `, [testStore, prodA]);
    clientSetup.release();

    const orderId4 = `ord_cancel_${Date.now()}`;
    const oClient = await pool.connect();
    await oClient.query(`
      INSERT INTO orders (id, order_code, full_name, phone, status, store_code, total, subtotal, province, district, ward, address)
      VALUES ($1, 'TSF-CANCEL-01', 'Khách Hủy', '0904444444', 'PENDING', $2, 150000, 150000, 'TP.HCM', 'Quận 7', 'Tân Thuận', '123 Đường Test');
    `, [orderId4, testStore]);
    oClient.release();

    // Reserve 5 chai
    const rClient = await pool.connect();
    await rClient.query('BEGIN');
    await reserveStock(testStore, orderId4, [{ productId: prodA, productName: 'Sữa Bắp', bottleQuantity: 5, originalItemIndex: 0 }], rClient);
    await rClient.query('COMMIT');
    rClient.release();

    // Kiểm tra reserved = 5
    const invCheck1 = await pool.query(`SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2`, [testStore, prodA]);
    console.log('Reserved sau khi đặt đơn:', invCheck1.rows[0].reserved);

    // Hủy lần 1
    const cancelClient1 = await pool.connect();
    await cancelClient1.query('BEGIN');
    const resCancel1 = await releaseStock(orderId4, cancelClient1, 'Hủy lần 1', 'admin');
    await cancelClient1.query('COMMIT');
    cancelClient1.release();

    const invCheck2 = await pool.query(`SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2`, [testStore, prodA]);
    console.log('Reserved sau khi hủy lần 1:', invCheck2.rows[0].reserved, `(Action: ${resCancel1.action})`);

    // Hủy lần 2 (ngay lập tức)
    const cancelClient2 = await pool.connect();
    await cancelClient2.query('BEGIN');
    const resCancel2 = await releaseStock(orderId4, cancelClient2, 'Hủy lần 2', 'admin');
    await cancelClient2.query('COMMIT');
    cancelClient2.release();

    const invCheck3 = await pool.query(`SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2`, [testStore, prodA]);
    console.log('Reserved sau khi hủy lần 2:', invCheck3.rows[0].reserved, `(Action: ${resCancel2.action})`);

    if (Number(invCheck2.rows[0].reserved) === 0 && Number(invCheck3.rows[0].reserved) === 0 && resCancel2.action === 'already_cancelled') {
      console.log('=> PASS: Hủy 2 lần an toàn tuyệt đối, không bị trừ âm reserved!');
    } else {
      console.error('=> FAIL: Reserved bị lệch sau 2 lần hủy!');
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 4: Hết hạn giữ chỗ (Cleanup expired reservations)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Hết hạn giữ chỗ (cleanupExpiredReservations) ---');
  {
    // Tạo 1 reservation đã hết hạn (expires_at = 2 giờ trước)
    const orderId5 = `ord_expired_${Date.now()}`;
    const expCode = `TSF-EXP-${Date.now()}`;
    const client = await pool.connect();
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO orders (id, order_code, full_name, phone, status, store_code, total, subtotal, province, district, ward, address)
      VALUES ($1, $2, 'Khách Quá Hạn', '0905555555', 'PENDING', $3, 120000, 120000, 'TP.HCM', 'Quận 7', 'Tân Thuận', '123 Đường Test');
    `, [orderId5, expCode, testStore]);

    await client.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
      VALUES ('inv_p1_exp', $1, $2, 20, 3, 0)
      ON CONFLICT (store_code, product_id) DO UPDATE SET stock_quantity = 20, reserved = 3;
    `, [testStore, prodA]);

    await client.query(`
      INSERT INTO stock_reservations (id, order_id, store_code, product_id, quantity, status, expires_at)
      VALUES ($1, $2, $3, $4, 3, 'active', CURRENT_TIMESTAMP - INTERVAL '2 hours');
    `, [`res_exp_${Date.now()}`, orderId5, testStore, prodA]);

    await client.query('COMMIT');
    client.release();

    const checkBefore = await pool.query(`SELECT id, order_id, status, expires_at, CURRENT_TIMESTAMP, (expires_at < CURRENT_TIMESTAMP) as is_exp FROM stock_reservations WHERE order_id = $1`, [orderId5]);
    console.log('Reservation trước khi cleanup:', checkBefore.rows);

    // Chạy cleanup
    const cleanupRes = await cleanupExpiredReservations();
    console.log(`Đã quét dọn: ${cleanupRes.releasedReservationsCount} reservations, hủy ${cleanupRes.cancelledOrdersCount} đơn hàng`);

    const orderCheck = await pool.query(`SELECT status FROM orders WHERE id = $1`, [orderId5]);
    const invCheck = await pool.query(`SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2`, [testStore, prodA]);

    console.log(`orderCheck status: ${orderCheck.rows[0]?.status}, invCheck reserved: ${invCheck.rows[0]?.reserved}`);

    if (orderCheck.rows[0]?.status === 'CANCELLED' && Number(invCheck.rows[0]?.reserved) === 0) {
      console.log('=> PASS: Reservation hết hạn đã được nhả kho và chuyển đơn sang CANCELLED thành công!');
    } else {
      console.error('=> FAIL: Chưa dọn sạch reservation hết hạn!', orderCheck.rows[0], invCheck.rows[0]);
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 5: Công thức tồn combo định mức 4/3/3
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Công thức tồn combo định mức 4/3/3 ---');
  {
    // Tạo 1 combo test 4/3/3 trong DB
    const comboTestId = 'combo-test-433';
    const cProd1 = 'prod-sb-01'; // 4 chai
    const cProd2 = 'prod-nl-01'; // 3 chai (nếu prod-nl-01 chưa có thì lấy id khác)
    
    // Lấy 3 sản phẩm có thật trong DB
    const pRows = await pool.query(`SELECT id, name FROM products WHERE is_active = true LIMIT 3;`);
    const p1 = pRows.rows[0];
    const p2 = pRows.rows[1];
    const p3 = pRows.rows[2];

    const client = await pool.connect();
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO combos (id, slug, name, original_price, sale_price, total_items, is_active)
      VALUES ($1, $1, 'Combo Thử Nghiệm 4/3/3', 250000, 199000, 10, true)
      ON CONFLICT (id) DO UPDATE SET is_active = true;
    `, [comboTestId]);

    await client.query(`DELETE FROM combo_items WHERE combo_id = $1;`, [comboTestId]);
    await client.query(`
      INSERT INTO combo_items (id, combo_id, product_id, quantity, unit)
      VALUES 
        ('ci_test_1', $1, $2, 4, 'chai'),
        ('ci_test_2', $1, $3, 3, 'chai'),
        ('ci_test_3', $1, $4, 3, 'chai');
    `, [comboTestId, p1.id, p2.id, p3.id]);

    // Setup tồn kho:
    // P1: tồn 16 -> 16 / 4 = 4 combo
    // P2: tồn 15 -> 15 / 3 = 5 combo
    // P3: tồn 9  -> 9 / 3  = 3 combo (Nút thắt)
    await client.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
      VALUES 
        ($1, $2, $3, 16, 0, 0),
        ($4, $5, $6, 15, 0, 0),
        ($7, $8, $9, 9, 0, 0)
      ON CONFLICT (store_code, product_id) DO UPDATE 
      SET stock_quantity = EXCLUDED.stock_quantity, reserved = 0, safety_stock = 0;
    `, [
      `inv_p1_${p1.id}`, testStore, p1.id,
      `inv_p1_${p2.id}`, testStore, p2.id,
      `inv_p1_${p3.id}`, testStore, p3.id,
    ]);

    await client.query('COMMIT');
    client.release();

    // Gọi hàm tính chuẩn getComboStockDetails
    const result = await getComboStockDetails(testStore, comboTestId);
    console.log('Kết quả tính maxCombos:', result.maxCombos, '(Kỳ vọng: 3)');
    console.log('Chai nút thắt:', result.bottlenecks.map(b => b.productName || b.productId));
    console.log('Số chai cần thêm để lên 4 combo:', result.bottlesNeededToIncrease, '(Kỳ vọng: 3 chai của chai nút thắt P3)');
    console.log('Trạng thái:', result.status, '(Kỳ vọng: low vì 3 <= 10)');

    const p3Detail = result.bottles.find(b => b.productId === p3.id);
    if (
      result.maxCombos === 3 &&
      result.status === 'low' &&
      result.bottlenecks.some(b => b.productId === p3.id) &&
      p3Detail?.bottlesNeededForNextLevel === 3
    ) {
      console.log('=> PASS: Công thức combo định mức 4/3/3 chuẩn xác 100%!');
    } else {
      console.error('=> FAIL: Kết quả tính combo 4/3/3 không đúng kỳ vọng!', result);
      process.exit(1);
    }
  }

  // Dọn dẹp dữ liệu test
  const cleanClient = await pool.connect();
  try {
    await cleanClient.query(`DELETE FROM stock_reservations WHERE store_code = $1;`, [testStore]);
    await cleanClient.query(`DELETE FROM store_inventory WHERE store_code = $1;`, [testStore]);
    await cleanClient.query(`DELETE FROM orders WHERE store_code = $1;`, [testStore]);
    await cleanClient.query(`DELETE FROM combo_items WHERE combo_id = 'combo-test-433';`);
    await cleanClient.query(`DELETE FROM combos WHERE id = 'combo-test-433';`);
    await cleanClient.query(`DELETE FROM stores WHERE code = $1;`, [testStore]);
    console.log('\nĐã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử testStore.');
  } finally {
    cleanClient.release();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log('         TẤT CẢ 5 BÀI TEST PHASE 1 ĐỀU THÀNH CÔNG!              ');
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('Lỗi khi chạy test suite:', err);
  process.exit(1);
});
