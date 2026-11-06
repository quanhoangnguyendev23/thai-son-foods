/**
 * Đơn vị hành chính cho ô nhập địa chỉ: nhận ra "Hạnh Thông", "P.1", "Q. Gò Vấp" trong chữ khách gõ,
 * đổi qua lại giữa tên cũ (Phường 1, Quận Gò Vấp) và tên mới (Phường Hạnh Thông) theo dữ liệu nội bộ,
 * và so sánh phường/quận của địa chỉ đã chọn với phường/quận tại điểm ghim.
 *
 * Dữ liệu lấy từ `VIETNAM_ADDRESSES` (Quận cũ → Phường mới kèm bí danh "Phường 1, 3, 4, 7").
 * Chỉ lập chỉ mục TP.HCM và hai tỉnh đã sáp nhập vào TP.HCM từ 01/07/2025 (Bình Dương, Bà Rịa - Vũng Tàu).
 * Bẫy chính: nhiều tên quận cũ nay là tên phường mới ("Gò Vấp", "Thủ Đức", "Tân Bình"...). Những cụm đó
 * được ghi là `ambiguous`, không bao giờ tự suy thành phường.
 */

import { HCM_OFFICIAL_UNITS } from '@/data/hcm-admin-units-2025';
import { VIETNAM_ADDRESSES } from '@/data/vietnam-addresses';
import { adminPrefixOf, distanceMeters, expandAbbreviations, normalizeForMatch, stripAdminPrefix } from './normalize';
import type { AdminHints, LatLng, WardRef } from './types';

export const HCM_PROVINCE = 'TP. Hồ Chí Minh';
const HCM_SOURCE_PROVINCES = new Set(['TP. Hồ Chí Minh', 'Bình Dương', 'Bà Rịa - Vũng Tàu']);

/**
 * Tỉnh trong dữ liệu nội bộ có thuộc TP.HCM sau sáp nhập không (để trống = chưa biết, coi là có).
 * Chỉ là cổng thô khi chưa nạp được vùng giao từ cửa hàng (xem serviceZone.ts); vùng giao thật lấy từ cấu hình giao hàng.
 */
export function isHcmRegionProvince(name?: string | null): boolean {
  return !name || HCM_SOURCE_PROVINCES.has(name);
}

/** Như trên nhưng cho chữ tự do của nhà cung cấp ("Thành phố Vũng Tàu, Tỉnh Bà Rịa - Vũng Tàu"); trống = chưa biết, coi là có. */
export function isHcmRegionText(text?: string | null): boolean {
  const n = normalizeForMatch(text || '');
  if (!n) return true;
  for (const name of HCM_SOURCE_PROVINCES) {
    const k = normalizeForMatch(name).replace(/^(tp|thanh pho|tinh)\s+/, '');
    if (k && n.includes(k)) return true;
  }
  return /\b(sai gon|hcm|tphcm)\b/.test(n);
}

interface WardEntry {
  ward: string;
  district: string;
  key: string;
  lat?: number;
  lng?: number;
  numbered: number | null;
}

interface DistrictEntry {
  name: string;
  key: string;
  numeric: boolean;
  lat: number;
  lng: number;
}

interface AdminIndex {
  wardsByKey: Map<string, WardEntry[]>;
  /** Cùng chỉ mục nhưng khóa CÓ DẤU: dùng cho tên nhà cung cấp trả về (luôn có dấu), tránh "Thành" lẫn "Thạnh" */
  wardsByAccent: Map<string, WardEntry[]>;
  /** Khóa không dấu bị trùng giữa các phường khác tên có dấu (vd "thanh an": Thanh An / Thạnh An) */
  collidingKeys: Set<string>;
  districtsByKey: Map<string, DistrictEntry[]>;
  /** Quận → (số phường cũ → phường mới, hoặc chính phường đánh số nếu quận chưa có tên mới) */
  numbered: Map<string, Map<number, WardEntry>>;
  allWards: WardEntry[];
  districts: DistrictEntry[];
}

