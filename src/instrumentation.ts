/**
 * Chạy một lần khi server Next.js khởi động (Node runtime).
 * Kiểm tra cấu hình bắt buộc ở production (JWT_SECRET mạnh, CRON_SECRET, ...) và ghi log lỗi rõ ràng
 * ngay từ lúc khởi động, thay vì để lộ ra muộn khi có người dùng đăng nhập.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // DBG-01: nhiều lớp bảo vệ (mã OTP thử, trả stack lỗi, debugOtp, cookie Secure...) chỉ tắt khi NODE_ENV=production.
  // `next start` tự đặt NODE_ENV=production; `next dev` thì không. Cảnh báo to khi khởi động ở chế độ khác.
  // Máy chủ thật nên đặt APP_ENV=production: khi đó chạy sai chế độ sẽ dừng hẳn thay vì chỉ cảnh báo.
  if (process.env.NODE_ENV !== 'production') {
    const message =
      `[DBG-01] Máy chủ đang chạy với NODE_ENV=${process.env.NODE_ENV || '(chưa đặt)'}, KHÔNG phải production. ` +
      'Chế độ này chỉ dùng để phát triển: lỗi trả chi tiết, OTP thử còn bật. ' +
      'Trên máy chủ thật hãy chạy `npm run build` rồi `npm run start:prod` (xem HUONG_DAN_TRIEN_KHAI.md).';
    if (process.env.APP_ENV === 'production') {
      console.error(message);
      throw new Error(message);
    }
    console.warn(message);
  }

  const { validateProductionEnvironment } = await import('@/lib/auth');
  validateProductionEnvironment();
}
