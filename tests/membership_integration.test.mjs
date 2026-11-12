/**
 * Kiểm thử tích hợp hội viên và OTP (vòng 3) trên DB RIÊNG "webtsf_review_test", phiên khách giả của tests/helpers/review_test_session.mjs.
 * Các test "Rxx" phản ánh REVIEW.md. Chạy: npx tsx --test tests/membership_integration.test.mjs
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupReviewTestEnv, lockReviewTestDb } from './helpers/review_test_db.mjs';
import { installFakeNextHeaders, loginUser, logoutUser, jsonRequest, readJson } from './helpers/review_test_session.mjs';

setupReviewTestEnv();
installFakeNextHeaders();

const { pool, initDatabase } = await import('@/lib/db');
const { ensureMembershipSchema, addLoyaltyPoints } = await import('@/lib/membership/repository');
const subscribe = await import('@/app/api/membership/subscribe/route');
const otpSend = await import('@/app/api/membership/auth/otp/send/route');
const partnerOtpSend = await import('@/app/api/partner/otp/send/route');

async function call(handler, path, { method = 'POST', body, headers } = {}) {
  const res = await handler(jsonRequest(`http://localhost${path}`, { method, body, headers }));
  return { status: res.status, json: await readJson(res) };
}

let releaseDbLock = async () => {};

before(async () => {
  releaseDbLock = await lockReviewTestDb(pool);
  await initDatabase();
  // Bảng điểm thưởng đúng như scripts/migrations/phase7_membership_schema.sql (khớp các câu truy vấn trong repository.ts);
  // ensureMembershipSchema tạo bảng này với cột khác (xem test R43), nên tạo trước để các test R41 chạy trên lược đồ đúng
  await pool.query('DROP TABLE IF EXISTS loyalty_point_ledger;'); // DB test riêng; bỏ bản tạo bởi lần chạy trước
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_point_ledger (
      id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(100) NOT NULL, points INTEGER NOT NULL, balance_after INTEGER NOT NULL,
      source_type VARCHAR(50) NOT NULL, reference_id VARCHAR(100), description TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  await ensureMembershipSchema();
});

beforeEach(async () => {
  logoutUser();
  await pool.query('TRUNCATE loyalty_point_ledger, user_memberships, users CASCADE;');
});

after(async () => {
  await releaseDbLock();
  await pool.end();
});

describe('R43: định nghĩa bảng điểm thưởng trong ensureMembershipSchema khớp câu truy vấn của repository', () => {
  test('addLoyaltyPoints cộng điểm được trên lược đồ migration (đối chứng)', async () => {
    const u = await loginUser(pool);
    assert.equal(await addLoyaltyPoints(u.id, 50, 'SIGNUP_BONUS', 'Thưởng thử'), 50);
  });

  test('R43: DDL loyalty_point_ledger trong ensureMembershipSchema phải có đủ cột mà INSERT/SELECT dùng (points, source_type, description)', () => {
    const src = readFileSync(new URL('../src/lib/membership/repository.ts', import.meta.url), 'utf8');
    const ddl = src.match(/CREATE TABLE IF NOT EXISTS loyalty_point_ledger \(([\s\S]*?)\);/)?.[1] || '';
    for (const col of ['points', 'source_type', 'description']) {
      assert.match(ddl, new RegExp(`\\b${col}\\b`), `DDL thiếu cột "${col}"; DDL hiện có: ${ddl.replace(/\s+/g, ' ').slice(0, 200)}`);
    }
  });
});

describe('POST /api/membership/subscribe', () => {
  const sub = (body) => call(subscribe.POST, '/api/membership/subscribe', { body });

  test('chưa đăng nhập: 401', async () => {
    assert.equal((await sub({ tierCode: 'PRIME_MONTHLY' })).status, 401);
  });

  test('mã gói sai: 400', async () => {
    await loginUser(pool);
    assert.equal((await sub({ tierCode: 'GOLD' })).status, 400);
  });

  test('R41: thưởng chào mừng 50 điểm chỉ được cộng một lần dù gọi đăng ký nhiều lần', async () => {
    const u = await loginUser(pool);
    for (let i = 0; i < 3; i++) assert.equal((await sub({ tierCode: 'PRIME_MONTHLY', isTrial: true })).status, 200);
    const r = (await pool.query('SELECT count(*)::int c, COALESCE(SUM(points), 0)::int p FROM loyalty_point_ledger WHERE user_id = $1', [u.id])).rows[0];
    assert.ok(r.c <= 1, `số dòng điểm thưởng sau 3 lần đăng ký = ${r.c} (tổng ${r.p} điểm)`);
  });

  test('R41: dùng thử 30 ngày chỉ được kích hoạt một lần (gọi lại không được gia hạn thêm)', async () => {
    const u = await loginUser(pool);
    assert.equal((await sub({ tierCode: 'PRIME_MONTHLY', isTrial: true })).status, 200);
    const first = (await pool.query('SELECT expires_at, started_at FROM user_memberships WHERE user_id = $1', [u.id])).rows[0];
    await pool.query("UPDATE user_memberships SET started_at = started_at - INTERVAL '29 days', expires_at = expires_at - INTERVAL '29 days' WHERE user_id = $1", [u.id]);
    const second = await sub({ tierCode: 'PRIME_MONTHLY', isTrial: true });
    const now = (await pool.query('SELECT expires_at FROM user_memberships WHERE user_id = $1', [u.id])).rows[0];
    const daysLeft = (new Date(now.expires_at).getTime() - Date.now()) / 86400000;
    assert.ok(second.status !== 200 || daysLeft < 5, `sau 29 ngày dùng thử, gọi lại thì còn ${daysLeft.toFixed(1)} ngày (đã được gia hạn thêm 30 ngày)`);
    void first;
  });

  test('gói trả phí PRIME_YEARLY đăng ký được mà không qua bước thanh toán nào (ghi nhận hành vi hiện tại)', async () => {
    const u = await loginUser(pool);
    const r = await sub({ tierCode: 'PRIME_YEARLY', isTrial: false });
    assert.equal(r.status, 200);
    assert.equal((await pool.query('SELECT status FROM user_memberships WHERE user_id = $1', [u.id])).rows[0].status, 'PAID_ACTIVE');
    console.log('[R41 thông tin] PRIME_YEARLY thành PAID_ACTIVE ngay, không có bước thanh toán.');
  });
});

describe('R40: gửi OTP không bị giới hạn tần suất', () => {
  test('gửi OTP khách hàng 10 lần liên tiếp cho cùng một SĐT: phải bị giới hạn (429) trước lần thứ 10', async () => {
    const statuses = [];
    for (let i = 0; i < 10; i++) statuses.push((await call(otpSend.POST, '/api/membership/auth/otp/send', { body: { phone: '0901234567' } })).status);
    assert.ok(statuses.includes(429), `mã trả về: ${statuses.join(',')}`);
  });

  test('gửi OTP đối tác 10 lần liên tiếp cho cùng một SĐT: phải bị giới hạn (429) trước lần thứ 10', async () => {
    const statuses = [];
    for (let i = 0; i < 10; i++) statuses.push((await call(partnerOtpSend.POST, '/api/partner/otp/send', { body: { phone: '0901234567' } })).status);
    assert.ok(statuses.includes(429), `mã trả về: ${statuses.join(',')}`);
  });
});
