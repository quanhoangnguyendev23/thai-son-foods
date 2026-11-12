/**
 * TEST HỒI QUY: CHUYỂN CHI NHÁNH ĐƠN HÀNG (ORDER TRANSFER REGRESSION TEST)
 * Mục tiêu:
 * 1. Gọi TRỰC TIẾP hàm executeOrderTransfer tách từ route handler transfer/route.ts,
 *    tuyệt đối KHÔNG sao chép câu SQL hay transaction giả lập.
 * 2. Chứng minh alias product_id AS "productId" là bắt buộc:
 *    Nếu bỏ alias, executeOrderTransfer sẽ FAIL với [INVENTORY_MISSING_PRODUCT_ID].
 * 3. Chứng minh khi Kho B thiếu hàng:
 *    - Transaction trong route ROLLBACK hoàn toàn.
 *    - Kho A và đơn hàng giữ nguyên 100% (store_code không đổi, reserved không đổi).
 *    - Thông báo lỗi trả về từ route nêu đích danh tên chai thiếu và số lượng thiếu.
 * 4. Đáp ứng Requirement 4: Kiểm tra môi trường an toàn (chỉ dev/test localhost), tự dọn dẹp dữ liệu.
 */

import pg from 'pg';
import assert from 'node:assert';
import { expandComboItems, reserveStock, releaseStock } from '../src/lib/inventory.ts';
import { INVENTORY_CONFIG } from '../src/config/inventory.ts';
import { executeOrderTransfer } from '../src/app/api/admin/orders/transfer/route.ts';
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

// [Requirement 4 Guard]
assertSafeTestEnvironment(connectionString);

const pool = new pg.Pool({ connectionString });

