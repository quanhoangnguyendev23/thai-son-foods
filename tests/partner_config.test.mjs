/**
 * Kiểm thử đơn vị: chiết khấu hạng đại lý (src/config/partner.ts, REVIEW.md R23). Không cần mạng, không cần CSDL.
 * Chạy: npx tsx --test tests/partner_config.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDealerDiscountPercent, DEFAULT_DEALER_DISCOUNT_PERCENT, PARTNER_CONFIG } from '@/config/partner';

describe('resolveDealerDiscountPercent', () => {
  test('R23: hạng chiết khấu 0% giữ nguyên 0 (không bị đổi thành 15%)', () => {
    assert.equal(resolveDealerDiscountPercent(0), 0);
    assert.equal(resolveDealerDiscountPercent('0'), 0);
    assert.equal(resolveDealerDiscountPercent('0.00'), 0);
  });

  test('giá trị hợp lệ giữ nguyên, kể cả chuỗi số từ NUMERIC của PostgreSQL', () => {
    assert.equal(resolveDealerDiscountPercent(15), 15);
    assert.equal(resolveDealerDiscountPercent('20.00'), 20);
    assert.equal(resolveDealerDiscountPercent(12.5), 12.5);
    assert.equal(resolveDealerDiscountPercent(100), 100);
  });

  test('thiếu hoặc không hợp lệ: dùng mặc định 15%', () => {
    assert.equal(DEFAULT_DEALER_DISCOUNT_PERCENT, 15);
    for (const v of [null, undefined, '', 'abc', NaN, -5, 101, Infinity]) {
      assert.equal(resolveDealerDiscountPercent(v), 15, String(v));
    }
  });

  test('mặc định khớp hạng đầu tiên trong cấu hình', () => {
    assert.equal(DEFAULT_DEALER_DISCOUNT_PERCENT, PARTNER_CONFIG.DEALER_TIERS_DEFAULT[0].discountRate);
  });
});
