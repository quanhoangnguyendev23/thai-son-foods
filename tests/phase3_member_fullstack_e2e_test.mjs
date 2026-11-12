import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
const { Pool } = pg;

import { generateCustomerOtp, verifyCustomerOtp } from '../src/lib/membership/otp.ts';
import {
  getMembershipTiers,
  subscribeUserMembership,
  getUserMembership,
  addLoyaltyPoints,
  getUserLoyaltySummary,
  createSubscription,
  getUserSubscriptions,
  skipSubscriptionNextDelivery,
  updateSubscriptionFrequency,
  updateSubscriptionAddress,
  cancelSubscription,
  cancelUserMembership,
} from '../src/lib/membership/repository.ts';
import {
  validateDeliveryRadius,
} from '../src/lib/membership/service.ts';

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : { connectionString: requireDatabaseUrl() }
);

let passedCount = 0;
let failedCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    -> Lỗi: ${err.message}`);
    failedCount++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    -> Lỗi: ${err.message}`);
    failedCount++;
  }
}

async function runFullstackSuite() {
  console.log('================================================================');
  console.log('    KIỂM THỬ TÍCH HỢP TOÀN DIỆN FULLSTACK: THÁI SƠN PRIME & S&S');
  console.log('================================================================\n');

  const testUserId = `usr_e2e_${Date.now()}`;
  const testPhone = '0909876543';
  let createdSubId = null;

  // Khởi tạo người dùng test trong users
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, phone, provider, is_active)
     VALUES ($1, $2, '', 'Nguyễn Văn Test Prime', $3, 'phone', true)
     ON CONFLICT (id) DO NOTHING;`,
    [testUserId, `${testUserId}@test.vn`, testPhone]
  );

  try {
    // ── NHÓM 1: CỔNG XÁC THỰC SĐT (PHONE OTP AUTH GATE) ────────────────
    console.log('--- NHÓM 1: Cổng Xác Thực SĐT & OTP Khách Hàng ---');
    it('OTP: Sinh mã OTP thành công cho số điện thoại hợp lệ', () => {
      const res = generateCustomerOtp(testPhone);
      assert.equal(res.success, true);
    });

    it('OTP: Xác thực thành công với mã thử nghiệm 123456', () => {
      const res = verifyCustomerOtp(testPhone, '123456');
      assert.equal(res.success, true);
    });

    it('OTP: Chặn số điện thoại sai định dạng viễn thông Việt Nam', () => {
      const res = generateCustomerOtp('123456789');
      assert.equal(res.success, false);
    });

    // ── NHÓM 2: GÓI HỘI VIÊN & SỔ CÁI ĐIỂM THƯỞNG (MEMBERSHIP & LOYALTY) ──
    console.log('\n--- NHÓM 2: Gói Hội Viên & Sổ Cái Điểm Thưởng CSDL ---');
    await itAsync('Tiers: Tải đầy đủ 3 gói hội viên từ CSDL PostgreSQL', async () => {
      const tiers = await getMembershipTiers();
      assert.equal(tiers.length >= 3, true);
      const codes = tiers.map((t) => t.code);
      assert.equal(codes.includes('FREE'), true);
      assert.equal(codes.includes('PRIME_MONTHLY'), true);
      assert.equal(codes.includes('PRIME_YEARLY'), true);
    });

    await itAsync('Subscribe: Kích hoạt gói Dùng Thử 30 ngày (TRIAL_ACTIVE)', async () => {
      const mem = await subscribeUserMembership(testUserId, 'PRIME_MONTHLY', true);
      assert.equal(mem.status, 'TRIAL_ACTIVE');
      assert.equal(mem.userId, testUserId);
    });

    await itAsync('Loyalty: Cộng điểm chào mừng gia nhập Prime vào sổ cái', async () => {
      const newBal = await addLoyaltyPoints(
        testUserId,
        50,
        'SIGNUP_BONUS',
        'Thưởng 50 điểm chào mừng Thái Sơn Prime'
      );
      assert.equal(newBal, 50);

      const summary = await getUserLoyaltySummary(testUserId);
      assert.equal(summary.currentBalance, 50);
      assert.equal(summary.history.length, 1);
    });

    // ── NHÓM 3: HỢP ĐỒNG ĐỊNH KỲ SUBSCRIBE & SAVE ──────────────────────
    console.log('\n--- NHÓM 3: Hợp Đồng Định Kỳ Subscribe & Save ---');
    it('Bán kính: Chấp nhận bán kính 5km, từ chối an toàn bán kính 35km', () => {
      const valid = validateDeliveryRadius(5.0);
      assert.equal(valid.isValid, true);
      const invalid = validateDeliveryRadius(35.0);
      assert.equal(invalid.isValid, false);
    });

    let createdSubId = '';
    await itAsync('Create Contract: Tạo hợp đồng giao định kỳ với 2 sản phẩm giảm 15%', async () => {
      const sub = await createSubscription({
        userId: testUserId,
        deliveryFrequency: '1_WEEK',
        preferredDayOfWeek: 2, // Thứ Hai
        preferredTimeSlot: '08:00-12:00',
        recipientName: 'Nguyễn Văn Test Prime',
        recipientPhone: testPhone,
        shippingAddress: '123 Nguyễn Thị Thập, P. Tân Phú, Quận 7, TP.HCM',
        province: 'TP. Hồ Chí Minh',
        district: 'Quận 7',
        ward: 'Phường Tân Phú',
        storeCode: 'NH',
        paymentMethod: 'vietqr',
        items: [
          {
            productId: 'sub-sb-01',
            name: 'Sữa Bắp Nếp Tươi (Lốc 7 chai)',
            unit: 'Lốc 7 chai',
            priceSnapshot: 126000,
            discountRate: 0.15,
            finalPrice: 107100,
            quantity: 1,
          },
          {
            productId: 'sub-shs-01',
            name: 'Sữa Hạt Sen Mekong (Lốc 7 chai)',
            unit: 'Lốc 7 chai',
            priceSnapshot: 126000,
            discountRate: 0.15,
            finalPrice: 107100,
            quantity: 1,
          },
        ],
      });

      assert.equal(sub.status, 'ACTIVE');
      assert.equal(sub.items.length, 2);
      assert.equal(sub.items[0].finalPrice, 107100);
      // Kiểm tra định dạng mã hợp đồng #SUB-xxxx (4 chữ số duy nhất)
      assert.match(sub.subscriptionCode, /^SUB-\d{4}$/, 'Mã hợp đồng phải có định dạng #SUB-xxxx');
      createdSubId = sub.id;
    });

    await itAsync('Query: Lấy danh sách hợp đồng định kỳ của khách hàng', async () => {
      const subs = await getUserSubscriptions(testUserId);
      assert.equal(subs.length >= 1, true);
      assert.equal(subs[0].id, createdSubId);
      assert.equal(subs[0].items.length, 2);
    });

    await itAsync('Address: Cập nhật địa chỉ nhận hàng thành công khi trong bán kính 25km', async () => {
      const updated = await updateSubscriptionAddress(createdSubId, testUserId, {
        recipientName: 'Nguyễn Văn Test Prime Đã Đổi',
        recipientPhone: '0909876543',
        shippingAddress: '456 Nguyễn Hữu Thọ, P. Tân Hưng, Quận 7',
        distanceKm: 6.5,
      });
      assert.equal(updated.recipientName, 'Nguyễn Văn Test Prime Đã Đổi');
      assert.equal(updated.shippingAddress, '456 Nguyễn Hữu Thọ, P. Tân Hưng, Quận 7');
    });

    await itAsync('Address: Từ chối cập nhật địa chỉ khi khoảng cách vượt quá 25km', async () => {
      await assert.rejects(
        async () => {
          await updateSubscriptionAddress(createdSubId, testUserId, {
            recipientName: 'Khách Ở Xa',
            recipientPhone: '0909876543',
            shippingAddress: 'Tỉnh Lộ 8, Củ Chi',
            distanceKm: 32.0,
          });
        },
        /vượt quá bán kính phục vụ/
      );
    });

    // ── NHÓM 4: THAO TÁC MINH BẠCH BỎ QUA KỲ GIAO (SKIP) ────────────────
    console.log('\n--- NHÓM 4: Thao Tác Bỏ Qua Kỳ Giao 1-Chạm (Skip Delivery) ---');
    await itAsync('Skip: Bỏ qua kỳ giao tiếp theo thành công và dời lịch sang tuần sau', async () => {
      const skipRes = await skipSubscriptionNextDelivery(createdSubId, testUserId, 'Khách còn nhiều sữa hạt');
      assert.equal(skipRes.success, true);
      assert.notEqual(skipRes.newNextDeliveryDate, null);

      // Kiểm tra trong CSDL: schedule cũ phải có status = 'SKIPPED'
      const schedRes = await pool.query(
        `SELECT status, skip_reason FROM subscription_schedules WHERE subscription_id = $1 ORDER BY created_at ASC LIMIT 1;`,
        [createdSubId]
      );
      assert.equal(schedRes.rows[0].status, 'SKIPPED');
      assert.equal(schedRes.rows[0].skip_reason, 'Khách còn nhiều sữa hạt');
    });

    // ── NHÓM 5: ĐỔI TẦN SUẤT & HỦY HỢP ĐỒNG MINH BẠCH ───────────────────
    console.log('\n--- NHÓM 5: Đổi Tần Suất & Hủy Hợp Đồng Minh Bạch ---');
    await itAsync('Frequency: Đổi sang giao 2 tuần / lần (Thứ Sáu)', async () => {
      const newDate = await updateSubscriptionFrequency(createdSubId, testUserId, '2_WEEKS', 6);
      assert.notEqual(newDate, null);

      const subRes = await pool.query(`SELECT delivery_frequency, preferred_day_of_week FROM subscriptions WHERE id = $1;`, [createdSubId]);
      assert.equal(subRes.rows[0].delivery_frequency, '2_WEEKS');
      assert.equal(subRes.rows[0].preferred_day_of_week, 6);
    });

    await itAsync('Cancel Sub: Hủy hợp đồng giao định kỳ minh bạch không cản trở', async () => {
      const ok = await cancelSubscription(createdSubId, testUserId, 'Sắp đi công tác');
      assert.equal(ok, true);

      const subRes = await pool.query(`SELECT status FROM subscriptions WHERE id = $1;`, [createdSubId]);
      assert.equal(subRes.rows[0].status, 'CANCELLED');
    });

    await itAsync('Cancel Member: Hủy gói Prime chuyển sang CANCELLED_GRACE bảo lưu quyền lợi', async () => {
      const ok = await cancelUserMembership(testUserId, 'Khảo sát: Không uống kịp');
      assert.equal(ok, true);

      const mem = await getUserMembership(testUserId);
      assert.equal(mem.status, 'CANCELLED_GRACE');
      assert.notEqual(mem.cancelledAt, null);
    });

  } finally {
    // Dọn dẹp dữ liệu kiểm thử
    console.log('\n--- DỌN DẸP DỮ LIỆU KIỂM THỬ ---');
    if (createdSubId) {
      await pool.query(`DELETE FROM subscription_items WHERE subscription_id = $1;`, [createdSubId]);
      await pool.query(`DELETE FROM subscription_schedules WHERE subscription_id = $1;`, [createdSubId]);
      await pool.query(`DELETE FROM subscriptions WHERE id = $1;`, [createdSubId]);
    }
    await pool.query(`DELETE FROM loyalty_point_ledger WHERE user_id = $1;`, [testUserId]);
    await pool.query(`DELETE FROM user_memberships WHERE user_id = $1;`, [testUserId]);
    await pool.query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
    await pool.end();
    console.log('✓ Đã dọn dẹp sạch sẽ toàn bộ bản ghi kiểm thử trong database.\n');
  }

  console.log('================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ E2E: ${passedCount} PASS, ${failedCount} FAIL`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runFullstackSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
