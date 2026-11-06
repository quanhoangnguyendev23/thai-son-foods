/**
 * Phần "não" của gợi ý địa chỉ, toàn hàm thuần để test được:
 * - parseAddressInput: tách chữ khách gõ thành số nhà / tên đường / phường / quận (KHÔNG cắt lại câu hỏi gửi nhà cung cấp)
 * - mapPhotonFeature, mapLocalStreet, buildAreaFallback: đổi kết quả của từng nguồn về cùng một dạng
 * - dedupeSuggestions, rankSuggestions: gộp trùng và xếp hạng theo phường/quận khách đã gõ
 *
 * Nguyên tắc: kết quả mâu thuẫn với phường/quận khách gõ bị đẩy xuống cuối, không bao giờ được tự chọn thay khách.
 */

import {
  accentKey,
  adminKey,
  buildAdminHints,
  canonicalWardKey,
  formatAdminLine,
  getAreaCenter,
  hasVietDiacritics,
  HCM_PROVINCE,
  isHcmRegionProvince,
  isHcmRegionText,
  matchAdminSegment,
  resolveAdminFromProvider,
} from './admin';
import {
  cleanStreetDisplay,
  composeAddressLine,
  distanceMeters,
  normalizeForMatch,
  sameHouseNumber,
  splitAlleyName,
  splitHouseAndStreet,
  streetKeyOf,
} from './normalize';
import type { ServiceZone } from './serviceZone';
import type { AddressPrecision, AddressSuggestion, AdminHints, LatLng, ParsedAddressInput } from './types';

export const MAX_SUGGESTIONS = 8;

/** Có ít nhất 2 chữ cái (khác số) thì mới đáng gọi nhà cung cấp: "101" thì chưa, "101 Lê" thì có. */
export function hasSearchableText(text: string): boolean {
  const letters = (text || '').replace(/[^\p{L}]/gu, '');
  return letters.length >= 2;
}

