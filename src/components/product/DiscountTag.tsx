import { discountLabel } from '@/lib/discount-label';
import { cn } from '@/lib/utils';

interface DiscountTagProps {
  /** Combo hoặc sản phẩm: dùng discount (nếu có), originalPrice, salePrice */
  source: { discount?: number | null; originalPrice?: number | null; salePrice?: number | null };
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Nhãn giảm giá đặt ở khu giá (cạnh hoặc dưới giá), không đè lên ảnh — kiểu "Save 7%" của Amazon.
 * Nội dung theo quy tắc chung trong lib/discount-label: >= 10% hiện "-15%", thấp hơn hiện "-21.600đ".
 * Dùng chung cho mọi thẻ combo/sản phẩm và trang chi tiết để đồng bộ giao diện.
 */
export default function DiscountTag({ source, size = 'sm', className }: DiscountTagProps) {
  const label = discountLabel(source);
  if (!label) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center shrink-0 rounded bg-sale text-white leading-none whitespace-nowrap',
        size === 'md' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-2xs',
        className
      )}
    >
      {label}
    </span>
  );
}
