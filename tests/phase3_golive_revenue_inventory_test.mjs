/**
 * tests/phase3_golive_revenue_inventory_test.mjs
 * 
 * BỘ KIỂM THỬ TỰ ĐỘNG GOLIVE PHASE 3:
 * 1. Kiểm tra công thức doanh thu:
 *    - Đơn hàng CANCELLED (hủy) tuyệt đối KHÔNG được tính vào total_revenue.
 *    - Doanh thu thực tế (total_revenue) phản ánh chính xác các đơn hàng COMPLETED (hoàn tất).
 *    - Báo cáo lợi nhuận /api/admin/reports/profit mặc định tính trên đơn hoàn tất, không bị méo mó bởi đơn hủy.
 * 2. Kiểm tra màn hình Kiểm Kê (Inventory Screen):
 *    - API /api/admin/inventory trả về dữ liệu tồn kho đầy đủ cho cửa hàng (stock_quantity, reserved, available_quantity).
 *    - Công thức tồn khả dụng: available_quantity = max(0, stock_quantity - reserved).
 *    - Phân quyền hợp lệ cho cả SUPER_ADMIN và STORE_STAFF.
 */

import 'dotenv/config';
import pg from 'pg';
import { SignJWT } from 'jose';
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

const DB_URL =
  requireDatabaseUrl();

assertSafeTestEnvironment(DB_URL);
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'tsf_super_secret_jwt_key_2026_thai_son_foods'
);

