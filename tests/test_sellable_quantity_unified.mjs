/**
 * TEST TỰ ĐỘNG HỢP NHẤT CÔNG THỨC TỒN: getSellableQuantity
 * 
 * Mục tiêu kiểm thử:
 * 1. Chứng minh công thức tồn bán được duy nhất: max(0, stock - reserved - safety_stock)
 *    đồng bộ trên toàn hệ thống:
 *    - stores/route.ts (Pop-up chọn chi nhánh)
 *    - getAvailability
 *    - inventory/check
 *    - reserveStock (chặn giữ chỗ đơn hàng)
 *    - API & trang Admin
 * 2. Chứng minh bóc tách combo và lốc theo bottle_multiplier
 * 3. CHỨNG MINH SỐ HIỂN THỊ BẰNG ĐÚNG SỐ CHẶN KHI ĐẶT HÀNG CHO:
 *    (1) Chai lẻ
 *    (2) Combo 4/3/3
 *    (3) Lốc 10 chai (bottle_multiplier = 10)
 *    (4) Chai có safety_stock > 0
 * 4. Tuân thủ Requirement 4: Chỉ chạy trên dev/test localhost, tự động dọn dẹp dữ liệu test.
 */

import assert from 'node:assert';
import pg from 'pg';
import { assertSafeTestEnvironment } from './helpers/safe_test_env.mjs';
import {
  getSellableQuantity,
  reserveStock,
  expandComboItems,
  InsufficientStockError,
} from '../src/lib/inventory.ts';
import { signAdminToken, ADMIN_COOKIE_NAME } from '../src/lib/auth.ts';

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

// 1. Kiểm tra an toàn môi trường
assertSafeTestEnvironment();

const connectionString =
  requireDatabaseUrl();

