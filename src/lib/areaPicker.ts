/**
 * Danh sách "Bạn đang ở khu vực nào?" cho popup chọn chi nhánh.
 * Dùng khi khách không bật định vị: chọn Quận/Huyện (+ Phường/Xã) nơi mình ở,
 * hệ thống lấy tọa độ khu vực đó để xếp chi nhánh gần nhất lên đầu.
 */
import { VIETNAM_ADDRESSES, type ProvinceItem, type WardItem } from '@/data/vietnam-addresses';
import { sortDistrictsByName } from '@/lib/sortDistricts';

export interface AreaDistrict {
  key: string; // "<tỉnh>|<quận>"
  name: string; // tên hiển thị
  province: string;
  lat: number;
  lng: number;
  wards: WardItem[];
}

export interface AreaProvinceGroup {
  province: string;
  districts: AreaDistrict[];
}

const strip = (s: string, re: RegExp) => s.toLowerCase().replace(re, '').trim();
const PROVINCE_PREFIX = /^(tỉnh|tp\.?|thành phố)\s*/i;

/** Khớp tên tỉnh của chi nhánh ("Hồ Chí Minh") với dữ liệu địa chỉ ("TP. Hồ Chí Minh"). */
export function findAddressProvince(name?: string | null): ProvinceItem | undefined {
  if (!name) return undefined;
  const n = strip(name, PROVINCE_PREFIX);
  return VIETNAM_ADDRESSES.find((p) => strip(p.name, PROVINCE_PREFIX) === n);
}

function buildGroup(p: ProvinceItem): AreaProvinceGroup {
  const districts: AreaDistrict[] = p.districts.map((d) => ({
    key: `${p.name}|${d.name}`,
    name: d.name,
    province: p.name,
    lat: d.lat,
    lng: d.lng,
    wards: sortDistrictsByName(d.wards),
  }));

  return { province: p.name, districts: sortDistrictsByName(districts) };
}

/** Các nhóm Tỉnh -> Quận/Huyện. Có tỉnh thì chỉ trả về tỉnh đó, không thì trả về tất cả. */
export function getAreaGroups(provinceName?: string | null): AreaProvinceGroup[] {
  if (provinceName && provinceName !== 'ALL') {
    const p = findAddressProvince(provinceName);
    return p ? [buildGroup(p)] : [];
  }
  return VIETNAM_ADDRESSES.map(buildGroup);
}

/** Tọa độ của khu vực khách chọn (ưu tiên phường nếu có tọa độ). */
export function getAreaCoords(district: AreaDistrict, wardName?: string | null): { lat: number; lng: number } {
  if (wardName) {
    const w = district.wards.find((x) => x.name === wardName);
    if (w?.lat && w?.lng) return { lat: w.lat, lng: w.lng };
  }
  return { lat: district.lat, lng: district.lng };
}