export function parseAddressInput(raw: string): ParsedAddressInput {
  const text = (raw || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const segments = text.split(',').map((s) => s.trim()).filter(Boolean);
  const split = splitHouseAndStreet(segments[0] || '');
  let street = split.street;
  let adminSegments = segments.slice(1);
  let soft = false;

  if (!adminSegments.length && street) {
    // Không có dấu phẩy ("101 le loi go vap"): thử bóc tối đa 3 cụm cuối nếu là phường/quận.
    // Luôn chừa lại ít nhất 1 từ cho tên đường; kết quả chỉ để cộng điểm (soft).
    let words = street.split(' ');
    const peeled: string[] = [];
    for (let guard = 0; guard < 3; guard++) {
      let found = false;
      for (let k = Math.min(4, words.length - 1); k >= 1; k--) {
        const suffix = words.slice(words.length - k).join(' ');
        const m = matchAdminSegment(suffix);
        if (m && (m.wards.length || m.districts.length || m.numberedWard !== null)) {
          peeled.unshift(suffix);
          words = words.slice(0, words.length - k);
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    if (peeled.length) {
      adminSegments = peeled;
      street = words.join(' ');
      soft = true;
    }
  }

  return {
    raw: text,
    houseNumber: split.houseNumber,
    houseLabel: split.houseLabel,
    isAlley: split.isAlley,
    street,
    streetKey: streetKeyOf(street),
    hints: buildAdminHints(adminSegments, soft),
  };
}

// ───────────────────────────── Yêu cầu gửi Photon ─────────────────────────────

export interface PhotonRequest {
  q: string;
  bias: LatLng | null;
  limit: number;
}

/** Tâm khu vực khách đã gõ (phường rõ ràng → quận → cụm nhập nhằng), để làm bias cho Photon. */
export function hintCenter(parsed: ParsedAddressInput): LatLng | null {
  const h = parsed.hints;
  const w = h.wards[0] || h.ambiguous[0]?.wards[0];
  if (h.wards[0]) return getAreaCenter(h.wards[0].ward, h.wards[0].district);
  if (h.districts[0]) return getAreaCenter(undefined, h.districts[0]);
  if (h.ambiguous[0]?.districts[0]) return getAreaCenter(undefined, h.ambiguous[0].districts[0]);
  return w ? getAreaCenter(w.ward, w.district) : null;
}

export const PHOTON_PUBLIC_BASE_URL = 'https://photon.komoot.io';

/**
 * Kế hoạch câu hỏi gửi Photon: phần tử đầu là câu CHÍNH (NGUYÊN chuỗi khách gõ); phần tử thứ hai (nếu có) là câu BỔ SUNG
 * và chỉ được gửi khi câu chính chưa có kết quả đúng đường + đúng khu khách gõ (xem `hasGoodResult`):
 * - số nhà nhiều cấp ("12/34/5 Lê Lợi"): chỉ tên đường, vì OSM không có số nhà dạng đó;
 * - khách có gõ phường/quận: số nhà + tên đường kèm bias vào khu đó (OSM dùng tên phường mới nên "Gò Vấp" trong câu
 *   dễ khớp nhầm tên địa điểm "Cầu vượt Ngã sáu Gò Vấp").
 */
export function buildPhotonRequests(parsed: ParsedAddressInput, clientBias: LatLng | null): PhotonRequest[] {
  const center = hintCenter(parsed);
  const hintsTyped = !!(parsed.hints.wards.length || parsed.hints.districts.length || parsed.hints.ambiguous.length);
  // Chưa gõ khu: lấy nhiều kết quả hơn trong CÙNG một lượt gọi (một con đường dài chiếm nhiều kết quả, cần thấy đủ khu)
  const requests: PhotonRequest[] = [{ q: parsed.raw, bias: center || clientBias, limit: hintsTyped ? 14 : 30 }];
  const h = parsed.hints;
  const areaTyped = !!(h.wards.length || h.districts.length || h.ambiguous.length);
  if (parsed.street) {
    const multiLevelHouse = /\//.test(parsed.houseNumber || '');
    if (multiLevelHouse) {
      if (parsed.street !== parsed.raw) requests.push({ q: parsed.street, bias: center || clientBias, limit: 14 });
    } else if (center && areaTyped) {
      const q = composeAddressLine(parsed.houseLabel, parsed.street);
      if (q && q !== parsed.raw) requests.push({ q, bias: center, limit: 14 });
    }
  }
  return requests;
}

/**
 * Đường dẫn gọi Photon. `zone` (vùng giao lấy từ cấu hình cửa hàng + bán kính giao) làm hộp giới hạn kết quả;
 * `baseUrl` lấy từ PHOTON_BASE_URL (bản công cộng chỉ nên dùng khi phát triển).
 */
export function photonUrl(req: PhotonRequest, zone: ServiceZone | null, baseUrl: string = PHOTON_PUBLIC_BASE_URL): string {
  const u = new URL('/api/', baseUrl);
  u.searchParams.set('q', req.q);
  u.searchParams.set('limit', String(req.limit));
  u.searchParams.append('layer', 'street');
  u.searchParams.append('layer', 'house');
  if (zone) {
    const b = zone.bbox;
    u.searchParams.set('bbox', `${b.minLng.toFixed(5)},${b.minLat.toFixed(5)},${b.maxLng.toFixed(5)},${b.maxLat.toFixed(5)}`);
  }
  if (req.bias) {
    u.searchParams.set('lat', req.bias.lat.toFixed(5));
    u.searchParams.set('lon', req.bias.lng.toFixed(5));
  }
  return u.toString();
}

// ───────────────────────────── Đổi kết quả nguồn về một dạng ─────────────────────────────

export interface PhotonFeature {
  properties?: {
    osm_type?: string;
    osm_id?: number | string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    countrycode?: string;
  };
  geometry?: { coordinates?: number[] };
}

function buildSuggestion(input: {
  id: string;
  parsed: ParsedAddressInput;
  street: string;
  precision: AddressPrecision;
  source: AddressSuggestion['source'];
  lat: number;
  lng: number;
  ward: string;
  district: string;
  exact: boolean;
  label?: string;
  houseLabelOverride?: string;
}): AddressSuggestion {
  const { parsed } = input;
  const houseLabel = input.houseLabelOverride ?? parsed.houseLabel;
  const main = composeAddressLine(houseLabel, input.street);
  const admin = { ward: input.ward, district: input.district, province: HCM_PROVINCE };
  return {
    place_id: input.id,
    description: [main, input.ward, input.district, HCM_PROVINCE].filter(Boolean).join(', '),
    main_text: main,
    secondary_text: formatAdminLine(admin),
    source: input.source,
    lat: input.lat,
    lng: input.lng,
    ward: input.ward || undefined,
    district: input.district || undefined,
    province: HCM_PROVINCE,
    houseNumber: parsed.houseNumber || undefined,
    street: input.street,
    precision: input.precision,
    label: input.label,
    adminExact: input.exact,
  };
}

/**
 * Photon → gợi ý. Giữ lại đường và nhà có địa chỉ, bỏ địa điểm không có địa chỉ.
 * - Hẻm ("Hẻm 116 Đường Lê Lợi") được gộp về đường chính để không dính số nhà khách gõ vào tên hẻm.
 * - Số nhà luôn là số khách gõ; chỉ coi là "house" khi nhà cung cấp có đúng số đó.
 */
export function mapPhotonFeature(
  feature: PhotonFeature,
  parsed: ParsedAddressInput,
  zone: ServiceZone | null = null
): AddressSuggestion | null {
  const p = feature.properties || {};
  const c = feature.geometry?.coordinates;
  if (!c || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Vùng giao = vòng tròn quanh cửa hàng GIAO VỚI TP.HCM: tỉnh nhà cung cấp trả khác TP.HCM (vd Long Thành, Đồng Nai)
  // thì luôn bỏ, kể cả khi nằm trong bán kính của một cửa hàng gần ranh giới
  // (dựa vào `state` khi có; chỉ có `city` thì chỉ dùng khi chưa nạp được vùng giao)
  if (p.state ? !isHcmRegionText(p.state) : !zone && !isHcmRegionText(p.city)) return null;
  if (zone && !zone.contains(lat, lng)) return null;
  if (p.countrycode && p.countrycode.toUpperCase() !== 'VN') return null;

  let streetRaw = '';
  let providerHouse = '';
  let label: string | undefined;
  if (p.type === 'street') {
    streetRaw = p.name || '';
  } else if (p.type === 'house') {
    providerHouse = (p.housenumber || '').trim();
    streetRaw = p.street || '';
    if (!providerHouse || !streetRaw) return null; // địa điểm không có địa chỉ (trạm xe buýt...)
    if (p.name && streetKeyOf(p.name) !== streetKeyOf(streetRaw)) label = p.name.trim();
  } else {
    return null;
  }
  if (!streetRaw.trim()) return null;

  const alley = splitAlleyName(streetRaw);
  const street = cleanStreetDisplay(alley ? alley.baseStreet : streetRaw);
  if (!street) return null;

  const admin = resolveAdminFromProvider({ ward: p.district, lat, lng, city: p.city, state: p.state });
  const exactHouse = !alley && !parsed.isAlley && !!providerHouse && sameHouseNumber(providerHouse, parsed.houseNumber);
  const precision: AddressPrecision = exactHouse ? 'house' : 'street';
  const osmId = p.osm_id !== undefined ? `${p.osm_type || ''}${p.osm_id}` : '';
  const wardKey = canonicalWardKey(admin.ward, admin.district).key || normalizeForMatch(admin.ward);
  const id =
    exactHouse && osmId
      ? `ph:${osmId}`
      : `ph:${streetKeyOf(street)}|${wardKey}|${parsed.isAlley && alley ? alley.alleyNumber : ''}`;

  return buildSuggestion({
    id,
    parsed,
    street,
    precision,
    source: 'photon',
    lat,
    lng,
    ward: admin.ward,
    district: admin.district,
    exact: admin.exact,
    label: exactHouse ? label : undefined,
  });
}

export interface LocalStreetLike {
  place_id: string;
  main_text: string;
  houseNumber?: string;
  lat: number;
  lng: number;
  district?: string;
  province?: string;
  wardHint?: string;
}

/**
 * Bảng đường nội bộ → gợi ý. Chỉ lấy trong vùng giao; toạ độ là tâm đường nên precision luôn là 'street'.
 * Chưa có vùng giao (chưa nạp được cửa hàng) thì dùng cổng tỉnh thô của dữ liệu hành chính nội bộ.
 */
export function mapLocalStreet(
  item: LocalStreetLike,
  parsed: ParsedAddressInput,
  zone: ServiceZone | null = null
): AddressSuggestion | null {
  // Bảng nội bộ cũng phải qua đủ hai lớp: thuộc TP.HCM VÀ trong vùng giao
  if (!isHcmRegionProvince(item.province)) return null;
  if (zone && !zone.contains(item.lat, item.lng)) return null;
  const house = item.houseNumber || '';
  const street = cleanStreetDisplay(
    house && item.main_text.startsWith(house) ? item.main_text.slice(house.length).trim() : item.main_text
  );
  if (!street) return null;
  const admin = resolveAdminFromProvider({ ward: item.wardHint, lat: item.lat, lng: item.lng });
  const district = item.district || admin.district;
  const ward = admin.exact || !item.wardHint ? admin.ward : item.wardHint;
  const wardKey = canonicalWardKey(ward, district).key || normalizeForMatch(ward);
  return buildSuggestion({
    id: `loc:${streetKeyOf(street)}|${wardKey}`,
    parsed,
    street,
    precision: 'street',
    source: 'local',
    lat: item.lat,
    lng: item.lng,
    ward,
    district,
    exact: true,
  });
}

/**
 * Khi khách đã gõ phường/quận mà không nguồn nào có đúng khu đó: đưa ra một gợi ý "vị trí gần đúng" ở tâm khu vực
 * với chính số nhà và tên đường khách gõ, để khách chọn rồi tự chấm ghim. Không bao giờ thay thế chữ khách gõ.
 */
export function buildAreaFallback(parsed: ParsedAddressInput): AddressSuggestion | null {
  if (!parsed.street || !hasSearchableText(parsed.street)) return null;
  const h = parsed.hints;
  let ward = '';
  let district = '';
  if (h.wards[0]) {
    ward = h.wards[0].ward;
    district = h.wards[0].district;
  } else if (h.districts[0]) {
    district = h.districts[0];
  } else if (h.ambiguous[0]?.districts[0]) {
    district = h.ambiguous[0].districts[0];
  } else {
    return null;
  }
  const center = getAreaCenter(ward, district);
  if (!center) return null;
  const key = ward ? canonicalWardKey(ward, district).key : normalizeForMatch(district);
  return buildSuggestion({
    id: `area:${key}|${streetKeyOf(parsed.street)}`,
    parsed,
    street: parsed.street,
    precision: 'area',
    source: 'area',
    lat: center.lat,
    lng: center.lng,
    ward,
    district,
    exact: !!ward,
  });
}

// ───────────────────────────── Gộp trùng và xếp hạng ─────────────────────────────

const PRECISION_RANK: Record<AddressPrecision, number> = { house: 3, street: 2, area: 1 };
const SOURCE_RANK: Record<AddressSuggestion['source'], number> = { photon: 4, google: 4, nominatim: 3, local: 2, area: 1 };

function dedupeKey(s: AddressSuggestion): string {
  const street = s.street ? streetKeyOf(s.street) : normalizeForMatch(s.main_text);
  const area = s.ward ? canonicalWardKey(s.ward, s.district).key : normalizeForMatch(s.district || '');
  return `${street}|${area}|${s.precision === 'house' ? s.houseNumber || '' : ''}`;
}

/** Gộp các kết quả cùng (đường, phường, số nhà); giữ kết quả chính xác hơn rồi tới nguồn đáng tin hơn. */
export function dedupeSuggestions(list: AddressSuggestion[]): AddressSuggestion[] {
  const best = new Map<string, { s: AddressSuggestion; order: number }>();
  list.forEach((s, order) => {
    const k = dedupeKey(s);
    const cur = best.get(k);
    if (!cur) {
      best.set(k, { s, order });
      return;
    }
    const a = PRECISION_RANK[s.precision || 'street'] * 10 + SOURCE_RANK[s.source];
    const b = PRECISION_RANK[cur.s.precision || 'street'] * 10 + SOURCE_RANK[cur.s.source];
    if (a > b) best.set(k, { s, order: cur.order });
  });
  return Array.from(best.values())
    .sort((x, y) => x.order - y.order)
    .map((x) => x.s);
}

/** Kết quả vừa đúng đường khách gõ vừa đúng khu khách gõ (nếu có gõ khu): đủ tốt để không cần hỏi thêm câu bổ sung. */
export function isGoodResult(s: AddressSuggestion, parsed: ParsedAddressInput): boolean {
  const h = parsed.hints;
  const areaTyped = h.wards.length || h.districts.length || h.ambiguous.length;
  return streetRelation(s, parsed).same && (!areaTyped || inTypedArea(s, h));
}

/**
 * Khu khách gõ (phường / quận nhận ra được) nằm ngoài vùng giao: khi đó báo "ngoài vùng giao" thay vì đưa điểm ở khu khác.
 * Chưa có vùng giao (chưa nạp được cửa hàng) thì không kết luận.
 */
export function typedAreaOutOfZone(parsed: ParsedAddressInput, zone: ServiceZone | null): boolean {
  if (!zone) return false;
  const h = parsed.hints;
  if (!(h.wards.length || h.districts.length || h.ambiguous.length)) return false;
  const centers = [
    ...h.wards.map((w) => getAreaCenter(w.ward, w.district)),
    ...h.districts.map((d) => getAreaCenter(undefined, d)),
    ...h.ambiguous.flatMap((a) => [...a.wards.map((w) => getAreaCenter(w.ward, w.district)), ...a.districts.map((d) => getAreaCenter(undefined, d))]),
  ].filter((c): c is LatLng => !!c);
  if (!centers.length) return false;
  // Chỉ kết luận khi MỌI cách hiểu khu khách gõ đều nằm ngoài vùng
  return centers.every((c) => !zone.contains(c.lat, c.lng));
}

const SAME_STREET_MERGE_M = 1000;
const DIVERSE_TOP = 4;

/**
 * Khách chưa gõ khu ("Lê Lợi"): các đoạn cùng tên đường cách nhau dưới ~1 km là cùng một con đường (Bến Thành / Sài Gòn
 * trên đại lộ Lê Lợi Q.1 cách ~95 m) nên gộp thành một mục; rồi đưa 4 mục đầu về 4 khu khác nhau (theo quận cũ) nếu có,
 * để khách ở Gò Vấp không phải cuộn qua nhiều mục Quận 1.
 */
/** Nội thành cũ ("Quận …", TP. Thủ Đức) trước huyện ngoại thành / vùng Bình Dương cũ khi chọn 4 mục đầu. */
function coreTier(district?: string): number {
  const d = (district || '').trim();
  if (/^quận\s/i.test(d)) return 0;
  if (/thủ đức/i.test(d)) return 1;
  return d ? 2 : 3;
}

export function diversifyWithoutArea(
  list: AddressSuggestion[],
  opts: { preferCore?: boolean; isExact?: (s: AddressSuggestion) => boolean } = {}
): AddressSuggestion[] {
  const merged: AddressSuggestion[] = [];
  for (const s of list) {
    const key = s.street ? streetKeyOf(s.street) : normalizeForMatch(s.main_text);
    const dup = merged.some(
      (m) =>
        (m.street ? streetKeyOf(m.street) : normalizeForMatch(m.main_text)) === key &&
        // Cùng đường, cùng quận cũ (Phan Văn Trị ở An Nhơn và ở P. Gò Vấp) hoặc cách nhau dưới ~1 km: một mục
        ((!!m.district && m.district === s.district) ||
          (typeof m.lat === 'number' && typeof s.lat === 'number' &&
            distanceMeters({ lat: m.lat, lng: m.lng as number }, { lat: s.lat, lng: s.lng as number }) < SAME_STREET_MERGE_M))
    );
    if (!dup) merged.push(s);
  }
  const top: AddressSuggestion[] = [];
  const seen = new Set<string>();
  // Không có vị trí gần khách: đường trùng tên ở 6 quận ("Lê Lợi") thì ưu tiên nội thành để Gò Vấp không bị đẩy ra sau
  // Hóc Môn / Bến Cát. Đúng tên đường khách gõ luôn đứng trước tên chỉ bắt đầu giống ("Nguyễn Duy nối dài" khi gõ
  // "Nguyễn Du"). Giữ thứ tự xếp hạng trong cùng nhóm.
  const exactRank = (s: AddressSuggestion) => (opts.isExact && !opts.isExact(s) ? 1 : 0);
  const pickOrder = opts.preferCore
    ? merged
        .map((s, i) => ({ s, i }))
        .sort((x, y) => exactRank(x.s) - exactRank(y.s) || coreTier(x.s.district) - coreTier(y.s.district) || x.i - y.i)
        .map((x) => x.s)
    : merged;
  for (const s of pickOrder) {
    if (top.length >= DIVERSE_TOP) break;
    const area = s.district || s.ward || '';
    if (!seen.has(area)) {
      seen.add(area);
      top.push(s);
    }
  }
  return [...top, ...merged.filter((s) => !top.includes(s))];
}

export function hasGoodResult(list: AddressSuggestion[], parsed: ParsedAddressInput): boolean {
  return list.some((s) => isGoodResult(s, parsed));
}

export interface RankContext {
  /** Vị trí gần khách (GPS đã cho phép, địa chỉ đã lưu...). Chỉ là bias, không bao giờ loại kết quả. */
  bias?: LatLng | null;
  /** Vùng giao: gợi ý "vị trí gần đúng" ở tâm khu nằm ngoài vùng thì không đưa ra. */
  zone?: ServiceZone | null;
  /** Phường/quận đang chọn ở ô chọn. Chỉ cộng nhẹ khi chữ khách gõ không có địa danh, không bao giờ trừ điểm. */
  context?: { ward?: string; district?: string } | null;
}

/**
 * Điểm và kết luận "cùng đường" giữa đường của kết quả và đường khách gõ.
 * Chỉ chung 1 từ phổ biến ("Lê", "Nguyễn", "Trần"...) thì chưa phải cùng đường: "Lê Hoàng Phái" không thay được "Lê Lợi".
 */
export function streetRelation(s: AddressSuggestion, parsed: ParsedAddressInput): { points: number; same: boolean } {
  const typed = parsed.streetKey;
  if (!typed) return { points: 0, same: true };
  const candidate = s.street ? streetKeyOf(s.street) : streetKeyOf(s.main_text.replace(/^\S*\d\S*\s+/, ''));
  if (candidate === typed) {
    // Cùng chữ khi bỏ dấu nhưng khác dấu, khi cả hai đều gõ có dấu ("Nguyễn Du" ≠ "Nguyễn Dữ"): khác đường
    const candText = cleanStreetDisplay(s.street || s.main_text.replace(/^\S*\d\S*\s+/, ''));
    const typedText = cleanStreetDisplay(parsed.street);
    const strip = (t: string) => accentKey(t).replace(/^(đường|phố|đại lộ)\s+/, '');
    if (hasVietDiacritics(typedText) && hasVietDiacritics(candText) && strip(typedText) !== strip(candText)) {
      return { points: 20, same: false };
    }
    return { points: 100, same: true };
  }
  if (candidate.startsWith(typed)) return { points: 70, same: true };
  if (typed.startsWith(candidate) && candidate.length >= 3) return { points: 55, same: true };
  if (candidate.includes(typed)) return { points: 40, same: true };
  if (typed.includes(candidate) && candidate.length >= 3) return { points: 30, same: true };
  const set = new Set(candidate.split(' '));
  const overlap = typed.split(' ').filter((t) => set.has(t)).length;
  return { points: overlap >= 2 ? overlap * 10 : -60, same: false };
}

/** Kết quả có nằm đúng phường / quận khách đã gõ không (tính cả tên cũ ↔ mới). */
export function inTypedArea(s: AddressSuggestion, h: AdminHints): boolean {
  const candWard = s.ward ? canonicalWardKey(s.ward, s.district).key : '';
  const candDistrict = s.district || '';
  if (candWard && h.wards.some((w) => canonicalWardKey(w.ward, w.district).key === candWard)) return true;
  if (candDistrict && h.districts.includes(candDistrict)) return true;
  return h.ambiguous.some(
    (amb) =>
      (!!candWard && amb.wards.some((w) => canonicalWardKey(w.ward, w.district).key === candWard)) ||
      (!!candDistrict && amb.districts.includes(candDistrict))
  );
}

function scoreOne(s: AddressSuggestion, parsed: ParsedAddressInput, ctx: RankContext): number {
  let score = 0;

  // 1) Tên đường
  const street = streetRelation(s, parsed);
  score += street.points;

  // 2) Số nhà và độ chính xác (số nhà trùng ở một đường khác không có giá trị)
  if (s.precision === 'house' && street.same && parsed.houseNumber && sameHouseNumber(s.houseNumber, parsed.houseNumber)) score += 120;
  if (s.precision === 'house') score += 10;
  if (s.precision === 'area') score -= 40;
  if (s.source === 'local') score -= 10;

  // 3) Phường / quận khách đã gõ (so khớp có tính tên cũ ↔ mới)
  const h = parsed.hints;
  const candWard = s.ward ? canonicalWardKey(s.ward, s.district).key : '';
  const candDistrict = s.district || '';
  // Địa danh tách từ chuỗi không dấu phẩy ("101 le loi go vap") có thể là một phần tên đường nên chỉ trừ điểm nhẹ (soft)
  const miss = h.soft ? 0.35 : 1;
  if (h.wards.length) {
    const keys = h.wards.map((w) => canonicalWardKey(w.ward, w.district).key);
    if (candWard && keys.includes(candWard)) score += 150;
    else if (candDistrict && h.wards.some((w) => w.district === candDistrict)) score += 25;
    else if (candWard || candDistrict) score -= Math.round(300 * miss);
  }
  if (h.districts.length) {
    if (candDistrict && h.districts.includes(candDistrict)) score += 80;
    else if (candDistrict && !h.wards.length) score -= Math.round(250 * miss);
  }
  if (h.unknown.length && (s.ward || s.district)) {
    // Phường/quận khách gõ mà dữ liệu nội bộ không biết ("Chợ Quán", "Thủ Dầu Một"): so thẳng với phường của kết quả.
    // Trùng thì cộng điểm; không trùng thì trừ vừa phải (cùng mức cho mọi kết quả nên không đổi thứ tự khi đó là chữ lạ)
    const wk = s.ward ? canonicalWardKey(s.ward, s.district).key : '';
    const dk = s.district ? adminKey(s.district) : '';
    if (h.unknown.includes(wk) || h.unknown.includes(dk)) score += 120;
    else score -= Math.round(100 * miss);
  }
  for (const amb of h.ambiguous) {
    const okWard = !!candWard && amb.wards.some((w) => canonicalWardKey(w.ward, w.district).key === candWard);
    const okDistrict = !!candDistrict && amb.districts.includes(candDistrict);
    // Khách gõ tên khu vực ("Gò Vấp") thì kết quả đúng khu đó phải đứng trên kết quả đúng số nhà nhưng ở nơi khác
    if (okWard || okDistrict) score += 150;
    else if (candWard || candDistrict) score -= Math.round(150 * miss);
  }

  // 4) Ô chọn phường/quận: chỉ cộng nhẹ, chỉ khi chữ gõ không có địa danh
  const hasTypedAdmin = h.wards.length || h.districts.length || h.ambiguous.length;
  if (!hasTypedAdmin && ctx.context) {
    if (ctx.context.ward && candWard && candWard === canonicalWardKey(ctx.context.ward, ctx.context.district).key) score += 40;
    else if (ctx.context.district && candDistrict === ctx.context.district) score += 20;
  }

  // 5) Gần vị trí bias
  if (ctx.bias && typeof s.lat === 'number' && typeof s.lng === 'number') {
    const d = distanceMeters(ctx.bias, { lat: s.lat, lng: s.lng });
    score += d < 2000 ? 40 : d < 8000 ? 20 : d < 25000 ? 8 : 0;
  }
  return score;
}

/** Xếp hạng lại (không đổi thứ tự khi bằng điểm, không sửa mảng đầu vào). */
export function rankSuggestions(list: AddressSuggestion[], parsed: ParsedAddressInput, ctx: RankContext = {}): AddressSuggestion[] {
  return list
    .map((s, i) => ({ s, i, score: scoreOne(s, parsed, ctx) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ s, score }) => ({ ...s, score }));
}

/**
 * Bước cuối cho server: gộp trùng → xếp hạng → thêm gợi ý "vị trí gần đúng" nếu khách gõ phường/quận mà chưa
 * có kết quả nào đúng khu đó → cắt còn tối đa MAX_SUGGESTIONS.
 */
export function finalizeSuggestions(
  candidates: AddressSuggestion[],
  parsed: ParsedAddressInput,
  ctx: RankContext = {},
  limit = MAX_SUGGESTIONS
): AddressSuggestion[] {
  let ranked = rankSuggestions(dedupeSuggestions(candidates), parsed, ctx);
  const h = parsed.hints;
  const hasTypedArea = h.wards.length || h.districts.length || h.ambiguous.length;
  // Đã có kết quả đúng đường (và đúng khu khách gõ) thì bỏ các kết quả khác đường / khác khu: chỉ là nhiễu của
  // tìm kiếm mờ ("Lê Hoàng Phái" khi gõ "Lê Lợi", Vũng Tàu khi gõ "Hạnh Thông"). Chưa có kết quả tốt nào thì giữ nguyên
  // tất cả, vì khách có thể gõ nhầm tên đường hay phường.
  if (hasGoodResult(ranked, parsed)) ranked = ranked.filter((s) => isGoodResult(s, parsed));
  if (!(parsed.hints.wards.length || parsed.hints.districts.length || parsed.hints.ambiguous.length)) {
    ranked = diversifyWithoutArea(ranked, { preferCore: !ctx.bias, isExact: (s) => streetRelation(s, parsed).points === 100 });
  }
  if (hasTypedArea) {
    // Đã có kết quả đúng đường VÀ đúng khu khách gõ thì không cần gợi ý "vị trí gần đúng"
    const fallback = !hasGoodResult(ranked, parsed) ? buildAreaFallback(parsed) : null;
    const inZone = !fallback || !ctx.zone || ctx.zone.contains(fallback.lat as number, fallback.lng as number);
    if (fallback && inZone && !ranked.some((s) => s.place_id === fallback.place_id)) {
      const withFallback = rankSuggestions([...ranked, fallback], parsed, ctx);
      return markNameMatch(withFallback.slice(0, limit), parsed);
    }
  }
  return markNameMatch(ranked.slice(0, limit), parsed);
}

/**
 * Gắn nhãn "tên gần giống" cho kết quả mà tên đường không đúng chữ khách gõ, CHỈ khi trong danh sách đã có đường đúng tên
 * (lúc khách mới gõ dở "Lê L" thì chưa có tên đúng nên không gắn, tránh nhãn sai trên mọi dòng).
 */
function markNameMatch(list: AddressSuggestion[], parsed: ParsedAddressInput): AddressSuggestion[] {
  if (!parsed.streetKey) return list;
  const exact = list.map((s) => streetRelation(s, parsed).points === 100);
  if (!exact.some(Boolean)) return list;
  return list.map((s, i) => ({ ...s, nameMatch: exact[i] ? 'exact' : 'similar' }));
}