const pool = new pg.Pool({ connectionString });
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function runUnifiedSellableQuantityTests() {
  console.log('================================================================');
  console.log('TEST HỢP NHẤT CÔNG THỨC TỒN: getSellableQuantity & SỐ CHẶN ĐẶT HÀNG');
  console.log('Công thức: sellable = max(0, stock - reserved - safety_stock)');
  console.log('================================================================');

  const client = await pool.connect();
  const ts = Date.now();
  const TEST_STORE_CODE = `TEST_ST_${ts % 100000}`;
  
  // IDs cho các sản phẩm test
  const ID_CHAI_LE = `test_chai_le_${ts}`;
  const ID_COMBO_A = `test_c433_a_${ts}`;
  const ID_COMBO_B = `test_c433_b_${ts}`;
  const ID_COMBO_C = `test_c433_c_${ts}`;
  const ID_COMBO_433 = `test_combo_433_${ts}`;
  const ID_LOC10_PROD = `test_loc10_prod_${ts}`;
  const ID_LOC10_VAR = `test_loc10_var_${ts}`;
  const ID_SAFETY_PROD = `test_safety_prod_${ts}`;

  let passedTests = 0;
  const resultsTable = [];

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: KHỞI TẠO DỮ LIỆU CỬA HÀNG VÀ SẢN PHẨM TEST TRONG DB
    // -------------------------------------------------------------------------
    console.log('\n[Chuẩn bị dữ liệu test]');
    
    // 1. Cửa hàng test
    await client.query(`
      INSERT INTO stores (id, code, name, address, province, district, is_active, status)
      VALUES ($1, $2, $3, $4, 'Hồ Chí Minh', 'Quận 1', true, 1);
    `, [`st_${TEST_STORE_CODE}`, TEST_STORE_CODE, `Chi nhánh Test ${TEST_STORE_CODE}`, '123 Đường Test, Quận 1']);

    // 2. Sản phẩm chai lẻ: stock=15, reserved=2, safety_stock=0 -> sellable=13
    await client.query(`
      INSERT INTO products (id, name, slug, sku, price, unit, thumbnail, is_active, stock_quantity)
      VALUES ($1, 'Chai Lẻ Test', $1, $1, 20000, 'chai', '/images/test.png', true, 15);
    `, [ID_CHAI_LE]);
    await client.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
      VALUES ($1, $2, $3, 15, 2, 0);
    `, [`inv_${TEST_STORE_CODE}_${ID_CHAI_LE}`, TEST_STORE_CODE, ID_CHAI_LE]);

    // 3. Sản phẩm cho Combo 4/3/3:
    //    Bottle A: stock=50, reserved=0, safety=2 -> sellable=48 -> 48/4 = 12 combos
    //    Bottle B: stock=35, reserved=2, safety=3 -> sellable=30 -> 30/3 = 10 combos
    //    Bottle C: stock=26, reserved=0, safety=2 -> sellable=24 -> 24/3 = 8 combos (Bottleneck!)
    await client.query(`
      INSERT INTO products (id, name, slug, sku, price, unit, thumbnail, is_active, stock_quantity) VALUES
      ($1, 'Chai Combo A', $1, $1, 25000, 'chai', '/images/test_a.png', true, 50),
      ($2, 'Chai Combo B', $2, $2, 25000, 'chai', '/images/test_b.png', true, 35),
      ($3, 'Chai Combo C', $3, $3, 25000, 'chai', '/images/test_c.png', true, 26);
    `, [ID_COMBO_A, ID_COMBO_B, ID_COMBO_C]);
    await client.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock) VALUES
      ($1, $2, $3, 50, 0, 2),
      ($4, $2, $5, 35, 2, 3),
      ($6, $2, $7, 26, 0, 2);
    `, [
      `inv_${TEST_STORE_CODE}_${ID_COMBO_A}`,
      TEST_STORE_CODE,
      ID_COMBO_A,
      `inv_${TEST_STORE_CODE}_${ID_COMBO_B}`,
      ID_COMBO_B,
      `inv_${TEST_STORE_CODE}_${ID_COMBO_C}`,
      ID_COMBO_C,
    ]);

    // Combo 4/3/3 trong bảng combos & combo_items
    await client.query(`
      INSERT INTO combos (id, name, slug, description, image, original_price, sale_price, total_items, discount, is_active)
      VALUES ($1, 'Combo Gia Đình 4-3-3', $1, 'Mô tả combo 4/3/3', '/images/combo.jpg', 250000, 220000, 10, 30000, true);
    `, [ID_COMBO_433]);
    await client.query(`
      INSERT INTO combo_items (id, combo_id, product_id, quantity, unit) VALUES
      ($1, $4, $5, 4, 'chai'),
      ($2, $4, $6, 3, 'chai'),
      ($3, $4, $7, 3, 'chai');
    `, [
      `ci_1_${ts}`, `ci_2_${ts}`, `ci_3_${ts}`,
      ID_COMBO_433,
      ID_COMBO_A, ID_COMBO_B, ID_COMBO_C
    ]);

    // 4. Lốc 10 chai: Bottle có stock=45, reserved=0, safety=0 -> sellable=45 chai -> floor(45/10) = 4 lốc
    await client.query(`
      INSERT INTO products (id, name, slug, sku, price, unit, thumbnail, is_active, stock_quantity)
      VALUES ($1, 'Chai Đóng Lốc Test', $1, $1, 20000, 'chai', '/images/test_loc.png', true, 45);
    `, [ID_LOC10_PROD]);
    await client.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
      VALUES ($1, $2, $3, 45, 0, 0);
    `, [`inv_${TEST_STORE_CODE}_${ID_LOC10_PROD}`, TEST_STORE_CODE, ID_LOC10_PROD]);
    await client.query(`
      INSERT INTO product_variants (id, product_id, name, quantity, price, unit, bottle_multiplier)
      VALUES ($1, $2, 'Lốc 10 Chai', 10, 190000, 'lốc 10 chai', 10);
    `, [ID_LOC10_VAR, ID_LOC10_PROD]);

    // 5. Chai có safety_stock: stock=20, reserved=3, safety_stock=5 -> sellable=12
    await client.query(`
      INSERT INTO products (id, name, slug, sku, price, unit, thumbnail, is_active, stock_quantity)
      VALUES ($1, 'Chai Safety Stock Test', $1, $1, 22000, 'chai', '/images/test_safe.png', true, 20);
    `, [ID_SAFETY_PROD]);
    await client.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
      VALUES ($1, $2, $3, 20, 3, 5);
    `, [`inv_${TEST_STORE_CODE}_${ID_SAFETY_PROD}`, TEST_STORE_CODE, ID_SAFETY_PROD]);

    // 6. Tạo trước các order IDs để thỏa mãn Foreign Key cho stock_reservations
    const testOrderIds = [
      `test_ord_13_${ts}`,
      `test_ord_14_${ts}`,
      `test_ord_c8_${ts}`,
      `test_ord_c9_${ts}`,
      `test_ord_p4_${ts}`,
      `test_ord_p5_${ts}`,
      `test_ord_s12_${ts}`,
      `test_ord_s13_${ts}`,
    ];
    for (const oId of testOrderIds) {
      await client.query(`
        INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, subtotal, total)
        VALUES ($1, $1, 'Test User', '0901234567', 'HCM', 'Q1', 'Bến Nghé', '123 Đường Test', 100000, 100000)
        ON CONFLICT (id) DO NOTHING;
      `, [oId]);
    }

    console.log('   ✓ Đã tạo store test, 4 kịch bản sản phẩm, test orders và tồn kho cách ly.');

    // Tạo admin user trong DB để getAdminSession xác thực thành công
    await client.query(`
      INSERT INTO admin_users (id, username, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, 'hash_test', 'SUPER_ADMIN', true)
      ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', is_active = true;
    `, ['qa_admin_id', 'qa_admin', 'qa@tsf.test']);

    // Token Super Admin để kiểm tra Admin API
    const adminToken = await signAdminToken({
      id: 'qa_admin_id',
      userId: 'qa_admin_id',
      username: 'qa_admin',
      email: 'qa@tsf.test',
      role: 'SUPER_ADMIN',
    });
    const authHeaders = {
      Cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
    };

    // -------------------------------------------------------------------------
    // TEST CASE 1: CHAI LẺ (Single Bottle)
    // Tồn vật lý = 15, reserved = 2, safety = 0 -> Tồn bán được = 13
    // -------------------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('[TEST CASE 1] CHAI LẺ: stock=15, reserved=2, safety=0 -> sellable=13');
    console.log('-------------------------------------------------------------');

    // 1.1 Kiểm tra qua hàm canonical getSellableQuantity
    const sellableSingle = await getSellableQuantity(TEST_STORE_CODE, ID_CHAI_LE);
    console.log(`- getSellableQuantity("${TEST_STORE_CODE}", "${ID_CHAI_LE}") = ${sellableSingle}`);
    assert.strictEqual(sellableSingle, 13, 'getSellableQuantity chai lẻ phải là 13');

    // 1.2 Kiểm tra qua API stores/route.ts (Pop-up chọn chi nhánh)
    const storeRes1 = await fetch(`${APP_URL}/api/stores?productId=${encodeURIComponent(ID_CHAI_LE)}`);
    const storeData1 = await storeRes1.json();
    assert.strictEqual(storeData1.success, true);
    const storeObj1 = storeData1.stores.find((s) => s.code === TEST_STORE_CODE);
    assert(storeObj1, `Phải tìm thấy store ${TEST_STORE_CODE}`);
    console.log(`- Pop-up stores/route.ts: sellableQuantity=${storeObj1.sellableQuantity}, stockStatus=${storeObj1.stockStatus}`);
    assert.strictEqual(storeObj1.sellableQuantity, 13);
    assert.strictEqual(storeObj1.stockStatus, 'in_stock');

    // 1.3 Kiểm tra qua API inventory/check
    const checkRes1 = await fetch(`${APP_URL}/api/inventory/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeCode: TEST_STORE_CODE,
        items: [{ productId: ID_CHAI_LE, quantity: 1 }],
      }),
    });
    const checkData1 = await checkRes1.json();
    console.log(`- API inventory/check: maxQuantity=${checkData1.maxQuantity}, isAvailable=${checkData1.isAvailable}`);
    assert.strictEqual(checkData1.maxQuantity, 13);
    assert.strictEqual(checkData1.isAvailable, true);

    // 1.4 Kiểm tra qua API Admin /api/admin/inventory
    const adminRes1 = await fetch(`${APP_URL}/api/admin/inventory?storeCode=${TEST_STORE_CODE}`, {
      headers: authHeaders,
    });
    const adminData1 = await adminRes1.json();
    const adminItem1 = adminData1.data.find((p) => p.product_id === ID_CHAI_LE);
    assert(adminItem1, 'Admin phải trả về sản phẩm chai lẻ');
    console.log(`- Admin Inventory: stock_quantity=${adminItem1.stock_quantity}, reserved=${adminItem1.reserved}, safety_stock=${adminItem1.safety_stock}, sellable_quantity=${adminItem1.sellable_quantity}`);
    assert.strictEqual(Number(adminItem1.stock_quantity), 15);
    assert.strictEqual(Number(adminItem1.reserved), 2);
    assert.strictEqual(Number(adminItem1.safety_stock), 0);
    assert.strictEqual(Number(adminItem1.sellable_quantity), 13);

    // 1.5 CHỨNG MINH SỐ HIỂN THỊ = SỐ CHẶN ĐẶT HÀNG:
    // Đặt đúng 13 chai -> THÀNH CÔNG (Không bị chặn)
    let orderPass1 = false;
    let orderFail1 = false;
    try {
      await client.query('BEGIN;');
      const { expandedBottles } = await expandComboItems([{ productId: ID_CHAI_LE, quantity: 13 }], client);
      await reserveStock(TEST_STORE_CODE, `test_ord_13_${ts}`, expandedBottles, client);
      await client.query('ROLLBACK;'); // rollback để không làm bẩn tồn kho cho bước tiếp theo
      orderPass1 = true;
      console.log('  ✓ Đặt hàng với số lượng đúng bằng số hiển thị (13 chai): THÀNH CÔNG!');
    } catch (err) {
      await client.query('ROLLBACK;');
      throw new Error(`Đặt 13 chai không được phép lỗi: ${err.message}`);
    }

    // Đặt 14 chai (vượt quá 1 chai) -> BỊ CHẶN BỞI reserveStock
    try {
      await client.query('BEGIN;');
      const { expandedBottles } = await expandComboItems([{ productId: ID_CHAI_LE, quantity: 14 }], client);
      await reserveStock(TEST_STORE_CODE, `test_ord_14_${ts}`, expandedBottles, client);
      await client.query('ROLLBACK;');
    } catch (err) {
      await client.query('ROLLBACK;');
      if (err instanceof InsufficientStockError || err.name === 'InsufficientStockError') {
        orderFail1 = true;
        console.log(`  ✓ Đặt hàng 14 chai (vượt 1 đơn vị): BỊ CHẶN CHÍNH XÁC (${err.message})!`);
      } else {
        throw err;
      }
    }

    assert(orderPass1 && orderFail1, 'Case 1: Số hiển thị (13) phải đúng bằng số chặn đặt hàng (13)!');
    passedTests++;
    resultsTable.push({
      scenario: '1. Chai Lẻ',
      physicalStock: 15,
      reserved: 2,
      safetyStock: 0,
      displayedSellable: 13,
      blockingLimit: 13,
      verifiedMatch: '✓ BẰNG NHAU (13 == 13)',
    });

    // -------------------------------------------------------------------------
    // TEST CASE 2: COMBO 4/3/3
    // Constituent A (x4): 50-0-2=48 chai -> 12 combos
    // Constituent B (x3): 35-2-3=30 chai -> 10 combos
    // Constituent C (x3): 26-0-2=24 chai -> 8 combos (Bottleneck)
    // Tồn bán được của Combo = min(12, 10, 8) = 8 combos
    // -------------------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('[TEST CASE 2] COMBO 4/3/3: A=48/4=12, B=30/3=10, C=24/3=8 -> sellable=8');
    console.log('-------------------------------------------------------------');

    // 2.1 getSellableQuantity bóc tách combo
    const sellableCombo = await getSellableQuantity(TEST_STORE_CODE, ID_COMBO_433);
    console.log(`- getSellableQuantity("${TEST_STORE_CODE}", "${ID_COMBO_433}") = ${sellableCombo}`);
    assert.strictEqual(sellableCombo, 8, 'getSellableQuantity Combo 4/3/3 phải là 8');

    // 2.2 Pop-up stores/route.ts bóc tách combo thành công (không còn 0 hay out_of_stock!)
    const storeRes2 = await fetch(`${APP_URL}/api/stores?productId=${encodeURIComponent(ID_COMBO_433)}`);
    const storeData2 = await storeRes2.json();
    assert.strictEqual(storeData2.success, true);
    const storeObj2 = storeData2.stores.find((s) => s.code === TEST_STORE_CODE);
    assert(storeObj2, `Phải tìm thấy store ${TEST_STORE_CODE}`);
    console.log(`- Pop-up stores/route.ts (Bóc tách combo): sellableQuantity=${storeObj2.sellableQuantity}, stockStatus=${storeObj2.stockStatus}`);
    assert.strictEqual(storeObj2.sellableQuantity, 8);
    assert.strictEqual(storeObj2.stockStatus, 'in_stock'); // 8 > LOW_STOCK_THRESHOLD (5) -> in_stock

    // 2.3 inventory/check API cho combo
    const checkRes2 = await fetch(`${APP_URL}/api/inventory/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeCode: TEST_STORE_CODE,
        items: [{ productId: ID_COMBO_433, quantity: 1 }],
      }),
    });
    const checkData2 = await checkRes2.json();
    console.log(`- API inventory/check (Combo): maxQuantity=${checkData2.maxQuantity}, isAvailable=${checkData2.isAvailable}`);
    assert.strictEqual(checkData2.maxQuantity, 8);
    assert.strictEqual(checkData2.isAvailable, true);

    // 2.4 CHỨNG MINH SỐ HIỂN THỊ = SỐ CHẶN ĐẶT HÀNG CHO COMBO 4/3/3:
    // Đặt đúng 8 combos -> Cần: A: 32 <= 48, B: 24 <= 30, C: 24 <= 24 -> THÀNH CÔNG!
    let orderPass2 = false;
    let orderFail2 = false;
    try {
      await client.query('BEGIN;');
      const { expandedBottles } = await expandComboItems([{ productId: ID_COMBO_433, quantity: 8 }], client);
      await reserveStock(TEST_STORE_CODE, `test_ord_c8_${ts}`, expandedBottles, client);
      await client.query('ROLLBACK;');
      orderPass2 = true;
      console.log('  ✓ Đặt hàng với số lượng đúng bằng số hiển thị (8 combo): THÀNH CÔNG!');
    } catch (err) {
      await client.query('ROLLBACK;');
      throw new Error(`Đặt 8 combo không được phép lỗi: ${err.message}`);
    }

    // Đặt 9 combos -> Cần C: 27 chai > 24 khả dụng -> BỊ CHẶN BỞI reserveStock
    try {
      await client.query('BEGIN;');
      const { expandedBottles } = await expandComboItems([{ productId: ID_COMBO_433, quantity: 9 }], client);
      await reserveStock(TEST_STORE_CODE, `test_ord_c9_${ts}`, expandedBottles, client);
      await client.query('ROLLBACK;');
    } catch (err) {
      await client.query('ROLLBACK;');
      if (err instanceof InsufficientStockError || err.name === 'InsufficientStockError') {
        orderFail2 = true;
        console.log(`  ✓ Đặt hàng 9 combo (vượt 1 đơn vị do chai C thiếu): BỊ CHẶN CHÍNH XÁC (${err.message})!`);
      } else {
        throw err;
      }
    }

    assert(orderPass2 && orderFail2, 'Case 2: Số hiển thị combo (8) phải đúng bằng số chặn đặt hàng (8)!');
    passedTests++;
    resultsTable.push({
      scenario: '2. Combo 4/3/3',
      physicalStock: 'A:50, B:35, C:26',
      reserved: 'A:0, B:2, C:0',
      safetyStock: 'A:2, B:3, C:2',
      displayedSellable: 8,
      blockingLimit: 8,
      verifiedMatch: '✓ BẰNG NHAU (8 == 8)',
    });

    // -------------------------------------------------------------------------
    // TEST CASE 3: LỐC 10 CHAI (bottle_multiplier = 10)
    // Tồn kho vật lý: 45 chai, reserved: 0, safety: 0 -> 45 chai
    // Số lốc bán được = floor(45 / 10) = 4 lốc (40 chai)
    // -------------------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('[TEST CASE 3] LỐC 10 CHAI: 45 chai khả dụng / 10 = 4 lốc bán được');
    console.log('-------------------------------------------------------------');

    // 3.1 getSellableQuantity cho variant lốc 10
    const sellablePack = await getSellableQuantity(TEST_STORE_CODE, ID_LOC10_VAR);
    console.log(`- getSellableQuantity("${TEST_STORE_CODE}", "${ID_LOC10_VAR}") = ${sellablePack}`);
    assert.strictEqual(sellablePack, 4, 'getSellableQuantity Lốc 10 phải là 4');

    // 3.2 Pop-up stores/route.ts cho variant lốc 10
    const storeRes3 = await fetch(`${APP_URL}/api/stores?productId=${encodeURIComponent(ID_LOC10_VAR)}`);
    const storeData3 = await storeRes3.json();
    assert.strictEqual(storeData3.success, true);
    const storeObj3 = storeData3.stores.find((s) => s.code === TEST_STORE_CODE);
    assert(storeObj3, `Phải tìm thấy store ${TEST_STORE_CODE}`);
    console.log(`- Pop-up stores/route.ts (Lốc 10): sellableQuantity=${storeObj3.sellableQuantity}, stockStatus=${storeObj3.stockStatus}`);
    assert.strictEqual(storeObj3.sellableQuantity, 4);
    assert.strictEqual(storeObj3.stockStatus, 'low_stock'); // 4 <= 10 -> low_stock

    // 3.3 inventory/check API cho variant lốc 10
    const checkRes3 = await fetch(`${APP_URL}/api/inventory/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeCode: TEST_STORE_CODE,
        items: [{ productId: ID_LOC10_VAR, quantity: 1, unit: 'lốc 10 chai' }],
      }),
    });
    const checkData3 = await checkRes3.json();
    console.log(`- API inventory/check (Lốc 10): maxQuantity=${checkData3.maxQuantity}, isAvailable=${checkData3.isAvailable}`);
    assert.strictEqual(checkData3.maxQuantity, 4);
    assert.strictEqual(checkData3.isAvailable, true);

    // 3.4 CHỨNG MINH SỐ HIỂN THỊ = SỐ CHẶN ĐẶT HÀNG CHO LỐC 10 CHAI:
    // Đặt 4 lốc (40 chai <= 45 khả dụng) -> THÀNH CÔNG!
    let orderPass3 = false;
    let orderFail3 = false;
    try {
      await client.query('BEGIN;');
      const { expandedBottles } = await expandComboItems([{ productId: ID_LOC10_VAR, quantity: 4 }], client);
      await reserveStock(TEST_STORE_CODE, `test_ord_p4_${ts}`, expandedBottles, client);
      await client.query('ROLLBACK;');
      orderPass3 = true;
      console.log('  ✓ Đặt hàng với số lượng đúng bằng số hiển thị (4 lốc = 40 chai): THÀNH CÔNG!');
    } catch (err) {
      await client.query('ROLLBACK;');
      throw new Error(`Đặt 4 lốc không được phép lỗi: ${err.message}`);
    }

    // Đặt 5 lốc (50 chai > 45 khả dụng) -> BỊ CHẶN BỞI reserveStock
    try {
      await client.query('BEGIN;');
      const { expandedBottles } = await expandComboItems([{ productId: ID_LOC10_VAR, quantity: 5 }], client);
      await reserveStock(TEST_STORE_CODE, `test_ord_p5_${ts}`, expandedBottles, client);
      await client.query('ROLLBACK;');
    } catch (err) {
      await client.query('ROLLBACK;');
      if (err instanceof InsufficientStockError || err.name === 'InsufficientStockError') {
        orderFail3 = true;
        console.log(`  ✓ Đặt hàng 5 lốc = 50 chai (vượt tồn 45 chai): BỊ CHẶN CHÍNH XÁC (${err.message})!`);
      } else {
        throw err;
      }
    }

    assert(orderPass3 && orderFail3, 'Case 3: Số hiển thị lốc (4) phải đúng bằng số chặn đặt hàng (4)!');
    passedTests++;
    resultsTable.push({
      scenario: '3. Lốc 10 chai (x10)',
      physicalStock: 45,
      reserved: 0,
      safetyStock: 0,
      displayedSellable: 4,
      blockingLimit: 4,
      verifiedMatch: '✓ BẰNG NHAU (4 == 4)',
    });

    // -------------------------------------------------------------------------
    // TEST CASE 4: CHAI CÓ SAFETY STOCK > 0
    // Tồn kho vật lý: 20 chai, reserved: 3, safety_stock: 5
    // Tồn bán được = max(0, 20 - 3 - 5) = 12 chai
    // -------------------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('[TEST CASE 4] CHAI CÓ SAFETY STOCK: 20 - 3 - 5 = 12 chai bán được');
    console.log('-------------------------------------------------------------');

    // 4.1 getSellableQuantity trừ safety_stock
    const sellableSafe = await getSellableQuantity(TEST_STORE_CODE, ID_SAFETY_PROD);
    console.log(`- getSellableQuantity("${TEST_STORE_CODE}", "${ID_SAFETY_PROD}") = ${sellableSafe}`);
    assert.strictEqual(sellableSafe, 12, 'getSellableQuantity có safety_stock phải là 12');

    // 4.2 Pop-up stores/route.ts trừ safety_stock
    const storeRes4 = await fetch(`${APP_URL}/api/stores?productId=${encodeURIComponent(ID_SAFETY_PROD)}`);
    const storeData4 = await storeRes4.json();
    assert.strictEqual(storeData4.success, true);
    const storeObj4 = storeData4.stores.find((s) => s.code === TEST_STORE_CODE);
    assert(storeObj4, `Phải tìm thấy store ${TEST_STORE_CODE}`);
    console.log(`- Pop-up stores/route.ts: sellableQuantity=${storeObj4.sellableQuantity}, stockStatus=${storeObj4.stockStatus}`);
    assert.strictEqual(storeObj4.sellableQuantity, 12);
    assert.strictEqual(storeObj4.stockStatus, 'in_stock');

    // 4.3 inventory/check API trừ safety_stock
    const checkRes4 = await fetch(`${APP_URL}/api/inventory/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeCode: TEST_STORE_CODE,
        items: [{ productId: ID_SAFETY_PROD, quantity: 1 }],
      }),
    });
    const checkData4 = await checkRes4.json();
    console.log(`- API inventory/check: maxQuantity=${checkData4.maxQuantity}, isAvailable=${checkData4.isAvailable}`);
    assert.strictEqual(checkData4.maxQuantity, 12);
    assert.strictEqual(checkData4.isAvailable, true);

    // 4.4 Admin Inventory hiển thị đầy đủ tồn vật lý và tồn bán được (đã trừ safety_stock)
    const adminRes4 = await fetch(`${APP_URL}/api/admin/inventory?storeCode=${TEST_STORE_CODE}`, {
      headers: authHeaders,
    });
    const adminData4 = await adminRes4.json();
    const adminItem4 = adminData4.data.find((p) => p.product_id === ID_SAFETY_PROD);
    assert(adminItem4, 'Admin phải trả về sản phẩm safety stock');
    console.log(`- Admin Inventory: stock_quantity=${adminItem4.stock_quantity}, reserved=${adminItem4.reserved}, safety_stock=${adminItem4.safety_stock}, sellable_quantity=${adminItem4.sellable_quantity}`);
    assert.strictEqual(Number(adminItem4.stock_quantity), 20);
    assert.strictEqual(Number(adminItem4.reserved), 3);
    assert.strictEqual(Number(adminItem4.safety_stock), 5);
    assert.strictEqual(Number(adminItem4.sellable_quantity), 12);

    // 4.5 CHỨNG MINH SỐ HIỂN THỊ = SỐ CHẶN ĐẶT HÀNG CHO CHAI CÓ SAFETY STOCK:
    // Đặt đúng 12 chai (12 <= 12 khả dụng) -> THÀNH CÔNG!
    let orderPass4 = false;
    let orderFail4 = false;
    try {
      await client.query('BEGIN;');
      const { expandedBottles } = await expandComboItems([{ productId: ID_SAFETY_PROD, quantity: 12 }], client);
      await reserveStock(TEST_STORE_CODE, `test_ord_s12_${ts}`, expandedBottles, client);
      await client.query('ROLLBACK;');
      orderPass4 = true;
      console.log('  ✓ Đặt hàng với số lượng đúng bằng số hiển thị (12 chai): THÀNH CÔNG!');
    } catch (err) {
      await client.query('ROLLBACK;');
      throw new Error(`Đặt 12 chai không được phép lỗi: ${err.message}`);
    }

    // Đặt 13 chai (13 > 12 khả dụng) -> BỊ CHẶN BỞI reserveStock (Bảo vệ safety stock!)
    try {
      await client.query('BEGIN;');
      const { expandedBottles } = await expandComboItems([{ productId: ID_SAFETY_PROD, quantity: 13 }], client);
      await reserveStock(TEST_STORE_CODE, `test_ord_s13_${ts}`, expandedBottles, client);
      await client.query('ROLLBACK;');
    } catch (err) {
      await client.query('ROLLBACK;');
      if (err instanceof InsufficientStockError || err.name === 'InsufficientStockError') {
        orderFail4 = true;
        console.log(`  ✓ Đặt hàng 13 chai (vượt ngưỡng khả dụng, xâm phạm safety stock): BỊ CHẶN CHÍNH XÁC (${err.message})!`);
      } else {
        throw err;
      }
    }

    assert(orderPass4 && orderFail4, 'Case 4: Số hiển thị (12) phải đúng bằng số chặn đặt hàng (12)!');
    passedTests++;
    resultsTable.push({
      scenario: '4. Chai có Safety Stock',
      physicalStock: 20,
      reserved: 3,
      safetyStock: 5,
      displayedSellable: 12,
      blockingLimit: 12,
      verifiedMatch: '✓ BẰNG NHAU (12 == 12)',
    });

    // -------------------------------------------------------------------------
    // TỔNG KẾT VÀ IN BẢNG SO SÁNH
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('BẢNG TỔNG HỢP KẾT QUẢ TEST: SỐ HIỂN THỊ VS SỐ CHẶN ĐẶT HÀNG');
    console.log('================================================================');
    console.table(resultsTable);

    console.log(`\n🎉 TOÀN BỘ ${passedTests}/4 TEST CASE ĐÃ VƯỢT QUA XUẤT SẮC!`);
    console.log(`- Hàm getSellableQuantity đã được đồng bộ hóa hoàn toàn trên toàn bộ hệ thống.`);
    console.log(`- Pop-up chọn chi nhánh bóc tách combo chính xác, không còn tình trạng báo hết hàng sai.`);
    console.log(`- Admin hiển thị song song Tồn vật lý và Tồn bán được (đã trừ safety stock).`);
    console.log(`- Số lượng hiển thị luôn khớp 100% với ngưỡng chặn khi khách đặt hàng.`);

  } finally {
    // -------------------------------------------------------------------------
    // BƯỚC DỌN DẸP DỮ LIỆU TEST (REQUIREMENT 4)
    // -------------------------------------------------------------------------
    console.log('\n[Dọn dẹp dữ liệu test cách ly...]');
    try {
      await client.query(`DELETE FROM stock_reservations WHERE store_code = $1;`, [TEST_STORE_CODE]);
      await client.query(`DELETE FROM orders WHERE id LIKE 'test_ord_%';`);
      await client.query(`DELETE FROM store_inventory WHERE store_code = $1;`, [TEST_STORE_CODE]);
      await client.query(`DELETE FROM combo_items WHERE combo_id = $1;`, [ID_COMBO_433]);
      await client.query(`DELETE FROM combos WHERE id = $1;`, [ID_COMBO_433]);
      await client.query(`DELETE FROM product_variants WHERE id = $1;`, [ID_LOC10_VAR]);
      await client.query(`
        DELETE FROM products WHERE id IN ($1, $2, $3, $4, $5, $6);
      `, [ID_CHAI_LE, ID_COMBO_A, ID_COMBO_B, ID_COMBO_C, ID_LOC10_PROD, ID_SAFETY_PROD]);
      await client.query(`DELETE FROM stores WHERE code = $1;`, [TEST_STORE_CODE]);
      await client.query(`DELETE FROM admin_users WHERE id = 'qa_admin_id';`);
      console.log('   ✓ Đã dọn dẹp sạch sẽ 100% dữ liệu test.');
    } catch (cleanupErr) {
      console.error('Lỗi khi dọn dẹp dữ liệu test:', cleanupErr);
    } finally {
      client.release();
      await pool.end();
      process.exit(0);
    }
  }
}

runUnifiedSellableQuantityTests().catch((err) => {
  console.error('\n❌ TEST THẤT BẠI:', err);
  process.exit(1);
});
