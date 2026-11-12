/**
 * TEST BẮT BUỘC NHẬP HỆ SỐ CHAI (bottle_multiplier > 0) KHI TẠO / SỬA BIẾN THỂ TRONG ADMIN
 * Mục tiêu Requirement 3:
 * 1. Form / API admin từ chối (400) khi biến thể thiếu bottle_multiplier hoặc bottle_multiplier <= 0.
 * 2. Form / API admin chấp nhận (200) khi biến thể có bottle_multiplier > 0 hợp lệ và lưu chính xác vào DB.
 * 3. GET /api/admin/products trả về đầy đủ bottle_multiplier trong mảng variants.
 * 4. Tuân thủ Requirement 4: Chỉ chạy trên dev/test localhost, tự dọn dẹp dữ liệu test.
 */

import assert from 'node:assert';
import pg from 'pg';
import { assertSafeTestEnvironment } from './helpers/safe_test_env.mjs';
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

// 1. Kiểm tra môi trường an toàn (Requirement 4)
assertSafeTestEnvironment();

const connectionString =
  requireDatabaseUrl();

const pool = new pg.Pool({ connectionString });
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const PRODUCTS_API = `${APP_URL}/api/admin/products`;

async function runVariantMultiplierTest() {
  console.log('================================================================');
  console.log('TEST BẮT BUỘC bottle_multiplier > 0 KHI TẠO / SỬA BIẾN THỂ ADMIN');
  console.log('================================================================');

  const client = await pool.connect();
  const testProdId = `test_prod_var_${Date.now()}`;
  const testProdSlug = `test-prod-var-${Date.now()}`;
  let createdProdId = null;
  let passedCount = 0;

  try {
    // Tạo Admin token với quyền SUPER_ADMIN
    const adminToken = await signAdminToken({
      id: 'qa_admin_super_id',
      userId: 'qa_admin_super_id',
      username: 'qa_super_admin',
      email: 'qa_super@example.com',
      role: 'SUPER_ADMIN',
    });

    const authHeaders = {
      'Content-Type': 'application/json',
      Cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      Host: 'localhost:3000',
      Origin: 'http://localhost:3000',
    };

    // -------------------------------------------------------------
    // TEST 1: POST TẠO BIẾN THỂ THIẾU HỆ SỐ CHAI -> BỊ TỪ CHỐI 400
    // -------------------------------------------------------------
    console.log('\n[Test 1] POST tạo sản phẩm với biến thể thiếu bottle_multiplier (hoặc = 0)...');
    const invalidPayload = {
      id: testProdId,
      slug: testProdSlug,
      name: 'Sản phẩm Test Thiếu Hệ Số',
      price: 100000,
      unit: '1 chai',
      thumbnail: '/images/products/sua-bap-nep.png',
      variants: [
        {
          name: 'Lốc không hệ số',
          quantity: 6,
          price: 90000,
          unit: 'lốc',
          // Cố tình bỏ qua bottle_multiplier hoặc để 0
          bottle_multiplier: 0,
        },
      ],
    };

    const res1 = await fetch(PRODUCTS_API, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(invalidPayload),
    });

    console.log(`   -> HTTP Status: ${res1.status} (Kỳ vọng: 400)`);
    assert.strictEqual(res1.status, 400, 'POST sản phẩm với biến thể thiếu hệ số PHẢI trả về HTTP 400');

    const data1 = await res1.json();
    console.log(`   -> Response JSON:`, JSON.stringify(data1));
    assert.strictEqual(data1.success, false);
    assert(
      data1.error && data1.error.includes('bắt buộc nhập hệ số quy đổi số chai'),
      'Thông báo lỗi PHẢI nêu rõ bắt buộc nhập hệ số quy đổi số chai'
    );
    console.log('   ✓ Test 1 ĐẠT: API chặn thành công biến thể thiếu/sai hệ số chai.');
    passedCount++;

    // -------------------------------------------------------------
    // TEST 2: POST TẠO BIẾN THỂ CÓ HỆ SỐ HỢP LỆ (bottle_multiplier = 6) -> 200 OK
    // -------------------------------------------------------------
    console.log('\n[Test 2] POST tạo sản phẩm với biến thể có bottle_multiplier = 6 hợp lệ...');
    const validPayload = {
      id: testProdId,
      slug: testProdSlug,
      name: 'Sản phẩm Test Có Hệ Số Chuẩn',
      price: 100000,
      unit: '1 chai',
      thumbnail: '/images/products/sua-bap-nep.png',
      variants: [
        {
          name: 'Lốc 6 chai',
          quantity: 6,
          price: 90000,
          unit: 'lốc',
          bottle_multiplier: 6,
        },
      ],
    };

    const res2 = await fetch(PRODUCTS_API, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(validPayload),
    });

    console.log(`   -> HTTP Status: ${res2.status} (Kỳ vọng: 200)`);
    assert.strictEqual(res2.status, 200, 'POST sản phẩm với biến thể hợp lệ PHẢI thành công 200');

    const data2 = await res2.json();
    assert.strictEqual(data2.success, true);
    createdProdId = data2.data?.id;
    assert(createdProdId, 'API phải trả về id sản phẩm đã tạo');
    console.log(`   -> Created Product ID: ${createdProdId}`);
    console.log('   ✓ Test 2 ĐẠT: Tạo biến thể thành công với HTTP 200.');
    passedCount++;

    // Kiểm tra trực tiếp trong DB
    const dbVar = await client.query(
      `SELECT name, quantity, unit, bottle_multiplier FROM product_variants WHERE product_id = $1;`,
      [createdProdId]
    );
    console.log(`   -> Bản ghi trong DB product_variants:`, JSON.stringify(dbVar.rows[0]));
    assert.strictEqual(dbVar.rows.length, 1);
    assert.strictEqual(dbVar.rows[0].bottle_multiplier, 6, 'Cột bottle_multiplier trong DB phải là 6');
    console.log('   ✓ Dữ liệu DB chính xác: bottle_multiplier = 6.');

    // -------------------------------------------------------------
    // TEST 3: GET /api/admin/products TRẢ VỀ ĐẦY ĐỦ bottle_multiplier
    // -------------------------------------------------------------
    console.log('\n[Test 3] GET /api/admin/products kiểm tra trường bottle_multiplier trong variants...');
    const res3 = await fetch(`${PRODUCTS_API}?q=${encodeURIComponent(data2.data.name)}`, {
      method: 'GET',
      headers: authHeaders,
    });

    assert.strictEqual(res3.status, 200);
    const data3 = await res3.json();
    const foundProd = (data3.data || []).find((p) => p.id === createdProdId);
    assert(foundProd, 'Phải tìm thấy sản phẩm vừa tạo qua GET API');
    console.log(`   -> Variants trả về từ GET API:`, JSON.stringify(foundProd.variants));
    assert(foundProd.variants && foundProd.variants.length > 0);
    assert.strictEqual(foundProd.variants[0].bottle_multiplier, 6);
    assert.strictEqual(foundProd.variants[0].bottleMultiplier, 6);
    console.log('   ✓ Test 3 ĐẠT: GET API trả về đầy đủ bottle_multiplier & bottleMultiplier.');
    passedCount++;

    // -------------------------------------------------------------
    // TEST 4: PUT SỬA BIẾN THỂ VỚI HỆ SỐ MỚI (bottle_multiplier = 12) -> 200 OK
    // -------------------------------------------------------------
    console.log('\n[Test 4] PUT cập nhật biến thể với hệ số mới bottle_multiplier = 12...');
    const updatePayload = {
      ...validPayload,
      id: createdProdId,
      name: 'Sản phẩm Test Đã Cập Nhật',
      variants: [
        {
          name: 'Thùng 12 chai',
          quantity: 12,
          price: 180000,
          unit: 'thùng',
          bottle_multiplier: 12,
        },
      ],
    };

    const res4 = await fetch(PRODUCTS_API, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updatePayload),
    });

    assert.strictEqual(res4.status, 200);
    const dbVarUpdate = await client.query(
      `SELECT name, quantity, unit, bottle_multiplier FROM product_variants WHERE product_id = $1;`,
      [createdProdId]
    );
    console.log(`   -> Bản ghi sau khi PUT trong DB:`, JSON.stringify(dbVarUpdate.rows[0]));
    assert.strictEqual(dbVarUpdate.rows[0].bottle_multiplier, 12);
    console.log('   ✓ Test 4 ĐẠT: PUT cập nhật thành công bottle_multiplier = 12 trong DB.');
    passedCount++;

    console.log('\n================================================================');
    console.log(`✓ HOÀN THÀNH TOÀN BỘ ${passedCount}/4 TEST BIẾN THỂ BẮT BUỘC bottle_multiplier`);
    console.log('  1. Chặn biến thể thiếu hoặc hệ số <= 0 (400 Bad Request): PASS');
    console.log('  2. Lưu chính xác bottle_multiplier khi tạo mới (200 OK): PASS');
    console.log('  3. GET API trả về bottle_multiplier trong variants: PASS');
    console.log('  4. PUT cập nhật chính xác bottle_multiplier (200 OK): PASS');
    console.log('================================================================\n');
  } catch (err) {
    console.error('LỖI TEST VARIANT MULTIPLIER:', err);
    throw err;
  } finally {
    // [Requirement 4 Self-Cleanup]
    try {
      console.log('[Cleanup] Dọn dẹp sản phẩm test trong database...');
      const idsToClean = [testProdId, createdProdId].filter(Boolean);
      for (const pId of idsToClean) {
        await client.query(`DELETE FROM product_variants WHERE product_id = $1;`, [pId]);
        await client.query(`DELETE FROM products WHERE id = $1;`, [pId]);
      }
      await client.query(`DELETE FROM products WHERE slug = $1;`, [testProdSlug]);
      console.log('   ✓ Đã dọn dẹp sạch toàn bộ dữ liệu test.');
    } catch (cleanupErr) {
      console.error('Lỗi cleanup:', cleanupErr);
    }
    client.release();
    await pool.end();
  }
}

runVariantMultiplierTest().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
