/**
 * CỜ TÍNH NĂNG TẬP TRUNG cho các chức năng CHƯA CHỐT với doanh nghiệp.
 * Mặc định TẮT toàn bộ (go-live). Muốn bật lại: đặt biến môi trường tương ứng = "true" rồi build/deploy lại
 * (biến NEXT_PUBLIC_* được nhúng lúc build). Hướng dẫn bật lại từng chức năng: docs/golive/BAT-LAI-CHUC-NANG.md
 *
 * Các cờ có sẵn ở nơi khác (giữ nguyên):
 *  - MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP / ENABLE_SUBSCRIBE_SAVE  → src/config/membership.ts
 *  - SHOW_PLACEHOLDER_BLOCKS (khối "Bản mẫu")                    → src/data/product-detail-placeholders.ts
 */
export const FEATURES = {
  /** Chương trình Đối tác: CTV/Đại lý, mã giới thiệu (?ref=), rút tiền/Payouts, trang /doi-tac, /dang-ky-doi-tac */
  PARTNER_PROGRAM: process.env.NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM === 'true',

  /**
   * Đăng nhập nhanh bằng Google / Facebook. BẬT mặc định; từng nút chỉ hiện khi nhà cung cấp đó đã có khóa
   * (GOOGLE_CLIENT_ID/SECRET, FACEBOOK_CLIENT_ID/SECRET). Tắt hẳn: NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN=false.
   */
  SOCIAL_LOGIN: process.env.NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN !== 'false',
} as const;
