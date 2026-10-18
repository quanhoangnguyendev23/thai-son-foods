'use client';

import { ShoppingCart } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

interface MobileBuyBarProps {
  visible: boolean;
  price: number;
  packLabel: string;
  canAdd: boolean;
  isOutOfStock: boolean;
  onAddToCart: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onBuyNow: () => void;
  onChangeBranch: () => void;
  language?: string;
}

/**
 * Thanh hành động cố định cạnh dưới màn hình (chỉ < lg).
 * Chỉ hiện khi khối nút của Buy Box đã cuộn khỏi màn hình để không lặp lại nút bấm.
 */
export default function MobileBuyBar({
  visible,
  price,
  packLabel,
  canAdd,
  isOutOfStock,
  onAddToCart,
  onBuyNow,
  onChangeBranch,
  language = 'vi',
}: MobileBuyBarProps) {
  const isEn = language === 'en';

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_rgba(34,84,76,0.06)] transition-transform duration-200',
        visible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-lg text-ink-950 leading-tight">{formatPrice(price)}đ</div>
          <div className="text-[11px] text-gray-600 truncate">{packLabel}</div>
        </div>
        {isOutOfStock ? (
          <button
            type="button"
            tabIndex={visible ? 0 : -1}
            onClick={onChangeBranch}
            className="h-11 px-4 rounded-full border border-gray-300 text-sm font-medium text-ink-950 cursor-pointer"
          >
            {isEn ? 'Other branch' : 'Chọn chi nhánh khác'}
          </button>
        ) : (
          <>
            <button
              type="button"
              tabIndex={visible ? 0 : -1}
              onClick={onAddToCart}
              disabled={!canAdd}
              aria-label={isEn ? 'Add to cart' : 'Thêm vào giỏ hàng'}
              className="h-11 w-11 shrink-0 rounded-full bg-corn border border-corn-dark/60 text-ink-950 inline-flex items-center justify-center cursor-pointer disabled:bg-gray-200 disabled:border-gray-300 disabled:text-gray-500"
            >
              <ShoppingCart className="w-5 h-5" aria-hidden />
            </button>
            <button
              type="button"
              tabIndex={visible ? 0 : -1}
              onClick={onBuyNow}
              disabled={!canAdd}
              className="h-11 px-5 rounded-full bg-leaf-900 hover:bg-leaf-900 text-white text-base cursor-pointer disabled:bg-gray-200 disabled:text-gray-500"
            >
              {isEn ? 'Buy now' : 'Mua ngay'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
