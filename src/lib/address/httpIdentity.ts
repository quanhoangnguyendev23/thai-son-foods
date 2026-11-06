/**
 * Danh tính app khi gọi dịch vụ bản đồ công cộng (Photon, Nominatim, Overpass): điều khoản của họ yêu cầu
 * User-Agent định danh, có cách liên hệ. Giá trị lấy từ biến môi trường, không viết cứng trong code:
 *   GEO_APP_NAME       tên web, mặc định "ThaiSonFoods"
 *   GEO_SITE_URL       địa chỉ web (gửi làm Referer), mặc định NEXT_PUBLIC_APP_URL
 *   GEO_CONTACT_EMAIL  email liên hệ của shop (bắt buộc khi chạy thật; thiếu thì cảnh báo một lần)
 */
let warned = false;

export function geoUserAgent(): string {
  const app = (process.env.GEO_APP_NAME || 'ThaiSonFoods').trim();
  const site = (process.env.GEO_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  const contact = (process.env.GEO_CONTACT_EMAIL || '').trim();
  if (!contact && process.env.NODE_ENV === 'production' && !warned) {
    warned = true;
    console.warn('[Geo] Thiếu GEO_CONTACT_EMAIL: dịch vụ bản đồ công cộng yêu cầu User-Agent có email liên hệ.');
  }
  const parts = [site ? `+${site}` : '', contact].filter(Boolean).join('; ');
  return parts ? `${app}/1.0 (${parts})` : `${app}/1.0`;
}

export function geoHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': geoUserAgent(), ...extra };
  const referer = (process.env.GEO_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (referer) headers.Referer = referer;
  return headers;
}
