import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { generateOtp, verifyOtp } from '../src/lib/partner/otp.ts';
import { generatePartnerCode, signReferralCookie, verifyReferralCookie, trackReferralClick } from '../src/lib/partner/referral.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const pool = new pg.Pool({
  connectionString:
    requireDatabaseUrl(),
});

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runPhase1Tests() {
  console.log('================================================================');
  console.log('       KIỂM THỬ GIAI ĐOẠN 1: FOUNDATION PHÂN HỆ ĐỐI TÁC        ');
  console.log('================================================================\n');

  const client = await pool.connect();
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failCount++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // 1. Kiểm tra OTP logic
    console.log('--- 1. Kiểm tra OTP Service ---');
    const testPhone = '0988123456';
    const otp = generateOtp(testPhone);
    assert(otp && otp.length === 6, `Sinh mã OTP thành công (${otp})`);

    const badVerify = verifyOtp(testPhone, '000000');
    assert(!badVerify.success, 'Nhập sai OTP bị từ chối');

    const goodVerify = verifyOtp(testPhone, otp);
    assert(goodVerify.success, 'Xác thực đúng OTP thành công');

    // 2. Kiểm tra Referral Code & Cookie Signing
    console.log('\n--- 2. Kiểm tra Referral Code & Cookie Signing ---');
    const ctvCode = generatePartnerCode('CTV');
    assert(ctvCode.startsWith('TSF-CTV-'), `Sinh mã CTV đúng chuẩn: ${ctvCode}`);

    const signedCookie = signReferralCookie(ctvCode);
    assert(signedCookie.includes('.'), `Cookie được ký an toàn: ${signedCookie}`);

    const verifiedCode = verifyReferralCookie(signedCookie);
    assert(verifiedCode === ctvCode, `Giải mã cookie hợp lệ: ${verifiedCode}`);

    const tampered = signedCookie.slice(0, -3) + 'abc';
    assert(verifyReferralCookie(tampered) === null, 'Cookie bị can thiệp chữ ký bị từ chối null');

    // 3. Kiểm tra API Đăng ký Đối tác (Lớp 1 - LITE)
    console.log('\n--- 3. Kiểm tra Đăng ký Đối tác Lớp 1 (HTTP) ---');
    // Dọn dẹp test phone nếu có
    const regPhone = '0987654321';
    await client.query(`DELETE FROM partner_profiles WHERE phone = $1;`, [regPhone]);
    await client.query(`DELETE FROM users WHERE phone = $1;`, [regPhone]);

    // Tạo OTP cho regPhone qua HTTP endpoint
    const otpRes = await fetch(`${BASE_URL}/api/partner/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: regPhone }),
    });
    const otpData = await otpRes.json();
    const regOtp = otpData.debugOtp || '123456';

    const regRes = await fetch(`${BASE_URL}/api/partner/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Nguyễn Văn Đối Tác',
        phone: regPhone,
        email: 'doitac.test@gmail.com',
        password: 'Password@123',
        otpCode: regOtp,
      }),
    });
    const regData = await regRes.json();
    if (!regData.success) {
      console.log('Registration debug response:', regRes.status, regData);
    }
    assert(regRes.status === 200 && regData.success, 'Đăng ký Lớp 1 thành công (HTTP 200)');
    assert(regData.partner.lifecycleStatus === 'LITE', 'Trạng thái khởi tạo đúng là LITE');
    assert(regData.partner.partnerCode.startsWith('TSF-CTV-'), `Đã cấp mã đối tác: ${regData.partner.partnerCode}`);

    const partnerId = regData.partner.id;
    const partnerCode = regData.partner.partnerCode;

    // Lấy cookie phiên đăng nhập
    const partnerCookie = regRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert(partnerCookie.includes('tsf_user_session'), 'Nhận cookie phiên đăng nhập tsf_user_session');

    // 4. Kiểm tra Chặn Duplicate Phone
    console.log('\n--- 4. Kiểm tra Chống Trùng lặp Số điện thoại ---');
    const dupOtpRes = await fetch(`${BASE_URL}/api/partner/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: regPhone }),
    });
    const dupOtpData = await dupOtpRes.json();
    const dupOtp = dupOtpData.debugOtp || '123456';
    const dupRes = await fetch(`${BASE_URL}/api/partner/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Người Nhái',
        phone: regPhone,
        email: 'nhai@gmail.com',
        password: 'Password@123',
        otpCode: dupOtp,
      }),
    });
    assert(dupRes.status === 409, 'Đăng ký trùng số điện thoại bị từ chối (HTTP 409)');

    // 5. Kiểm tra Cập nhật Hồ sơ Lớp 2 (CCCD & Ngân hàng -> SUBMITTED)
    console.log('\n--- 5. Kiểm tra Hoàn thiện Hồ sơ Lớp 2 (SUBMITTED) ---');
    const kycRes = await fetch(`${BASE_URL}/api/partner/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: partnerCookie,
      },
      body: JSON.stringify({
        idCardNumber: '079200012345',
        idCardIssuedDate: '2022-01-15',
        idCardIssuedPlace: 'Cục Cảnh sát QLHC về TTXH',
        bankName: 'Vietcombank',
        bankAccountNumber: '9988776655',
        bankAccountName: 'NGUYEN VAN DOI TAC',
        bankBranch: 'Chi nhánh Nam Sài Gòn',
      }),
    });
    const kycData = await kycRes.json();
    assert(kycRes.status === 200 && kycData.success, 'Cập nhật Lớp 2 thành công');
    assert(kycData.lifecycleStatus === 'SUBMITTED', 'Trạng thái tự động chuyển thành SUBMITTED');

    // 6. Kiểm tra Click Tracking (Referral Click)
    console.log('\n--- 6. Kiểm tra Ghi nhận Lượt Click Giới thiệu ---');
    const clickRes = await fetch(`${BASE_URL}/api/partner/click?ref=${partnerCode}`);
    const clickData = await clickRes.json();
    assert(clickRes.status === 200 && clickData.success, 'Ghi nhận click giới thiệu thành công');

    const clickCookie = clickRes.headers.get('set-cookie');
    assert(clickCookie && clickCookie.includes('tsf_partner_ref'), 'Set cookie giới thiệu tsf_partner_ref kèm chữ ký');

    // 7. Kiểm tra Admin Review Workflow
    console.log('\n--- 7. Kiểm tra Quản trị viên Thẩm định Hồ sơ (Admin Review) ---');
    // Đăng nhập Super Admin
    const adminLogin = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ identifier: 'admin', password: 'Admin@123' }),
    });
    const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';
    assert(adminLogin.status === 200 && adminCookie.length > 0, 'Đăng nhập Super Admin thành công');

    // Xem chi tiết hồ sơ
    const detailRes = await fetch(`${BASE_URL}/api/admin/partners/${partnerId}`, {
      headers: { Cookie: adminCookie },
    });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200 && detailData.partner.fullName === 'Nguyễn Văn Đối Tác', 'Admin xem chi tiết hồ sơ đối tác thành công');

    // Admin Duyệt hồ sơ (APPROVE -> ACTIVE)
    const approveRes = await fetch(`${BASE_URL}/api/admin/partners/${partnerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200 && approveData.partner.lifecycleStatus === 'ACTIVE', 'Admin duyệt hồ sơ thành công -> ACTIVE');

    // Admin Tạm khóa (SUSPEND -> SUSPENDED)
    const suspendRes = await fetch(`${BASE_URL}/api/admin/partners/${partnerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
      body: JSON.stringify({ action: 'SUSPEND', reason: 'Nghi vấn tự mua' }),
    });
    const suspendData = await suspendRes.json();
    assert(suspendRes.status === 200 && suspendData.partner.lifecycleStatus === 'SUSPENDED', 'Admin tạm khóa đối tác thành công -> SUSPENDED');

    // Admin Mở khóa (ACTIVATE -> ACTIVE)
    const activateRes = await fetch(`${BASE_URL}/api/admin/partners/${partnerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE_URL },
      body: JSON.stringify({ action: 'ACTIVATE' }),
    });
    const activateData = await activateRes.json();
    assert(activateRes.status === 200 && activateData.partner.lifecycleStatus === 'ACTIVE', 'Admin kích hoạt lại đối tác thành công -> ACTIVE');

    // 8. Kiểm tra Audit Logs
    console.log('\n--- 8. Kiểm tra Ghi vết Nhật ký Hoạt động (Audit Logs) ---');
    const auditCheck = await client.query(
      `SELECT action, entity_id FROM audit_logs WHERE entity_type = 'PARTNER' AND entity_id = $1 ORDER BY created_at DESC;`,
      [partnerId]
    );
    assert(auditCheck.rows.length >= 4, `Bảng audit_logs ghi nhận đủ ${auditCheck.rows.length} hành động của Partner`);

    console.log('\n================================================================');
    console.log(`KẾT QUẢ PHASE 1: ${passCount} PASS, ${failCount} FAIL`);
    console.log('================================================================');
  } catch (err) {
    console.error('❌ LỖI TRONG TEST SUITE:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runPhase1Tests();