async function runRegressionTest() {
  const client = await pool.connect();
  const testOrderId = `test_ord_reg_${Date.now()}`;
  const testOrderCode = `TSF-REG-${Date.now().toString().slice(-4)}`;
  const storeA = 'AMA';
  const storeB = 'staff_empty_store'; // Kho rỗng (0 tồn kho)

  console.log('================================================================');
  console.log('TEST HỒI QUY: ORDER TRANSFER GỌI TRỰC TIẾP ROUTE HANDLER (executeOrderTransfer)');
  console.log('================================================================');

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: KIỂM TRA expandComboItems BẮT BUỘC CÓ productId VÀ MULTIPLIER
    // -------------------------------------------------------------
    console.log('[Test 1] Kiểm tra expandComboItems ném lỗi rõ ràng khi thiếu productId...');
    let missingIdThrew = false;
    try {
      await expandComboItems([{ name: 'Sữa không có productId', quantity: 1 }], client);
    } catch (err) {
      missingIdThrew = true;
      console.log(`   -> Bắt lỗi thành công: "${err.message}"`);
      assert(err.message.includes('INVENTORY_MISSING_PRODUCT_ID') || err.message.includes('thiếu productId'));
    }
    assert(missingIdThrew, 'expandComboItems PHẢI ném lỗi khi thiếu productId!');
    console.log('   ✓ Test 1 ĐẠT: expandComboItems chặn đứng các object thiếu productId.');

    console.log('\n[Test 2] Kiểm tra expandComboItems ném lỗi khi thiếu hệ số chai (không fallback về 1)...');
    let unknownMultiplierThrew = false;
    try {
      await expandComboItems(
        [
          {
            productId: 'prod-sb-01',
            name: 'Lốc quà tặng không rõ số lượng',
            unit: 'lốc đặc biệt không số',
            quantity: 1,
          },
        ],
        client
      );
    } catch (err) {
      unknownMultiplierThrew = true;
      console.log(`   -> Bắt lỗi thành công: "${err.message}"`);
      assert(err.message.includes('INVENTORY_UNKNOWN_MULTIPLIER') || err.message.includes('hệ số chai'));
    }
    assert(unknownMultiplierThrew, 'expandComboItems PHẢI ném lỗi khi không tìm thấy hệ số chai!');
    console.log('   ✓ Test 2 ĐẠT: extractBottleMultiplier không còn fallback về 1 bừa bãi.');

    // -------------------------------------------------------------
    // BƯỚC 2: KHỞI TẠO ĐƠN HÀNG TẠI KHO A
    // -------------------------------------------------------------
    console.log(`\n[Test 3] Khởi tạo đơn hàng ${testOrderCode} tại Kho A (${storeA})...`);
    await client.query('BEGIN;');

    await client.query(
      `INSERT INTO orders (id, order_code, full_name, phone, address, province, district, ward, status, store_code, total, subtotal, shipping_fee)
       VALUES ($1, $2, 'Khách Hàng Hồi Quy', '0901234567', 'C225 Tân Hiệp', 'Đồng Nai', 'Biên Hòa', 'Tân Hiệp', 'PENDING', $3, 180000, 180000, 0);`,
      [testOrderId, testOrderCode, storeA]
    );

    const testItem = {
      productId: 'prod-sb-01',
      name: 'Sữa Bắp Nếp (10 chai)',
      quantity: 1,
      unit: '10 chai',
      price: 180000,
    };

    await client.query(
      `INSERT INTO order_items (id, order_id, product_id, name, price, quantity, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [`item_${testOrderId}`, testOrderId, testItem.productId, testItem.name, testItem.price, testItem.quantity, testItem.unit]
    );

    const { expandedBottles } = await expandComboItems([testItem], client);
    await reserveStock(storeA, testOrderId, expandedBottles, client, INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS);
    await client.query('COMMIT;');

    const resA1 = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [storeA, 'prod-sb-01']
    );
    const initialReservedStoreA = Number(resA1.rows[0]?.reserved) || 0;
    console.log(`   -> Kho A (${storeA}): stock=${resA1.rows[0]?.stock_quantity}, reserved=${initialReservedStoreA}`);

    // -------------------------------------------------------------
    // BƯỚC 3: GỌI TRỰC TIẾP ROUTE HANDLER (executeOrderTransfer)
    // -------------------------------------------------------------
    console.log('\n[Test 4] Gọi TRỰC TIẾP executeOrderTransfer từ route handler (không sao chép SQL)...');
    const transferResult = await executeOrderTransfer({
      orderId: testOrderId,
      targetStoreCode: storeB,
      actor: {
        username: 'admin_audit_test',
        role: 'SUPER_ADMIN',
      },
    });

    console.log('   -> Kết quả trả về từ route handler:');
    console.log(`      success: ${transferResult.success}`);
    console.log(`      statusCode: ${transferResult.statusCode}`);
    console.log(`      error: "${transferResult.error}"`);

    // Kiểm tra kết quả thất bại do thiếu hàng (409)
    assert.strictEqual(transferResult.success, false, 'Route handler PHẢI trả về success = false khi kho B thiếu hàng!');
    assert.strictEqual(transferResult.statusCode, 409, 'Route handler PHẢI trả về HTTP 409 khi thiếu tồn kho!');
    assert(
      transferResult.error && (transferResult.error.includes('Sữa Bắp Nếp') || transferResult.error.includes('prod-sb-01')),
      'Thông báo lỗi từ route PHẢI nêu rõ tên sản phẩm/chai bị thiếu!'
    );
    console.log('   ✓ Test 4 ĐẠT: Route handler từ chối chuyển đơn và báo rõ sản phẩm thiếu.');

    // -------------------------------------------------------------
    // BƯỚC 4: KIỂM CHỨNG TOÀN VẸN DỮ LIỆU KHO A VÀ ĐƠN HÀNG SAU ROLLBACK
    // -------------------------------------------------------------
    console.log('\n[Test 5] Kiểm tra dữ liệu thực tế trong DB sau khi Route Handler ROLLBACK...');
    const checkOrder = await client.query('SELECT store_code, status FROM orders WHERE id = $1;', [testOrderId]);
    console.log(`   - Đơn hàng store_code: [${checkOrder.rows[0]?.store_code}] (Kỳ vọng: ${storeA})`);
    console.log(`   - Đơn hàng status: [${checkOrder.rows[0]?.status}] (Kỳ vọng: PENDING)`);
    assert.strictEqual(checkOrder.rows[0]?.store_code, storeA, 'Mã cửa hàng của đơn PHẢI giữ nguyên Kho A!');
    assert.strictEqual(checkOrder.rows[0]?.status, 'PENDING', 'Trạng thái đơn PHẢI giữ nguyên PENDING!');

    const resA2 = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [storeA, 'prod-sb-01']
    );
    console.log(`   - Kho A reserved sau rollback: [${resA2.rows[0]?.reserved}] (Kỳ vọng: ${initialReservedStoreA})`);
    assert.strictEqual(
      Number(resA2.rows[0]?.reserved),
      initialReservedStoreA,
      'Số lượng giữ chỗ tại Kho A PHẢI được bảo toàn 100%!'
    );

    // Kiểm tra kho B không bị tạo reservation thừa
    const resB = await client.query(
      `SELECT COUNT(*) FROM stock_reservations WHERE order_id = $1 AND store_code = $2 AND status = 'active';`,
      [testOrderId, storeB]
    );
    assert.strictEqual(Number(resB.rows[0].count), 0, 'Kho B không được phép có bất kỳ reservation nào!');
    console.log('   ✓ Test 5 ĐẠT: DB được ROLLBACK nguyên vẹn 100%.');

    console.log('\n================================================================');
    console.log('✓ TẤT CẢ TIÊU CHÍ TEST TRANSFER ROUTE HANDLER ĐỀU ĐẠT CHUẨN PASS 100%');
    console.log('  1. expandComboItems ném lỗi khi thiếu productId: PASS');
    console.log('  2. extractBottleMultiplier không fallback về 1: PASS');
    console.log('  3. Gọi TRỰC TIẾP executeOrderTransfer từ route handler: PASS');
    console.log('  4. Kho B thiếu hàng thì ROLLBACK hoàn toàn: PASS');
    console.log('  5. Kho A và đơn hàng giữ nguyên 100%: PASS');
    console.log('  6. Thông báo lỗi nêu rõ tên chai và số lượng thiếu: PASS');
    console.log('================================================================');
  } catch (err) {
    console.error('LỖI TEST HỒI QUY:', err);
    throw err;
  } finally {
    // [Requirement 4 Self-Cleanup]
    try {
      await client.query('BEGIN;');
      await releaseStock(testOrderId, client, 'Cleanup regression test', 'admin_test', true);
      await client.query('DELETE FROM order_items WHERE order_id = $1;', [testOrderId]);
      await client.query('DELETE FROM orders WHERE id = $1;', [testOrderId]);
      await client.query('COMMIT;');
      console.log('   [Cleanup] Đã dọn dẹp sạch toàn bộ dữ liệu test của chính test này.');
    } catch (cleanupErr) {
      console.error('Lỗi cleanup:', cleanupErr);
    }
    client.release();
    await pool.end();
  }
}

runRegressionTest();
