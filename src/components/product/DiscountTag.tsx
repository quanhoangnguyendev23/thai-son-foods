'use client';

import { discountLabel } from '@/lib/discount-label';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { AttentionStyles, attentionShine } from '@/components/ui/AttentionEffects';

interface DiscountTagProps {
  /** Combo hoặc sản phẩm: dùng discount (nếu có), originalPrice, salePrice */
  source: { discount?: number | null; originalPrice?: number | null; salePrice?: number | null };
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Nhãn giảm giá đặt ở khu giá (cạnh hoặc dưới giá), không đè lên ảnh — kiểu "Save 7%" của Amazon.
 * Nội dung theo quy tắc chung trong lib/discount-label: >= 10% hiện "Tiết kiệm 15%", thấp hơn hiện "Tiết kiệm 21.600đ".
 * Dùng chung cho mọi thẻ combo/sản phẩm và trang chi tiết để đồng bộ giao diện.
 */
export default function DiscountTag({ source, size = 'sm', className }: DiscountTagProps) {
  const { language } = useLanguage();
  const label = discountLabel(source, language === 'en' ? 'en' : 'vi');
  if (!label) return null;
  // 13/11: vệt sáng lướt qua nhãn (hiệu ứng chung), mỗi nhãn lệch thời điểm theo nội dung + giá để không loé cùng lúc
  const shine = attentionShine(`${label}|${source.salePrice ?? ''}|${source.originalPrice ?? ''}`);
  return (
    <>
      <AttentionStyles />
      <span
        className={cn(
          'relative inline-flex items-center shrink-0 rounded bg-sale text-white leading-none whitespace-nowrap',
          size === 'md' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-2xs',
          shine.className,
          className
        )}
        style={shine.style}
      >
        {label}
      </span>
    </>
  );
}
