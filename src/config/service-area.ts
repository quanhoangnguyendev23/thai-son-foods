/**
 * Phạm vi phục vụ - GIAI ĐOẠN 1: chỉ giao khu vực TP. Hồ Chí Minh.
 * Sang GIAI ĐOẠN 2 (mở rộng tỉnh/thành khác): đổi HCM_ONLY thành false là xong,
 * không cần sửa dữ liệu cửa hàng trong DB.
 */
export const SERVICE_AREA = {
  HCM_ONLY: true,
  MESSAGE_VI: 'Hiện Thái Sơn Foods chỉ giao hàng trong khu vực TP. Hồ Chí Minh. Các tỉnh/thành khác sẽ được mở ở giai đoạn sau.',
  MESSAGE_EN: 'We currently deliver within Ho Chi Minh City only. Other provinces will be available soon.',
} as const;

/** Điều kiện SQL lọc cửa hàng thuộc TP.HCM (alias bảng stores = s). Cửa hàng chưa nhập tỉnh được xem là TP.HCM. */
export function hcmStoreSql(alias = 's'): string {
  if (!SERVICE_AREA.HCM_ONLY) return 'TRUE';
  return `(${alias}.province IS NULL OR ${alias}.province = '' OR ${alias}.province ILIKE '%Hồ Chí Minh%' OR ${alias}.province ILIKE '%HCM%' OR ${alias}.province ILIKE '%Sài Gòn%')`;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** true nếu tên tỉnh/thành là TP.HCM (hoặc để trống/đặt nhanh). */
export function isHcmProvince(province?: string | null): boolean {
  if (!SERVICE_AREA.HCM_ONLY) return true;
  const n = normalize(province || '');
  if (!n || n === 'dat hang nhanh') return true;
  return /ho chi minh|\bhcm\b|tphcm|tp hcm|sai gon|hochiminh/.test(n);
}
