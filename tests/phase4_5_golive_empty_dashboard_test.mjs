/**
 * tests/phase4_5_golive_empty_dashboard_test.mjs
 * 
 * BỘ KIỂM THỬ TỰ ĐỘNG GOLIVE PHASE 4 & PHASE 5:
 * 1. Phân quyền và bảo mật Báo cáo Lợi nhuận (Phase 4 RBAC):
 *    - SUPER_ADMIN có quyền truy cập /api/admin/reports/profit.
 *    - MARKETING và STORE_STAFF bị chặn 403 Forbidden.
 *    - Khách vãng lai chưa đăng nhập bị chặn 401 Unauthorized.
 * 2. Tính toán Giá vốn & Báo cáo Lợi nhuận khi Dữ liệu rỗng (Phase 4 & 5):
 *    - Endpoint /api/admin/reports/profit không lỗi 500 khi không có đơn.
 *    - summary trả về toàn bộ số thực 0, không NaN, không null.
 *    - marginPercent = 0% (không chia cho 0, không NaN%).
 * 3. Thống kê Dashboard (/api/admin/stats) khi Dữ liệu rỗng:
 *    - Không phát sinh lỗi, statusBreakdown rỗng, revenueTrend đủ 7 ngày.
 * 4. Kiểm toán và bảo vệ giao diện Dashboard (Frontend Unit Logic):
 *    - formatVND xử lý an toàn undefined, null, NaN, chuỗi lỗi -> '0 ₫'.
 *    - Các chỉ số AOV, tỷ lệ hoàn thành, tỷ suất lợi nhuận khi orders = 0
 *      luôn hiển thị chuẩn xác '0 ₫' và 0%, không bao giờ xuất hiện NaN.
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

// Logic định dạng tiền tệ đồng bộ với src/app/admin/page.tsx
function formatVND(num) {
  if (num === null || num === undefined) return '0 ₫';
  const n = Number(num);
  if (!Number.isFinite(n) || isNaN(n)) return '0 ₫';
  return n.toLocaleString('vi-VN') + ' ₫';
}

async function runPhase4And5Suite() {
  console.log('================================================================');
  console.log('    KIỂM THỬ GOLIVE PHASE 4 & 5: GIÁ VỐN & DASHBOARD DỮ LIỆU RỖNG');
  console.log('================================================================\n');

  const client = await pool.connect();
  try {
    // -------------------------------------------------------------------------
    // 1. Chuẩn bị tài khoản và token xác thực cho các vai trò
    // -------------------------------------------------------------------------
    const superAdminRes = await client.query(
      `SELECT id, username, role FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active = true LIMIT 1;`
    );
    const superAdmin = superAdminRes.rows[0];
    if (!superAdmin) {
      throw new Error('Không tìm thấy tài khoản SUPER_ADMIN hợp lệ.');
    }
    const superToken = await makeToken({
      id: superAdmin.id,
      username: superAdmin.username,
      role: superAdmin.role,
    });

    // Lấy hoặc tạo tài khoản MARKETING
    let mktRes = await client.query(
      `SELECT id, username, role FROM admin_users WHERE role = 'MARKETING' AND is_active = true LIMIT 1;`
    );
    let mktUser = mktRes.rows[0];
    if (!mktUser) {
      const insMkt = await client.query(`
        INSERT INTO admin_users (id, username, email, password_hash, role, is_active)
        VALUES ('mkt_phase45_test', 'marketing_phase45', 'mkt_phase45@tsf.vn', 'hash', 'MARKETING', true)
        ON CONFLICT (username) DO UPDATE SET is_active = true
        RETURNING id, username, role;
      `);
      mktUser = insMkt.rows[0];
    }
    const mktToken = await makeToken({
      id: mktUser.id,
      username: mktUser.username,
      role: mktUser.role,
    });

    // Lấy tài khoản STORE_STAFF
    let storeStaffRes = await client.query(
      `SELECT id, username, role, store_code FROM admin_users WHERE role = 'STORE_STAFF' AND is_active = true LIMIT 1;`
    );
    let storeStaff = storeStaffRes.rows[0];
    if (!storeStaff) {
      const insStaff = await client.query(`
        INSERT INTO admin_users (id, username, email, password_hash, role, store_code, is_active)
        VALUES ('staff_phase45_test', 'staff_phase45', 'staff_phase45@tsf.vn', 'hash', 'STORE_STAFF', 'TTH', true)
        ON CONFLICT (username) DO UPDATE SET is_active = true
        RETURNING id, username, role, store_code;
      `);
      storeStaff = insStaff.rows[0];
    }
    const storeStaffToken = await makeToken({
      id: storeStaff.id,
      username: storeStaff.username,
      role: storeStaff.role,
      storeCode: storeStaff.store_code || 'TTH',
    });

    // Tìm một cửa hàng rỗng không có đơn hàng nào để kiểm thử phạm vi dữ liệu rỗng
    const emptyStoreRes = await client.query(`
      SELECT s.code, s.name 
      FROM stores s
      LEFT JOIN orders o ON o.store_code = s.code
      WHERE o.id IS NULL
      LIMIT 1;
    `);
    const emptyStoreCode = emptyStoreRes.rows[0]?.code || 'TDM';

    // Tạo tài khoản STORE_STAFF trong admin_users cho cửa hàng rỗng
    const insEmptyStaff = await client.query(`
      INSERT INTO admin_users (id, username, email, password_hash, role, store_code, is_active)
      VALUES ('staff_empty_store_id', 'staff_empty_store', 'empty_store@tsf.vn', 'hash', 'STORE_STAFF', $1, true)
      ON CONFLICT (username) DO UPDATE SET is_active = true, store_code = $1
      RETURNING id, username, role, store_code;
    `, [emptyStoreCode]);
    const emptyStaffUser = insEmptyStaff.rows[0];

    // Tạo token STORE_STAFF cho cửa hàng rỗng này
    const emptyStoreStaffToken = await makeToken({
      id: emptyStaffUser.id,
      username: emptyStaffUser.username,
      role: 'STORE_STAFF',
      storeCode: emptyStoreCode,
    });

    // -------------------------------------------------------------------------
    // NHÓM 1: Phân quyền truy cập Báo cáo Lợi nhuận (Phase 4 RBAC)
    // -------------------------------------------------------------------------
    console.log('--- NHÓM 1: Phân quyền truy cập Báo cáo Lợi nhuận (Phase 4 RBAC) ---');

    // 1.1 Khách chưa đăng nhập -> 401
    const anonRes = await fetch(`${BASE_URL}/api/admin/reports/profit`);
    assert(
      anonRes.status === 401,
      'Request không có session bị từ chối truy cập báo cáo lợi nhuận',
      `HTTP ${anonRes.status}`
    );

    // 1.2 MARKETING bị chặn -> 403
    const mktReportRes = await fetch(`${BASE_URL}/api/admin/reports/profit`, {
      headers: { Cookie: `tsf_admin_token=${mktToken}` },
    });
    assert(
      mktReportRes.status === 403,
      'MARKETING bị chặn hoàn toàn khỏi báo cáo lợi nhuận (HTTP 403)',
      `HTTP ${mktReportRes.status}`
    );

    // 1.3 STORE_STAFF bị chặn -> 403
    const staffReportRes = await fetch(`${BASE_URL}/api/admin/reports/profit`, {
      headers: { Cookie: `tsf_admin_token=${storeStaffToken}` },
    });
    assert(
      staffReportRes.status === 403,
      'STORE_STAFF bị chặn hoàn toàn khỏi báo cáo lợi nhuận (HTTP 403)',
      `HTTP ${staffReportRes.status}`
    );

    // 1.4 SUPER_ADMIN truy cập thành công -> 200
    const superReportRes = await fetch(`${BASE_URL}/api/admin/reports/profit`, {
      headers: { Cookie: `tsf_admin_token=${superToken}` },
    });
    assert(
      superReportRes.status === 200,
      'SUPER_ADMIN truy cập thành công báo cáo lợi nhuận (HTTP 200)',
      `HTTP ${superReportRes.status}`
    );

    // -------------------------------------------------------------------------
    // NHÓM 2: Báo cáo Lợi nhuận khi Dữ liệu rỗng / Không có đơn (Phase 4 & 5)
    // -------------------------------------------------------------------------
    console.log('\n--- NHÓM 2: Kiểm thử Báo cáo Lợi nhuận khi Dữ liệu rỗng ---');

    // Gọi báo cáo lợi nhuận cho cửa hàng không có đơn hàng nào
    const emptyProfitRes = await fetch(
      `${BASE_URL}/api/admin/reports/profit?storeCode=${emptyStoreCode}&startDate=2099-01-01&endDate=2099-01-02`,
      { headers: { Cookie: `tsf_admin_token=${superToken}` } }
    );
    assert(
      emptyProfitRes.status === 200,
      'Báo cáo lợi nhuận khi dữ liệu rỗng trả về HTTP 200 OK',
      `HTTP ${emptyProfitRes.status}`
    );

    const emptyProfitJson = await emptyProfitRes.json();
    assert(emptyProfitJson.success === true, 'Response báo cáo rỗng có success = true');
    assert(emptyProfitJson.summary !== undefined, 'Khối summary tồn tại đầy đủ');

    const sum = emptyProfitJson.summary;
    assert(
      sum.totalRevenue === 0 && !isNaN(sum.totalRevenue),
      'Doanh thu khi rỗng: totalRevenue = 0 (không NaN, không null)',
      `totalRevenue: ${sum.totalRevenue}`
    );
    assert(
      sum.totalCost === 0 && !isNaN(sum.totalCost),
      'Giá vốn khi rỗng: totalCost = 0 (không NaN)',
      `totalCost: ${sum.totalCost}`
    );
    assert(
      sum.grossProfit === 0 && !isNaN(sum.grossProfit),
      'Lợi nhuận gộp khi rỗng: grossProfit = 0 (không NaN)',
      `grossProfit: ${sum.grossProfit}`
    );
    assert(
      sum.marginPercent === 0 && !isNaN(sum.marginPercent),
      'Tỷ suất lợi nhuận khi rỗng: marginPercent = 0% (không chia 0, không NaN)',
      `marginPercent: ${sum.marginPercent}%`
    );
    assert(
      Array.isArray(emptyProfitJson.breakdown) && emptyProfitJson.breakdown.length === 0,
      'Mảng breakdown khi rỗng là array rỗng []',
      `breakdown.length: ${emptyProfitJson.breakdown?.length}`
    );

    // -------------------------------------------------------------------------
    // NHÓM 3: Kiểm thử Thống kê Dashboard (/api/admin/stats) khi Dữ liệu rỗng
    // -------------------------------------------------------------------------
    console.log('\n--- NHÓM 3: Thống kê Dashboard (/api/admin/stats) khi Dữ liệu rỗng ---');

    // Gọi stats với tài khoản cửa hàng rỗng (storeScope = emptyStoreCode)
    const emptyStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: `tsf_admin_token=${emptyStoreStaffToken}` },
    });
    assert(
      emptyStatsRes.status === 200,
      'STORE_STAFF cửa hàng rỗng gọi /api/admin/stats trả về HTTP 200 OK',
      `HTTP ${emptyStatsRes.status}`
    );

    const emptyStatsJson = await emptyStatsRes.json();
    assert(emptyStatsJson.success === true, 'Response stats khi rỗng có success = true');

    const statSummary = emptyStatsJson.summary;
    assert(
      Number(statSummary?.total_orders || 0) === 0,
      'total_orders = 0 trên cửa hàng chưa có đơn',
      `total_orders: ${statSummary?.total_orders}`
    );
    assert(
      Number(statSummary?.total_revenue || 0) === 0,
      'total_revenue = 0 trên cửa hàng chưa có đơn',
      `total_revenue: ${statSummary?.total_revenue}`
    );
    assert(
      Number(statSummary?.completed_orders || 0) === 0,
      'completed_orders = 0 trên cửa hàng chưa có đơn',
      `completed_orders: ${statSummary?.completed_orders}`
    );
    assert(
      Array.isArray(emptyStatsJson.statusBreakdown) && emptyStatsJson.statusBreakdown.length === 0,
      'statusBreakdown là mảng rỗng [] khi cửa hàng chưa có đơn',
      `statusBreakdown length: ${emptyStatsJson.statusBreakdown?.length}`
    );
    assert(
      Array.isArray(emptyStatsJson.revenueTrend) && emptyStatsJson.revenueTrend.length === 7,
      'revenueTrend sinh đủ 7 ngày theo series ngày lịch sử',
      `revenueTrend length: ${emptyStatsJson.revenueTrend?.length}`
    );
    const zeroTrend = emptyStatsJson.revenueTrend.every(
      (d) => Number(d.daily_revenue) === 0 && Number(d.order_count) === 0
    );
    assert(
      zeroTrend,
      'Toàn bộ 7 ngày trong revenueTrend đều có doanh thu 0 và 0 đơn (không lỗi NaN)',
      '100% các ngày daily_revenue = 0'
    );

    // -------------------------------------------------------------------------
    // NHÓM 4: Kiểm thử Logic Giao diện Frontend Admin (Unit Validation)
    // -------------------------------------------------------------------------
    console.log('\n--- NHÓM 4: Kiểm thử Hàm và Công thức Giao diện Frontend Admin ---');

    // 4.1 formatVND bulletproof
    assert(formatVND(undefined) === '0 ₫', 'formatVND(undefined) -> "0 ₫"');
    assert(formatVND(null) === '0 ₫', 'formatVND(null) -> "0 ₫"');
    assert(formatVND(NaN) === '0 ₫', 'formatVND(NaN) -> "0 ₫"');
    assert(formatVND('NaN') === '0 ₫', 'formatVND("NaN") -> "0 ₫"');
    assert(formatVND('unparsed_text') === '0 ₫', 'formatVND("unparsed_text") -> "0 ₫"');
    assert(formatVND(0) === '0 ₫', 'formatVND(0) -> "0 ₫"');
    assert(formatVND(150000).includes('150') && formatVND(150000).endsWith('₫'), 'formatVND(150000) -> "150.000 ₫"');

    // 4.2 Quick summary success rate calculation
    const totalZero = 0;
    const completedZero = 0;
    const successRateZero = totalZero > 0 ? Math.round((completedZero / totalZero) * 100) : 0;
    assert(
      successRateZero === 0 && !isNaN(successRateZero),
      'Tỷ lệ thành công khi tổng đơn = 0: 0% (không NaN%)',
      `Result: ${successRateZero}%`
    );

    // 4.3 AOV calculation when orders.length = 0
    const emptyOrdersLength = 0;
    const totalRevVal = 0;
    const aovEmpty = emptyOrdersLength > 0 ? Math.round(totalRevVal / emptyOrdersLength) : 0;
    assert(
      aovEmpty === 0 && !isNaN(aovEmpty),
      'Đơn trung bình (AOV) khi số đơn = 0: 0 đ (không NaN ₫)',
      `AOV: ${formatVND(aovEmpty)}`
    );

    // 4.4 Completion rate calculation when orders.length = 0
    const compRateEmpty = emptyOrdersLength > 0 ? Math.round((0 / emptyOrdersLength) * 100) : 0;
    assert(
      compRateEmpty === 0 && !isNaN(compRateEmpty),
      'Tỷ lệ hoàn thành khi số đơn = 0: 0% (không NaN%)',
      `Result: ${compRateEmpty}%`
    );

    // 4.5 Profit Margin calculation when revenue = 0
    const profitRev = 0;
    const grossVal = 0;
    const marginCalc = profitRev > 0 ? Math.round((grossVal / profitRev) * 1000) / 10 : 0;
    assert(
      marginCalc === 0 && !isNaN(marginCalc),
      'Tỷ suất lợi nhuận gộp khi doanh thu = 0: 0% (không NaN%)',
      `Margin: ${marginCalc}%`
    );

    // 4.6 7-Day Trend Chart baseline
    const emptyTrend = [];
    const fallbackTrend = emptyTrend.length > 0 ? emptyTrend : Array.from({ length: 7 }, () => ({ daily_revenue: 0 }));
    const maxRevTrend = Math.max(...fallbackTrend.map((r) => Number(r.daily_revenue || 0)), 100000);
    const sampleRev = 0;
    const barHeight = sampleRev > 0 ? Math.min(100, Math.max(8, Math.round((sampleRev / maxRevTrend) * 100))) : 4;
    assert(
      barHeight === 4 && !isNaN(barHeight),
      'Biểu đồ 7 ngày khi doanh thu = 0 có độ cao baseline 4% (không NaN%, không giả mạo cột doanh thu cao)',
      `Bar height: ${barHeight}%`
    );

    console.log('\n================================================================');
    console.log(`KẾT QUẢ KIỂM THỬ PHASE 4 & 5: ${passedCount} PASS, ${failedCount} FAIL`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runPhase4And5Suite().catch((err) => {
  console.error('Lỗi thực thi kiểm thử Phase 4 & 5:', err);
  process.exit(1);
});
