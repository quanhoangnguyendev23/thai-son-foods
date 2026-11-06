/**
 * Log ẩn danh để đo chất lượng gợi ý địa chỉ, KHÔNG nhận dạng được người đặt hàng:
 *  - không mã đơn, không mã khách, không IP, không tên / số điện thoại / email;
 *  - chuỗi khách gõ chỉ giữ tên đường + khu (bỏ mọi số: số nhà, số hẻm), tối đa 80 ký tự;
 *  - tọa độ làm tròn 3 số lẻ (khoảng 100 m); khoảng ghim dời chỉ ghi theo nhóm;
 *  - thời gian làm tròn xuống đầu giờ.
 * Đầu ra mặc định là một dòng JSON "[address-event]" trong log máy chủ (không ghi DB). Lưu vào bảng riêng và tự xóa sau
 * 30 ngày cần thêm bảng nên đang chờ chủ dự án duyệt; khi có thì gắn vào `setAddressEventSink`.
 */
export type PinMovedBucket = '<20m' | '20-100m' | '100-500m' | '>500m';

export interface AddressEventInput {
  /** Chuỗi khách gõ trước khi chọn gợi ý (đã hay chưa bỏ số đều được, hàm này tự bỏ) */
  query?: string | null;
  resultCount?: number | null;
  /** Thứ hạng (từ 0) của gợi ý được chọn */
  rank?: number | null;
  source?: string | null;
  providerStatus?: string | null;
  precision?: string | null;
  addressSource?: string | null;
  locationTrusted?: boolean | null;
  /** Kết quả kiểm tra phường tại tọa độ đơn */
  check?: string | null;
  pinMovedMeters?: number | null;
  pinChoice?: 'use' | 'keep' | null;
  lat?: number | null;
  lng?: number | null;
  now?: Date;
}

export interface AddressEvent {
  /** Đầu giờ, ISO */
  hour: string;
  query: string | null;
  resultCount: number | null;
  rank: number | null;
  source: string | null;
  providerStatus: string | null;
  precision: string | null;
  addressSource: string | null;
  locationTrusted: boolean | null;
  check: string | null;
  pinMoved: PinMovedBucket | null;
  pinChoice: 'use' | 'keep' | null;
  pin: [number, number] | null;
}

const word = (v: unknown, max = 30): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[^\p{L}\p{N}_:\- ]/gu, '').trim().slice(0, max);
  return t || null;
};
const int = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null;

/** Chỉ giữ tên đường + khu: bỏ mọi chữ số (số nhà, số hẻm, "12/34/5") và dấu câu. */
export function stripQuery(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw
    .normalize('NFC')
    .replace(/[\d/\\-]+/g, ' ')
    .replace(/[^\p{L} ,]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .slice(0, 80);
  return t.length >= 2 ? t : null;
}

export function moveBucket(meters: number | null | undefined): PinMovedBucket | null {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return null;
  return meters < 20 ? '<20m' : meters < 100 ? '20-100m' : meters < 500 ? '100-500m' : '>500m';
}

export function buildAddressEvent(input: AddressEventInput): AddressEvent {
  const hour = new Date(input.now ?? new Date());
  hour.setUTCMinutes(0, 0, 0);
  const lat = typeof input.lat === 'number' && Number.isFinite(input.lat) ? Math.round(input.lat * 1000) / 1000 : null;
  const lng = typeof input.lng === 'number' && Number.isFinite(input.lng) ? Math.round(input.lng * 1000) / 1000 : null;
  return {
    hour: hour.toISOString(),
    query: stripQuery(input.query),
    resultCount: int(input.resultCount, 0, 50),
    rank: int(input.rank, 0, 50),
    source: word(input.source, 12),
    providerStatus: word(input.providerStatus, 12),
    precision: word(input.precision, 10),
    addressSource: word(input.addressSource, 14),
    locationTrusted: typeof input.locationTrusted === 'boolean' ? input.locationTrusted : null,
    check: word(input.check, 24),
    pinMoved: moveBucket(input.pinMovedMeters),
    pinChoice: input.pinChoice === 'use' || input.pinChoice === 'keep' ? input.pinChoice : null,
    pin: lat !== null && lng !== null ? [lat, lng] : null,
  };
}

type Sink = (event: AddressEvent) => void;
let sink: Sink = (event) => console.info('[address-event]', JSON.stringify(event));

/** Đổi nơi ghi log (ví dụ bảng DB sau khi được duyệt). */
export function setAddressEventSink(next: Sink | null): void {
  sink = next ?? ((event) => console.info('[address-event]', JSON.stringify(event)));
}

export function logAddressEvent(input: AddressEventInput): AddressEvent {
  const event = buildAddressEvent(input);
  try {
    sink(event);
  } catch {
    // log phụ, lỗi thì bỏ qua
  }
  return event;
}
