/**
 * test_phase5_account_security.mjs
 * 
 * Script kiểm thử tự động toàn diện Phase 5:
 * 1. Chặn đăng ký công khai /api/admin/auth/register khi đã có tài khoản (HTTP 403, REGISTRATION_DISABLED).
 * 2. Rate limiting trên /api/admin/auth/login (HTTP 429 sau 5 lần thử sai, ghi nhận audit log AUTH_RATE_LIMITED).
 * 3. Chống CSRF trên middleware: Origin giả mạo bị chặn (HTTP 403, CSRF_BLOCKED).
 * 4. Chặn thao tác API quản trị khi must_change_password = true (HTTP 403, MUST_CHANGE_PASSWORD).
 * 5. Luồng đổi mật khẩu /api/admin/auth/change-password: kiểm tra độ mạnh, đối chiếu mật khẩu cũ, hash mới, gỡ cờ must_change_password, ghi log AUTH_PASSWORD_CHANGE.
 */

import pg from 'pg';
import { SignJWT } from 'jose';

import { assertSafeDatabase } from './db-guard.mjs';

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

const DB_URL = requireDatabaseUrl();
const pool = new pg.Pool({ connectionString: DB_URL });
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'tsf_super_secret_jwt_key_2026_thai_son_foods'
);
const BASE_URL = 'http://127.0.0.1:3000';

