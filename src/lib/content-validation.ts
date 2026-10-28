import path from 'path';
import { getUploadRoot } from '@/lib/uploadStorage';

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
