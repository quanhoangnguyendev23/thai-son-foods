/**
 * Vùng giao hàng dùng để lọc gợi ý, lấy từ ĐÚNG cấu hình giao/phí ship hiện có (không giữ danh sách vùng riêng):
 * hợp các vòng tròn bán kính `INVENTORY_CONFIG.SHIPPING.DISTANCE_BASED.MAX_DELIVERY_RADIUS_KM` quanh các cửa hàng
 * đang hoạt động ở TP.HCM (`hcmStoreSql`, bảng stores). Ngoài mọi vòng tròn thì chắc chắn không giao được.
 * Bán kính ở đây tính theo đường chim bay, nên rộng hơn quãng đường đi thật mà phí ship dùng: chỉ để loại điểm
 * chắc chắn ngoài vùng; việc từ chối đơn vẫn do logic đặt hàng quyết định.
 *
 * Không đọc được cửa hàng (chưa có DB, chưa nhập tọa độ...) thì trả null: không lọc theo vị trí, không chặn khách.
 */
import { distanceMeters } from './normalize';
import type { LatLng } from './types';

export interface ServiceZone {
  /** Hộp bao ngoài của các vòng tròn, dùng làm `bbox` cho nhà cung cấp hỗ trợ giới hạn vùng */
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  contains(lat: number, lng: number): boolean;
}

/** Tạo vùng từ danh sách tọa độ cửa hàng và bán kính (km). Không có cửa hàng nào hợp lệ thì trả null. */
export function createServiceZone(stores: LatLng[], radiusKm: number): ServiceZone | null {
  const points = stores.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!points.length || !(radiusKm > 0)) return null;
  const dLat = radiusKm / 111.32;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    const dLng = radiusKm / (111.32 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
    minLat = Math.min(minLat, p.lat - dLat);
    maxLat = Math.max(maxLat, p.lat + dLat);
    minLng = Math.min(minLng, p.lng - dLng);
    maxLng = Math.max(maxLng, p.lng + dLng);
  }
  const radiusM = radiusKm * 1000;
  return {
    bbox: { minLat, maxLat, minLng, maxLng },
    contains(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return false;
      return points.some((p) => distanceMeters(p, { lat, lng }) <= radiusM);
    },
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { at: number; zone: ServiceZone | null } | null = null;
let loading: Promise<ServiceZone | null> | null = null;
/** Chỉ dùng trong kiểm thử: ép một vùng cố định (undefined = dùng DB). */
let override: ServiceZone | null | undefined;

export function setServiceZoneOverride(zone: ServiceZone | null | undefined): void {
  override = zone;
}

/** Nạp vùng giao từ DB (đệm 5 phút theo tiến trình). Lỗi thì trả null và thử lại ở lần sau. */
export async function loadServiceZone(): Promise<ServiceZone | null> {
  if (override !== undefined) return override;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.zone;
  if (loading) return loading;
  loading = (async () => {
    try {
      // Nạp muộn để file này (và test) không kéo theo kết nối DB khi chỉ dùng createServiceZone
      const [{ query }, { INVENTORY_CONFIG }, { hcmStoreSql }] = await Promise.all([
        import('@/lib/db'),
        import('@/config/inventory'),
        import('@/config/service-area'),
      ]);
      const res = await query(
        `SELECT s.latitude, s.longitude FROM stores s
         WHERE s.is_active = true AND ${hcmStoreSql('s')}
           AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
           AND (s.supports_delivery IS NULL OR s.supports_delivery = true)`
      );
      const stores = res.rows.map((r: { latitude: unknown; longitude: unknown }) => ({
        lat: Number(r.latitude),
        lng: Number(r.longitude),
      }));
      const zone = createServiceZone(stores, INVENTORY_CONFIG.SHIPPING.DISTANCE_BASED.MAX_DELIVERY_RADIUS_KM);
      cached = { at: Date.now(), zone };
      return zone;
    } catch (e) {
      console.warn('[ServiceZone] Không nạp được cửa hàng để xác định vùng giao, tạm không lọc theo vị trí:', (e as Error)?.message);
      cached = { at: Date.now() - CACHE_TTL_MS + 30_000, zone: null }; // thử lại sau 30 giây
      return null;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Xóa đệm (dùng trong kiểm thử). */
export function resetServiceZoneCache(): void {
  cached = null;
  loading = null;
}