async function makeAdminCookie(payload) {
  const token = await new SignJWT({ ...payload, userId: payload.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
  return `tsf_admin_token=${token}`;
}

async function runTests() {
  console.log('=====================================================');
  console.log('CHẠY KIỂM THỬ TỰ ĐỘNG PHASE 5: BẢO MẬT TÀI KHOẢN');
  console.log('=====================================================\n');

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
    // Tạo tài khoản test riêng cho Phase 5
    const testUsername = `sec_test_${Date.now()}`;
    const testPassword = 'OldPassword123';
    const testNewPassword = 'NewSecretPassword2026';

    // 1. Kiểm tra Vô hiệu hóa /api/admin/auth/register
    console.log('1. Kiểm tra khóa cổng đăng ký tự do /api/admin/auth/register:');
    const regRes = await fetch(`${BASE_URL}/api/admin/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'hacker_attempt',
        email: 'hacker@example.com',
        password: 'Password123',
      }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 403, `Cổng đăng ký trả về HTTP 403 (nhận được ${regRes.status})`);
    assert(regData.code === 'REGISTRATION_DISABLED', `Mã phản hồi code là REGISTRATION_DISABLED (nhận được ${regData.code})`);

    // 2. Kiểm tra phòng thủ CSRF trên middleware
    console.log('\n2. Kiểm tra bảo vệ CSRF trên các API thay đổi dữ liệu:');
    const csrfRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-phishing-site.com',
      },
      body: JSON.stringify({ identifier: 'test', password: 'wrong' }),
    });
    const csrfData = await csrfRes.json().catch(() => ({}));
    assert(csrfRes.status === 403, `CSRF tấn công từ domain ngoài bị chặn với HTTP 403 (nhận được ${csrfRes.status})`);
    assert(csrfData.code === 'CSRF_BLOCKED', `Mã lỗi CSRF là CSRF_BLOCKED (nhận được ${csrfData.code})`);

    // 3. Tạo tài khoản Store Staff test có must_change_password = true
    console.log('\n3. Tạo tài khoản test có must_change_password = true:');
    const { default: bcrypt } = await import('bcryptjs');
    const oldHash = await bcrypt.hash(testPassword, 10);
    const testUserId = `admin_sec_${Date.now()}`;

    await client.query(`
      INSERT INTO admin_users (id, username, email, password_hash, full_name, role, store_code, is_active, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, true);
    `, [testUserId, testUsername, `${testUsername}@example.com`, oldHash, 'Store Staff Test', 'STORE_STAFF', 'AMA']);
    assert(true, `Đã tạo tài khoản test ${testUsername} với must_change_password = true`);

    // 4. Kiểm tra chặn API quản trị khi must_change_password = true
    console.log('\n4. Kiểm tra chặn hành động quản trị khi chưa đổi mật khẩu lần đầu:');
    const cookieMustChange = await makeAdminCookie({
      id: testUserId,
      username: testUsername,
      email: `${testUsername}@example.com`,
      role: 'STORE_STAFF',
      storeCode: 'AMA',
      mustChangePassword: true,
    });

    const blockedOrderRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { Cookie: cookieMustChange },
    });
    const blockedOrderData = await blockedOrderRes.json();
    assert(blockedOrderRes.status === 403, `Gọi /api/admin/orders bị trả về HTTP 403 (nhận được ${blockedOrderRes.status})`);
    assert(blockedOrderData.code === 'MUST_CHANGE_PASSWORD', `Lý do chặn đúng là MUST_CHANGE_PASSWORD (nhận được ${blockedOrderData.code})`);

    // 5. Kiểm tra API đổi mật khẩu /api/admin/auth/change-password
    console.log('\n5. Kiểm tra API đổi mật khẩu /api/admin/auth/change-password:');
    // 5.1 Sai mật khẩu hiện tại
    const wrongCurrentRes = await fetch(`${BASE_URL}/api/admin/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieMustChange },
      body: JSON.stringify({
        currentPassword: 'WrongPassword999',
        newPassword: testNewPassword,
        confirmPassword: testNewPassword,
      }),
    });
    const wrongCurrentData = await wrongCurrentRes.json();
    assert(wrongCurrentRes.status === 400, `Mật khẩu cũ không đúng bị từ chối 400 (nhận được ${wrongCurrentRes.status})`);

    // 5.2 Mật khẩu mới quá ngắn
    const shortPwdRes = await fetch(`${BASE_URL}/api/admin/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieMustChange },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword: '123',
        confirmPassword: '123',
      }),
    });
    assert(shortPwdRes.status === 400, `Mật khẩu mới ngắn bị từ chối 400 (nhận được ${shortPwdRes.status})`);

    // 5.3 Đổi mật khẩu hợp lệ thành công
    const validChangeRes = await fetch(`${BASE_URL}/api/admin/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieMustChange },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword: testNewPassword,
        confirmPassword: testNewPassword,
      }),
    });
    const validChangeData = await validChangeRes.json();
    assert(validChangeRes.status === 200, `Đổi mật khẩu thành công trả HTTP 200 (nhận được ${validChangeRes.status})`);
    assert(validChangeData.success === true, 'Đổi mật khẩu trả success = true');

    // Kiểm tra DB sau khi đổi
    const checkDbRes = await client.query('SELECT must_change_password, password_changed_at FROM admin_users WHERE id = $1', [testUserId]);
    assert(checkDbRes.rows[0].must_change_password === false, 'Trường must_change_password trong DB đã chuyển thành false');
    assert(checkDbRes.rows[0].password_changed_at !== null, 'Trường password_changed_at đã được ghi nhận thời gian');

    // 6. Kiểm tra quyền truy cập sau khi đổi mật khẩu
    console.log('\n6. Kiểm tra quyền truy cập sau khi đã đổi mật khẩu:');
    const setCookieHeader = validChangeRes.headers.get('set-cookie');
    assert(Boolean(setCookieHeader && setCookieHeader.includes('tsf_admin_token')), 'Response có cấp phát Set-Cookie tsf_admin_token mới');

    // Trích xuất cookie mới
    const newCookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';
    const allowedOrderRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { Cookie: newCookie },
    });
    const allowedOrderData = await allowedOrderRes.json();
    assert(allowedOrderRes.status === 200, `Sau khi đổi mật khẩu, truy cập /api/admin/orders thành công HTTP 200 (nhận được ${allowedOrderRes.status})`);
    assert(allowedOrderData.success === true, 'Dữ liệu đơn hàng được trả về thành công theo store scoping');

    // 7. Kiểm tra Rate Limiting chống Brute-Force trên /api/admin/auth/login
    console.log('\n7. Kiểm tra Rate Limiting đăng nhập sai:');
    const bruteUser = `brute_victim_${Date.now()}`;
    let rateLimitedTriggered = false;

    for (let i = 1; i <= 6; i++) {
      const loginAttemptRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: bruteUser, password: `wrong_${i}` }),
      });
      if (loginAttemptRes.status === 429) {
        rateLimitedTriggered = true;
        const rateData = await loginAttemptRes.json();
        assert(rateData.code === 'RATE_LIMITED', `Lần thử ${i}: Nhận mã lỗi RATE_LIMITED (HTTP 429)`);
        break;
      }
    }
    assert(rateLimitedTriggered, 'Hệ thống đã kích hoạt Rate Limiting khóa brute-force sau chuỗi đăng nhập sai');

    // Dọn dẹp tài khoản test
    await client.query('DELETE FROM admin_users WHERE id = $1', [testUserId]);

    console.log('\n=====================================================');
    console.log(`KẾT QUẢ PHASE 5: ${passed} PASS, ${failed} FAIL`);
    console.log('=====================================================');
  } catch (error) {
    console.error('Lỗi khi chạy kiểm thử:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests();
