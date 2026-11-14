import pg from 'pg';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from '../scripts/db-guard.mjs';

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

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU TEST PHASE 3: PAYOUT ENGINE & LEDGER IDEMPOTENCY');
  console.log('====================================================\n');

  const runId = Date.now().toString().slice(-4);
  const partnerPhone = `091${Date.now().toString().slice(-7)}`;
  const partnerEmail = `payout_${runId}@thaisonfoods.vn`;

  try {
    // -----------------------------------------------------------------
    // 1. SETUP: TẠO CTV TEST & ADMIN SESSION
    // -----------------------------------------------------------------
    console.log('--- 1. Tạo CTV test và Admin token ---');
    const uRes = await queryDb(
      `INSERT INTO users (id, full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4, 'dummy_hash')
       RETURNING id;`,
      [`usr_p3_${runId}`, `Đối tác Rút tiền ${runId}`, partnerEmail, partnerPhone]
    );
    const userId = uRes.rows[0].id;

    const partnerCode = `TSF-CTV-P3-${runId}`;
    const pRes = await queryDb(
      `INSERT INTO partner_profiles (
        id, user_id, partner_code, partner_type, full_name, phone, email,
        lifecycle_status, current_balance, total_commission_earned,
        bank_name, bank_account_number, bank_account_name
       ) VALUES ($1, $2, $3, 'CTV', $4, $5, $6, 'ACTIVE', 1000000, 1000000, 'Vietcombank', '0123456789', 'NGUYEN VAN TEST')
       RETURNING id;`,
      [`part_p3_${runId}`, userId, partnerCode, `Đối tác Rút tiền ${runId}`, partnerPhone, partnerEmail]
    );
    const partnerId = pRes.rows[0].id;

    // Ký JWT session cho user liên kết partner
    const { signUserToken } = await import('../src/lib/auth.js');
    const partnerToken = await signUserToken({
      id: userId,
      email: partnerEmail,
      fullName: `Đối tác Rút tiền ${runId}`,
      phone: partnerPhone,
    });

    // Đăng nhập Super Admin thật để lấy session hợp lệ
    const adminLogin = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ identifier: 'admin', password: requireSecretEnv('TEST_ADMIN_PASSWORD') }),
    });
    const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';
    assert(adminLogin.status === 200 && adminCookie.length > 0, 'Đăng nhập Super Admin thành công');

    assert(Boolean(partnerId && partnerToken), 'Setup đối tác thành công');

    // -----------------------------------------------------------------
    // 2. CHẶN RÚT DƯỚI HẠN MỨC TỐI THIỂU (MIN 200K)
    // -----------------------------------------------------------------
    console.log('\n--- 2. Kiểm tra chặn rút dưới hạn mức tối thiểu ---');
    const minPayoutRes = await fetch(`${BASE_URL}/api/partner/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({ amount: 100000 }), // Dưới 200k
    });
    const minPayoutData = await minPayoutRes.json();
    assert(minPayoutRes.status === 400, 'Trả về mã lỗi 400 khi rút dưới 200k');
    assert(minPayoutData.code === 'BELOW_MIN_PAYOUT', 'Mã lỗi đúng là BELOW_MIN_PAYOUT');

    // -----------------------------------------------------------------
    // 3. CHẶN ĐỐI TÁC SUSPENDED RÚT TIỀN
    // -----------------------------------------------------------------
    console.log('\n--- 3. Kiểm tra chặn rút tiền khi tài khoản bị SUSPENDED ---');
    await queryDb(`UPDATE partner_profiles SET lifecycle_status = 'SUSPENDED' WHERE id = $1;`, [partnerId]);

    const suspendedRes = await fetch(`${BASE_URL}/api/partner/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({ amount: 500000 }),
    });
    const suspendedData = await suspendedRes.json();
    assert(suspendedRes.status === 403, 'Tài khoản SUSPENDED bị chặn 403');
    assert(suspendedData.code === 'ACCOUNT_NOT_ACTIVE', 'Mã lỗi ACCOUNT_NOT_ACTIVE');

    // Khôi phục ACTIVE
    await queryDb(`UPDATE partner_profiles SET lifecycle_status = 'ACTIVE' WHERE id = $1;`, [partnerId]);

    // -----------------------------------------------------------------
    // 4. CHẶN RÚT KHI VÍ BỊ ÂM DO HOÀN ĐƠN (NEGATIVE WALLET)
    // -----------------------------------------------------------------
    console.log('\n--- 4. Kiểm tra chặn rút tiền khi ví bị âm ---');
    await queryDb(`UPDATE partner_profiles SET current_balance = -250000 WHERE id = $1;`, [partnerId]);

    const negativeRes = await fetch(`${BASE_URL}/api/partner/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({ amount: 300000 }),
    });
    const negativeData = await negativeRes.json();
    assert(negativeRes.status === 400, 'Ví âm bị chặn 400');
    assert(negativeData.code === 'NEGATIVE_BALANCE', 'Mã lỗi NEGATIVE_BALANCE');
    assert(negativeData.negativeAmount === 250000, 'Báo đúng số tiền cần bù là 250.000 ₫');

    // Nạp lại số dư dương 1.500.000đ
    await queryDb(`UPDATE partner_profiles SET current_balance = 1500000 WHERE id = $1;`, [partnerId]);

    // -----------------------------------------------------------------
    // 5. CHẶN RÚT VƯỢT QUÁ SỐ DƯ KHẢ DỤNG
    // -----------------------------------------------------------------
    console.log('\n--- 5. Kiểm tra chặn rút vượt quá số dư khả dụng ---');
    const overRes = await fetch(`${BASE_URL}/api/partner/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({ amount: 99999999 }),
    });
    const overData = await overRes.json();
    assert(overRes.status === 400, 'Rút quá số dư bị 400');
    assert(overData.code === 'INSUFFICIENT_AVAILABLE_BALANCE', 'Mã lỗi INSUFFICIENT_AVAILABLE_BALANCE');

    // -----------------------------------------------------------------
    // 6. TẠO YÊU CẦU RÚT TIỀN THÀNH CÔNG (KHÓA TIỀN & SỔ CÁI)
    // -----------------------------------------------------------------
    console.log('\n--- 6. Tạo yêu cầu rút tiền thành công ---');
    const validPayoutRes = await fetch(`${BASE_URL}/api/partner/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({ amount: 500000 }),
    });
    const validPayoutData = await validPayoutRes.json();
    assert(validPayoutData.success === true, 'Tạo yêu cầu rút tiền 500.000 ₫ thành công');
    const payoutId = validPayoutData.payoutId;

    // Kiểm tra DB payout_requests
    const prCheck = await queryDb(`SELECT * FROM payout_requests WHERE id = $1;`, [payoutId]);
    assert(prCheck.rows[0]?.status === 'PENDING', 'Trạng thái ban đầu là PENDING');
    assert(Number(prCheck.rows[0]?.amount) === 500000, 'Số tiền ghi nhận là 500.000 ₫');

    // Kiểm tra số dư đối tác bị khóa (trừ đi 500k, còn 1.000.000đ)
    const pCheck = await queryDb(`SELECT current_balance FROM partner_profiles WHERE id = $1;`, [partnerId]);
    assert(Number(pCheck.rows[0]?.current_balance) === 1000000, 'current_balance bị trừ 500.000 ₫ để tránh rút kép');

    // Kiểm tra dòng sổ cái PAYOUT_HOLD
    const ledCheck = await queryDb(`SELECT * FROM partner_ledger WHERE reference_id = $1;`, [payoutId]);
    assert(ledCheck.rows.length === 1, 'Tạo dòng sổ cái tạm giữ tiền');
    assert(ledCheck.rows[0]?.entry_type === 'PAYOUT_HOLD', 'Loại dòng là PAYOUT_HOLD');
    assert(Number(ledCheck.rows[0]?.amount) === -500000, 'Số tiền ghi DEBIT âm 500.000 ₫');

    // -----------------------------------------------------------------
    // 7. CHỐNG DOUBLE-SUBMIT KHI ĐANG CÓ YÊU CẦU PENDING
    // -----------------------------------------------------------------
    console.log('\n--- 7. Kiểm tra Chống Double-Submit ---');
    const doubleRes = await fetch(`${BASE_URL}/api/partner/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({ amount: 300000 }),
    });
    const doubleData = await doubleRes.json();
    assert(doubleRes.status === 409, 'Bị chặn 409 khi đang có đơn PENDING');
    assert(doubleData.code === 'PENDING_PAYOUT_EXISTS', 'Mã lỗi đúng là PENDING_PAYOUT_EXISTS');

    // -----------------------------------------------------------------
    // 8. ADMIN LIST PAYOUTS & REVIEW APPROVE
    // -----------------------------------------------------------------
    console.log('\n--- 8. Admin lấy danh sách & Phê duyệt (APPROVE) ---');
    const adminListRes = await fetch(`${BASE_URL}/api/admin/payouts?partnerId=${partnerId}`, {
      headers: {
        Cookie: adminCookie,
        Origin: BASE_URL,
      },
    });
    const adminListData = await adminListRes.json();
    assert(adminListData.success === true, 'Admin xem danh sách payout thành công');
    assert(adminListData.data.length >= 1, 'Tìm thấy yêu cầu rút tiền của đối tác');

    // Admin duyệt APPROVE
    const approveRes = await fetch(`${BASE_URL}/api/admin/payouts/${payoutId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: BASE_URL,
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    const approveData = await approveRes.json();
    assert(approveData.success === true, 'Admin phê duyệt APPROVE thành công');
    assert(approveData.payout.status === 'APPROVED', 'Trạng thái chuyển sang APPROVED');

    // -----------------------------------------------------------------
    // 9. ADMIN XÁC NHẬN CHUYỂN KHOẢN (MARK_AS_PAID)
    // -----------------------------------------------------------------
    console.log('\n--- 9. Admin xác nhận chuyển khoản ngân hàng (MARK_AS_PAID) ---');
    const bankRefCode = `VCB-TXN-${Date.now().toString().slice(-6)}`;
    const paidRes = await fetch(`${BASE_URL}/api/admin/payouts/${payoutId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: BASE_URL,
      },
      body: JSON.stringify({ action: 'MARK_AS_PAID', bankReference: bankRefCode }),
    });
    const paidData = await paidRes.json();
    assert(paidData.success === true, 'Admin xác nhận chuyển khoản thành công');
    assert(paidData.payout.status === 'PAID', 'Trạng thái chuyển sang PAID');
    assert(paidData.payout.bank_reference === bankRefCode, 'Lưu đúng mã giao dịch ngân hàng');

    // Kiểm tra dòng sổ cái chuyển sang PAID
    const ledPaidCheck = await queryDb(`SELECT * FROM partner_ledger WHERE reference_id = $1;`, [payoutId]);
    assert(ledPaidCheck.rows[0]?.status === 'PAID', 'Dòng sổ cái cập nhật sang PAID');

    // -----------------------------------------------------------------
    // 10. TEST TỪ CHỐI RÚT TIỀN (REJECT) VÀ HOÀN TIỀN VÀO VÍ
    // -----------------------------------------------------------------
    console.log('\n--- 10. Test Từ chối (REJECT) và hoàn tiền về ví ---');
    // Tạo yêu cầu mới thứ 2
    const payout2Res = await fetch(`${BASE_URL}/api/partner/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({ amount: 300000 }),
    });
    const payout2Data = await payout2Res.json();
    const payoutId2 = payout2Data.payoutId;

    // Ví lúc này: 1.000.000đ - 300.000đ = 700.000đ
    const pBeforeReject = await queryDb(`SELECT current_balance FROM partner_profiles WHERE id = $1;`, [partnerId]);
    assert(Number(pBeforeReject.rows[0]?.current_balance) === 700000, 'Ví bị tạm trừ 300.000 ₫');

    // Admin từ chối (REJECT)
    const rejectRes = await fetch(`${BASE_URL}/api/admin/payouts/${payoutId2}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: BASE_URL,
      },
      body: JSON.stringify({ action: 'REJECT', reason: 'Sai số tài khoản ngân hàng' }),
    });
    const rejectData = await rejectRes.json();
    assert(rejectData.success === true, 'Từ chối rút tiền thành công');
    assert(rejectData.payout.status === 'REJECTED', 'Trạng thái chuyển sang REJECTED');

    // Kiểm tra tiền được hoàn trả lại ví: 700.000đ + 300.000đ = 1.000.000đ
    const pAfterReject = await queryDb(`SELECT current_balance FROM partner_profiles WHERE id = $1;`, [partnerId]);
    assert(Number(pAfterReject.rows[0]?.current_balance) === 1000000, 'Tiền 300.000 ₫ được hoàn lại ví đối tác');

    // Kiểm tra dòng sổ cái chuyển sang VOID
    const ledRejectCheck = await queryDb(`SELECT * FROM partner_ledger WHERE reference_id = $1;`, [payoutId2]);
    assert(ledRejectCheck.rows[0]?.status === 'VOID', 'Dòng sổ cái cập nhật sang VOID');

    // -----------------------------------------------------------------
    // 11. AUDIT LOG KIỂM TOÁN
    // -----------------------------------------------------------------
    console.log('\n--- 11. Kiểm tra Audit Log ---');
    const auditRes = await queryDb(
      `SELECT * FROM audit_logs WHERE entity_type = 'PAYOUT_REQUEST' AND entity_id = $1;`,
      [payoutId]
    );
    assert(auditRes.rows.length >= 2, 'Ghi nhận đầy đủ audit log cho các thao tác phê duyệt & chi trả');

    console.log('\n====================================================');
    console.log(`🎉 HOÀN THÀNH TEST SUITE PHASE 3: ${passed} PASS, ${failed} FAIL`);
    console.log('====================================================');
  } catch (err) {
    console.error('❌ LỖI TRONG TEST RUNNER PHASE 3:', err);
    failed++;
  } finally {
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhase3Tests();
