/**
 * Kiểm thử đơn vị: giỏ hàng (src/store/cart.ts) — hệ số chai, giới hạn số lượng, gộp dòng, tổng tiền.
 * Dùng store thật (zustand), không mock. Không cần mạng, không cần CSDL.
 * Chạy: npx tsx --test tests/cart_store.test.mjs
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  useCartStore,
  getItemBottleMultiplier,
  getItemMaxQuantity,
  getCartMergeKey,
  findCartLine,
  MAX_BOTTLES_LIMIT,
} from '@/store/cart';

const cart = () => useCartStore.getState();

// Lốc 7 chai Sữa bắp nếp, mã kiểu thẻ sản phẩm (dữ liệu tĩnh)
const packFromCard = {
  productId: 'sua-bap-nep-sb-7chai',
  name: 'Sữa bắp nếp (7 chai)',
  slug: 'sua-bap-nep-thai-son',
  price: 126000,
  unit: 'Lốc 7 chai',
  thumbnail: '/images/sb.jpg',
  variantId: 'sb-7chai',
  variantName: '7 chai',
};
// Cùng quy cách nhưng mã kiểu trang chi tiết (mã quy cách trong CSDL)
const packFromDetail = { ...packFromCard, productId: 'sua-bap-nep-var_abc123', variantId: 'var_abc123' };
const combo = {
  productId: 'combo-van-phong',
  name: 'Combo văn phòng',
  slug: 'combo-van-phong',
  price: 160000,
  unit: 'Combo',
  thumbnail: '/images/combo.jpg',
};

beforeEach(() => {
  useCartStore.setState({ items: [], lastAddedItem: null, isOpen: false });
});

describe('getItemBottleMultiplier', () => {
  test('đọc số chai từ đơn vị, tên, mã quy cách', () => {
    assert.equal(getItemBottleMultiplier({ unit: 'Lốc 7 chai' }), 7);
    assert.equal(getItemBottleMultiplier({ name: 'Pack of 6 bottles' }), 6);
    assert.equal(getItemBottleMultiplier({ unit: 'thùng 24' }), 24);
    assert.equal(getItemBottleMultiplier({ productId: 'sua-bap-nep-sb-10chai' }), 10);
    assert.equal(getItemBottleMultiplier({ variantId: 'x-7chai' }), 7);
  });

  // REVIEW.md R16 — comment ở cart.ts:27 nói nhận dạng được "-loc5" nhưng biểu thức chính quy không khớp
  test('R16: mã quy cách dạng "-loc5" phải ra 5 chai như comment mô tả', () => {
    assert.equal(getItemBottleMultiplier({ variantId: 'x-loc5' }), 5);
  });

  test('không có chỉ báo: 1 chai', () => {
    assert.equal(getItemBottleMultiplier({}), 1);
    assert.equal(getItemBottleMultiplier({ productId: 'combo-van-phong', unit: 'Combo' }), 1);
    assert.equal(getItemBottleMultiplier({ unit: '0 chai' }), 1);
  });
});

describe('getItemMaxQuantity', () => {
  test('giới hạn 1.000 chai quy ra số lốc', () => {
    assert.equal(MAX_BOTTLES_LIMIT, 1000);
    assert.equal(getItemMaxQuantity({ unit: 'Lốc 7 chai' }), 142);
    assert.equal(getItemMaxQuantity({ unit: 'thùng 24' }), 41);
    assert.equal(getItemMaxQuantity({ unit: 'Combo' }), 1000);
  });

  test('quy cách lớn hơn 1.000 chai vẫn cho tối thiểu 1', () => {
    assert.equal(getItemMaxQuantity({ unit: 'thùng 5000' }), 1);
  });
});

describe('getCartMergeKey', () => {
  test('cùng sản phẩm + cùng số chai ra cùng khóa dù mã quy cách khác nhau', () => {
    assert.equal(getCartMergeKey(packFromCard), 'sua-bap-nep::7');
    assert.equal(getCartMergeKey(packFromDetail), 'sua-bap-nep::7');
  });

  test('khác số chai ra khóa khác', () => {
    const ten = { ...packFromCard, productId: 'sua-bap-nep-sb-10chai', variantId: 'sb-10chai', variantName: '10 chai' };
    assert.notEqual(getCartMergeKey(ten), getCartMergeKey(packFromCard));
  });

  test('không có quy cách: khóa là productId', () => {
    assert.equal(getCartMergeKey(combo), 'combo-van-phong');
    assert.equal(getCartMergeKey({ productId: 'a-b', variantId: 'zzz' }), 'a-b');
  });
});

describe('useCartStore — thêm, sửa, xóa', () => {
  test('thêm sản phẩm mới: 1 dòng, số lượng mặc định 1', () => {
    cart().addItem(packFromCard);
    assert.equal(cart().items.length, 1);
    assert.equal(cart().items[0].quantity, 1);
    assert.equal(cart().lastAddedItem.productId, packFromCard.productId);
  });

  test('thêm lại cùng sản phẩm: cộng dồn số lượng', () => {
    cart().addItem(packFromCard, 2);
    cart().addItem(packFromCard, 3);
    assert.equal(cart().items.length, 1);
    assert.equal(cart().items[0].quantity, 5);
  });

  test('thêm từ trang chi tiết rồi từ thẻ: gộp 1 dòng, giữ mã của dòng có trước', () => {
    cart().addItem(packFromDetail, 1);
    cart().addItem(packFromCard, 1);
    assert.equal(cart().items.length, 1);
    assert.equal(cart().items[0].quantity, 2);
    assert.equal(cart().items[0].productId, packFromDetail.productId);
  });

  test('chai lẻ tự quy đổi về lốc nhỏ nhất của sản phẩm', () => {
    cart().addItem({
      productId: 'sua-bap-nep',
      name: 'Sữa bắp nếp',
      slug: 'sua-bap-nep-thai-son',
      price: 18000,
      unit: '1 chai',
      thumbnail: '',
    });
    const line = cart().items[0];
    assert.equal(line.productId, 'sua-bap-nep-sb-7chai');
    assert.equal(line.price, 126000);
    assert.equal(line.variantId, 'sb-7chai');
    assert.equal(line.unit, 'Lốc 7 chai');
  });

  test('số lượng 0 hoặc âm khi thêm: tối thiểu 1', () => {
    cart().addItem(packFromCard, 0);
    assert.equal(cart().items[0].quantity, 1);
    cart().clearCart();
    cart().addItem(packFromCard, -5);
    assert.equal(cart().items[0].quantity, 1);
  });

  test('vượt 1.000 chai: kẹp về tối đa 142 lốc 7 chai, kể cả khi cộng dồn', () => {
    cart().addItem(packFromCard, 500);
    assert.equal(cart().items[0].quantity, 142);
    cart().addItem(packFromCard, 10);
    assert.equal(cart().items[0].quantity, 142);
  });

  test('increaseQuantity dừng ở mức tối đa; decreaseQuantity về 0 thì xóa dòng', () => {
    cart().addItem(packFromCard, 141);
    cart().increaseQuantity(packFromCard.productId);
    cart().increaseQuantity(packFromCard.productId);
    assert.equal(cart().items[0].quantity, 142);

    cart().setQuantity(packFromCard.productId, 2);
    cart().decreaseQuantity(packFromCard.productId);
    assert.equal(cart().items[0].quantity, 1);
    cart().decreaseQuantity(packFromCard.productId);
    assert.equal(cart().items.length, 0);
  });

  test('setQuantity: 0 hoặc âm xóa dòng, quá lớn kẹp về tối đa', () => {
    cart().addItem(packFromCard, 3);
    cart().setQuantity(packFromCard.productId, 9999);
    assert.equal(cart().items[0].quantity, 142);
    cart().setQuantity(packFromCard.productId, 0);
    assert.equal(cart().items.length, 0);

    cart().addItem(packFromCard, 3);
    cart().updateQuantity(packFromCard.productId, -1);
    assert.equal(cart().items.length, 0);
  });

  test('thao tác trên mã không tồn tại: giỏ giữ nguyên', () => {
    cart().addItem(packFromCard, 2);
    cart().increaseQuantity('khong-co');
    cart().decreaseQuantity('khong-co');
    cart().setQuantity('khong-co', 5);
    cart().removeItem('khong-co');
    assert.equal(cart().items.length, 1);
    assert.equal(cart().items[0].quantity, 2);
  });

  test('tổng số lượng và tạm tính', () => {
    cart().addItem(packFromCard, 2);
    cart().addItem(combo, 3);
    assert.equal(cart().getTotalQuantity(), 5);
    assert.equal(cart().getSubtotal(), 2 * 126000 + 3 * 160000);
    assert.equal(cart().getTotalPrice(), cart().getSubtotal());
  });

  test('giỏ rỗng: tổng bằng 0', () => {
    assert.equal(cart().getTotalQuantity(), 0);
    assert.equal(cart().getSubtotal(), 0);
  });
});

describe('Hồi quy cho lỗi R4, R5 trong REVIEW.md (đã sửa)', () => {
  test('R4: addItem với số lượng NaN không được làm hỏng số lượng và tạm tính', () => {
    cart().addItem(packFromCard, NaN);
    assert.ok(Number.isFinite(cart().items[0].quantity), `quantity = ${cart().items[0].quantity}`);
    assert.ok(Number.isFinite(cart().getSubtotal()), `subtotal = ${cart().getSubtotal()}`);
  });

  test('R4: setQuantity với NaN không được ghi NaN vào dòng hàng', () => {
    cart().addItem(packFromCard, 2);
    cart().setQuantity(packFromCard.productId, NaN);
    const line = cart().items.find((i) => i.productId === packFromCard.productId);
    assert.ok(!line || Number.isFinite(line.quantity), `quantity = ${line && line.quantity}`);
  });

  test('R5: hoàn tác "vừa thêm" từ thẻ sản phẩm khi dòng đã gộp vào mã của trang chi tiết', () => {
    cart().addItem(packFromDetail, 1); // khách thêm từ trang chi tiết trước
    cart().addItem(packFromCard, 1); // rồi bấm thêm trên thẻ sản phẩm
    assert.equal(cart().getTotalQuantity(), 2);

    // Thao tác của nút Hoàn tác trong src/components/product/ProductCard.tsx (handleUndoAdd), nay gọi undoAdd của store.
    // Bản đầu của test này chép lại các dòng find/setQuantity/removeItem cũ của component nên không phát hiện được việc sửa
    // component; assert bên dưới giữ nguyên.
    cart().undoAdd(
      { productId: packFromCard.productId, variantId: packFromCard.variantId, variantName: packFromCard.variantName },
      1
    );

    assert.equal(cart().getTotalQuantity(), 1, 'sau khi hoàn tác phải còn 1 lốc');
  });

  test('số lượng hiện trên thẻ sản phẩm (ProductCard:73-75): tìm theo khóa gộp, dòng nằm dưới mã trang chi tiết vẫn được đếm', () => {
    cart().addItem(packFromDetail, 3); // dòng lưu dưới mã var_... của trang chi tiết
    const ref = { productId: packFromCard.productId, variantId: packFromCard.variantId, variantName: packFromCard.variantName };
    // Cách tìm cũ của thẻ theo đúng mã (trả 0): đây là lỗi
    assert.equal(cart().items.find((i) => i.productId === ref.productId)?.quantity ?? 0, 0);
    // Cách mới
    assert.equal(findCartLine(cart().items, ref)?.quantity, 3);
    assert.equal(findCartLine(cart().items, { productId: 'sp-khac-sb-7chai', variantId: 'x', variantName: '10 chai' }), undefined);
  });

  test('undoAdd: trừ đúng số lượng, hết thì xóa dòng, không có dòng thì bỏ qua', () => {
    const ref = { productId: packFromCard.productId, variantId: packFromCard.variantId, variantName: packFromCard.variantName };
    cart().addItem(packFromCard, 3);
    cart().undoAdd(ref, 2);
    assert.equal(cart().items[0].quantity, 1);
    cart().undoAdd(ref, 1);
    assert.equal(cart().items.length, 0);

    cart().addItem(packFromCard, 2);
    cart().undoAdd({ productId: 'sp-khac-sb-7chai', variantId: 'x', variantName: '10 chai' }, 1);
    cart().undoAdd(ref, 0);
    cart().undoAdd(ref, NaN);
    assert.equal(cart().getTotalQuantity(), 2);
    cart().undoAdd(ref, 99);
    assert.equal(cart().items.length, 0);
  });
});
