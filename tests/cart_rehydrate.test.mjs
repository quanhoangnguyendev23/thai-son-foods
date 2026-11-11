/**
 * Kiểm thử đơn vị: nâng cấp giỏ hàng cũ (chai lẻ) khi nạp lại từ localStorage (sanitizeCartItems trong src/store/cart.ts).
 * Giả lập localStorage của trình duyệt trước khi nạp store; dùng store thật, không mock logic. Không cần mạng, không cần CSDL.
 * Chạy: npx tsx --test tests/cart_rehydrate.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const legacyItem = (productId, slug, quantity) => ({
  productId,
  name: productId,
  slug,
  price: 18000,
  unit: '1 chai',
  thumbnail: '',
  quantity,
});

// zustand persist lấy window.localStorage lúc tạo store: dựng một bản giả dùng chung cho cả file test, trước khi nạp store
const data = {};
globalThis.window = {
  localStorage: {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  },
};

/** Đặt giỏ cũ vào localStorage giả rồi nạp lại giỏ từ đó */
async function rehydrateWith(items) {
  data['cart-storage'] = JSON.stringify({ state: { items }, version: 0 });
  const { useCartStore } = await import('@/store/cart');
  await useCartStore.persist.rehydrate();
  return useCartStore.getState().items;
}

describe('giỏ cũ có chai lẻ được đổi sang lốc nhỏ nhất khi nạp lại', () => {
  test('sản phẩm lốc nhỏ nhất 7 chai: 14 chai lẻ thành 2 lốc, đơn vị đổi sang lốc', async () => {
    const items = await rehydrateWith([legacyItem('sua-bap-nep', 'sua-bap-nep-thai-son', 14)]);
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 2);
    assert.equal(items[0].variantId, 'sb-7chai');
    assert.equal(items[0].price, 126000);
    assert.equal(items[0].unit, 'Lốc 7 chai');
  });

  test('dòng đã là lốc thì giữ nguyên', async () => {
    const pack = { ...legacyItem('sua-bap-nep-sb-7chai', 'sua-bap-nep-thai-son', 3), unit: 'Lốc 7 chai', price: 126000, variantId: 'sb-7chai', variantName: '7 chai' };
    const items = await rehydrateWith([pack]);
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 3);
    assert.equal(items[0].price, 126000);
  });
});

describe('R14 — số chai lẻ phải chia theo số chai của lốc nhỏ nhất của chính sản phẩm đó', () => {
  test('R14: sản phẩm lốc nhỏ nhất 6 chai: 24 chai lẻ phải thành 4 lốc (24 chai)', async () => {
    const items = await rehydrateWith([legacyItem('sua-hat-sen-lotus', 'sua-hat-sen-lotus-thai-son', 24)]);
    assert.equal(items.length, 1);
    assert.equal(items[0].variantName, '6 chai', 'phải đổi sang lốc nhỏ nhất của sản phẩm');
    assert.equal(items[0].quantity, 4, `quantity = ${items[0].quantity} lốc = ${items[0].quantity * 6} chai, mong đợi 24 chai`);
  });
});
