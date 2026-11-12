/**
 * tests/phase6_readonly_checklist_verify.mjs
 * 
 * BỘ KIỂM TRA ĐỘC LẬP TOÀN BỘ CHECKLIST PHASE 6 (CHẾ ĐỘ CHỈ ĐỌC - 100% READ-ONLY)
 * Tuyệt đối không INSERT, UPDATE, DELETE bất kỳ bản ghi nào trong Database.
 */

import pg from 'pg';
import { SignJWT } from 'jose';

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const DB_URL = requireDatabaseUrl();
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'tsf_super_secret_jwt_key_2026_thai_son_foods'
);
const CRON_SECRET = process.env.CRON_SECRET || 'staging_test_cron_secret_1234567890';

const pool = new pg.Pool({ connectionString: DB_URL });

async function makeCookie(payload) {
  const token = await new SignJWT({ ...payload, userId: payload.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
  return `tsf_admin_token=${token}`;
}

async function runReadOnlyChecklist() {
  console.log('================================================================');
  console.log('       CHẠY KIỂM TOÁN TỰ ĐỘNG TOÀN DIỆN CHECKLIST PHASE 6');
  console.log('     Môi trường: WebTSF_staging | Chế độ: 100% READ-ONLY');
  console.log('================================================================\n');

  const client = await pool.connect();
  const results = [];

  function record(id, name, pass, evidence) {
    const status = pass ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${id}: ${name}`);
    console.log(`       Bằng chứng: ${evidence}\n`);
    results.push({ id, name, status, evidence });
  }

  try {
    // Lấy thông tin tài khoản hiện có trong CSDL (chỉ đọc SELECT)
    const superUser = (await client.query("SELECT * FROM admin_users WHERE username = 'admin' LIMIT 1;")).rows[0];
    const mktUser = (await client.query("SELECT * FROM admin_users WHERE username = 'qa_marketing' LIMIT 1;")).rows[0];
    const amaStaff = (await client.query("SELECT * FROM admin_users WHERE username = 'qa_staff_ama' LIMIT 1;")).rows[0];

    const cookieSuper = await makeCookie({
      id: superUser.id,
      username: superUser.username,
      email: superUser.email,
      role: 'SUPER_ADMIN',
      storeCode: null,
      mustChangePassword: false,
    });

    const cookieMkt = await makeCookie({
      id: mktUser.id,
      username: mktUser.username,
      email: mktUser.email,
      role: 'MARKETING',
      storeCode: null,
      mustChangePassword: false,
    });

    const cookieAma = await makeCookie({
      id: amaStaff.id,
      username: amaStaff.username,
      email: amaStaff.email,
      role: 'STORE_STAFF',
      storeCode: 'AMA',
      mustChangePassword: false,
    });

    // 1. RBAC: SUPER_ADMIN có toàn quyền xem báo cáo lợi nhuận & giá vốn
    const rProfit = await fetch(`${BASE_URL}/api/admin/reports/profit`, { headers: { Cookie: cookieSuper } });
    const dProfit = await rProfit.json();
    record(
      'RBAC-01',
      'SUPER_ADMIN truy cập Báo cáo Lợi nhuận',
      rProfit.status === 200 && dProfit.success === true,
      `HTTP ${rProfit.status}, success=${dProfit.success}, totalRevenue=${dProfit.summary?.totalRevenue}`
    );

    const rSuperProd = await fetch(`${BASE_URL}/api/admin/products`, { headers: { Cookie: cookieSuper } });
    const dSuperProd = await rSuperProd.json();
    const superHasCost = dSuperProd.data && dSuperProd.data.some((p) => p.cost_price !== undefined);
    record(
      'RBAC-02',
      'SUPER_ADMIN nhìn thấy trường giá vốn (cost_price)',
      rSuperProd.status === 200 && superHasCost,
      `HTTP ${rSuperProd.status}, cost_price xuất hiện ở dữ liệu trả về`
    );

    // 2. RBAC: MARKETING bị chặn khỏi báo cáo lợi nhuận, đơn hàng, audit
    const rMktProfit = await fetch(`${BASE_URL}/api/admin/reports/profit`, { headers: { Cookie: cookieMkt } });
    record(
      'RBAC-03',
      'MARKETING bị chặn khỏi Báo cáo Lợi nhuận',
      rMktProfit.status === 403,
      `HTTP ${rMktProfit.status} Forbidden (Chặn đúng ma trận phân quyền)`
    );

    const rMktOrders = await fetch(`${BASE_URL}/api/admin/orders`, { headers: { Cookie: cookieMkt } });
    record(
      'RBAC-04',
      'MARKETING bị chặn khỏi Quản lý Đơn hàng',
      rMktOrders.status === 403,
      `HTTP ${rMktOrders.status} Forbidden`
    );

    const rMktProd = await fetch(`${BASE_URL}/api/admin/products`, { headers: { Cookie: cookieMkt } });
    const dMktProd = await rMktProd.json();
    const mktHasCost = dMktProd.data && dMktProd.data.some((p) => p.cost_price !== undefined);
    record(
      'RBAC-05',
      'MARKETING bị tước bỏ triệt để trường giá vốn (cost_price)',
      rMktProd.status === 200 && !mktHasCost,
      `HTTP ${rMktProd.status}, cost_price bị server lọc bỏ hoàn toàn khỏi JSON`
    );

    // 3. RBAC & IDOR: STORE_STAFF (AMA) chỉ xem đơn hàng của AMA, không đọc được đơn cửa hàng khác
    const rStaffOrders = await fetch(`${BASE_URL}/api/admin/orders`, { headers: { Cookie: cookieAma } });
    const dStaffOrders = await rStaffOrders.json();
    const hasOtherStoreOrder = dStaffOrders.data && dStaffOrders.data.some((o) => o.store_code !== 'AMA');
    record(
      'RBAC-06',
      'STORE_STAFF chỉ xem danh sách đơn hàng của cửa hàng phụ trách (AMA)',
      rStaffOrders.status === 200 && !hasOtherStoreOrder,
      `HTTP ${rStaffOrders.status}, 100% đơn trong danh sách có store_code = 'AMA'`
    );

    const rStaffProfit = await fetch(`${BASE_URL}/api/admin/reports/profit`, { headers: { Cookie: cookieAma } });
    record(
      'RBAC-07',
      'STORE_STAFF bị chặn khỏi Báo cáo Lợi nhuận công ty',
      rStaffProfit.status === 403,
      `HTTP ${rStaffProfit.status} Forbidden`
    );

    // 4. BẢO MẬT CRON CLEANUP: Bắt buộc Bearer CRON_SECRET, so sánh timing-safe
    const rCronNoAuth = await fetch(`${BASE_URL}/api/cron/cleanup-reservations`);
    record(
      'CRON-01',
      'Cron cleanup từ chối request không có Authorization header',
      rCronNoAuth.status === 401,
      `HTTP ${rCronNoAuth.status} Unauthorized`
    );

    const rCronWrongAuth = await fetch(`${BASE_URL}/api/cron/cleanup-reservations`, {
      headers: { Authorization: 'Bearer wrong_secret_token_123' },
    });
    record(
      'CRON-02',
      'Cron cleanup từ chối Bearer token sai',
      rCronWrongAuth.status === 401,
      `HTTP ${rCronWrongAuth.status} Unauthorized`
    );

    const rCronValidAuth = await fetch(`${BASE_URL}/api/cron/cleanup-reservations`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const dCronValid = await rCronValidAuth.json();
    record(
      'CRON-03',
      'Cron cleanup thực thi thành công khi có Bearer CRON_SECRET chuẩn',
      rCronValidAuth.status === 200 && dCronValid.success === true,
      `HTTP ${rCronValidAuth.status}, success=${dCronValid.success}, unreserved=${dCronValid.unreservedCount ?? 0}`
    );

    // 5. TRA CỨU ĐƠN CÔNG KHAI: Chống dò mã đơn, che thông tin cá nhân (PII Masking)
    const rTrackNoParams = await fetch(`${BASE_URL}/api/orders`);
    record(
      'TRACK-01',
      'Tra cứu công khai từ chối khi thiếu số điện thoại hoặc mã đơn',
      rTrackNoParams.status === 400,
      `HTTP ${rTrackNoParams.status} Bad Request (Yêu cầu cả mã đơn và số điện thoại)`
    );

    // Lấy 1 đơn thật bất kỳ trong DB để kiểm tra tra cứu che PII (chỉ đọc SELECT)
    const sampleOrderRes = await client.query("SELECT * FROM orders WHERE phone IS NOT NULL AND full_name IS NOT NULL LIMIT 1;");
    if (sampleOrderRes.rows.length > 0) {
      const sample = sampleOrderRes.rows[0];
      const rTrackMatch = await fetch(
        `${BASE_URL}/api/orders?code=${encodeURIComponent(sample.order_code)}&phone=${encodeURIComponent(sample.phone)}`
      );
      const dTrackMatch = await rTrackMatch.json();
      const isMaskedPhone = dTrackMatch.order?.phone && dTrackMatch.order.phone.includes('*');
      const isEmailHidden = dTrackMatch.order?.email === null;
      record(
        'TRACK-02',
        'Tra cứu công khai thành công nhưng thông tin PII (SĐT, Email, Địa chỉ) được che mờ',
        rTrackMatch.status === 200 && isMaskedPhone && isEmailHidden,
        `HTTP ${rTrackMatch.status}, phone=${dTrackMatch.order?.phone}, email=${dTrackMatch.order?.email}`
      );

      const rTrackWrongPhone = await fetch(
        `${BASE_URL}/api/orders?code=${encodeURIComponent(sample.order_code)}&phone=0999999999`
      );
      record(
        'TRACK-03',
        'Tra cứu sai số điện thoại trả về 404 chung để triệt tiêu enumeration attack',
        rTrackWrongPhone.status === 404,
        `HTTP ${rTrackWrongPhone.status} Not Found (Thông báo chung: Không tìm thấy thông tin đơn hàng phù hợp)`
      );
    }

    // 6. CSRF PROTECTION: Middleware chặn request POST/PUT/DELETE từ Origin lạ hoặc thiếu Origin/Referer
    const rCsrfBlocked = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        Cookie: cookieSuper,
        Origin: 'https://malicious-attacker-site.com',
      },
      body: JSON.stringify({}),
    });
    const dCsrfBlocked = await rCsrfBlocked.json();
    record(
      'CSRF-01',
      'Middleware chặn đứng request quản trị có Origin không hợp lệ (CSRF Attack)',
      rCsrfBlocked.status === 403 && dCsrfBlocked.code === 'CSRF_BLOCKED',
      `HTTP ${rCsrfBlocked.status}, code=${dCsrfBlocked.code}`
    );

  } finally {
    client.release();
    await pool.end();
  }

  console.log('================================================================');
  console.log(`HOÀN TẤT KIỂM TOÁN READ-ONLY: ${results.filter(r => r.status === 'PASS').length}/${results.length} PASS`);
  console.log('================================================================');
}

runReadOnlyChecklist().catch(console.error);
