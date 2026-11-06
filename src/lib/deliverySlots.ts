/**
 * Khung giờ giao hàng (giờ hành chính 07:00 – 16:30, giờ Việt Nam, giao cả tuần).
 *
 * - "Giao ngay": chỉ khi giờ đặt + thời gian giao (chuẩn bị + chạy xe) <= 16:30 cùng ngày.
 * - Hết giờ (hoặc trước 07:00): khách chọn khung hẹn; mặc định khung trống sớm nhất.
 * - Khung còn chọn được khi giờ đặt + thời gian giao <= giờ kết thúc khung. Không giới hạn số đơn mỗi khung.
 *
 * Dùng chung cho trang thanh toán (client) và /api/orders, /api/delivery-slots (server).
 * Mọi phép tính giờ đều quy về giờ Việt Nam (UTC+7, không đổi giờ mùa hè), không phụ thuộc múi giờ máy chủ.
 */

export const DELIVERY_CONFIG = {
  START_MINUTES: 7 * 60, // 07:00
  END_MINUTES: 16 * 60 + 30, // 16:30
  SLOT_MINUTES: 60,
  /** Cho đặt hẹn hôm nay và thêm bao nhiêu ngày tới */
  BOOK_AHEAD_DAYS: 2,
  /** Thời gian giao dự phòng khi không có ước tính theo km */
  DEFAULT_ETA_MINUTES: 30,
  MIN_ETA_MINUTES: 15,
  MAX_ETA_MINUTES: 120,
} as const;

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export type DeliveryMode = 'ASAP' | 'SCHEDULED';

export interface DeliverySlot {
  /** ISO UTC của giờ bắt đầu khung, dùng làm mã khung */
  start: string;
  end: string;
  startLabel: string; // "08:00"
  endLabel: string; // "09:00"
  available: boolean;
  /** Lý do không chọn được: TOO_LATE = không kịp giao trong khung */
  reason?: 'TOO_LATE';
}

export interface DeliveryDay {
  dateKey: string; // "2026-11-06" (ngày VN)
  dayLabel: string; // "Hôm nay" | "Ngày mai" | "Thứ Bảy"
  weekday: string; // "Thứ Sáu"
  dateLabel: string; // "06/11"
  slots: DeliverySlot[];
}

export interface DeliveryOptions {
  now: string;
  etaMinutes: number;
  canDeliverNow: boolean;
  /** Giờ dự kiến tới nơi nếu giao ngay (ISO) */
  asapArrival: string;
  days: DeliveryDay[];
  earliestSlot: DeliverySlot | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export function clampEtaMinutes(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return DELIVERY_CONFIG.DEFAULT_ETA_MINUTES;
  return Math.min(DELIVERY_CONFIG.MAX_ETA_MINUTES, Math.max(DELIVERY_CONFIG.MIN_ETA_MINUTES, n));
}

/** Ngày & phút trong ngày theo giờ Việt Nam */
export function vnParts(date: Date) {
  const v = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: v.getUTCFullYear(),
    month: v.getUTCMonth() + 1,
    day: v.getUTCDate(),
    weekdayIndex: v.getUTCDay(),
    minutes: v.getUTCHours() * 60 + v.getUTCMinutes(),
    dateKey: `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`,
  };
}

/** Thời điểm (UTC) ứng với ngày VN + số phút trong ngày */
function vnDateAt(year: number, month: number, day: number, minutes: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, minutes) - VN_OFFSET_MS);
}

/** Danh sách giờ bắt đầu các khung trong ngày (phút) */
function slotStarts(): number[] {
  const out: number[] = [];
  for (let s = DELIVERY_CONFIG.START_MINUTES; s < DELIVERY_CONFIG.END_MINUTES; s += DELIVERY_CONFIG.SLOT_MINUTES) out.push(s);
  return out;
}

/** Nhãn ngắn của khung: "Thứ Sáu 06/11, 08:00–09:00" */
export function formatDeliveryWindow(start: string | Date | null | undefined, end?: string | Date | null): string {
  if (!start) return '';
  const s = vnParts(new Date(start));
  const label = `${WEEKDAYS[s.weekdayIndex]} ${pad(s.day)}/${pad(s.month)}, ${hm(s.minutes)}`;
  if (!end) return label;
  const e = vnParts(new Date(end));
  return `${label}–${hm(e.minutes)}`;
}

/** Nhãn hiển thị cho đơn đã đặt (dùng cho email, Telegram, admin, tra cứu) */
export function describeOrderDelivery(
  mode: string | null | undefined,
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  if (!start) return '';
  if (mode === 'SCHEDULED') return formatDeliveryWindow(start, end);
  // Giao ngay: hiện giờ dự kiến tới nơi
  const arrival = end || start;
  const a = vnParts(new Date(arrival));
  const today = vnParts(new Date());
  const dayText = a.dateKey === today.dateKey ? 'hôm nay' : `${pad(a.day)}/${pad(a.month)}`;
  return `Giao ngay, dự kiến ${hm(a.minutes)} ${dayText}`;
}

/** Tính các lựa chọn giao hàng tại thời điểm `now` */
export function getDeliveryOptions(now: Date, etaMinutesInput: unknown): DeliveryOptions {
  const etaMinutes = clampEtaMinutes(etaMinutesInput);
  const p = vnParts(now);
  const readyAt = p.minutes + etaMinutes;
  const canDeliverNow = p.minutes >= DELIVERY_CONFIG.START_MINUTES && readyAt <= DELIVERY_CONFIG.END_MINUTES;

  const days: DeliveryDay[] = [];
  for (let i = 0; i <= DELIVERY_CONFIG.BOOK_AHEAD_DAYS; i++) {
    const base = new Date(Date.UTC(p.year, p.month - 1, p.day + i));
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth() + 1;
    const d = base.getUTCDate();
    const slots: DeliverySlot[] = slotStarts().map((s) => {
      const e = Math.min(s + DELIVERY_CONFIG.SLOT_MINUTES, DELIVERY_CONFIG.END_MINUTES);
      const start = vnDateAt(y, m, d, s).toISOString();
      const end = vnDateAt(y, m, d, e).toISOString();
      const tooLate = i === 0 && readyAt > e;
      return {
        start,
        end,
        startLabel: hm(s),
        endLabel: hm(e),
        available: !tooLate,
        reason: tooLate ? 'TOO_LATE' : undefined,
      };
    });
    days.push({
      dateKey: `${y}-${pad(m)}-${pad(d)}`,
      dayLabel: i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : WEEKDAYS[base.getUTCDay()],
      weekday: WEEKDAYS[base.getUTCDay()],
      dateLabel: `${pad(d)}/${pad(m)}`,
      slots,
    });
  }

  let earliestSlot: DeliverySlot | null = null;
  for (const day of days) {
    earliestSlot = day.slots.find((s) => s.available) || null;
    if (earliestSlot) break;
  }

  return {
    now: now.toISOString(),
    etaMinutes,
    canDeliverNow,
    asapArrival: new Date(now.getTime() + etaMinutes * 60000).toISOString(),
    days,
    earliestSlot,
  };
}

/** Tìm khung theo mã (ISO giờ bắt đầu) trong các lựa chọn đã tính; null nếu không phải khung hợp lệ */
export function findSlot(options: DeliveryOptions, slotStart: unknown): DeliverySlot | null {
  if (typeof slotStart !== 'string' || !slotStart) return null;
  const t = new Date(slotStart).getTime();
  if (!Number.isFinite(t)) return null;
  for (const day of options.days) {
    const hit = day.slots.find((s) => new Date(s.start).getTime() === t);
    if (hit) return hit;
  }
  return null;
}
