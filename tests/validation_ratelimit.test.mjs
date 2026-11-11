/**
 * Kiểm thử đơn vị: giới hạn tần suất (src/lib/rateLimit.ts), chính sách mật khẩu admin
 * (src/lib/password-policy.ts), kiểm tra URL/đường dẫn upload (src/lib/content-validation.ts),
 * máy trạng thái hội viên (src/lib/membership/stateMachine.ts). Không cần mạng, không cần CSDL.
 * Chạy: npx tsx --test tests/validation_ratelimit.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { checkRateLimit, recordFailedLogin, resetLoginRateLimit, checkRequestRateLimit } from '@/lib/rateLimit';
import { validateAdminPassword, ADMIN_PASSWORD_MIN_LENGTH } from '@/lib/password-policy';
import { isSafeUrl, isOptionalSafeUrl, resolveUploadedFile } from '@/lib/content-validation';
import { transitionMemberState } from '@/lib/membership/stateMachine';

let seq = 0;
const freshKey = () => `test-key-${process.pid}-${++seq}`;

describe('rateLimit — đăng nhập sai', () => {
  test('khóa chưa có bản ghi: không bị chặn, còn 5 lượt', () => {
    const r = checkRateLimit(freshKey());
    assert.deepEqual(r, { isBlocked: false, remainingSeconds: 0, remainingAttempts: 5 });
  });

  test('4 lần sai chưa khóa, lần thứ 5 khóa 15 phút', () => {
    const key = freshKey();
    for (let i = 1; i <= 4; i++) {
      const r = recordFailedLogin(key);
      assert.equal(r.isBlocked, false);
      assert.equal(r.failedCount, i);
      assert.equal(r.remainingAttempts, 5 - i);
    }
    const fifth = recordFailedLogin(key);
    assert.equal(fifth.isBlocked, true);
    assert.equal(fifth.remainingSeconds, 900);
    assert.equal(fifth.remainingAttempts, 0);

    const check = checkRateLimit(key);
    assert.equal(check.isBlocked, true);
    assert.ok(check.remainingSeconds > 890 && check.remainingSeconds <= 900);
  });

  test('đăng nhập đúng thì xóa bộ đếm', () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) recordFailedLogin(key);
    resetLoginRateLimit(key);
    assert.equal(checkRateLimit(key).isBlocked, false);
    assert.equal(checkRateLimit(key).remainingAttempts, 5);
  });

  test('các khóa độc lập với nhau', () => {
    const a = freshKey();
    const b = freshKey();
    for (let i = 0; i < 5; i++) recordFailedLogin(a);
    assert.equal(checkRateLimit(b).isBlocked, false);
  });
});

describe('rateLimit — checkRequestRateLimit', () => {
  test('cho đúng số request tối đa rồi mới chặn', () => {
    const key = freshKey();
    assert.deepEqual(
      [1, 2, 3].map(() => checkRequestRateLimit(key, 3, 60000).isBlocked),
      [false, false, false]
    );
    const fourth = checkRequestRateLimit(key, 3, 60000);
    assert.equal(fourth.isBlocked, true);
    assert.equal(fourth.remaining, 0);
    assert.ok(fourth.resetInSeconds >= 1 && fourth.resetInSeconds <= 60);
  });

  test('số lượt còn lại giảm dần', () => {
    const key = freshKey();
    assert.equal(checkRequestRateLimit(key, 3, 60000).remaining, 2);
    assert.equal(checkRequestRateLimit(key, 3, 60000).remaining, 1);
    assert.equal(checkRequestRateLimit(key, 3, 60000).remaining, 0);
  });

  test('hết cửa sổ thời gian thì đếm lại', async () => {
    const key = freshKey();
    checkRequestRateLimit(key, 1, 20);
    assert.equal(checkRequestRateLimit(key, 1, 20).isBlocked, true);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(checkRequestRateLimit(key, 1, 20).isBlocked, false);
  });
});

describe('validateAdminPassword', () => {
  test('hợp lệ: đủ dài, có chữ và số', () => {
    assert.equal(validateAdminPassword('abc12345'), null);
    assert.equal(validateAdminPassword('a1'.repeat(64)), null);
  });

  test('quá ngắn hoặc không phải chuỗi', () => {
    assert.equal(ADMIN_PASSWORD_MIN_LENGTH, 8);
    for (const v of ['abc1234', '', null, undefined, 12345678]) {
      assert.match(String(validateAdminPassword(v)), /ít nhất 8 ký tự/, String(v));
    }
  });

  test('thiếu chữ hoặc thiếu số', () => {
    assert.match(validateAdminPassword('abcdefgh'), /chữ cái và chữ số/);
    assert.match(validateAdminPassword('12345678'), /chữ cái và chữ số/);
  });

  test('dài quá 128 ký tự', () => {
    assert.match(validateAdminPassword('a1'.repeat(64) + 'x'), /tối đa 128/);
  });
});

describe('content-validation — isSafeUrl', () => {
  test('cho phép đường dẫn nội bộ và http(s)', () => {
    assert.equal(isSafeUrl('/san-pham/sua-bap'), true);
    assert.equal(isSafeUrl('https://example.com/a?b=1'), true);
    assert.equal(isSafeUrl('HTTP://example.com'), true);
  });

  test('chặn giao thức nguy hiểm và "//host"', () => {
    for (const v of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.com', 'evil.com', 'ftp://x']) {
      assert.equal(isSafeUrl(v), false, v);
    }
  });

  test('chặn "../" (kể cả dạng mã hóa) và dấu "\\"', () => {
    assert.equal(isSafeUrl('/a/../b'), false);
    assert.equal(isSafeUrl('/a/%2e%2e/b'), false);
    assert.equal(isSafeUrl('/a/%2E%2E'), false);
    assert.equal(isSafeUrl('/a\\b'), false);
  });

  test('chặn khoảng trắng, quá dài, sai kiểu', () => {
    assert.equal(isSafeUrl('/a b'), false);
    assert.equal(isSafeUrl('/' + 'a'.repeat(1000)), false);
    assert.equal(isSafeUrl('/abc', 3), false);
    assert.equal(isSafeUrl(123), false);
    assert.equal(isSafeUrl(null), false);
    assert.equal(isSafeUrl(''), false);
  });

  test('isOptionalSafeUrl: bỏ trống là hợp lệ', () => {
    assert.equal(isOptionalSafeUrl(''), true);
    assert.equal(isOptionalSafeUrl(null), true);
    assert.equal(isOptionalSafeUrl(undefined), true);
    assert.equal(isOptionalSafeUrl('javascript:x'), false);
    assert.equal(isOptionalSafeUrl('/ok'), true);
  });
});

describe('content-validation — resolveUploadedFile', () => {
  test('đường dẫn hợp lệ trả về file nằm trong thư mục uploads', () => {
    const abs = resolveUploadedFile('/uploads/products/a.jpg');
    assert.ok(abs && path.isAbsolute(abs));
    assert.ok(abs.endsWith(path.join('products', 'a.jpg')));
  });

  test('mọi đường thoát ra ngoài đều trả null', () => {
    for (const v of [
      '/uploads/../.env',
      '/uploads/%2e%2e/.env',
      '/uploads/a/../../.env',
      '/uploads/..\\..\\.env',
      '/uploads/a%00.jpg',
      '/uploads/%E0%A4%A',
      '/etc/passwd',
      'uploads/a.jpg',
      '/uploads',
      '',
      null,
      42,
    ]) {
      assert.equal(resolveUploadedFile(v), null, String(v));
    }
  });
});

describe('membership stateMachine — transitionMemberState', () => {
  test('các bước hợp lệ chính', () => {
    assert.deepEqual(transitionMemberState('STANDARD_FREE', 'OPT_IN_TRIAL'), {
      allowed: true,
      nextStatus: 'TRIAL_ACTIVE',
      hasAccessToBenefits: true,
    });
    assert.equal(transitionMemberState('TRIAL_ACTIVE', 'TRIAL_EXPIRED').nextStatus, 'STANDARD_FREE');
    assert.equal(transitionMemberState('RENEWAL_DUE', 'RENEWAL_OVERDUE').nextStatus, 'EXPIRED_CHURN');
    assert.equal(transitionMemberState('WIN_BACK', 'KEEP_FREE').nextStatus, 'STANDARD_FREE');
  });

  test('hủy gói trả phí: giữ quyền lợi tới hết kỳ (CANCELLED_GRACE)', () => {
    const r = transitionMemberState('PAID_ACTIVE', 'REQUEST_CANCEL');
    assert.equal(r.nextStatus, 'CANCELLED_GRACE');
    assert.equal(r.hasAccessToBenefits, true);
    const expired = transitionMemberState('CANCELLED_GRACE', 'PERIOD_EXPIRED');
    assert.equal(expired.nextStatus, 'EXPIRED_CHURN');
    assert.equal(expired.hasAccessToBenefits, false);
  });

  test('tạm dừng mất quyền lợi, tiếp tục thì có lại', () => {
    assert.equal(transitionMemberState('PAID_ACTIVE', 'REQUEST_PAUSE').hasAccessToBenefits, false);
    assert.equal(transitionMemberState('PAUSED', 'RESUME_MEMBERSHIP').nextStatus, 'PAID_ACTIVE');
  });

  test('sự kiện không hợp lệ: giữ nguyên trạng thái, có lý do, quyền lợi theo trạng thái hiện tại', () => {
    const r = transitionMemberState('STANDARD_FREE', 'RENEWAL_PAID');
    assert.equal(r.allowed, false);
    assert.equal(r.nextStatus, 'STANDARD_FREE');
    assert.equal(r.hasAccessToBenefits, false);
    assert.match(r.reason, /STANDARD_FREE.*RENEWAL_PAID/);

    const paid = transitionMemberState('PAID_ACTIVE', 'OPT_IN_TRIAL');
    assert.equal(paid.allowed, false);
    assert.equal(paid.hasAccessToBenefits, true);
  });

  test('không dùng thử lại được sau khi đã rời gói', () => {
    assert.equal(transitionMemberState('EXPIRED_CHURN', 'OPT_IN_TRIAL').allowed, false);
    assert.equal(transitionMemberState('TRIAL_ACTIVE', 'OPT_IN_TRIAL').allowed, false);
  });
});
