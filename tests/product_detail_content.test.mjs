/**
 * Kiểm thử đơn vị: nội dung "Thông tin sản phẩm" do admin nhập (cột products.detail_content).
 *  - sanitizeProductDetailContent (src/lib/content-validation.ts): làm sạch dữ liệu admin gửi lên
 *  - mergeProductDetailContent (src/data/product-detail-content.ts): DB ưu tiên, trống thì dùng nội dung trong code
 * Không cần mạng, không cần CSDL. Chạy: npx tsx --test tests/product_detail_content.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProductDetailContent } from '@/lib/content-validation';
import { mergeProductDetailContent } from '@/data/product-detail-content';

describe('sanitizeProductDetailContent', () => {
  test('null / undefined → xoá nội dung (null)', () => {
    assert.deepEqual(sanitizeProductDetailContent(null), { value: null });
    assert.deepEqual(sanitizeProductDetailContent(undefined), { value: null });
  });

  test('không phải object → lỗi', () => {
    assert.ok('error' in sanitizeProductDetailContent('abc'));
    assert.ok('error' in sanitizeProductDetailContent([1, 2]));
  });

  test('cắt khoảng trắng, lọc thẻ HTML, bỏ trường trống, giới hạn độ dài', () => {
    const r = sanitizeProductDetailContent({
      ingredients: '  <b>Bắp</b> tươi<script>x</script>  ',
      usage: '   ',
      storage: 'x'.repeat(5000),
      unknownField: 'bị bỏ qua',
    });
    assert.ok('value' in r);
    assert.equal(r.value.ingredients, 'Bắp tươix');
    assert.equal('usage' in r.value, false);
    assert.equal(r.value.storage.length, 500);
    assert.equal('unknownField' in r.value, false);
  });

  test('ảnh nhãn phải là URL an toàn', () => {
    assert.ok('error' in sanitizeProductDetailContent({ labelImage: 'javascript:alert(1)' }));
    const ok = sanitizeProductDetailContent({ labelImage: '/uploads/products/nhan.jpg' });
    assert.equal(ok.value.labelImage, '/uploads/products/nhan.jpg');
  });

  test('dinh dưỡng: bỏ dòng trống; không còn dòng nào thì bỏ cả mục', () => {
    const r = sanitizeProductDetailContent({
      nutrition: { basis: 'Trong 100ml', rows: [{ label: 'Năng lượng', value: '31 kcal' }, { label: ' ', value: '' }], source: 'Theo nhãn' },
    });
    assert.deepEqual(r.value.nutrition, { basis: 'Trong 100ml', rows: [{ label: 'Năng lượng', value: '31 kcal' }], source: 'Theo nhãn' });
    const empty = sanitizeProductDetailContent({ nutrition: { basis: 'x', rows: [{ label: '', value: '' }] } });
    assert.equal(empty.value, null);
  });

  test('điểm nổi bật: tối đa 6, bỏ ô không có chữ tiếng Việt', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ labelVi: `Ý ${i}`, contentVi: 'nội dung', labelEn: '', contentEn: '' }));
    items.splice(1, 0, { labelVi: '', contentVi: '', labelEn: 'Only EN', contentEn: '' });
    const r = sanitizeProductDetailContent({ highlights: items });
    assert.equal(r.value.highlights.length, 6);
    assert.equal(r.value.highlights[0].labelVi, 'Ý 0');
    assert.equal(r.value.highlights[1].labelVi, 'Ý 1');
  });

  test('tất cả trống → null', () => {
    assert.deepEqual(sanitizeProductDetailContent({ ingredients: '', highlights: [], nutrition: null }), { value: null });
  });
});

describe('mergeProductDetailContent', () => {
  const base = {
    shortName: 'Sữa Bắp',
    ingredients: 'Bắp (code)',
    storage: '5-10°C',
    highlights: [{ labelVi: 'Code', contentVi: 'c', labelEn: '', contentEn: '' }],
    nutrition: { basis: 'b', rows: [{ label: 'kcal', value: '31' }], source: 's' },
  };

  test('không có nội dung DB → giữ nguyên nội dung code', () => {
    assert.deepEqual(mergeProductDetailContent(base, null), base);
    assert.deepEqual(mergeProductDetailContent(base, undefined), base);
  });

  test('trường có trong DB ghi đè, trường thiếu giữ của code', () => {
    const out = mergeProductDetailContent(base, { ingredients: 'Bắp (DB)', usage: 'Lắc đều' });
    assert.equal(out.ingredients, 'Bắp (DB)');
    assert.equal(out.usage, 'Lắc đều');
    assert.equal(out.storage, '5-10°C');
    assert.equal(out.shortName, 'Sữa Bắp');
  });

  test('mảng rỗng / chuỗi rỗng trong DB không xoá nội dung code', () => {
    const out = mergeProductDetailContent(base, { ingredients: '', highlights: [], nutrition: { basis: '', rows: [], source: '' } });
    assert.equal(out.ingredients, 'Bắp (code)');
    assert.deepEqual(out.highlights, base.highlights);
    assert.deepEqual(out.nutrition, base.nutrition);
  });

  test('highlights / nutrition trong DB thay nguyên khối', () => {
    const hl = [{ labelVi: 'DB', contentVi: 'd', labelEn: '', contentEn: '' }];
    const nu = { basis: 'B2', rows: [{ label: 'Đường', value: '3 g' }], source: 'S2' };
    const out = mergeProductDetailContent(base, { highlights: hl, nutrition: nu });
    assert.deepEqual(out.highlights, hl);
    assert.deepEqual(out.nutrition, nu);
  });
});
