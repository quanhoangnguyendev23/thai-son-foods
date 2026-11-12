/**
 * XSS-01: chuỗi JSON an toàn để nhúng vào <script type="application/ld+json">.
 * JSON.stringify không đổi ký tự `<`, nên dữ liệu như `</script><script>...` (tên sản phẩm do admin nhập)
 * có thể đóng thẻ script và chạy mã. Thoát < > & và U+2028/U+2029 thành \uXXXX:
 * JSON vẫn hợp lệ, Google đọc ra đúng ký tự gốc.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