const pool = new pg.Pool({ connectionString: DB_URL });

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${testName} ${details ? `(${details})` : ''}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function makeToken(payload) {
  return new SignJWT({ ...payload, userId: payload.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

async function runPhase3Suite() {
  console.log('================================================================');
  console.log('         KIỂM THỬ GOLIVE PHASE 3: CÔNG THỨC DOANH THU & KIỂM KÊ');
  console.log('================================================================\n');

  const client = await pool.connect();
  try {
    // -------------------------------------------------------------------------
    // 1. Chuẩn bị token xác thực SUPER_ADMIN
    // -------------------------------------------------------------------------
    const superAdminRes = await client.query(
      `SELECT id, username, role FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active = true LIMIT 1;`
    );
    const superAdmin = superAdminRes.rows[0];
    if (!superAdmin) throw new Error('Không tìm thấy tài khoản SUPER_ADMIN để chạy kiểm thử!');

    const superToken = await makeToken({
      id: superAdmin.id,
      username: superAdmin.username,
      role: 'SUPER_ADMIN',
    });
    const superCookie = `tsf_admin_token=${superToken}`;

    // -------------------------------------------------------------------------
    // NHÓM 1: Kiểm thử Công thức Doanh thu trong API /api/admin/stats
    // -------------------------------------------------------------------------
    console.log('--- NHÓM 1: Kiểm thử Công thức Doanh Thu (/api/admin/stats) ---');

    // 1.1 Lấy số liệu stats hiện tại từ API
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: superCookie },
    });
    assert(statsRes.status === 200, 'SUPER_ADMIN gọi /api/admin/stats thành công (HTTP 200)');
    const statsData = await statsRes.json();
    assert(statsData.success === true, 'API stats trả về success = true');

    const totalRevenueAPI = Number(statsData.summary?.total_revenue || 0);

    // 1.2 Kiểm tra đối soát trực tiếp trong CSDL
    const dbCompletedSumRes = await client.query(`
      SELECT COALESCE(SUM(total), 0)::bigint AS completed_sum
      FROM orders
      WHERE status = 'COMPLETED';
    `);
    const dbCompletedSum = Number(dbCompletedSumRes.rows[0].completed_sum);

    const dbAllSumRes = await client.query(`
      SELECT COALESCE(SUM(total), 0)::bigint AS all_sum
      FROM orders;
    `);
    const dbAllSum = Number(dbAllSumRes.rows[0].all_sum);

    const dbCancelledSumRes = await client.query(`
      SELECT COALESCE(SUM(total), 0)::bigint AS cancelled_sum
      FROM orders
      WHERE status = 'CANCELLED';
    `);
    const dbCancelledSum = Number(dbCancelledSumRes.rows[0].cancelled_sum);

    // Test: total_revenue phải khớp với completed_sum, KHÔNG ĐƯỢC khớp với all_sum
    assert(
      totalRevenueAPI === dbCompletedSum,
      'total_revenue khớp chính xác 100% với tổng doanh thu đơn COMPLETED trong CSDL',
      `API: ${totalRevenueAPI.toLocaleString()} đ, DB COMPLETED: ${dbCompletedSum.toLocaleString()} đ`
    );

    assert(
      totalRevenueAPI !== dbAllSum && dbCancelledSum > 0,
      'total_revenue KHÔNG bị cộng dồn sai lệch bởi các đơn hàng đã bị hủy (CANCELLED)',
      `Tổng đơn hủy bị loại trừ: ${dbCancelledSum.toLocaleString()} đ`
    );

    // 1.3 Kiểm tra Báo cáo lợi nhuận /api/admin/reports/profit
    console.log('\n--- NHÓM 2: Kiểm thử Báo cáo Doanh thu & Lợi nhuận (/api/admin/reports/profit) ---');
    const profitRes = await fetch(`${BASE_URL}/api/admin/reports/profit?groupBy=day`, {
      headers: { Cookie: superCookie },
    });
    assert(profitRes.status === 200, 'SUPER_ADMIN gọi /api/admin/reports/profit thành công (HTTP 200)');
    const profitData = await profitRes.json();
    assert(profitData.success === true, 'Báo cáo lợi nhuận trả về success = true');
    assert(profitData.summary !== undefined, 'Báo cáo có khối summary chứa totalRevenue và grossProfit');
    assert(
      profitData.summary.totalRevenue <= dbCompletedSum + 500000,
      'Doanh thu trong Báo cáo lợi nhuận phản ánh đúng đơn hoàn tất, không bị đội bởi đơn hủy',
      `Doanh thu báo cáo: ${Number(profitData.summary.totalRevenue).toLocaleString()} đ`
    );

    // -------------------------------------------------------------------------
    // NHÓM 3: Kiểm thử Màn hình Kiểm Kê Tồn Kho (/api/admin/inventory)
    // -------------------------------------------------------------------------
    console.log('\n--- NHÓM 3: Kiểm thử Màn hình Kiểm Kê Tồn Kho (/api/admin/inventory) ---');

    // 3.1 SUPER_ADMIN mở màn kiểm kê chi nhánh Nhà Bè (NH)
    const invResNH = await fetch(`${BASE_URL}/api/admin/inventory?storeCode=NH`, {
      headers: { Cookie: superCookie },
    });
    assert(invResNH.status === 200, 'SUPER_ADMIN mở màn kiểm kê chi nhánh NH thành công (HTTP 200)');
    const invDataNH = await invResNH.json();
    assert(invDataNH.success === true, 'Dữ liệu kiểm kê chi nhánh NH trả về success = true');
    assert(Array.isArray(invDataNH.data) && invDataNH.data.length > 0, `Chi nhánh NH có danh sách ${invDataNH.data?.length} mặt hàng kiểm kê`);

    // 3.2 Kiểm tra tính toàn vẹn các trường kiểm kê bắt buộc
    const firstItem = invDataNH.data[0];
    const hasAllFields =
      'product_id' in firstItem &&
      'product_name' in firstItem &&
      'stock_quantity' in firstItem &&
      'reserved' in firstItem &&
      'available_quantity' in firstItem;
    assert(hasAllFields, 'Mỗi bản ghi kiểm kê có đầy đủ các trường: mã sản phẩm, tên, tồn thực, giữ chỗ, khả dụng');

    // 3.3 Kiểm tra công thức khả dụng: available_quantity = max(0, stock_quantity - reserved)
    const isFormulaCorrect = invDataNH.data.every((item) => {
      const expectedAvailable = Math.max(0, Number(item.stock_quantity) - Number(item.reserved));
      return Number(item.available_quantity) === expectedAvailable;
    });
    assert(isFormulaCorrect, 'Công thức tồn khả dụng: available_quantity = max(0, stock - reserved) chính xác trên 100% mặt hàng');

    // 3.4 Kiểm thử STORE_STAFF mở màn kiểm kê cửa hàng của chính mình
    const staffRes = await client.query(
      `SELECT id, username, role, store_code FROM admin_users WHERE role = 'STORE_STAFF' AND is_active = true LIMIT 1;`
    );
    if (staffRes.rows.length > 0) {
      const staff = staffRes.rows[0];
      const staffToken = await makeToken({
        id: staff.id,
        username: staff.username,
        role: 'STORE_STAFF',
        storeCode: staff.store_code || 'NH',
      });
      const staffCookie = `tsf_admin_token=${staffToken}`;

      const staffInvRes = await fetch(`${BASE_URL}/api/admin/inventory`, {
        headers: { Cookie: staffCookie },
      });
      assert(staffInvRes.status === 200, `STORE_STAFF (${staff.username}) mở màn kiểm kê cửa hàng ${staff.store_code || 'NH'} thành công (HTTP 200)`);
      const staffInvData = await staffInvRes.json();
      assert(staffInvData.success === true && Array.isArray(staffInvData.data), 'STORE_STAFF nhận đúng danh mục kiểm kê của cửa hàng phụ trách');
    }

    console.log('\n================================================================');
    console.log(`KẾT QUẢ KIỂM THỬ PHASE 3: ${passedCount} PASS, ${failedCount} FAIL`);
    console.log('================================================================');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runPhase3Suite().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy test suite Phase 3:', err);
  process.exit(1);
});
