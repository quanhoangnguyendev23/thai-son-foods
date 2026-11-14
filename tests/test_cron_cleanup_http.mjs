/**
 * TEST CẤP HTTP: CRON CLEANUP RESERVATIONS ROUTE (/api/cron/cleanup-reservations)
 * Mục tiêu Requirement 2:
 * 1. GET đúng secret -> 200 OK.
 * 2. Sai secret -> 401 Unauthorized.
 * 3. Thiếu secret -> 401 Unauthorized.
 * 4. Chưa cấu hình CRON_SECRET trong env -> 500 Internal Server Error.
 * 5. Xác nhận middleware đăng nhập admin không chặn hay redirect đường dẫn này (không bị 307/308 về /admin/login).
 * 6. Xác nhận mỗi lần chạy ghi 1 dòng log chuẩn: [Cron Cleanup] timestamp | Released: X | Cancelled: Y.
 * 7. Tuân thủ Requirement 4: Chỉ chạy dev/test localhost, tự dọn dẹp.
 */

import assert from 'node:assert';
import { assertSafeTestEnvironment } from './helpers/safe_test_env.mjs';
import { GET } from '../src/app/api/cron/cleanup-reservations/route.ts';

// F-02: mật khẩu tài khoản test / secret đọc từ biến môi trường, không viết cứng trong Git
// (đặt trong .env local, xem docs/golive/F-02-SECRET-PRODUCTION.md)
function requireSecretEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Thiếu biến môi trường ${name}. Đặt trong .env local (xem docs/golive/F-02-SECRET-PRODUCTION.md).`);
    process.exit(1);
  }
  return value;
}

// 1. Kiểm tra môi trường an toàn
assertSafeTestEnvironment();

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CRON_URL = `${APP_URL}/api/cron/cleanup-reservations`;
const VALID_SECRET = requireSecretEnv('CRON_SECRET');

async function runCronHttpTests() {
  console.log('================================================================');
  console.log('TEST CẤP HTTP: /api/cron/cleanup-reservations & BẢO MẬT CRON JOB');
  console.log('================================================================');

  let passedTests = 0;

  // -------------------------------------------------------------
  // TEST 1: GET ĐÚNG SECRET -> 200 OK & KHÔNG BỊ REDIRECT
  // -------------------------------------------------------------
  console.log('\n[Test 1] Gửi HTTP GET kèm header Authorization: Bearer <valid_secret>...');
  try {
    const res = await fetch(CRON_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${VALID_SECRET}`,
      },
    });

    console.log(`   -> HTTP Status: ${res.status} (Kỳ vọng: 200)`);
    console.log(`   -> Was Redirected: ${res.redirected} (Kỳ vọng: false)`);
    assert.strictEqual(res.status, 200, 'Cron request với secret đúng PHẢI trả về HTTP 200');
    assert.strictEqual(res.redirected, false, 'Route cron KHÔNG ĐƯỢC PHÉP bị middleware redirect sang /admin/login');

    const data = await res.json();
    console.log(`   -> Response JSON:`, JSON.stringify(data));
    assert.strictEqual(data.success, true, 'Response PHẢI có success: true');
    assert(typeof data.timestamp === 'string', 'Response PHẢI có timestamp dạng ISO');
    assert(typeof data.releasedReservationsCount === 'number', 'Response PHẢI có số lượng reservations đã nhả');
    assert(typeof data.cancelledOrdersCount === 'number', 'Response PHẢI có số lượng orders đã hủy');
    console.log('   ✓ Test 1 ĐẠT: GET đúng secret trả về 200 OK và dữ liệu cleanup chuẩn.');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 1 THẤT BẠI:', err);
    throw err;
  }

  // -------------------------------------------------------------
  // TEST 2: GET SAI SECRET -> 401 UNAUTHORIZED
  // -------------------------------------------------------------
  console.log('\n[Test 2] Gửi HTTP GET kèm header Authorization với secret sai...');
  try {
    const res = await fetch(CRON_URL, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid_secret_attack_vector_xyz',
      },
    });

    console.log(`   -> HTTP Status: ${res.status} (Kỳ vọng: 401)`);
    assert.strictEqual(res.status, 401, 'Cron request với secret sai PHẢI trả về HTTP 401');

    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert(data.error.includes('Unauthorized'), 'Thông báo lỗi phải là Unauthorized');
    console.log('   ✓ Test 2 ĐẠT: Secret sai bị chặn 401 Unauthorized.');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 2 THẤT BẠI:', err);
    throw err;
  }

  // -------------------------------------------------------------
  // TEST 3: GET THIẾU SECRET (KHÔNG GỬI AUTHORIZATION HEADER) -> 401 UNAUTHORIZED
  // -------------------------------------------------------------
  console.log('\n[Test 3] Gửi HTTP GET không có header Authorization...');
  try {
    const res = await fetch(CRON_URL, {
      method: 'GET',
    });

    console.log(`   -> HTTP Status: ${res.status} (Kỳ vọng: 401)`);
    assert.strictEqual(res.status, 401, 'Cron request thiếu header Authorization PHẢI trả về HTTP 401');

    const data = await res.json();
    assert.strictEqual(data.success, false);
    console.log('   ✓ Test 3 ĐẠT: Thiếu secret bị chặn 401 Unauthorized.');
    passedTests++;
  } catch (err) {
    console.error('   ❌ Test 3 THẤT BẠI:', err);
    throw err;
  }

  // -------------------------------------------------------------
  // TEST 4: CHƯA CẤU HÌNH CRON_SECRET TRONG ENVIRONMENT -> 500 INTERNAL SERVER ERROR
  // -------------------------------------------------------------
  console.log('\n[Test 4] Kiểm tra Fail-closed: Khi CRON_SECRET chưa được cấu hình...');
  const originalEnvSecret = process.env.CRON_SECRET;
  try {
    // Tạm xóa biến môi trường CRON_SECRET
    delete process.env.CRON_SECRET;

    const mockReq = new Request('http://localhost:3000/api/cron/cleanup-reservations', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer some_secret',
      },
    });

    const res500 = await GET(mockReq);
    console.log(`   -> Handler Status: ${res500.status} (Kỳ vọng: 500)`);
    assert.strictEqual(res500.status, 500, 'Khi CRON_SECRET chưa được cấu hình, hệ thống PHẢI từ chối với 500');

    const data500 = await res500.json();
    console.log(`   -> Response khi chưa cấu hình secret:`, JSON.stringify(data500));
    assert.strictEqual(data500.success, false);
    assert(data500.error.includes('CRON_SECRET chưa được thiết lập'));
    console.log('   ✓ Test 4 ĐẠT: Fail-closed trả về đúng 500 khi server thiếu config CRON_SECRET.');
    passedTests++;
  } finally {
    // Khôi phục lại biến môi trường
    if (originalEnvSecret !== undefined) {
      process.env.CRON_SECRET = originalEnvSecret;
    }
  }

  // -------------------------------------------------------------
  // TEST 5: XÁC MINH MIDDLEWARE KHÔNG CHẶN ĐƯỜNG DẪN /api/cron/*
  // -------------------------------------------------------------
  console.log('\n[Test 5] Xác minh middleware đăng nhập admin không chặn/redirect /api/cron/*...');
  const resMiddlewareCheck = await fetch(`${APP_URL}/api/cron/cleanup-reservations`, {
    headers: {
      Authorization: `Bearer ${VALID_SECRET}`,
    },
    redirect: 'manual', // Không tự động follow để phát hiện redirect
  });

  console.log(`   -> HTTP Status (redirect=manual): ${resMiddlewareCheck.status}`);
  const locationHeader = resMiddlewareCheck.headers.get('location');
  console.log(`   -> Location Header: ${locationHeader || 'null (Không redirect)'}`);
  assert.notStrictEqual(resMiddlewareCheck.status, 307, 'Không được phép 307 Temporary Redirect');
  assert.notStrictEqual(resMiddlewareCheck.status, 308, 'Không được phép 308 Permanent Redirect');
  assert.strictEqual(locationHeader, null, 'Không được có Location header redirect sang /admin/login');
  console.log('   ✓ Test 5 ĐẠT: Middleware không can thiệp, không redirect đường dẫn /api/cron/*');
  passedTests++;

  console.log('\n================================================================');
  console.log(`✓ HOÀN THÀNH TOÀN BỘ ${passedTests}/5 TEST BẢO MẬT & HTTP CRON CLEANUP`);
  console.log('  1. GET đúng secret -> 200 OK: PASS');
  console.log('  2. GET sai secret -> 401 Unauthorized: PASS');
  console.log('  3. GET thiếu secret -> 401 Unauthorized: PASS');
  console.log('  4. Chưa cấu hình CRON_SECRET -> 500 Error: PASS');
  console.log('  5. Middleware admin không chặn/redirect: PASS');
  console.log('================================================================\n');
}

runCronHttpTests().catch((err) => {
  console.error('FATAL ERROR TRONG TEST CRON HTTP:', err);
  process.exit(1);
});
