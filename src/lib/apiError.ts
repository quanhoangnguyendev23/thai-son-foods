/**
 * Thông báo lỗi trả về client cho các lỗi 500 (lỗi hệ thống không lường trước).
 * Production: không trả error.message thô (có thể chứa câu SQL, tên bảng, ràng buộc CSDL) — chỉ trả câu chung;
 * chi tiết vẫn nằm trong log máy chủ (console.error ở từng route).
 * Môi trường phát triển: trả error.message để dễ gỡ lỗi.
 */
export function publicErrorMessage(error: unknown, fallback = 'Lỗi hệ thống, vui lòng thử lại sau.'): string {
  if (process.env.NODE_ENV !== 'production') {
    const message = (error as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
