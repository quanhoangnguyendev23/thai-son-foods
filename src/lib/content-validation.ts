import path from 'path';
import { getUploadRoot } from '@/lib/uploadStorage';
import type { ProductDetailContent } from '@/data/product-detail-content';

/**
 * Kiểm tra URL do admin nhập cho nội dung hiển thị công khai (banner, slide thương hiệu, ...).
 * Chỉ cho phép đường dẫn nội bộ ("/..."), http(s) — chặn javascript:, data:, vbscript:, "//host"...
 */
const SAFE_URL_RE = /^(\/(?!\/)|https?:\/\/)\S*$/i;

export function isSafeUrl(value: unknown, maxLength = 1000): boolean {
  // Chặn "../" (kể cả dạng mã hóa %2e%2e) và ký tự "\" trong URL
  if (typeof value === 'string' && (/(^|\/)(\.\.|%2e%2e)(\/|$)/i.test(value) || value.includes('\\'))) return false;
  return typeof value === 'string' && value.length <= maxLength && SAFE_URL_RE.test(value.trim());
}

/** undefined/null/'' → hợp lệ (không nhập); ngược lại phải là URL an toàn */
export function isOptionalSafeUrl(value: unknown, maxLength = 1000): boolean {
  if (value === undefined || value === null || value === '') return true;
  return isSafeUrl(value, maxLength);
}

const DETAIL_TEXT_LIMITS: Record<string, number> = {
  ingredients: 2000,
  usage: 1000,
  storage: 500,
  expiry: 500,
  manufacturer: 300,
  origin: 200,
  certification: 200,
  packagingMaterial: 300,
};

/** Chuỗi admin nhập: bỏ thẻ HTML, cắt khoảng trắng, giới hạn độ dài; không phải chuỗi / rỗng → '' */
function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').trim().slice(0, max);
}

/**
 * Làm sạch nội dung "Thông tin sản phẩm" admin gửi lên (cột products.detail_content, cấu trúc ProductDetailContent).
 * Chỉ giữ các trường đã biết; bỏ trường trống; null/undefined hoặc không còn gì → value: null (trang dùng nội dung trong code).
 */
export function sanitizeProductDetailContent(input: unknown): { value: ProductDetailContent | null } | { error: string } {
  if (input === null || input === undefined) return { value: null };
  if (typeof input !== 'object' || Array.isArray(input)) return { error: 'Thông tin chi tiết sản phẩm không hợp lệ.' };
  const src = input as Record<string, unknown>;
  const out: ProductDetailContent = {};

  for (const [key, max] of Object.entries(DETAIL_TEXT_LIMITS)) {
    const v = cleanText(src[key], max);
    if (v) (out as Record<string, unknown>)[key] = v;
  }

  if (src.labelImage !== undefined && src.labelImage !== null && src.labelImage !== '') {
    if (!isSafeUrl(src.labelImage)) return { error: 'Đường dẫn ảnh nhãn không hợp lệ.' };
    out.labelImage = String(src.labelImage).trim();
  }

  if (Array.isArray(src.highlights)) {
    const highlights = src.highlights
      .filter((h): h is Record<string, unknown> => Boolean(h) && typeof h === 'object')
      .map((h) => ({
        labelVi: cleanText(h.labelVi, 80),
        contentVi: cleanText(h.contentVi, 300),
        labelEn: cleanText(h.labelEn, 80),
        contentEn: cleanText(h.contentEn, 300),
      }))
      .filter((h) => h.labelVi || h.contentVi)
      .slice(0, 6);
    if (highlights.length > 0) out.highlights = highlights;
  }

  if (src.nutrition && typeof src.nutrition === 'object' && !Array.isArray(src.nutrition)) {
    const n = src.nutrition as Record<string, unknown>;
    const rows = (Array.isArray(n.rows) ? n.rows : [])
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => ({ label: cleanText(r.label, 80), value: cleanText(r.value, 40) }))
      .filter((r) => r.label && r.value)
      .slice(0, 20);
    if (rows.length > 0) out.nutrition = { basis: cleanText(n.basis, 200), rows, source: cleanText(n.source, 300) };
  }

  return { value: Object.keys(out).length > 0 ? out : null };
}

/**
 * Đổi URL dạng "/uploads/..." thành đường dẫn tuyệt đối trên đĩa — CHỈ khi nằm trong thư mục public/uploads.
 * Trả về null với mọi đường dẫn thoát ra ngoài (../, %2e%2e, đường dẫn tuyệt đối...) để không bao giờ
 * xóa nhầm file hệ thống / mã nguồn khi gỡ banner, slide hoặc ảnh sản phẩm.
 */
export function resolveUploadedFile(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.split(/[\/]/).includes('..')) return null;
  // Thư mục upload: UPLOAD_DIR nếu có, mặc định public/uploads (src/lib/uploadStorage.ts)
  const root = path.resolve(getUploadRoot());
  const abs = path.resolve(root, decoded.replace(/^\/uploads\/+/, ''));
  return abs.startsWith(root + path.sep) ? abs : null;
}
