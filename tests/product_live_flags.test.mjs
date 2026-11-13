/**
 * Kiểm thử đơn vị: danh mục sản phẩm "sống" cho các khối gợi ý (trang chi tiết SP / combo / thương hiệu).
 * buildLiveCatalog (src/lib/product-detail.ts) ghép bảng products (CSDL) lên danh mục tĩnh src/data/products.ts:
 * nhãn admin gắn, sản phẩm mới chỉ có trong CSDL, sản phẩm tạm ẩn / đã xoá.
 * Không cần mạng, không cần CSDL. Chạy: npx tsx --test tests/product_live_flags.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveCatalog } from '@/lib/product-detail';

const catalog = [
  { id: 'sua-bap-nep', slug: 'sua-bap-nep-thai-son', sku: 'SB-01', name: 'Sữa Bắp', price: 15000, unit: 'chai', categoryId: 'sua-hat', thumbnail: '/a.png', images: [], shortDescription: '', description: '', isFeatured: true, isBestSeller: true, isNew: false, isActive: true, variants: [{ id: 'v1', name: '1 chai', quantity: 1, price: 15000, unit: 'chai' }] },
  { id: 'tra-xanh-go', slug: 'tra-xanh-go', sku: 'TXG-01', name: 'Trà Xanh', price: 12000, unit: 'chai', categoryId: 'tra-sua', thumbnail: '/b.png', images: [], shortDescription: '', description: '', isFeatured: true, isBestSeller: false, isNew: false, isActive: true },
];
const row = (over) => ({ id: 'x', slug: 'x', sku: null, name: 'X', price: 10000, unit: 'chai', thumbnail: null, category_id: 'cat-sua-hat', short_description: '', description: '', is_featured: false, is_best_seller: false, is_new: false, is_active: true, volume: null, energy_kcal: null, variants: [], images: [], ...over });

describe('buildLiveCatalog', () => {
  test('CSDL trống → danh mục tĩnh như cũ', () => {
    assert.deepEqual(buildLiveCatalog(catalog, []), catalog);
  });

  test('nhãn trong CSDL ghi đè nhãn tĩnh; giữ mã tĩnh khi khớp theo slug', () => {
    const out = buildLiveCatalog(catalog, [
      row({ id: 'prod-sb-01', slug: 'sua-bap-nep-thai-son', sku: 'SB-01', is_best_seller: false, is_new: true, is_featured: false }),
      row({ id: 'prod-txg-01', slug: 'tra-xanh-go', sku: 'TXG-01' }),
    ]);
    assert.equal(out[0].id, 'sua-bap-nep');
    assert.equal(out[0].isBestSeller, false);
    assert.equal(out[0].isNew, true);
    assert.equal(out[0].isFeatured, false);
  });

  test('null trong CSDL giữ nhãn tĩnh', () => {
    const out = buildLiveCatalog(catalog, [row({ id: 'prod-sb-01', slug: 'sua-bap-nep-thai-son', is_featured: null, is_best_seller: null, is_new: null })]);
    assert.equal(out[0].isBestSeller, true);
    assert.equal(out[0].isFeatured, true);
  });

  test('sản phẩm mới chỉ có trong CSDL được thêm vào sau, dùng mã/slug/giá/danh mục trong CSDL', () => {
    const out = buildLiveCatalog(catalog, [
      row({ id: 'prod_999', slug: 'sp-moi-1234', sku: 'NEW-01', name: 'SP mới', price: 20000, category_id: 'cat-tra-sua', thumbnail: '/uploads/products/moi.jpg', is_new: true,
        variants: [{ id: 'pv1', name: '6 chai', quantity: 6, price: 110000, unit: 'lốc' }, { id: 'pv0', name: '1 chai', quantity: 1, price: 20000, unit: 'chai' }] }),
      row({ id: 'prod-sb-01', slug: 'sua-bap-nep-thai-son' }),
    ]);
    assert.deepEqual(out.map((p) => p.id), ['sua-bap-nep', 'prod_999']);
    const fresh = out[1];
    assert.equal(fresh.slug, 'sp-moi-1234');
    assert.equal(fresh.name, 'SP mới');
    assert.equal(fresh.price, 20000);
    assert.equal(fresh.categoryId, 'tra-sua');
    assert.equal(fresh.thumbnail, '/uploads/products/moi.jpg');
    assert.equal(fresh.isNew, true);
    assert.equal(fresh.isActive, true);
    assert.deepEqual(fresh.variants.map((v) => v.quantity), [1, 6]);
  });

  test('sản phẩm tạm ẩn giữ trong danh mục với isActive=false; sản phẩm đã xoá khỏi CSDL bị bỏ', () => {
    const out = buildLiveCatalog(catalog, [row({ id: 'prod-sb-01', slug: 'sua-bap-nep-thai-son', is_active: false })]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'sua-bap-nep');
    assert.equal(out[0].isActive, false);
  });

  test('không sửa mảng gốc', () => {
    const before = JSON.stringify(catalog);
    buildLiveCatalog(catalog, [row({ id: 'prod-sb-01', slug: 'sua-bap-nep-thai-son', is_new: true })]);
    assert.equal(JSON.stringify(catalog), before);
  });
});
