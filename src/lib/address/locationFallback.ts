/**
 * Đường lui khi bản đồ / dịch vụ địa chỉ không dùng được: vẫn cho đặt hàng, đơn mang cờ location_check = "needs_call"
 * (cửa hàng gọi xác nhận vị trí), phí ship tính theo tâm Phường/Quận khách đã chọn.
 * Để không bị dùng để né phí theo km, server chỉ nhận khi client gửi kèm MÃ LỖI bản đồ hợp lệ và mỗi phiên ẩn danh
 * (cookie tsf_geo_sid, không có thì IP) chỉ được dùng tối đa 2 lần / 24 giờ. Bộ đếm trong bộ nhớ từng instance.
 */
export const FALLBACK_CODES = ['TILES_FAILED', 'GEO_TIMEOUT', 'GEO_ERROR', 'GEO_RATE_LIMITED', 'REVERSE_FAILED'] as const;
export type FallbackCode = (typeof FALLBACK_CODES)[number];

const MAX_PER_DAY = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const used = new Map<string, number[]>();

export function isFallbackCode(v: unknown): v is FallbackCode {
  return typeof v === 'string' && (FALLBACK_CODES as readonly string[]).includes(v);
}

/** Ghi nhận một lần dùng đường lui; false nếu phiên này đã dùng quá hạn mức. */
export function takeFallbackQuota(key: string, now: number = Date.now()): boolean {
  if (!key) return false;
  const recent = (used.get(key) || []).filter((t) => now - t < DAY_MS);
  if (recent.length >= MAX_PER_DAY) {
    used.set(key, recent);
    return false;
  }
  recent.push(now);
  used.set(key, recent);
  return true;
}

export function resetFallbackQuota(): void {
  used.clear();
}
