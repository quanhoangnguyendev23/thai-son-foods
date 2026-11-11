/**
 * Kiểm thử đơn vị: phí vận chuyển (src/config/inventory.ts) — chính sách chốt 04/11/2026.
 * Không cần mạng, không cần CSDL.
 * Chạy: npx tsx --test tests/shipping_fee.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateShippingFee, getDistanceSurcharge, INVENTORY_CONFIG } from '@/config/inventory';

describe('calculateShippingFee — phí cơ bản (không có km)', () => {
  test('đơn dưới 200.000đ: phí 30.000đ', () => {
    const r = calculateShippingFee(100000);
    assert.equal(r.fee, 30000);
    assert.equal(r.baseFee, 30000);
    assert.equal(r.surcharge, 0);
    assert.equal(r.isFree, false);
    assert.equal(r.isBeyondRadius, false);
  });

  test('đơn đúng 200.000đ: miễn phí', () => {
    const r = calculateShippingFee(200000);
    assert.equal(r.fee, 0);
    assert.equal(r.isFree, true);
  });

  test('đơn 199.999đ: vẫn tính phí', () => {
    assert.equal(calculateShippingFee(199999).fee, 30000);
  });

  test('đơn 0đ: tính phí cơ bản', () => {
    assert.equal(calculateShippingFee(0).fee, 30000);
  });

  test('km null / NaN / âm: coi như chưa có vị trí, chỉ tính phí cơ bản', () => {
    assert.equal(calculateShippingFee(100000, null).fee, 30000);
    assert.equal(calculateShippingFee(100000, NaN).fee, 30000);
    assert.equal(calculateShippingFee(100000, -3).fee, 30000);
    assert.equal(calculateShippingFee(100000, -3).isBeyondRadius, false);
    assert.equal(calculateShippingFee(100000, Infinity).isBeyondRadius, false);
  });
});

describe('calculateShippingFee — phụ thu theo km', () => {
  test('trong 10 km: không phụ thu', () => {
    assert.equal(calculateShippingFee(100000, 0).fee, 30000);
    assert.equal(calculateShippingFee(100000, 10).fee, 30000);
    assert.equal(calculateShippingFee(250000, 10).fee, 0);
  });

  test('vùng đệm 10 đến dưới 11 km: chưa phụ thu', () => {
    assert.equal(calculateShippingFee(250000, 10.9).fee, 0);
    assert.equal(calculateShippingFee(250000, 10.9).isFree, true);
  });

  test('10,95 km làm tròn lên 11,0 km: phụ thu 20.000đ (theo comment trong code)', () => {
    assert.equal(getDistanceSurcharge(10.95), 20000);
  });

  test('từ 11 km: +20.000đ cho mọi đơn, kể cả đơn đủ miễn phí', () => {
    assert.equal(calculateShippingFee(100000, 11).fee, 50000);
    assert.equal(calculateShippingFee(250000, 11).fee, 20000);
    assert.equal(calculateShippingFee(250000, 11).isFree, false);
    assert.equal(calculateShippingFee(100000, 14.9).fee, 50000);
  });

  test('từ 15 km: +35.000đ', () => {
    assert.equal(calculateShippingFee(100000, 15).fee, 65000);
    assert.equal(calculateShippingFee(250000, 20).fee, 35000);
  });

  test('đúng 20 km: vẫn giao', () => {
    assert.equal(calculateShippingFee(100000, 20).isBeyondRadius, false);
  });

  test('trên 20 km: ngoài bán kính, có lý do kèm số km', () => {
    const r = calculateShippingFee(100000, 20.5);
    assert.equal(r.isBeyondRadius, true);
    assert.equal(r.isFree, false);
    assert.match(r.reason, /20\.5 km/);
    assert.match(r.reason, new RegExp(String(INVENTORY_CONFIG.SHIPPING.DISTANCE_BASED.MAX_DELIVERY_RADIUS_KM)));
  });

  // REVIEW.md R6 (đã rút lại): 20,04 km bị từ chối đúng quy định, vì giới hạn so với số km thô
  test('20,04 km: ngoài bán kính (giới hạn so với số km thô), phí không phụ thu', () => {
    const r = calculateShippingFee(100000, 20.04);
    assert.equal(r.isBeyondRadius, true);
    assert.equal(r.surcharge, 0);
  });

  // REVIEW.md R6 (mục còn lại): câu báo lỗi làm tròn 20,04 thành "20.0 km" rồi nói "vượt quá 20 km"
  test('R6: câu báo lỗi ngoài bán kính không được hiện số km bằng đúng bán kính tối đa', () => {
    const r = calculateShippingFee(100000, 20.04);
    assert.doesNotMatch(r.reason, /\(20\.0 km\)/);
  });
});

describe('getDistanceSurcharge', () => {
  test('giá trị không hợp lệ trả 0', () => {
    assert.equal(getDistanceSurcharge(undefined), 0);
    assert.equal(getDistanceSurcharge(null), 0);
    assert.equal(getDistanceSurcharge(NaN), 0);
    assert.equal(getDistanceSurcharge(-1), 0);
    assert.equal(getDistanceSurcharge('12'), 0);
  });

  test('các mốc 11 và 15 km', () => {
    assert.equal(getDistanceSurcharge(10.99), 20000);
    assert.equal(getDistanceSurcharge(10.9), 0);
    assert.equal(getDistanceSurcharge(11), 20000);
    assert.equal(getDistanceSurcharge(14.9), 20000);
    assert.equal(getDistanceSurcharge(14.95), 35000);
    assert.equal(getDistanceSurcharge(15), 35000);
    assert.equal(getDistanceSurcharge(1000), 35000);
  });
});
