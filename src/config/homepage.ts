/**
 * Cấu hình giao diện trang chủ (/)
 * Cờ tính năng (Feature Flag) — theo cùng quy ước với PRODUCT_DETAIL_CONFIG / MEMBERSHIP_CONFIG.
 *
 * ROLLBACK 1 DÒNG: đổi DEFAULT_USE_AMAZON_HOMEPAGE thành false (hoặc đặt biến môi trường
 * NEXT_PUBLIC_USE_AMAZON_HOMEPAGE=false rồi build lại) → trang chủ cũ (HomePageLegacy)
 * cùng Header/Footer gốc hiển thị lại y như trước. Xem ROLLBACK.md.
 */

// true = trang chủ mới theo bố cục Amazon (HomePage + HeaderAmazon + FooterAmazon)
// false = trang chủ cũ (HomePageLegacy + Header + Footer gốc)
const DEFAULT_USE_AMAZON_HOMEPAGE = true;

function readFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

export const HOMEPAGE_CONFIG = {
  // Biến môi trường (nếu có) được ưu tiên hơn giá trị mặc định trong file.
  USE_AMAZON_HOMEPAGE: readFlag(process.env.NEXT_PUBLIC_USE_AMAZON_HOMEPAGE, DEFAULT_USE_AMAZON_HOMEPAGE),
} as const;

/**
 * NỘI DUNG PHẦN ĐẦU TRANG CHỦ (hero + 2 ô khuyến mãi) — Marketing/Design sửa ở đây, không cần đụng bố cục.
 *
 * Thứ tự ưu tiên chữ trên banner hero:
 *  1. Banner admin (bảng `banners`, placement = 'hero') có điền "Mô tả / Phụ đề" → dùng Tiêu đề + Phụ đề của banner đó,
 *     "Nhãn / Tag" (nếu có) làm chữ trên nút.
 *  2. Banner trong mã nguồn (src/data/banners.ts, homepage-placeholders.ts) có khai báo `title` → dùng chữ của banner
 *     (title rỗng '' = ảnh đã có chữ sẵn, chỉ hiện nút CTA).
 *  3. Còn lại → DEFAULT_COPY bên dưới.
 * Tiêu đề nên ≤ 6 từ, dòng phụ 1 dòng (≤ 60 ký tự) để không bị cắt trên điện thoại.
 */
export const HOMEPAGE_HERO = {
  /** Thời gian tự chuyển slide (ms), tối thiểu 5000. Tự tắt khi người dùng bật "giảm chuyển động". */
  AUTOPLAY_MS: 6000,
  DEFAULT_COPY: {
    title: 'Thức uống tự nhiên mỗi ngày',
    titleEn: 'Natural drinks, every day',
    subtitle: 'Sữa hạt, nước giải khát và trà sữa Thái Sơn',
    subtitleEn: 'Thai Son nut milks, soft drinks and milk teas',
    ctaLabel: 'Mua ngay',
    ctaLabelEn: 'Shop now',
    /** Dùng khi banner không có đường dẫn riêng */
    ctaHref: '/#san-pham',
  },
} as const;
