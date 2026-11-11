/**
 * Kiểm thử đơn vị: quy tắc chuyển trạng thái đơn (src/lib/order-status.ts)
 * và khung giờ giao hàng (src/lib/deliverySlots.ts). Không cần mạng, không cần CSDL.
 * Chạy: npx tsx --test tests/order_status_delivery.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUSES,
  isOrderStatus,
  isFinalOrderStatus,
  getAllowedNextStatuses,
  canTransitionOrderStatus,
  canDeleteOrder,
} from '@/lib/order-status';
import {
  DELIVERY_CONFIG,
  clampEtaMinutes,
  vnParts,
  getDeliveryOptions,
  findSlot,
  formatDeliveryWindow,
  describeOrderDelivery,
} from '@/lib/deliverySlots';

describe('order-status', () => {
  test('isOrderStatus chỉ nhận 6 trạng thái viết hoa', () => {
    for (const s of ORDER_STATUSES) assert.equal(isOrderStatus(s), true);
    assert.equal(isOrderStatus('pending'), false);
    assert.equal(isOrderStatus(''), false);
    assert.equal(isOrderStatus(null), false);
    assert.equal(isOrderStatus(1), false);
  });

  test('đi tới và nhảy cóc về phía trước được phép', () => {
    assert.equal(canTransitionOrderStatus('PENDING', 'CONFIRMED'), true);
    assert.equal(canTransitionOrderStatus('PENDING', 'COMPLETED'), true);
    assert.equal(canTransitionOrderStatus('SHIPPING', 'COMPLETED'), true);
  });

  test('không được đi lùi', () => {
    assert.equal(canTransitionOrderStatus('CONFIRMED', 'PENDING'), false);
    assert.equal(canTransitionOrderStatus('SHIPPING', 'PROCESSING'), false);
  });

  test('hủy được từ mọi trạng thái chưa kết thúc', () => {
    for (const s of ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING']) {
      assert.equal(canTransitionOrderStatus(s, 'CANCELLED'), true, s);
    }
  });

  test('COMPLETED và CANCELLED là trạng thái cuối: không mở lại, không hủy', () => {
    assert.equal(isFinalOrderStatus('COMPLETED'), true);
    assert.equal(isFinalOrderStatus('CANCELLED'), true);
    assert.equal(isFinalOrderStatus('SHIPPING'), false);
    assert.deepEqual(getAllowedNextStatuses('COMPLETED'), []);
    assert.deepEqual(getAllowedNextStatuses('CANCELLED'), []);
    assert.equal(canTransitionOrderStatus('COMPLETED', 'CANCELLED'), false);
    assert.equal(canTransitionOrderStatus('CANCELLED', 'PENDING'), false);
  });

  test('giữ nguyên trạng thái (chỉ sửa ghi chú) luôn được phép', () => {
    assert.equal(canTransitionOrderStatus('COMPLETED', 'COMPLETED'), true);
    assert.equal(canTransitionOrderStatus('PENDING', 'PENDING'), true);
  });

  test('trạng thái lạ: không có bước tiếp theo', () => {
    assert.deepEqual(getAllowedNextStatuses('REFUNDED'), []);
    assert.equal(canTransitionOrderStatus('REFUNDED', 'CANCELLED'), false);
    assert.equal(canTransitionOrderStatus('PENDING', 'REFUNDED'), false);
  });

  test('danh sách bước tiếp theo từ PENDING', () => {
    assert.deepEqual(getAllowedNextStatuses('PENDING'), ['CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED']);
    assert.deepEqual(getAllowedNextStatuses('SHIPPING'), ['COMPLETED', 'CANCELLED']);
  });

  test('chỉ xóa được đơn PENDING hoặc CANCELLED', () => {
    assert.equal(canDeleteOrder('PENDING'), true);
    assert.equal(canDeleteOrder('CANCELLED'), true);
    for (const s of ['CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED', '']) assert.equal(canDeleteOrder(s), false, s);
  });
});

// Giờ VN = UTC+7. 2026-11-11 là Thứ Tư.
const at = (iso) => new Date(iso);

describe('deliverySlots — clampEtaMinutes, vnParts', () => {
  test('giá trị không hợp lệ dùng mặc định 30 phút', () => {
    for (const v of ['abc', undefined, null, 0, -10, NaN]) assert.equal(clampEtaMinutes(v), 30, String(v));
  });

  test('kẹp trong khoảng 15 đến 120 phút và làm tròn', () => {
    assert.equal(clampEtaMinutes(5), 15);
    assert.equal(clampEtaMinutes(500), 120);
    assert.equal(clampEtaMinutes(45.4), 45);
    assert.equal(clampEtaMinutes('60'), 60);
  });

  test('vnParts đổi ngày đúng khi UTC còn hôm trước', () => {
    const p = vnParts(at('2026-11-10T18:00:00Z')); // 01:00 ngày 11/11 giờ VN
    assert.equal(p.dateKey, '2026-11-11');
    assert.equal(p.minutes, 60);
    assert.equal(p.weekdayIndex, 3);
  });
});

describe('deliverySlots — getDeliveryOptions', () => {
  test('10:00 giờ VN, giao 30 phút: giao ngay được, khung sớm nhất là 10:00', () => {
    const o = getDeliveryOptions(at('2026-11-11T03:00:00Z'), 30);
    assert.equal(o.canDeliverNow, true);
    assert.equal(o.etaMinutes, 30);
    assert.equal(o.asapArrival, '2026-11-11T03:30:00.000Z');
    assert.equal(o.days.length, DELIVERY_CONFIG.BOOK_AHEAD_DAYS + 1);
    assert.equal(o.days[0].dayLabel, 'Hôm nay');
    assert.equal(o.days[1].dayLabel, 'Ngày mai');
    assert.equal(o.days[2].dayLabel, 'Thứ Sáu');
    assert.equal(o.earliestSlot.startLabel, '10:00');
    const tooLate = o.days[0].slots.filter((s) => !s.available).map((s) => s.startLabel);
    assert.deepEqual(tooLate, ['07:00', '08:00', '09:00']);
    assert.ok(o.days[0].slots.filter((s) => !s.available).every((s) => s.reason === 'TOO_LATE'));
  });

  test('mỗi ngày có 10 khung, khung cuối 16:00–16:30', () => {
    const o = getDeliveryOptions(at('2026-11-11T03:00:00Z'), 30);
    for (const d of o.days) assert.equal(d.slots.length, 10);
    const last = o.days[1].slots.at(-1);
    assert.equal(last.startLabel, '16:00');
    assert.equal(last.endLabel, '16:30');
    assert.equal(last.end, '2026-11-12T09:30:00.000Z');
    assert.ok(o.days[1].slots.every((s) => s.available));
  });

  test('đúng mốc: 16:00 + 30 phút = 16:30 vẫn giao ngay được', () => {
    assert.equal(getDeliveryOptions(at('2026-11-11T09:00:00Z'), 30).canDeliverNow, true);
  });

  test('16:01 + 30 phút quá 16:30: không giao ngay, khung sớm nhất là 07:00 ngày mai', () => {
    const o = getDeliveryOptions(at('2026-11-11T09:01:00Z'), 30);
    assert.equal(o.canDeliverNow, false);
    assert.ok(o.days[0].slots.every((s) => !s.available));
    assert.equal(o.earliestSlot.start, '2026-11-12T00:00:00.000Z');
    assert.equal(o.earliestSlot.startLabel, '07:00');
  });

  test('06:00 sáng (trước giờ mở): không giao ngay, khung sớm nhất 07:00 hôm nay', () => {
    const o = getDeliveryOptions(at('2026-11-10T23:00:00Z'), 30);
    assert.equal(o.canDeliverNow, false);
    assert.equal(o.days[0].dateKey, '2026-11-11');
    assert.equal(o.earliestSlot.start, '2026-11-11T00:00:00.000Z');
  });

  test('qua tháng: 30/11 thì ngày thứ ba là 02/12', () => {
    const o = getDeliveryOptions(at('2026-11-30T03:00:00Z'), 30);
    assert.deepEqual(o.days.map((d) => d.dateKey), ['2026-11-30', '2026-12-01', '2026-12-02']);
    assert.equal(o.days[2].dateLabel, '02/12');
  });

  test('thời gian giao do client gửi bị kẹp tối đa 120 phút', () => {
    assert.equal(getDeliveryOptions(at('2026-11-11T03:00:00Z'), 99999).etaMinutes, 120);
  });
});

describe('deliverySlots — findSlot, nhãn hiển thị', () => {
  const o = getDeliveryOptions(at('2026-11-11T03:00:00Z'), 30);

  test('tìm đúng khung theo ISO giờ bắt đầu', () => {
    const s = findSlot(o, '2026-11-12T01:00:00.000Z');
    assert.equal(s.startLabel, '08:00');
    assert.equal(s.available, true);
  });

  test('khung hôm nay đã quá giờ vẫn tìm thấy nhưng mang lý do TOO_LATE', () => {
    assert.equal(findSlot(o, '2026-11-11T00:00:00.000Z').reason, 'TOO_LATE');
  });

  test('mã khung sai, lệch phút, ngoài 3 ngày, sai kiểu: null', () => {
    assert.equal(findSlot(o, '2026-11-12T01:30:00.000Z'), null);
    assert.equal(findSlot(o, '2026-11-20T01:00:00.000Z'), null);
    assert.equal(findSlot(o, 'khong-phai-ngay'), null);
    assert.equal(findSlot(o, ''), null);
    assert.equal(findSlot(o, 12345), null);
    assert.equal(findSlot(o, null), null);
  });

  test('formatDeliveryWindow', () => {
    assert.equal(formatDeliveryWindow('2026-11-11T01:00:00.000Z', '2026-11-11T02:00:00.000Z'), 'Thứ Tư 11/11, 08:00–09:00');
    assert.equal(formatDeliveryWindow('2026-11-11T01:00:00.000Z'), 'Thứ Tư 11/11, 08:00');
    assert.equal(formatDeliveryWindow(null), '');
  });

  test('describeOrderDelivery', () => {
    assert.equal(describeOrderDelivery('SCHEDULED', '2026-11-11T01:00:00.000Z', '2026-11-11T02:00:00.000Z'), 'Thứ Tư 11/11, 08:00–09:00');
    assert.equal(describeOrderDelivery('ASAP', null, null), '');
    // Đơn giao ngay của một ngày đã qua: hiện ngày/tháng thay cho "hôm nay"
    assert.equal(describeOrderDelivery('ASAP', '2020-01-05T03:00:00.000Z', '2020-01-05T03:30:00.000Z'), 'Giao ngay, dự kiến 10:30 05/01');
  });
});
