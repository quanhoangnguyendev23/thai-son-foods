/**
 * Chạy MỘT LẦN (không chạy khi khách dùng): lấy tâm các đoạn đường TRÙNG TÊN ở nhiều quận cũ của TP.HCM từ OpenStreetMap
 * (qua Photon), ghi vào src/data/hcm-street-segments.ts. Dùng để khi khách gõ "Lê Lợi" mà chưa gõ khu, gợi ý có đủ các
 * quận cũ có đường đó (vd Gò Vấp), không chỉ Quận 1.
 * - Hỏi Photon theo từng (tên đường, quận cũ) với điểm ưu tiên ở tâm quận cũ, tối đa 1 lần / 2 giây, có User-Agent nhận diện (GEO_APP_NAME...).
 * - Chỉ giữ đoạn có tên đúng tên đường; gom theo phường (tra bằng dữ liệu hành chính nội bộ), lấy trung bình tọa độ.
 * Chạy: npx tsx scripts/build_hcm_street_segments.mjs
 */
import fs from 'node:fs';
import { resolveAdminFromProvider, isHcmRegionText, getAreaCenter } from '@/lib/address/admin';
import { normalizeForMatch } from '@/lib/address/normalize';
import { geoHeaders } from '@/lib/address/httpIdentity';

const STREETS = [
  'Lê Lợi', 'Lê Lai', 'Phạm Ngũ Lão', 'Phan Văn Trị', 'Lê Hồng Phong', 'Trần Phú',
  'Quang Trung', 'Nguyễn Trãi', 'Hai Bà Trưng', 'Trần Hưng Đạo', 'Nguyễn Du', 'Lê Văn Thọ',
];
const DISTRICTS = [
  'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 'Quận 8', 'Quận 10', 'Quận 11', 'Quận 12',
  'Quận Gò Vấp', 'Quận Bình Thạnh', 'Quận Phú Nhuận', 'Quận Tân Bình', 'Quận Tân Phú', 'Quận Bình Tân',
  'Quận 2', 'Quận 9', 'TP. Thủ Đức', 'Huyện Hóc Môn', 'Huyện Bình Chánh', 'Huyện Nhà Bè', 'Huyện Củ Chi',
];
const BASE = process.env.PHOTON_BASE_URL || 'https://photon.komoot.io';
const BBOX = '106.35,10.35,107.05,11.2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const byKey = new Map(); // `${street}|${ward}|${district}` → { street, ward, district, pts: [], osmIds: Set }
let calls = 0;
for (const street of STREETS) {
  const want = normalizeForMatch(street);
  for (const d of DISTRICTS) {
    const c = getAreaCenter(undefined, d);
    if (!c) { console.log(`
(bỏ qua ${d}: không có tâm quận)`); continue; }
    const url = `${BASE}/api/?q=${encodeURIComponent(street)}&lat=${c.lat}&lon=${c.lng}&zoom=14&limit=15&osm_tag=highway&bbox=${BBOX}`;
    let data = null;
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      calls++;
      try {
        const res = await fetch(url, { headers: geoHeaders(), signal: AbortSignal.timeout(10000) });
        if (res.status === 429) { await sleep(10000); continue; }
        if (res.ok) data = await res.json();
      } catch { /* thử lại */ }
      await sleep(2000);
    }
    for (const f of data?.features || []) {
      const p = f.properties || {};
      if (normalizeForMatch(String(p.name || '').replace(/^đường\s+/i, '')) !== want) continue;
      if (p.state && !isHcmRegionText(p.state)) continue;
      const [lng, lat] = f.geometry?.coordinates || [];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const admin = resolveAdminFromProvider({ ward: p.district, lat, lng, state: p.state, city: p.city });
      if (!admin.district) continue;
      const k = `${street}|${admin.ward}|${admin.district}`;
      const cur = byKey.get(k) || { street, ward: admin.ward, district: admin.district, pts: [], osmIds: new Set() };
      const id = `${p.osm_type}${p.osm_id}`;
      if (!cur.osmIds.has(id)) { cur.osmIds.add(id); cur.pts.push([lat, lng]); }
      byKey.set(k, cur);
    }
    process.stdout.write(`\r${street} / ${d}  (${calls} lượt gọi, ${byKey.size} đoạn)      `);
  }
}

const today = new Date().toISOString().slice(0, 10);
const rows = Array.from(byKey.values())
  .map((s) => ({
    street: s.street,
    ward: s.ward,
    district: s.district,
    lat: +(s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length).toFixed(6),
    lng: +(s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length).toFixed(6),
    osmIds: Array.from(s.osmIds).sort(),
  }))
  .sort((a, b) => a.street.localeCompare(b.street, 'vi') || a.district.localeCompare(b.district, 'vi') || a.ward.localeCompare(b.ward, 'vi'));

const out = `/**
 * TÂM CÁC ĐOẠN ĐƯỜNG TRÙNG TÊN Ở NHIỀU QUẬN CŨ CỦA TP.HCM — file TẠO TỰ ĐỘNG bởi scripts/build_hcm_street_segments.mjs, KHÔNG sửa tay.
 * Nguồn: dữ liệu OpenStreetMap (© OpenStreetMap contributors, giấy phép ODbL), tra qua Photon (${BASE}).
 * Ngày lấy: ${today}. Mỗi dòng = các đoạn cùng tên trong một phường, tọa độ là trung bình các đoạn (độ chính xác: mức đường).
 * Dùng khi khách gõ tên đường mà chưa gõ khu, để 4 gợi ý đầu đủ các quận cũ khác nhau.
 */
export interface HcmStreetSegment {
  street: string;
  /** Phường/Xã mới (có thể rỗng nếu OSM không ghi) */
  ward: string;
  /** Quận/Huyện cũ */
  district: string;
  lat: number;
  lng: number;
  /** Mã đối tượng OSM của các đoạn đã gom (way/relation) */
  osmIds: string[];
}

export const HCM_STREET_SEGMENTS_SOURCE = {
  source: 'OpenStreetMap (ODbL) qua Photon',
  url: ${JSON.stringify(BASE)},
  fetchedAt: ${JSON.stringify(today)},
} as const;

export const HCM_STREET_SEGMENTS: HcmStreetSegment[] = ${JSON.stringify(rows, null, 2)};
`;
fs.writeFileSync('src/data/hcm-street-segments.ts', out);
console.log(`\nĐã ghi ${rows.length} đoạn (${calls} lượt gọi) vào src/data/hcm-street-segments.ts`);
const perStreet = {};
for (const r of rows) (perStreet[r.street] ||= new Set()).add(r.district);
for (const [s, ds] of Object.entries(perStreet)) console.log(`  ${s}: ${[...ds].join(', ')}`);
