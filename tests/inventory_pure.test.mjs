/**
 * Kiểm thử đơn vị: các hàm thuần của kho (src/lib/inventory.ts) và bộ đọc Google Sheet tồn kho
 * (src/lib/inventorySheetParser.ts). Không gọi CSDL, không cần mạng.
 * Chạy: npx tsx --test tests/inventory_pure.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractBottleMultiplier, calculateSellable, getSellableQuantity, canonicalProductId } from '@/lib/inventory';
import { parseCsv, parseSheetDate, parseSheetDateTime, daysBetweenIso, todayInVietnam } from '@/lib/inventorySheetParser';

describe('extractBottleMultiplier', () => {
  test('hậu tố mã quy cách "-7chai" là nguồn ưu tiên', () => {
    assert.equal(extractBottleMultiplier('sua-bap-nep-sb-7chai'), 7);
    assert.equal(extractBottleMultiplier('sua-bap-nep-sb-12chai', 'Lốc 10 chai mô tả dán nhầm'), 12);
  });

  test('đọc từ đơn vị khi mã không có hậu tố', () => {
    assert.equal(extractBottleMultiplier('x', 'Lốc 10 chai'), 10);
    assert.equal(extractBottleMultiplier('x', 'thùng 24'), 24);
    assert.equal(extractBottleMultiplier('x', '6 lon'), 6);
  });

  test('chai lẻ đã xác định rõ: 1', () => {
    assert.equal(extractBottleMultiplier('prod-sb-01', 'chai'), 1);
    assert.equal(extractBottleMultiplier('x', '1 chai'), 1);
    assert.equal(extractBottleMultiplier('x', '330ml'), 1);
  });

  test('mã chuẩn "prod-xx-01" không bị hiểu nhầm số 01 là số chai', () => {
    assert.equal(extractBottleMultiplier('prod-sb-01', 'chai'), 1);
  });

  test('hậu tố vượt 1.000 chai hoặc bằng 0 bị bỏ qua', () => {
    assert.equal(extractBottleMultiplier('x-1500chai', 'chai'), 1);
    assert.equal(extractBottleMultiplier('x-0chai', 'chai'), 1);
  });

  test('không xác định được: ném lỗi, không tự rơi về 1', () => {
    assert.throws(() => extractBottleMultiplier('x', 'hũ'), /INVENTORY_UNKNOWN_MULTIPLIER/);
    assert.throws(() => extractBottleMultiplier('', ''), /INVENTORY_UNKNOWN_MULTIPLIER/);
    assert.throws(() => extractBottleMultiplier('prod-sb-01', 'lốc'), /INVENTORY_UNKNOWN_MULTIPLIER/);
  });
});

describe('calculateSellable / getSellableQuantity (dạng số)', () => {
  test('tồn bán được = tồn - giữ chỗ - tồn an toàn', () => {
    assert.equal(calculateSellable(10, 3, 2), 5);
    assert.equal(getSellableQuantity(10, 3, 2), 5);
  });

  test('không bao giờ âm', () => {
    assert.equal(calculateSellable(5, 10, 0), 0);
    assert.equal(calculateSellable(5, 3, 5), 0);
    assert.equal(calculateSellable(0, 0, 0), 0);
  });

  test('nhận chuỗi số từ CSDL, null và undefined coi là 0', () => {
    assert.equal(calculateSellable('10', '3', null), 7);
    assert.equal(calculateSellable(undefined, undefined, undefined), 0);
    assert.equal(calculateSellable('abc', 1, 1), 0);
  });

  test('giá trị âm trong dữ liệu bị coi là 0', () => {
    assert.equal(calculateSellable(-5, 0, 0), 0);
    assert.equal(calculateSellable(10, -4, 0), 10);
    assert.equal(calculateSellable(10, 0, -4), 10);
  });
});

describe('canonicalProductId', () => {
  test('quy bí danh về mã chuẩn, bỏ khoảng trắng và hoa thường', () => {
    assert.equal(canonicalProductId('sl-01'), 'prod-sl-01');
    assert.equal(canonicalProductId('  Prod-SL-01 '), 'prod-sl-01');
  });

  test('mã lạ giữ nguyên (đã chuẩn hóa), rỗng trả chuỗi rỗng', () => {
    assert.equal(canonicalProductId('Ma-La'), 'ma-la');
    assert.equal(canonicalProductId(null), '');
    assert.equal(canonicalProductId(undefined), '');
  });
});

describe('inventorySheetParser — parseCsv', () => {
  test('dòng thường, CRLF, không sinh dòng rỗng ở cuối', () => {
    assert.deepEqual(parseCsv('a,b\r\nc,d\r\n'), [
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  test('ô có dấu phẩy, dấu nháy kép và xuống dòng bên trong', () => {
    assert.deepEqual(parseCsv('"x,1","he said ""hi""","dòng 1\ndòng 2"'), [['x,1', 'he said "hi"', 'dòng 1\ndòng 2']]);
  });

  test('bỏ BOM ở đầu file', () => {
    assert.deepEqual(parseCsv('﻿Mã,SL\nSB,5'), [
      ['Mã', 'SL'],
      ['SB', '5'],
    ]);
  });

  test('chuỗi rỗng trả mảng rỗng; ô rỗng được giữ', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv('a,,c'), [['a', '', 'c']]);
    assert.deepEqual(parseCsv('a,'), [['a', '']]);
  });
});

describe('inventorySheetParser — ngày giờ', () => {
  test('parseSheetDate nhận năm 2 hoặc 4 chữ số', () => {
    assert.equal(parseSheetDate('01/11/26'), '2026-11-01');
    assert.equal(parseSheetDate('01/11/2026'), '2026-11-01');
    assert.equal(parseSheetDate(' 1/1/2026 '), '2026-01-01');
  });

  test('parseSheetDate: ngày không tồn tại hoặc sai định dạng trả null', () => {
    assert.equal(parseSheetDate('31/02/2026'), null);
    assert.equal(parseSheetDate('00/11/2026'), null);
    assert.equal(parseSheetDate('15/13/2026'), null);
    assert.equal(parseSheetDate('2026-11-01'), null);
    assert.equal(parseSheetDate('abc'), null);
    assert.equal(parseSheetDate(''), null);
    assert.equal(parseSheetDate(undefined), null);
  });

  test('parseSheetDate: 29/02 chỉ hợp lệ ở năm nhuận', () => {
    assert.equal(parseSheetDate('29/02/2028'), '2028-02-29');
    assert.equal(parseSheetDate('29/02/2026'), null);
  });

  test('parseSheetDateTime gắn múi giờ +07:00', () => {
    assert.equal(parseSheetDateTime('24/10/26 13:42:34'), '2026-10-24T13:42:34+07:00');
    assert.equal(parseSheetDateTime('24/10/2026 7:05'), '2026-10-24T07:05:00+07:00');
  });

  test('parseSheetDateTime: giờ phút giây ngoài khoảng hoặc thiếu giờ trả null', () => {
    assert.equal(parseSheetDateTime('24/10/26 25:00'), null);
    assert.equal(parseSheetDateTime('24/10/26 10:60'), null);
    assert.equal(parseSheetDateTime('24/10/26 10:00:61'), null);
    assert.equal(parseSheetDateTime('24/10/26'), null);
    assert.equal(parseSheetDateTime('31/02/26 10:00'), null);
    assert.equal(parseSheetDateTime(undefined), null);
  });

  test('daysBetweenIso và todayInVietnam', () => {
    assert.equal(daysBetweenIso('2026-11-01', '2026-11-11'), 10);
    assert.equal(daysBetweenIso('2026-11-11', '2026-11-01'), -10);
    assert.equal(daysBetweenIso('2026-11-11', '2026-11-11'), 0);
    assert.equal(todayInVietnam(new Date('2026-11-10T18:00:00Z')), '2026-11-11');
    assert.equal(todayInVietnam(new Date('2026-11-10T16:59:59Z')), '2026-11-10');
  });
});
