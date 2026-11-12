import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from '../scripts/db-guard.mjs';

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

const { Pool } = pg;
const BASE_URL = 'http://localhost:3000';
const DB_URL =
  requireDatabaseUrl();

const pool = new Pool({ connectionString: DB_URL });

async function queryDb(sql, params = []) {
  return pool.query(sql, params);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU TEST PHASE 5: INVENTORY LOTS & FEFO ALLOCATION');
  console.log('====================================================\n');

  const runId = Date.now().toString().slice(-4);

  try {
    // -----------------------------------------------------------------
    // 1. SETUP: CHỌN SẢN PHẨM & TẠO CÁC LÔ DATE KHÁC NHAU
    // -----------------------------------------------------------------
    console.log('--- 1. Tạo các lô hàng với hạn sử dụng khác nhau ---');
    const pRes = await queryDb(`SELECT id, name FROM products LIMIT 1;`);
    const prod = pRes.rows[0];
    const storeCode = 'NH';

    // Dọn dẹp các lot cũ của product này tại kho NH
    await queryDb(`DELETE FROM inventory_lots WHERE store_code = $1 AND product_id = $2;`, [storeCode, prod.id]);

    const { createOrUpdateInventoryLot, allocateLotsFEFO } = await import('../src/lib/partner/fefo.js');

    // Lot 1: Cận date nhất (Hết hạn sau 2 ngày) - 30 chai
    const lot1Res = await createOrUpdateInventoryLot({
      storeCode,
      productId: prod.id,
      lotCode: `LOT-P5-NEAR-${runId}`,
      manufacturingDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      quantity: 30,
    });

    // Lot 2: Date xa hơn (Hết hạn sau 14 ngày) - 50 chai
    const lot2Res = await createOrUpdateInventoryLot({
      storeCode,
      productId: prod.id,
      lotCode: `LOT-P5-FAR-${runId}`,
      manufacturingDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      quantity: 50,
    });

    // Lot 3: ĐÃ HẾT HẠN (Hết hạn 2 ngày trước) - 20 chai
    const lot3Res = await createOrUpdateInventoryLot({
      storeCode,
      productId: prod.id,
      lotCode: `LOT-P5-EXPIRED-${runId}`,
      manufacturingDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
      expiryDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
      quantity: 20,
    });

    assert(Boolean(lot1Res.id && lot2Res.id && lot3Res.id), 'Tạo 3 lô hàng date khác nhau thành công');

    // -----------------------------------------------------------------
    // 2. PHÂN BỔ FEFO: ƯU TIÊN LÔ DATE GẦN NHẤT TRƯỚC
    // -----------------------------------------------------------------
    console.log('\n--- 2. Kiểm tra Phân bổ FEFO (Yêu cầu 45 chai) ---');
    // Cần 45 chai:
    // Sẽ phải lấy hết 30 chai của Lot 1 (hạn 2 ngày)
    // Và lấy thêm 15 chai của Lot 2 (hạn 14 ngày)
    // Tuyệt đối không lấy Lot 3 đã hết hạn!
    const allocResult = await allocateLotsFEFO(storeCode, prod.id, 45);

    assert(allocResult.success === true, 'Phân bổ FEFO thành công');
    assert(allocResult.totalAllocated === 45, 'Tổng số lượng phân bổ đủ 45 chai');
    assert(allocResult.allocations.length === 2, 'Phân bổ trải dài trên đúng 2 lô hợp lệ');

    // Kiểm tra lô thứ nhất được lấy là Lot 1 (cận date hơn)
    const firstAlloc = allocResult.allocations[0];
    assert(firstAlloc.lotCode === `LOT-P5-NEAR-${runId}`, 'Lô đầu tiên được xuất là Lô cận date (Lot 1)');
    assert(firstAlloc.allocatedQuantity === 30, 'Lô 1 xuất tối đa khả dụng: 30 chai');

    // Kiểm tra lô thứ hai được lấy là Lot 2
    const secondAlloc = allocResult.allocations[1];
    assert(secondAlloc.lotCode === `LOT-P5-FAR-${runId}`, 'Lô tiếp theo được xuất là Lô date xa hơn (Lot 2)');
    assert(secondAlloc.allocatedQuantity === 15, 'Lô 2 xuất phần còn thiếu: 15 chai');

    // Kiểm tra Lot 3 đã hết hạn không xuất hiện trong allocations
    const hasExpired = allocResult.allocations.some(a => a.lotCode === `LOT-P5-EXPIRED-${runId}`);
    assert(!hasExpired, 'Lô đã hết hạn không bao giờ được phân bổ xuất kho');

    // -----------------------------------------------------------------
    // 3. KIỂM TRA BẢO LƯU RESERVED TRÊN DATABASE
    // -----------------------------------------------------------------
    console.log('\n--- 3. Kiểm tra CSDL cập nhật reserved_quantity trên lô ---');
    const lotDbCheck = await queryDb(
      `SELECT lot_code, stock_quantity, reserved_quantity FROM inventory_lots WHERE store_code = $1 AND product_id = $2 ORDER BY expiry_date ASC;`,
      [storeCode, prod.id]
    );

    const checkNear = lotDbCheck.rows.find(r => r.lot_code === `LOT-P5-NEAR-${runId}`);
    assert(checkNear.reserved_quantity === 30, 'Lô 1 đã được giữ chỗ 30 chai');

    const checkFar = lotDbCheck.rows.find(r => r.lot_code === `LOT-P5-FAR-${runId}`);
    assert(checkFar.reserved_quantity === 15, 'Lô 2 đã được giữ chỗ 15 chai');

    // -----------------------------------------------------------------
    // 4. KIỂM TRA TỪ CHỐI KHI YÊU CẦU VƯỢT QUÁ TỒN KHẢ DỤNG HỢP LỆ
    // -----------------------------------------------------------------
    console.log('\n--- 4. Kiểm tra Từ chối khi vượt quá tồn kho khả dụng FEFO ---');
    // Hiện tại Lot 1 còn 0 chai khả dụng, Lot 2 còn 35 chai khả dụng (50 - 15).
    // Nếu yêu cầu 40 chai -> Bị từ chối (thiếu hàng còn hạn)!
    const failAlloc = await allocateLotsFEFO(storeCode, prod.id, 40);
    assert(failAlloc.success === false, 'Từ chối phân bổ khi không đủ hàng còn date');
    assert(failAlloc.totalAllocated === 35, 'Báo đúng tổng số khả dụng chỉ còn 35 chai');

    // -----------------------------------------------------------------
    // 5. KIỂM TRA API ADMIN LOTS (/api/admin/inventory/lots)
    // -----------------------------------------------------------------
    console.log('\n--- 5. Kiểm tra API Quản trị Lô hàng (/api/admin/inventory/lots) ---');
    const adminLogin = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ identifier: 'admin', password: 'Admin@123' }),
    });
    const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';

    const lotsApiRes = await fetch(`${BASE_URL}/api/admin/inventory/lots?storeCode=${storeCode}&productId=${prod.id}`, {
      headers: {
        Cookie: adminCookie,
        Origin: BASE_URL,
      },
    });
    const lotsApiData = await lotsApiRes.json();
    assert(lotsApiRes.status === 200, 'Lấy danh sách lô hàng qua API thành công');
    assert(lotsApiData.lots.length === 3, 'Trả về đủ 3 lô hàng');

    const apiNear = lotsApiData.lots.find(l => l.lot_code === `LOT-P5-NEAR-${runId}`);
    assert(apiNear.expiryStatus === 'CRITICAL', 'Lô 2 ngày được phân loại là CRITICAL');

    const apiExpired = lotsApiData.lots.find(l => l.lot_code === `LOT-P5-EXPIRED-${runId}`);
    assert(apiExpired.expiryStatus === 'EXPIRED', 'Lô quá hạn được phân loại là EXPIRED');

    console.log('\n====================================================');
    console.log(`🎉 HOÀN THÀNH TEST SUITE PHASE 5: ${passed} PASS, ${failed} FAIL`);
    console.log('====================================================');
  } catch (err) {
    console.error('❌ LỖI TRONG TEST RUNNER PHASE 5:', err);
    failed++;
  } finally {
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhase5Tests();
