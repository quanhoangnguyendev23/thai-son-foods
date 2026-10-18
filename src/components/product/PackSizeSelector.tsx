'use client';

import { Product, ProductVariant } from '@/types';
import { cn, formatPrice } from '@/lib/utils';
import { getUnitPrice, getVariantLabel, getVariantOriginalPrice, getBottleVolume } from '@/lib/product-detail';

interface PackSizeSelectorProps {
  product: Product;
  variants: ProductVariant[];
  activeVariantId?: string;
  onSelect: (variantId: string) => void;
  /** Quy cách không đủ tồn tại chi nhánh đang chọn (chỉ khi hệ thống đã xác nhận) */
  unavailableIds?: Set<string>;
  language?: string;
}

/**
 * Bộ chọn quy cách đóng gói kiểu sàn TMĐT: mỗi ô hiển thị tên quy cách, giá, đơn giá/chai.
 * Giá lấy trực tiếp từ bảng giá của từng quy cách.
 */
export default function PackSizeSelector({
  product,
  variants,
  activeVariantId,
  onSelect,
  unavailableIds,
  language = 'vi',
}: PackSizeSelectorProps) {
  if (variants.length === 0) return null;

  const active = variants.find((v) => v.id === activeVariantId) || variants[0];
  const bottleVolume = getBottleVolume(product, active);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-ink-950 mb-2">
        {language === 'en' ? 'Pack size: ' : 'Quy cách: '}
        <strong className="text-[1.125em]">
          {getVariantLabel(active, language)}
          {bottleVolume ? ` × ${bottleVolume}` : ''}
        </strong>
      </legend>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 gap-2" role="radiogroup">
        {variants.map((v) => {
          const isSelected = v.id === active.id;
          const isUnavailable = unavailableIds?.has(v.id) ?? false;
          const originalPrice = getVariantOriginalPrice(product, v);

          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(v.id)}
              className={cn(
                'relative rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer min-h-[72px]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-primary/40',
                isSelected
                  ? 'border-2 border-green-primary bg-green-primary/[0.04]'
                  : 'border border-gray-300 bg-white hover:border-gray-500',
                isUnavailable && !isSelected && 'border-dashed opacity-60'
              )}
            >
              <span className="block text-[15px] text-ink-950 leading-tight">
                {getVariantLabel(v, language)}
              </span>
              <span className="block text-[17px] text-ink-950 mt-1 leading-none">
                {formatPrice(v.price)}đ
              </span>
              <span className="block text-[11px] text-gray-500 mt-1">
                {formatPrice(getUnitPrice(v))}đ/{language === 'en' ? 'bottle' : 'chai'}
              </span>
              {originalPrice && (
                <span className="block text-[11px] text-gray-400 line-through">{formatPrice(originalPrice)}đ</span>
              )}
              {isUnavailable && (
                <span className="block text-[11px] text-red-600 font-medium mt-0.5">
                  {language === 'en' ? 'Not enough stock' : 'Không đủ hàng'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
