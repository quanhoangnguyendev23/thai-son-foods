/**
 * Cấu hình đọc lúc chạy (runtime) từ biến môi trường server — dùng được cả ở middleware (edge) lẫn route handler.
 * Không import thư viện Node. Không có biến NEXT_PUBLIC_ nào ở đây: đổi giá trị chỉ cần khởi động lại, không cần build lại.
 *
 * Biến dùng:
 *  - TRUSTED_PROXY_COUNT: số lớp reverse proxy tin cậy đứng trước app (0 = khách kết nối thẳng vào Next).
 *  - ALLOWED_ORIGINS: danh sách origin được phép gửi POST/PUT/PATCH/DELETE, cách nhau dấu phẩy
 *    (vd: https://thaisonfood.tsf.com.vn,http://137.107.16.94:3000).
 */

type HeaderBag = { get(name: string): string | null };

/** Nhãn dùng chung cho mọi request không xác định được IP đáng tin (vẫn bị rate limit, không bao giờ được bỏ qua). */
export const UNKNOWN_CLIENT_IP = 'unknown';

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:.]+$/i;

function normalizeIp(raw: string): string | null {
  let ip = raw.trim();
  if (!ip) return null;
  // "[::1]:1234" hoặc "1.2.3.4:5678" (một số proxy gửi kèm cổng)
  const bracket = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket) ip = bracket[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  ip = ip.replace(/^::ffff:/i, '');
  if (IPV4.test(ip)) return ip.split('.').every((p) => Number(p) <= 255) ? ip : null;
  if (ip.includes(':') && IPV6.test(ip)) return ip.toLowerCase();
  return null;
}

export function getTrustedProxyCount(): number {
  const n = parseInt(process.env.TRUSTED_PROXY_COUNT || '0', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 0;
}

/**
 * IP khách đáng tin, hoặc null nếu không xác định được.
 *
 * - TRUSTED_PROXY_COUNT = 0 (localhost / LAN kết nối thẳng): luôn null. Next 16 chỉ tự điền X-Forwarded-For bằng IP socket
 *   khi request KHÔNG có sẵn header này; nếu khách tự gửi thì Next giữ nguyên, nên không phân biệt được thật/giả.
 *   Middleware (edge) không đọc được IP socket. => không tin header nào.
 * - TRUSTED_PROXY_COUNT = N > 0: proxy nối IP nó nhìn thấy vào CUỐI X-Forwarded-For; lấy phần tử thứ N tính từ phải.
 *   Phần bên trái do khách tự gửi nên bị bỏ qua. X-Real-IP không được dùng.
 */
export function getClientIp(headers: HeaderBag): string | null {
  const proxies = getTrustedProxyCount();
  if (proxies === 0) return null;
  const list = (headers.get('x-forwarded-for') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length < proxies) return null;
  return normalizeIp(list[list.length - proxies]);
}

let cachedOriginsRaw: string | undefined;
let cachedOrigins: string[] = [];

/** Danh sách origin chuẩn hóa (scheme://host[:port]) từ ALLOWED_ORIGINS; giá trị sai định dạng bị bỏ qua. */
export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || '';
  if (raw === cachedOriginsRaw) return cachedOrigins;
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const v = part.trim();
    if (!v) continue;
    try {
      const u = new URL(v);
      if (u.protocol === 'http:' || u.protocol === 'https:') out.push(u.origin);
      else console.warn(`[runtimeConfig] ALLOWED_ORIGINS bỏ qua giá trị không phải http/https: ${v}`);
    } catch {
      console.warn(`[runtimeConfig] ALLOWED_ORIGINS bỏ qua giá trị không hợp lệ: ${v}`);
    }
  }
  cachedOriginsRaw = raw;
  cachedOrigins = out;
  return out;
}
