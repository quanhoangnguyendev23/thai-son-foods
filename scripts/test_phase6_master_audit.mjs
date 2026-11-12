/**
 * test_phase6_master_audit.mjs
 * 
 * Kiểm thử tự động tổng thể Ma trận Phân quyền & Bảo mật (Master RBAC Audit):
 * - Role 1: SUPER_ADMIN (Toàn quyền, doanh thu công ty, giá vốn, báo cáo lợi nhuận, đối soát, user, audit)
 * - Role 2: MARKETING (Sản phẩm, banner, combo, thành viên che số điện thoại; cấm đơn hàng, doanh thu, giá vốn, lợi nhuận, users, audit)
 * - Role 3: STORE_STAFF (Giới hạn store_code = AMA; cấm IDOR đơn của store khác, cấm sửa giá, cấm giá vốn, cấm users, cấm marketing)
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
const pool = new pg.Pool({ connectionString: DB_URL });
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'tsf_super_secret_jwt_key_2026_thai_son_foods'
);
const BASE_URL = 'http://127.0.0.1:3000';

async function makeCookie(payload) {
  const token = await new SignJWT({ ...payload, userId: payload.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
  return `tsf_admin_token=${token}`;
}

async function runMasterAudit() {
  console.log('================================================================');
  console.log('CHẠY KIỂM THỬ TỔNG HỢP MASTER AUDIT: RBAC & BẢO MẬT 3 ROLES');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const client = await pool.connect();

  try {
    // 1. Chuẩn bị 3 User Token chuẩn cho 3 Role
    const superAdminRes = await client.query("SELECT * FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active = true LIMIT 1;");
    const superAdmin = superAdminRes.rows[0];

    const marketingRes = await client.query("SELECT * FROM admin_users WHERE role = 'MARKETING' AND is_active = true LIMIT 1;");
    const marketing = marketingRes.rows[0];

    // Tạo hoặc dùng tài khoản store staff test đã hoàn thành đổi mật khẩu (must_change_password = false)
    const staffAuditUser = 'staff_audit_test';
    await client.query(`
      INSERT INTO admin_users (id, username, email, password_hash, full_name, role, store_code, is_active, must_change_password)
      VALUES ('audit_staff_id', $1, 'staff_audit@test.com', 'dummy_hash', 'Staff AMA Test', 'STORE_STAFF', 'AMA', true, false)
      ON CONFLICT (username) DO UPDATE SET must_change_password = false, is_active = true;
    `, [staffAuditUser]);

    const storeStaffRes = await client.query("SELECT * FROM admin_users WHERE username = $1 LIMIT 1;", [staffAuditUser]);
    const storeStaff = storeStaffRes.rows[0];

    const cookieSuper = await makeCookie({
      id: superAdmin.id,
      username: superAdmin.username,
      email: superAdmin.email,
      role: 'SUPER_ADMIN',
      storeCode: null,
      mustChangePassword: false,
    });

    const cookieMkt = await makeCookie({
      id: marketing.id,
      username: marketing.username,
      email: marketing.email,
      role: 'MARKETING',
      storeCode: null,
      mustChangePassword: false,
    });

    const cookieStore = await makeCookie({
      id: storeStaff.id,
      username: storeStaff.username,
      email: storeStaff.email,
      role: 'STORE_STAFF',
      storeCode: 'AMA',
      mustChangePassword: false,
    });

    // ==============================================================
    // PHẦN 1: KIỂM TRA QUYỀN SUPER_ADMIN
    // ==============================================================
    console.log('PHẦN 1: KIỂM TRA QUYỀN HẠN CỦA SUPER_ADMIN:');

    // 1.1 Xem báo cáo lợi nhuận
    const rProfit = await fetch(`${BASE_URL}/api/admin/reports/profit`, { headers: { Cookie: cookieSuper } });
    assert(rProfit.status === 200, 'SUPER_ADMIN truy cập thành công /api/admin/reports/profit (HTTP 200)');
    const dProfit = await rProfit.json();
    assert(dProfit.success && dProfit.summary !== undefined, 'Báo cáo lợi nhuận trả về dữ liệu summary và breakdown');

    // 1.2 Xem giá vốn sản phẩm
    const rProd = await fetch(`${BASE_URL}/api/admin/products`, { headers: { Cookie: cookieSuper } });
    const dProd = await rProd.json();
    const hasCostPrice = dProd.data && dProd.data.some(p => p.cost_price !== undefined);
    assert(rProd.status === 200 && hasCostPrice, 'SUPER_ADMIN nhìn thấy trường cost_price của sản phẩm');

    // 1.3 Quản lý tài khoản
    const rUsers = await fetch(`${BASE_URL}/api/admin/users`, { headers: { Cookie: cookieSuper } });
    assert(rUsers.status === 200, 'SUPER_ADMIN truy cập thành công /api/admin/users (HTTP 200)');

    // 1.4 Nhật ký hoạt động (Audit log)
    const rAudit = await fetch(`${BASE_URL}/api/admin/audit`, { headers: { Cookie: cookieSuper } });
    assert(rAudit.status === 200, 'SUPER_ADMIN truy cập thành công /api/admin/audit (HTTP 200)');

    // 1.5 Doanh thu toàn công ty
    const rStats = await fetch(`${BASE_URL}/api/admin/stats`, { headers: { Cookie: cookieSuper } });
    const dStats = await rStats.json();
    assert(rStats.status === 200 && (dStats.storeScope === 'ALL' || dStats.storeScope === null), 'SUPER_ADMIN nhận thống kê toàn công ty (storeScope = ALL)');

    // 1.6 Xem số điện thoại thành viên đầy đủ (không bị che)
    const rSuperMemb = await fetch(`${BASE_URL}/api/admin/members`, { headers: { Cookie: cookieSuper } });
    const dSuperMemb = await rSuperMemb.json();
    const superMembers = dSuperMemb.members || dSuperMemb.data || [];
    assert(rSuperMemb.status === 200, 'SUPER_ADMIN xem được danh sách thành viên (HTTP 200)');
    if (superMembers.length > 0) {
      const anyPhone = superMembers.find(m => m.phone)?.phone;
      if (anyPhone) {
        assert(!anyPhone.includes('*'), `SUPER_ADMIN thấy số điện thoại đầy đủ không che: ${anyPhone}`);
      }
    }

    // ==============================================================
    // PHẦN 2: KIỂM TRA PHÂN QUYỀN CỦA MARKETING
    // ==============================================================
    console.log('\nPHẦN 2: KIỂM TRA PHÂN QUYỀN CỦA MARKETING:');

    // 2.1 Được phép xem sản phẩm, combo, banner
    const rMktProd = await fetch(`${BASE_URL}/api/admin/products`, { headers: { Cookie: cookieMkt } });
    const dMktProd = await rMktProd.json();
    assert(rMktProd.status === 200, 'MARKETING xem được danh sách sản phẩm (HTTP 200)');

    const rMktCombos = await fetch(`${BASE_URL}/api/admin/combos`, { headers: { Cookie: cookieMkt } });
    assert(rMktCombos.status === 200, 'MARKETING xem được danh sách combo (HTTP 200)');

    const rMktBanners = await fetch(`${BASE_URL}/api/admin/banners`, { headers: { Cookie: cookieMkt } });
    assert(rMktBanners.status === 200, 'MARKETING xem được danh sách banner (HTTP 200)');

    // Kiểm tra bảo mật: Bị server tước bỏ cost_price
    const leakedCost = dMktProd.data && dMktProd.data.some(p => p.cost_price !== undefined);
    assert(!leakedCost, 'MARKETING bị server ẩn triệt để trường cost_price');

    // 2.2 Không được phép truy cập báo cáo lợi nhuận
    const rMktProfit = await fetch(`${BASE_URL}/api/admin/reports/profit`, { headers: { Cookie: cookieMkt } });
    assert(rMktProfit.status === 403, 'MARKETING bị chặn vào báo cáo lợi nhuận (HTTP 403)');

    // 2.3 Không được phép truy cập danh sách đơn hàng
    const rMktOrders = await fetch(`${BASE_URL}/api/admin/orders`, { headers: { Cookie: cookieMkt } });
    assert(rMktOrders.status === 403, 'MARKETING bị chặn vào danh sách đơn hàng (HTTP 403)');

    // 2.4 Không được phép truy cập danh sách tài khoản
    const rMktUsers = await fetch(`${BASE_URL}/api/admin/users`, { headers: { Cookie: cookieMkt } });
    assert(rMktUsers.status === 403, 'MARKETING bị chặn vào quản lý tài khoản (HTTP 403)');

    // 2.5 Không được phép truy cập nhật ký audit
    const rMktAudit = await fetch(`${BASE_URL}/api/admin/audit`, { headers: { Cookie: cookieMkt } });
    assert(rMktAudit.status === 403, 'MARKETING bị chặn vào nhật ký hoạt động (HTTP 403)');

    // 2.6 Xem thành viên với số điện thoại đã che (masked)
    const rMktMemb = await fetch(`${BASE_URL}/api/admin/members`, { headers: { Cookie: cookieMkt } });
    assert(rMktMemb.status === 200, 'MARKETING xem được danh sách thành viên (HTTP 200)');
    const dMktMemb = await rMktMemb.json();
    const mktMembers = dMktMemb.members || dMktMemb.data || [];
    if (mktMembers.length > 0) {
      const anyPhone = mktMembers.find(m => m.phone)?.phone;
      if (anyPhone) {
        assert(anyPhone.includes('*'), `Số điện thoại thành viên đã được che: ${anyPhone}`);
      }
    }

    // ==============================================================
    // PHẦN 3: KIỂM TRA PHÂN QUYỀN STORE_STAFF & CHỐNG IDOR
    // ==============================================================
    console.log('\nPHẦN 3: KIỂM TRA PHÂN QUYỀN STORE_STAFF (CHI NHÁNH AMA) & CHỐNG IDOR:');

    // 3.1 Chỉ xem đơn hàng của store mình
    const rStaffOrders = await fetch(`${BASE_URL}/api/admin/orders`, { headers: { Cookie: cookieStore } });
    assert(rStaffOrders.status === 200, 'STORE_STAFF xem được danh sách đơn hàng của AMA (HTTP 200)');
    const dStaffOrders = await rStaffOrders.json();
    const otherStoreOrders = dStaffOrders.data && dStaffOrders.data.some(o => o.store_code !== 'AMA');
    assert(!otherStoreOrders, 'STORE_STAFF tuyệt đối không nhận đơn hàng của cửa hàng khác trong danh sách');

    // 3.2 Kiểm tra chống IDOR: Cố đọc đơn chi tiết của cửa hàng khác (ví dụ store CM hoặc D1)
    const otherOrderRes = await client.query("SELECT id, store_code FROM orders WHERE store_code IS NOT NULL AND store_code != 'AMA' LIMIT 1;");
    if (otherOrderRes.rows.length > 0) {
      const otherOrderId = otherOrderRes.rows[0].id;
      const otherStoreCode = otherOrderRes.rows[0].store_code;

      const rIdorGet = await fetch(`${BASE_URL}/api/admin/orders?id=${otherOrderId}`, { headers: { Cookie: cookieStore } });
      assert(rIdorGet.status === 403, `Chống IDOR GET: Nhân viên AMA cố đọc đơn ${otherOrderId} của ${otherStoreCode} bị chặn HTTP 403`);

      // 3.3 Chống IDOR PUT: Cố cập nhật trạng thái đơn của store khác
      const rIdorPut = await fetch(`${BASE_URL}/api/admin/orders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookieStore },
        body: JSON.stringify({ id: otherOrderId, status: 'COMPLETED' }),
      });
      assert(rIdorPut.status === 403, `Chống IDOR PUT: Nhân viên AMA cố sửa trạng thái đơn ${otherOrderId} của ${otherStoreCode} bị chặn HTTP 403`);
    }

    // 3.4 Không được phép xem báo cáo lợi nhuận
    const rStaffProfit = await fetch(`${BASE_URL}/api/admin/reports/profit`, { headers: { Cookie: cookieStore } });
    assert(rStaffProfit.status === 403, 'STORE_STAFF bị chặn vào báo cáo lợi nhuận (HTTP 403)');

    // 3.5 Không được phép xem quản lý tài khoản
    const rStaffUsers = await fetch(`${BASE_URL}/api/admin/users`, { headers: { Cookie: cookieStore } });
    assert(rStaffUsers.status === 403, 'STORE_STAFF bị chặn vào quản lý tài khoản (HTTP 403)');

    // 3.6 Không được phép xem nhật ký hoạt động
    const rStaffAudit = await fetch(`${BASE_URL}/api/admin/audit`, { headers: { Cookie: cookieStore } });
    assert(rStaffAudit.status === 403, 'STORE_STAFF bị chặn vào nhật ký hoạt động (HTTP 403)');

    // 3.7 Bị server tước bỏ cost_price của sản phẩm
    const rStaffProd = await fetch(`${BASE_URL}/api/admin/products`, { headers: { Cookie: cookieStore } });
    const dStaffProd = await rStaffProd.json();
    const staffCostLeaked = dStaffProd.data && dStaffProd.data.some(p => p.cost_price !== undefined);
    assert(!staffCostLeaked, 'STORE_STAFF bị server loại bỏ trường cost_price của sản phẩm');

    // 3.8 Thống kê doanh thu bị ép phạm vi AMA
    const rStaffStats = await fetch(`${BASE_URL}/api/admin/stats`, { headers: { Cookie: cookieStore } });
    const dStaffStats = await rStaffStats.json();
    assert(rStaffStats.status === 200 && dStaffStats.storeScope === 'AMA', 'STORE_STAFF nhận thống kê doanh thu scoped chuẩn theo AMA');

    // ==============================================================
    // PHẦN 4: KIỂM TRA BẢO MẬT HẠ TẦNG (CSRF, REGISTER LOCKDOWN, FIRST LOGIN)
    // ==============================================================
    console.log('\nPHẦN 4: KIỂM TRA BẢO MẬT HẠ TẦNG (CSRF, REGISTER LOCKDOWN, FIRST LOGIN):');

    // 4.1 Khóa đăng ký tự do khi đã có Super Admin
    const rRegister = await fetch(`${BASE_URL}/api/admin/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'hacker_attempt',
        email: 'hacker@evil.com',
        password: 'Password123!',
      }),
    });
    const dRegister = await rRegister.json();
    assert(
      rRegister.status === 403 && dRegister.code === 'REGISTRATION_DISABLED',
      'Đăng ký tự do bị khóa hoàn toàn khi hệ thống đã có Super Admin (HTTP 403 REGISTRATION_DISABLED)'
    );

    // 4.2 Chống tấn công CSRF trên API thay đổi dữ liệu khi Origin không hợp lệ
    const rCsrf = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil-attacker-site.com',
        Cookie: cookieSuper,
      },
      body: JSON.stringify({ name: 'Hacked Product' }),
    });
    const dCsrf = await rCsrf.json();
    assert(
      rCsrf.status === 403 && dCsrf.code === 'CSRF_BLOCKED',
      'Chặn đứng tấn công CSRF với Origin giả mạo từ bên ngoài (HTTP 403 CSRF_BLOCKED)'
    );

    // 4.3 Bắt buộc đổi mật khẩu lần đầu (must_change_password)
    const cookieMustChange = await makeCookie({
      id: 'must_change_user_id',
      username: 'temp_user',
      email: 'temp@test.com',
      role: 'STORE_STAFF',
      storeCode: 'AMA',
      mustChangePassword: true,
    });
    const rMustChange = await fetch(`${BASE_URL}/api/admin/products`, {
      headers: { Cookie: cookieMustChange },
    });
    const dMustChange = await rMustChange.json();
    assert(
      rMustChange.status === 403 && dMustChange.code === 'MUST_CHANGE_PASSWORD',
      'Tài khoản chưa đổi mật khẩu lần đầu bị chặn toàn bộ API quản trị (HTTP 403 MUST_CHANGE_PASSWORD)'
    );

    // 4.4 Chặn truy cập khi không có token (Unauthenticated)
    const rNoAuth = await fetch(`${BASE_URL}/api/admin/products`);
    assert(rNoAuth.status === 401, 'Yêu cầu không có token bị từ chối truy cập (HTTP 401 UNAUTHORIZED)');

    // ==============================================================
    // PHẦN 5: KIỂM TRA BẢNG AUDIT LOGS
    // ==============================================================
    console.log('\nPHẦN 5: KIỂM TRA TÍNH TOÀN VẸN CỦA BẢNG AUDIT LOGS:');
    const logCheckRes = await client.query(`
      SELECT action, COUNT(*) AS count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC;
    `);
    assert(logCheckRes.rows.length > 0, `Bảng audit_logs ghi nhận đầy đủ ${logCheckRes.rows.length} loại hành động.`);
    console.log('Thống kê các hành động đã được ghi vết tự động:');
    console.table(logCheckRes.rows);

    console.log('\n================================================================');
    console.log(`TỔNG KẾT MASTER AUDIT: ${passed} PASS, ${failed} FAIL`);
    console.log('================================================================');
  } catch (error) {
    console.error('Lỗi khi chạy master audit:', error);
  } finally {
    try {
      await client.query("DELETE FROM admin_users WHERE username = 'staff_audit_test';");
    } catch {}
    client.release();
    await pool.end();
  }
}

runMasterAudit();
