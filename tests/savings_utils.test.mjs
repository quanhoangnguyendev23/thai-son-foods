/**
 * Kiểm thử đơn vị: Túi tiết kiệm (src/lib/savings.ts), định dạng (src/lib/utils.ts),
 * giá vốn (src/lib/costSnapshot.ts). Không cần mạng, không cần CSDL.
 * Chạy: npx tsx --test tests/savings_utils.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getCartSavings, getComboSaving, findCombo, formatShortVND } from '@/lib/savings';
import { formatPrice, formatKcal, clamp, cn } from '@/lib/utils';
import { totalCostOfBottles } from '@/lib/costSnapshot';

const comboA = { id: 'combo-test-a', slug: 'combo-test-a', originalPrice: 180000, salePrice: 160000, isActive: true };
const lineA = { productId: 'combo-test-a', slug: 'combo-test-a', price: 160000, quantity: 2 };

describe('savings', () => {
  test('getComboSaving = giá gốc trừ giá bán, không âm', () => {
    assert.equal(getComboSaving(comboA), 20000);
    assert.equal(getComboSaving({ ...comboA, originalPrice: 100000 }), 0);
    assert.equal(getComboSaving({ ...comboA, originalPrice: undefined }), 0);
    assert.equal(getComboSaving({ ...comboA, originalPrice: '180000', salePrice: '150000' }), 30000);
  });

  test('getCartSavings nhân theo số lượng', () => {
    assert.equal(getCartSavings([lineA], [comboA]), 40000);
  });

  test('getCartSavings: dòng không phải combo, giỏ rỗng trả 0', () => {
    const product = { productId: 'sp-khong-phai-combo', slug: 'sp-khong-phai-combo', price: 126000, quantity: 3 };
    assert.equal(getCartSavings([product], [comboA]), 0);
    assert.equal(getCartSavings([], [comboA]), 0);
  });

  test('getCartSavings: giá trong giỏ cao hơn giá gốc thì không tính âm', () => {
    assert.equal(getCartSavings([{ ...lineA, price: 200000 }], [comboA]), 0);
  });

  test('getCartSavings dùng giá đang nằm trong giỏ, không dùng salePrice của combo', () => {
    assert.equal(getCartSavings([{ ...lineA, price: 170000, quantity: 1 }], [comboA]), 10000);
  });

  test('findCombo khớp theo id hoặc slug', () => {
    assert.equal(findCombo([comboA], { productId: 'combo-test-a', slug: 'khac' }), comboA);
    assert.equal(findCombo([comboA], { productId: 'khac', slug: 'combo-test-a' }), comboA);
    assert.equal(findCombo([comboA], { productId: 'khong-co', slug: 'khong-co' }), undefined);
  });

  // REVIEW.md R8 — chưa rõ hành vi đúng nên để todo, chờ chủ dự án quyết định
  test(
    'R8: combo đã tạm dừng trong CSDL (danh sách rỗng) không còn được tính tiết kiệm từ dữ liệu tĩnh',
    { todo: 'Chờ quyết định nghiệp vụ: combo tạm dừng còn trong giỏ có hiện tiết kiệm không' },
    () => {
      const staticLine = { productId: 'combo-van-phong', slug: 'combo-van-phong', price: 160000, quantity: 1 };
      assert.equal(getCartSavings([staticLine], []), 0);
    }
  );

  test('formatShortVND', () => {
    assert.equal(formatShortVND(0), '0');
    assert.equal(formatShortVND(500), '500');
    assert.equal(formatShortVND(1000), '1K');
    assert.equal(formatShortVND(40000), '40K');
    assert.equal(formatShortVND(1000000), '1Tr');
    assert.equal(formatShortVND(1250000), '1,25Tr');
  });

  test('R7: 999.500đ phải hiện "1Tr", không phải "1000K"', () => {
    assert.equal(formatShortVND(999500), '1Tr');
  });
});

describe('utils', () => {
  test('formatPrice chèn dấu chấm ngăn nghìn', () => {
    assert.equal(formatPrice(0), '0');
    assert.equal(formatPrice(999), '999');
    assert.equal(formatPrice(18000), '18.000');
    assert.equal(formatPrice(1234567), '1.234.567');
  });

  test('formatPrice làm tròn số lẻ và giữ dấu âm', () => {
    assert.equal(formatPrice(1999.6), '2.000');
    assert.equal(formatPrice(-1500), '-1.500');
  });

  test('formatPrice: NaN hoặc không phải số trả "0"', () => {
    assert.equal(formatPrice(NaN), '0');
    assert.equal(formatPrice('18000'), '0');
    assert.equal(formatPrice(undefined), '0');
  });

  test('formatKcal kiểu số Việt Nam, null khi thiếu', () => {
    assert.equal(formatKcal(31), '31 kcal');
    assert.equal(formatKcal(10.8), '10,8 kcal');
    assert.equal(formatKcal(0), '0 kcal');
    assert.equal(formatKcal(null), null);
    assert.equal(formatKcal(undefined), null);
    assert.equal(formatKcal(NaN), null);
  });

  test('clamp và cn', () => {
    assert.equal(clamp(5, 1, 10), 5);
    assert.equal(clamp(-5, 1, 10), 1);
    assert.equal(clamp(50, 1, 10), 10);
    assert.equal(cn('a', false, null, undefined, 'b'), 'a b');
    assert.equal(cn(), '');
  });
});

describe('costSnapshot.totalCostOfBottles', () => {
  const costs = new Map([
    ['p1', 9000],
    ['p2', 12000],
  ]);

  test('cộng giá vốn theo số chai', () => {
    assert.equal(
      totalCostOfBottles(
        [
          { productId: 'p1', bottleQuantity: 7 },
          { productId: 'p2', bottleQuantity: 2 },
        ],
        costs
      ),
      87000
    );
  });

  test('thiếu giá vốn của một chai bất kỳ: null (không ghi giá vốn thiếu)', () => {
    assert.equal(
      totalCostOfBottles(
        [
          { productId: 'p1', bottleQuantity: 7 },
          { productId: 'chua-co', bottleQuantity: 1 },
        ],
        costs
      ),
      null
    );
  });

  test('danh sách rỗng hoặc tổng bằng 0: null', () => {
    assert.equal(totalCostOfBottles([], costs), null);
    assert.equal(totalCostOfBottles([{ productId: 'p1', bottleQuantity: 0 }], costs), null);
  });
});
