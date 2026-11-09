/**
 * Kiểm tra phụ ở backend khi đặt đơn: phường tại TỌA ĐỘ của đơn có khớp phường khách đã chọn không (tính cả tên cũ / mới).
 * Không sửa dữ liệu khách, không chặn đơn. Khoảng cách tới tâm phường chỉ là kiểm tra phụ, ngưỡng theo cỡ phường.
 *
 * Chưa có ranh giới phường dạng đa giác trong dữ liệu nên phường tại tọa độ lấy bằng reverse (Nominatim qua hàng đợi chung
 * ≤ 1 lượt/giây, có đệm) rồi đổi sang phường mới + quận cũ bằng dữ liệu nội bộ. Có ranh giới chính thức thì thay
 * `resolveWardAtPoint` bằng point-in-polygon, phần còn lại giữ nguyên.
 */
import { detectLocationMismatch, resolveAdminFromProvider, type MismatchResult } from './admin';
import { nominatimJson } from './osmQueue';
import { hasRealCoords } from './normalize';
import type { LatLng } from './types';

export interface WardAtPoint {
  ward?: string;
  district?: string;
}

interface NominatimReverse {
  address?: Record<string, string | undefined>;
}

/** Phường / quận tại một tọa độ (null nếu không tra được). */
export async function resolveWardAtPoint(at: LatLng): Promise<WardAtPoint | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${at.lat.toFixed(5)}&lon=${at.lng.toFixed(5)}&format=json&addressdetails=1&zoom=18&accept-language=vi`;
  const item = await nominatimJson<NominatimReverse>(url);
  const a = item?.address;
  if (!a) return null;
  const wardText = [a.suburb, a.quarter, a.village].find((v) => v && /^(phường|xã|thị trấn|đặc khu)\s/i.test(v)) || a.suburb || '';
  const resolved = resolveAdminFromProvider({ ward: wardText, lat: at.lat, lng: at.lng, city: a.city, state: a.state });
  return { ward: resolved.ward || undefined, district: resolved.district || undefined };
}

export type LocationCheckStatus = 'ok' | 'ward_mismatch' | 'district_mismatch' | 'far_from_area' | 'unknown';

export interface LocationCheckResult {
  status: LocationCheckStatus;
  atPin?: WardAtPoint;
}

const REASON_TO_STATUS: Record<NonNullable<MismatchResult['reason']>, LocationCheckStatus> = {
  ward: 'ward_mismatch',
  district: 'district_mismatch',
  far: 'far_from_area',
};

/**
 * So phường đã chọn với phường tại tọa độ đơn. `resolver` thay được khi test.
 * Không tra được phường tại tọa độ thì chỉ còn kiểm tra khoảng cách theo cỡ phường.
 */
export async function checkOrderLocation(
  chosen: { ward?: string; district?: string },
  at: LatLng,
  resolver: (p: LatLng) => Promise<WardAtPoint | null> = resolveWardAtPoint
): Promise<LocationCheckResult> {
  let atPin: WardAtPoint | null = null;
  try {
    atPin = await resolver(at);
  } catch {
    atPin = null; // hàng đợi đầy / bị giới hạn / hết hạn: kiểm tra phụ, bỏ qua
  }
  const result = detectLocationMismatch(chosen, atPin || {}, at);
  if (result.mismatch && result.reason) return { status: REASON_TO_STATUS[result.reason], atPin: atPin || undefined };
  return { status: atPin ? 'ok' : 'unknown', atPin: atPin || undefined };
}

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

/**
 * Việc chạy SAU KHI tạo đơn (gọi trong after() của Next.js để Vercel giữ hàm tới khi xong):
 * kiểm phường tại tọa độ, lưu kết quả vào orders.location_check (không sửa dữ liệu khách), ghi log ẩn danh.
 * Có timeout ngắn để không giữ hàm lâu khi Nominatim chậm.
 */
export async function runOrderAddressChecks(input: {
  orderId: string;
  ward?: string | null;
  district?: string | null;
  lat: number | null;
  lng: number | null;
  addressSource?: string | null;
  emit: (check: string | null) => unknown;
  query?: QueryFn;
  resolver?: (p: LatLng) => Promise<WardAtPoint | null>;
  timeoutMs?: number;
}): Promise<LocationCheckStatus | null> {
  let status: LocationCheckStatus | null = null;
  if (hasRealCoords(input.lat, input.lng) && input.ward) {
    const timeout = new Promise<LocationCheckResult>((resolve) =>
      setTimeout(() => resolve({ status: 'unknown' }), input.timeoutMs ?? 5000)
    );
    const r = await Promise.race([
      checkOrderLocation({ ward: input.ward, district: input.district || undefined }, { lat: Number(input.lat), lng: Number(input.lng) }, input.resolver),
      timeout,
    ]);
    status = r.status;
    if (r.status !== 'ok' && r.status !== 'unknown') {
      console.warn(`[orders] Kiểm tra vị trí: ${r.status} (nguồn: ${input.addressSource || 'không rõ'}, phường chọn: ${input.ward}, phường tại tọa độ: ${r.atPin?.ward || '-'})`);
    }
    try {
      const q = input.query ?? ((await import('@/lib/db')).query as unknown as QueryFn);
      await q('UPDATE orders SET location_check = $1 WHERE id = $2', [status, input.orderId]);
    } catch (e) {
      console.warn('[orders] Không lưu được location_check:', (e as Error)?.message);
    }
  }
  await input.emit(status);
  return status;
}
