'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '@/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import ProductCard from '@/components/product/ProductCard';

interface ProductCarouselProps {
  title: string;
  products: Product[];
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  /** Mobile (< sm): xếp lưới 2 cột theo chiều dọc thay vì trượt ngang; có nút Xem thêm */
  mobileGrid?: boolean;
  /** Số sản phẩm hiện ban đầu ở chế độ mobileGrid (mặc định 4) */
  mobileInitialCount?: number;
}

/**
 * Dải sản phẩm cuộn ngang: nút trái/phải trên desktop, vuốt + scroll-snap trên cảm ứng.
 * Tái sử dụng ProductCard để thẻ đồng bộ với trang chủ (ảnh, tên, giá, nút thêm giỏ).
 */
export default function ProductCarousel({
  title,
  products,
  subtitle,
  action,
  className,
  mobileGrid = false,
  mobileInitialCount = 4,
}: ProductCarouselProps) {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, products.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  if (products.length === 0) return null;
  return (
    <section className={cn('max-w-[1456px] mx-auto px-4 sm:px-6 py-6 md:py-8', className)}>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl text-ink-950">{title}</h2>
          {subtitle && <p className="text-xs md:text-sm text-gray-600 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>

      <div className="relative group/carousel">
        <div
          ref={trackRef}
          className={cn(
            'gap-3 md:gap-4 sm:overflow-x-auto sm:snap-x sm:snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            mobileGrid ? 'grid grid-cols-2 sm:flex' : 'flex overflow-x-auto snap-x snap-mandatory'
          )}
        >
          {products.map((p, idx) => (
            <div
              key={p.id}
              className={cn(
                'snap-start sm:shrink-0 sm:w-[31%] md:w-[23.5%] lg:w-[18.8%] xl:w-[15.6%]',
                mobileGrid ? 'min-w-0' : 'shrink-0 w-[46%]',
                mobileGrid && !expanded && idx >= mobileInitialCount && 'max-sm:hidden'
              )}
            >
              {/* Bố cục compact + tên giới hạn 2 dòng để các thẻ đồng bộ chiều cao */}
              <ProductCard product={p} layout="compact" isHomepage />
            </div>
          ))}
        </div>

        {mobileGrid && products.length > mobileInitialCount && (
          <div className="sm:hidden pt-3 text-center">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-300 bg-white text-sm text-ink-950 hover:bg-gray-50 cursor-pointer"
            >
              {expanded
                ? language === 'en' ? 'Show less' : 'Thu gọn'
                : language === 'en'
                  ? `Show ${products.length - mobileInitialCount} more`
                  : `Xem thêm ${products.length - mobileInitialCount} sản phẩm`}
            </button>
          </div>
        )}

        {canPrev && (
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            aria-label="Xem sản phẩm trước"
            className="hidden md:flex absolute left-0 top-[30%] -translate-x-1/2 z-10 w-10 h-16 rounded-md bg-white border border-gray-300 shadow-md items-center justify-center text-gray-800 hover:bg-gray-50 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {canNext && (
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            aria-label="Xem sản phẩm tiếp theo"
            className="hidden md:flex absolute right-0 top-[30%] translate-x-1/2 z-10 w-10 h-16 rounded-md bg-white border border-gray-300 shadow-md items-center justify-center text-gray-800 hover:bg-gray-50 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </section>
  );
}
