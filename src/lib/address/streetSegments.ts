/**
 * Đoạn đường trùng tên ở nhiều quận cũ (src/data/hcm-street-segments.ts, lấy từ OSM một lần bằng
 * scripts/build_hcm_street_segments.mjs). Chỉ dùng khi khách gõ tên đường mà CHƯA gõ khu: thêm các đoạn ở mọi quận cũ
 * vào ứng viên để 4 gợi ý đầu đủ các quận khác nhau (Photon không có điểm ưu tiên thường chỉ trả Quận 1).
 * Ứng viên đi qua mapLocalStreet như bảng đường nội bộ (lọc TP.HCM + vùng giao, độ chính xác mức đường).
 */
import { HCM_STREET_SEGMENTS } from '@/data/hcm-street-segments';
import { HCM_PROVINCE } from './admin';
import { streetKeyOf } from './normalize';
import type { LocalStreetLike } from './suggest';
import type { ParsedAddressInput } from './types';

let byStreet: Map<string, typeof HCM_STREET_SEGMENTS> | null = null;
function index() {
  if (!byStreet) {
    byStreet = new Map();
    for (const s of HCM_STREET_SEGMENTS) {
      const k = streetKeyOf(s.street);
      const list = byStreet.get(k) || [];
      list.push(s);
      byStreet.set(k, list);
    }
  }
  return byStreet;
}

export function streetSegmentCandidates(parsed: ParsedAddressInput): LocalStreetLike[] {
  const h = parsed.hints;
  if (h.wards.length || h.districts.length || h.ambiguous.length) return [];
  if (!parsed.streetKey) return [];
  const list = index().get(parsed.streetKey) || [];
  const house = parsed.houseNumber && !parsed.isAlley ? parsed.houseNumber : '';
  return list.map((s) => ({
    place_id: `seg:${s.osmIds[0] || s.street}`,
    main_text: house ? `${house} ${s.street}` : s.street,
    houseNumber: house || undefined,
    lat: s.lat,
    lng: s.lng,
    district: s.district,
    province: HCM_PROVINCE,
    wardHint: s.ward || undefined,
  }));
}
