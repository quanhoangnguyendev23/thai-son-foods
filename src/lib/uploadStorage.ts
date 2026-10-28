import path from 'path';

/**
 * Thư mục lưu file admin tải lên (chỉ dùng phía server, Node runtime).
 *
 * - UPLOAD_DIR (đường dẫn tuyệt đối hoặc tương đối so với thư mục chạy app): đặt ở máy chủ thật,
 *   trỏ ra NGOÀI thư mục build để không mất ảnh khi build lại / deploy bản mới, và đưa vào lịch backup.
 * - Bỏ trống: public/uploads như trước (máy phát triển).
 *
 * URL công khai của file luôn là /uploads/<thư mục>/<tên file>, không phụ thuộc nơi lưu.
 * `next start` chỉ phục vụ file có trong public/ lúc build, nên file tải lên sau đó được phục vụ qua
 * route /api/uploads/[...path] (rewrite fallback trong next.config.ts).
 */
export function getUploadRoot(): string {
  const configured = (process.env.UPLOAD_DIR || '').trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), 'public', 'uploads');
}

/**
 * Đổi phần đường dẫn sau "/uploads/" thành đường dẫn tuyệt đối trong thư mục upload.
 * Trả về null nếu thoát ra ngoài thư mục (../, ký tự NUL, đường dẫn tuyệt đối).
 */
export function resolveInsideUploadRoot(relative: string): string | null {
  if (!relative || relative.includes('\0')) return null;
  const parts = relative.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0 || parts.some((p) => p === '..' || p === '.')) return null;
  const root = path.resolve(getUploadRoot());
  const abs = path.resolve(root, ...parts);
  return abs.startsWith(root + path.sep) ? abs : null;
}