const keyOf = (text: string): string => stripAdminPrefix(expandAbbreviations(normalizeForMatch(text)));

/** Khóa so khớp của tên phường/quận: không dấu, bỏ tiền tố Phường/Quận/Xã/Huyện/TP. */
export const adminKey = keyOf;

/** Khóa CÓ DẤU (NFC, chữ thường, bỏ tiền tố): "Phường Thạnh An" → "thạnh an". */
export function accentKey(text: string): string {
  return (text || '')
    .normalize('NFC')
    .replace(/Ð/g, 'Đ')
    .replace(/ð/g, 'đ')
    .toLowerCase()
    .replace(/^(phường|xã|thị trấn|đặc khu|p\.|x\.)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chữ có dấu tiếng Việt không (chữ không dấu thì chỉ so được bỏ dấu). */
export function hasVietDiacritics(text: string): boolean {
  const t = (text || '').normalize('NFC');
  return /[^\x00-\x7F]/.test(t) && normalizeForMatch(t) !== t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else {
    map.set(key, [value]);
  }
}

let cached: AdminIndex | null = null;

function getIndex(): AdminIndex {
  if (cached) return cached;
  const wardsByKey = new Map<string, WardEntry[]>();
  const wardsByAccent = new Map<string, WardEntry[]>();
  const districtsByKey = new Map<string, DistrictEntry[]>();
  const numbered = new Map<string, Map<number, WardEntry>>();
  const allWards: WardEntry[] = [];
  const districts: DistrictEntry[] = [];

  for (const province of VIETNAM_ADDRESSES) {
    if (!HCM_SOURCE_PROVINCES.has(province.name)) continue;
    for (const d of province.districts) {
      const dKey = keyOf(d.name);
      const dEntry: DistrictEntry = { name: d.name, key: dKey, numeric: /^\d+$/.test(dKey), lat: d.lat, lng: d.lng };
      districts.push(dEntry);
      push(districtsByKey, dKey, dEntry);

      const numMap = new Map<number, WardEntry>();
      numbered.set(d.name, numMap);
      const entries: WardEntry[] = [];

      for (const w of d.wards) {
        const key = keyOf(w.name);
        const isNum = /^\d+$/.test(key);
        const entry: WardEntry = {
          ward: w.name,
          district: d.name,
          key,
          lat: w.lat,
          lng: w.lng,
          numbered: isNum ? Number(key) : null,
        };
        entries.push(entry);
        allWards.push(entry);
        if (isNum) continue;
        push(wardsByKey, key, entry);
        push(wardsByAccent, accentKey(w.name), entry);
        for (const alias of w.aliases || []) {
          const ak = keyOf(alias);
          if (!ak) continue;
          if (/^\d+$/.test(ak)) numMap.set(Number(ak), entry);
          else {
            if (ak !== key) push(wardsByKey, ak, entry);
            push(wardsByAccent, accentKey(alias), entry);
          }
        }
      }

      // Phường đánh số chưa được phường mới nào nhận làm bí danh: dùng bí danh của chính nó, không có thì giữ nguyên
      for (const entry of entries) {
        if (entry.numbered === null || numMap.has(entry.numbered)) continue;
        const source = d.wards.find((w) => keyOf(w.name) === entry.key);
        let target: WardEntry | undefined;
        for (const alias of source?.aliases || []) {
          target = wardsByKey.get(keyOf(alias))?.find((e) => e.district === d.name);
          if (target) break;
        }
        numMap.set(entry.numbered, target || entry);
      }
    }
  }

  addMissingOfficialUnits(wardsByKey, wardsByAccent, allWards, districts, numbered);

  const collidingKeys = new Set<string>();
  for (const [k, list] of wardsByKey) {
    if (new Set(list.map((e) => accentKey(e.ward))).size > 1) collidingKeys.add(k);
  }

  cached = { wardsByKey, wardsByAccent, collidingKeys, districtsByKey, numbered, allWards, districts };
  return cached;
}

const OFFICIAL_PREFIX: Record<string, string> = { phuong: 'Phường', xa: 'Xã', 'thi-tran': 'Thị trấn', 'dac-khu': 'Đặc khu' };

/**
 * Bổ sung các đơn vị cấp xã CHÍNH THỨC (NQ 1685/NQ-UBTVQH15, src/data/hcm-admin-units-2025.ts) mà dữ liệu nội bộ chưa có
 * (ví dụ phường Sài Gòn, Bàn Cờ, Chợ Quán, Thủ Đức...), để nhận ra tên phường mới khách gõ và nhà cung cấp trả về.
 * Quận cũ và tâm của đơn vị mới suy từ các phường cũ có tên trong dữ liệu nội bộ (không bịa): quận cũ chiếm đa số,
 * tâm là trung bình tọa độ. Không suy được thì bỏ qua, như trước đây. Chỉ THÊM, không sửa/xóa mục nào đang có.
 */
function addMissingOfficialUnits(
  wardsByKey: Map<string, WardEntry[]>,
  wardsByAccent: Map<string, WardEntry[]>,
  allWards: WardEntry[],
  districts: DistrictEntry[],
  numbered: Map<string, Map<number, WardEntry>>
) {
  for (const unit of HCM_OFFICIAL_UNITS) {
    const key = keyOf(unit.name);
    // So CÓ DẤU: "xã Thạnh An" (Cần Giờ) không bị coi là đã có chỉ vì dữ liệu có "xã Thanh An"
    if (wardsByAccent.has(accentKey(unit.name))) continue;
    const known = unit.sources
      .filter((s) => !/^\d+$/.test(s.name.trim()))
      .flatMap((s) => wardsByKey.get(keyOf(s.name)) || []);
    // Quận cũ: phiếu bầu từ các phường cũ đã biết tên + từ ghi chú "(quận 5)" của chính văn bản cho các phường đánh số
    const votes = new Map<string, number>();
    for (const e of known) votes.set(e.district, (votes.get(e.district) || 0) + 1);
    for (const s of unit.sources) {
      if (!s.district) continue;
      const d = districts.find((x) => x.key === keyOf(s.district as string));
      if (d) votes.set(d.name, (votes.get(d.name) || 0) + 1);
    }
    if (!votes.size) continue;
    const district = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const withCoords = known.filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number');
    const entry: WardEntry = {
      ward: `${OFFICIAL_PREFIX[unit.type] || 'Phường'} ${unit.name}`,
      district,
      key,
      lat: withCoords.length ? withCoords.reduce((s, e) => s + (e.lat as number), 0) / withCoords.length : undefined,
      lng: withCoords.length ? withCoords.reduce((s, e) => s + (e.lng as number), 0) / withCoords.length : undefined,
      numbered: null,
    };
    allWards.push(entry);
    push(wardsByKey, key, entry);
    push(wardsByAccent, accentKey(unit.name), entry);
    // Phường cũ đánh số của quận đó (vd. Phường 1, 2, 4 quận 5 → Chợ Quán): chỉ thêm khi chưa có ánh xạ nào
    const numMap = numbered.get(district);
    for (const s of unit.sources) {
      if (!numMap || !/^\d+$/.test(s.name.trim())) continue;
      const n = Number(s.name.trim());
      if (s.district && keyOf(s.district) === keyOf(district) && !numMap.has(n)) numMap.set(n, entry);
    }
  }
}

const toRef = (e: WardEntry): WardRef => ({ ward: e.ward, district: e.district, lat: e.lat, lng: e.lng });

export interface AdminSegmentMatch {
  prefix: 'ward' | 'district' | 'city' | null;
  key: string;
  wards: WardRef[];
  districts: string[];
  province: boolean;
  numberedWard: number | null;
}

/**
 * Nhận ra một đoạn chữ ("Hạnh Thông", "P.1", "Quận Gò Vấp", "TP.HCM") là phường, quận hay thành phố.
 * Trả null nếu không phải địa danh hành chính nào trong dữ liệu.
 */
export function matchAdminSegment(segment: string): AdminSegmentMatch | null {
  const n = expandAbbreviations(normalizeForMatch(segment));
  if (!n) return null;
  const prefix = adminPrefixOf(n);
  const key = stripAdminPrefix(n);
  if (!key) return null;
  const index = getIndex();

  const province = key.startsWith('ho chi minh') || (key === 'sai gon' && prefix !== 'ward');
  if (/^\d+$/.test(key)) {
    // Số trần ("1") không phải địa danh; chỉ "Quận 1" hoặc "Phường 1" mới tính
    if (prefix === 'district') {
      const hits = (index.districtsByKey.get(key) || []).filter((d) => d.numeric).map((d) => d.name);
      return hits.length ? { prefix, key, wards: [], districts: hits, province: false, numberedWard: null } : null;
    }
    if (prefix === 'ward') return { prefix, key, wards: [], districts: [], province: false, numberedWard: Number(key) };
    return null;
  }

  let wards = prefix === 'district' || (prefix === 'city' && !province) ? [] : index.wardsByKey.get(key) || [];
  // Khách gõ CÓ dấu và tên này trùng khi bỏ dấu ("Thạnh An" / "Thanh An"): chỉ giữ phường đúng dấu nếu có
  if (wards.length > 1 && hasVietDiacritics(segment)) {
    const ak = accentKey(segment.replace(/^\s*(p\.|phường|xã|thị trấn)\s*/i, ''));
    const exact = wards.filter((w) => accentKey(w.ward) === ak);
    if (exact.length) wards = exact;
  }
  const districts =
    prefix === 'ward' ? [] : (index.districtsByKey.get(key) || []).filter((d) => !d.numeric).map((d) => d.name);
  if (!wards.length && !districts.length && !province) return null;
  return { prefix, key, wards: wards.map(toRef), districts, province, numberedWard: null };
}

/** Đoạn đuôi không phải phường/quận: nước, khu phố, ấp, tổ... */
const IGNORED_TAIL = /^(viet nam|vietnam|vn|khu pho|kp|to|ap|thon|khom|ngo|hem)(\s|$)/;

/** Gom các đoạn chữ hành chính thành gợi ý để xếp hạng (xem `AdminHints`). */
export function buildAdminHints(segments: string[], soft: boolean): AdminHints {
  const index = getIndex();
  const hints: AdminHints = { wards: [], districts: [], ambiguous: [], province: false, recognized: [], unknown: [], soft };
  const numberedWards: number[] = [];
  const seenWard = new Set<string>();
  const addWard = (w: WardRef) => {
    const k = `${w.ward}|${w.district}`;
    if (!seenWard.has(k)) {
      seenWard.add(k);
      hints.wards.push(w);
    }
  };

  for (const segment of segments) {
    const m = matchAdminSegment(segment);
    if (!m) {
      // Đoạn sau dấu phẩy mà dữ liệu không biết: giữ lại khóa để so với phường của kết quả (không dùng để trừ điểm)
      const uk = keyOf(segment);
      if (!soft && uk.length >= 2 && !/^\d+$/.test(uk) && !IGNORED_TAIL.test(uk) && !hints.unknown.includes(uk)) hints.unknown.push(uk);
      continue;
    }
    hints.recognized.push(segment.trim());
    if (m.province) hints.province = true;
    if (m.numberedWard !== null) numberedWards.push(m.numberedWard);
    if (m.wards.length && (m.districts.length || m.province)) {
      hints.ambiguous.push({ token: segment.trim(), wards: m.wards, districts: m.districts });
    } else if (m.wards.length) {
      m.wards.forEach(addWard);
    } else if (m.districts.length) {
      for (const d of m.districts) if (!hints.districts.includes(d)) hints.districts.push(d);
    }
  }

  if (numberedWards.length) {
    const knownDistricts = Array.from(
      new Set([...hints.districts, ...hints.ambiguous.flatMap((a) => a.districts)])
    );
    for (const n of numberedWards) {
      for (const dn of knownDistricts) {
        const entry = index.numbered.get(dn)?.get(n);
        if (entry) addWard(toRef(entry));
      }
    }
  }
  return hints;
}

/** Phường khớp tên nhưng tâm phường cách điểm quá xa mức này thì coi là trùng tên ở nơi khác. */
const SAME_NAME_WARD_MAX_M = 12_000;
const SAME_NAME_DISTRICT_MAX_M = 25_000;

export interface ProviderAdminInput {
  /** Phường/Xã theo nhà cung cấp (Photon trả tên phường MỚI trong trường `district`) */
  ward?: string;
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
}

export interface ResolvedAdmin {
  province: string;
  /** Phường/Xã mới, có tiền tố ("Phường Hạnh Thông"); rỗng nếu nhà cung cấp không trả */
  ward: string;
  /** Quận/Huyện cũ chứa phường đó; rỗng nếu không suy ra được */
  district: string;
  /** true nếu quận cũ suy ra từ tên phường khớp chính xác trong dữ liệu */
  exact: boolean;
}

const nearest = <T extends { lat?: number; lng?: number }>(list: T[], at: LatLng | null): T | undefined => {
  if (!list.length) return undefined;
  if (!at) return list[0];
  let best = list[0];
  let bestD = Infinity;
  for (const item of list) {
    if (typeof item.lat !== 'number' || typeof item.lng !== 'number') continue;
    const d = distanceMeters(at, { lat: item.lat, lng: item.lng });
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
};

/**
 * Đổi phường của nhà cung cấp thành bộ (phường mới, quận cũ).
 * 1) Khớp tên phường trong dữ liệu → quận cũ chính xác.
 * 2) Không khớp: lấy quận của phường (có tọa độ) gần nhất trong 3 km, nếu không thì quận gần nhất theo tâm quận.
 */
export function resolveAdminFromProvider(input: ProviderAdminInput): ResolvedAdmin {
  const index = getIndex();
  const at = typeof input.lat === 'number' && typeof input.lng === 'number' ? { lat: input.lat, lng: input.lng } : null;
  const wardText = (input.ward || '').trim();

  // Tỉnh trong kết quả khác TP.HCM (vd "Thành phố Đồng Nai" cho Long Thành): KHÔNG BAO GIỜ gán vào phường TP.HCM
  const regionText = (input.state || '').trim();
  if (regionText && !isHcmRegionText(regionText)) {
    return { province: (input.state || input.city || '').trim(), ward: wardText, district: '', exact: false };
  }

  if (wardText) {
    const key = keyOf(wardText);
    // Tên nhà cung cấp luôn có dấu: so CÓ DẤU ("Long Thành" ≠ "Long Thạnh"). Chỉ khi nhà cung cấp trả chữ không dấu
    // mới so bỏ dấu.
    const exact = index.wardsByAccent.get(accentKey(wardText)) || [];
    const hits = /^\d+$/.test(key)
      ? []
      : exact.length || hasVietDiacritics(wardText)
      ? exact
      : index.wardsByKey.get(key) || [];
    if (hits.length) {
      const hit = nearest(hits, at) || hits[0];
      // Trùng tên phường/xã ở nơi khác ("Bình Trung" ở Châu Đức vs "Bình Trưng" ở Thủ Đức): tâm phường khớp tên mà cách
      // điểm này quá xa thì không phải phường đó, rơi xuống bước suy theo tọa độ bên dưới.
      // Phường chưa có tọa độ thì so với tâm quận cũ của nó (ngưỡng rộng hơn)
      const hitCenter = typeof hit.lat === 'number' && typeof hit.lng === 'number' ? { lat: hit.lat, lng: hit.lng } : getAreaCenter(hit.ward, hit.district);
      const far =
        !!at && !!hitCenter &&
        distanceMeters(at, hitCenter) > (typeof hit.lat === 'number' ? SAME_NAME_WARD_MAX_M : SAME_NAME_DISTRICT_MAX_M);
      if (!far) return { province: HCM_PROVINCE, ward: hit.ward, district: hit.district, exact: true };
    }
  }

  const wardName = wardText
    ? /^(phường|xã|thị trấn|đặc khu)\s/i.test(wardText)
      ? wardText
      : `Phường ${wardText}`
    : '';

  if (at) {
    const withCoords = index.allWards.filter((w) => typeof w.lat === 'number' && typeof w.lng === 'number');
    let bestW: WardEntry | undefined;
    let bestD = 3000;
    for (const w of withCoords) {
      const d = distanceMeters(at, { lat: w.lat as number, lng: w.lng as number });
      if (d < bestD) {
        bestD = d;
        bestW = w;
      }
    }
    if (bestW) return { province: HCM_PROVINCE, ward: wardName, district: bestW.district, exact: false };
    const d = nearest(index.districts, at);
    if (d) return { province: HCM_PROVINCE, ward: wardName, district: d.name, exact: false };
  }
  return { province: HCM_PROVINCE, ward: wardName, district: '', exact: false };
}

/** Khóa chuẩn của phường để so sánh: "Phường 1" của Gò Vấp và "Phường Hạnh Thông" cho cùng một khóa. */
export function canonicalWardKey(ward?: string, district?: string): { key: string; known: boolean } {
  const text = (ward || '').trim();
  if (!text) return { key: '', known: false };
  const index = getIndex();
  const key = keyOf(text);
  if (/^\d+$/.test(key)) {
    const hit = district ? index.numbered.get(district)?.get(Number(key)) : undefined;
    return hit ? { key: hit.key, known: true } : { key: `so:${key}`, known: false };
  }
  // Khóa không dấu trùng giữa hai phường khác tên ("Thanh An" / "Thạnh An"): thêm khóa có dấu để không bị coi là một
  if (index.collidingKeys.has(key)) {
    const exact = index.wardsByAccent.get(accentKey(text));
    if (exact?.length) return { key: `${exact[0].key}#${accentKey(exact[0].ward)}`, known: true };
    return { key, known: false };
  }
  const hits = index.wardsByKey.get(key);
  if (hits?.length) return { key: hits[0].key, known: true };
  return { key, known: false };
}

/** Tâm của phường (nếu dữ liệu có tọa độ), nếu không thì tâm của quận. */
export function getAreaCenter(ward?: string, district?: string): LatLng | null {
  const index = getIndex();
  if (ward) {
    const key = keyOf(ward);
    const hits = /^\d+$/.test(key)
      ? [index.numbered.get(district || '')?.get(Number(key))].filter((e): e is WardEntry => !!e)
      : index.wardsByKey.get(key) || [];
    const hit = (district ? hits.find((h) => h.district === district) : undefined) || hits[0];
    if (hit && typeof hit.lat === 'number' && typeof hit.lng === 'number') return { lat: hit.lat, lng: hit.lng };
  }
  if (district) {
    const hit = index.districts.find((d) => d.name === district);
    if (hit) return { lat: hit.lat, lng: hit.lng };
  }
  return null;
}

export interface MismatchResult {
  mismatch: boolean;
  reason: 'ward' | 'district' | 'far' | null;
}

export interface AdminPair {
  ward?: string;
  district?: string;
}

/**
 * So phường/quận của địa chỉ khách đã chọn với phường/quận tại điểm ghim.
 * Chỉ cảnh báo nhẹ (không tự sửa, không chặn):
 * - cả hai phường đều có trong dữ liệu nhưng khác nhau → 'ward'
 * - không so được phường thì so quận cũ → 'district'
 * - ghim cách tâm khu vực đã chọn quá xa (6 km với phường, 12 km với quận) → 'far'
 */
export function detectLocationMismatch(chosen: AdminPair, atPin: AdminPair, pin?: LatLng | null): MismatchResult {
  const a = canonicalWardKey(chosen.ward, chosen.district);
  const b = canonicalWardKey(atPin.ward, atPin.district);
  if (a.known && b.known && a.key !== b.key) return { mismatch: true, reason: 'ward' };
  if (!(a.known && b.known) && chosen.district && atPin.district && chosen.district !== atPin.district) {
    return { mismatch: true, reason: 'district' };
  }
  if (pin) {
    const center = getAreaCenter(chosen.ward, chosen.district);
    if (center) {
      const limit = a.known ? wardLimitM(chosen.ward, chosen.district) : DISTRICT_LIMIT_M;
      if (distanceMeters(center, pin) > limit) return { mismatch: true, reason: 'far' };
    }
  }
  return { mismatch: false, reason: null };
}

const DISTRICT_LIMIT_M = 12_000;

/**
 * Ngưỡng "ghim cách tâm phường quá xa" theo CỠ phường: gấp đôi khoảng cách từ tâm phường tới tâm phường gần nhất
 * (xấp xỉ đường kính phường), kẹp trong 2,5–10 km. Phường nhỏ ở nội thành thì ngưỡng nhỏ, xã rộng ở ngoại thành thì lớn.
 * Chỉ là kiểm tra phụ; kiểm tra chính là so phường tại ghim (xem detectLocationMismatch).
 */
export function wardLimitM(ward?: string, district?: string): number {
  const center = getAreaCenter(ward, district);
  if (!center) return DISTRICT_LIMIT_M;
  let nearestOther = Infinity;
  for (const w of getIndex().allWards) {
    if (typeof w.lat !== 'number' || typeof w.lng !== 'number') continue;
    const d = distanceMeters(center, { lat: w.lat, lng: w.lng });
    if (d > 50 && d < nearestOther) nearestOther = d; // > 50 m: bỏ chính phường đó
  }
  if (!Number.isFinite(nearestOther)) return DISTRICT_LIMIT_M;
  return Math.min(10_000, Math.max(2_500, 2 * nearestOther));
}

/** "Quận 1" → "Q.1", "Quận Gò Vấp" → "Gò Vấp", "TP. Thủ Đức" → "Thủ Đức" (dùng cho dòng "(Gò Vấp cũ)"). */
export function shortDistrictLabel(district: string): string {
  const t = (district || '').trim();
  const num = t.match(/^(?:quận|q\.?)\s*(\d+)$/i);
  if (num) return `Q.${num[1]}`;
  return t.replace(/^(quận|huyện|thị xã|tp\.?|thành phố)\s+/i, '').trim();
}

/** "Phường Hạnh Thông" → "P. Hạnh Thông"; xã giữ nguyên. */
export function shortWardLabel(ward: string): string {
  return (ward || '').trim().replace(/^phường\s+/i, 'P. ');
}

/** "P. Hạnh Thông (Gò Vấp cũ), TP.HCM" */
export function formatAdminLine(admin: { ward?: string; district?: string; province?: string }): string {
  const ward = shortWardLabel(admin.ward || '');
  const district = admin.district ? shortDistrictLabel(admin.district) : '';
  const province = admin.province === HCM_PROVINCE ? 'TP.HCM' : admin.province || '';
  const first = ward ? (district ? `${ward} (${district} cũ)` : ward) : district ? `${district} (quận cũ)` : '';
  return [first, province].filter(Boolean).join(', ');
}
