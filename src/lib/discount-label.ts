import { formatPrice } from '@/lib/utils';

/**
 * Nhãn giảm giá hiển thị cho khách (sản phẩm và combo).
 * Phần trăm giảm >= DISCOUNT_PERCENT_THRESHOLD → hiện phần trăm ("Tiết kiệm 15%");
 * thấp hơn → hiện số tiền giảm ("Tiết kiệm 21.600đ") cho hấp dẫn hơn; không giảm → không hiện.
 * Đổi ngưỡng tại đây. Trang admin vẫn hiện % thật (không dùng file này).
 */
export const DISCOUNT_PERCENT_THRESHOLD = 10;

interface DiscountSource {
  /** % giảm đã lưu (combos.discount); thiếu thì tự tính từ giá gốc / giá bán */
  discount?: number | null;
  originalPrice?: number | null;
  salePrice?: number | null;
}

function percentOf(src: DiscountSource): number {
  const saved = Number(src.discount) || 0;
  if (saved > 0) return saved;
  const original = Number(src.originalPrice) || 0;
  const sale = Number(src.salePrice) || 0;
  return original > sale && original > 0 ? Math.round(((original - sale) / original) * 100) : 0;
}

function amountOf(src: DiscountSource): number {
  const original = Number(src.originalPrice) || 0;
  const sale = Number(src.salePrice) || 0;
  return original > sale ? original - sale : 0;
}

/** "Tiết kiệm 15%" hoặc "Tiết kiệm 21.600đ" (EN: "Save 15%"); không có giảm giá → null.
 *  13/11: đổi từ "-15%" sang chữ "Tiết kiệm" theo yêu cầu (áp dụng mọi nhãn giảm giá phía khách). */
export function discountLabel(src: DiscountSource, language: 'vi' | 'en' = 'vi'): string | null {
  const pct = percentOf(src);
  const amount = amountOf(src);
  if (pct <= 0 && amount <= 0) return null;
  const prefix = language === 'en' ? 'Save' : 'Tiết kiệm';
  if (pct >= DISCOUNT_PERCENT_THRESHOLD || amount <= 0) return `${prefix} ${pct}%`;
  return `${prefix} ${formatPrice(amount)}đ`;
}

/** Phần " (-15%)" sau dòng "Tiết kiệm X đ": chỉ khi % đạt ngưỡng, còn lại rỗng */
export function discountPercentSuffix(src: DiscountSource): string {
  const pct = percentOf(src);
  return pct >= DISCOUNT_PERCENT_THRESHOLD ? ` (-${pct}%)` : '';
}
