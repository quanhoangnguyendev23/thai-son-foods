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
