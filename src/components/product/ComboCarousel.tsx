'use client';

import DiscountTag from '@/components/product/DiscountTag';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { Combo } from '@/types';
import { cn, formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';

/** Combo phải chọn vị trên trang combo trước khi mua (giống ProductCombosSidebar) */
const CUSTOMIZABLE_COMBO_IDS = new Set(['combo-4-chai', 'combo-van-phong', 'combo-uu-dai', 'combo-5-old', 'combo-sieu-hoi', 'combo-6-old']);

function ComboCard({ combo, plain = false }: { combo: Combo; plain?: boolean }) {
  const cardRef = useRef<HTMLElement>(null);
  const { flyToCart } = useFlyToCart();
  const [added, setAdded] = useState(false);
  const isCustomizable = CUSTOMIZABLE_COMBO_IDS.has(combo.id);
  const href = `/combo/${combo.slug}`;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const imgEl = cardRef.current?.querySelector('img') as HTMLElement | null;
    flyToCart({ startElement: imgEl || (e.currentTarget as HTMLElement), imageSrc: combo.image });
    useCartStore.getState().addItem({
      productId: combo.id,
      name: combo.name,
      slug: combo.slug || '#combo',
      price: combo.salePrice,
      unit: `${combo.totalItems} chai`,
      thumbnail: combo.image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <article ref={cardRef} className="group h-full flex flex-col">
      <Link
        href={href}
        className={
          plain
            ? 'flex flex-col h-full'
            : 'flex flex-col h-full bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs transition-all duration-300 ease-out hover:border-forest-700/30 hover:shadow-[0_14px_28px_-14px_rgba(34,84,76,0.35)] motion-reduce:transition-none'
        }
      >
        {/* Ảnh: cùng khung 4:3 với thẻ sản phẩm */}
        <div className={`relative aspect-[4/3] w-full overflow-hidden bg-ivory${plain ? ' rounded-lg' : ''}`}>
          <Image
            src={combo.image}
            alt={combo.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 34vw, 22vw"
            loading="lazy"
            className="object-cover transition-transform duration-500"
          />
        </div>

        {/* Thông tin: cùng cỡ chữ, cách dòng với thẻ sản phẩm */}
        <div className={`${plain ? 'pt-2' : 'p-2 sm:p-2.5 md:p-3'} flex-1 flex flex-col justify-between`}>
          <h3 title={combo.name} className={`text-base text-text-dark mb-1 leading-snug line-clamp-4 group-hover:text-leaf-900 ${plain ? 'group-hover:underline ' : ''}transition-colors`}>
            {combo.name}
          </h3>
          {/* Nhãn Bán chạy nằm dưới tên (kiểu Amazon), không đè lên ảnh */}
          {combo.isBestSeller && (
            <div className="flex flex-wrap gap-1 mb-1">
              <span className="px-1.5 py-0.5 text-2xs bg-brand-emerald text-white rounded">Bán chạy</span>
            </div>
          )}

          <div className={`relative flex items-center justify-between gap-1 mt-auto pt-1.5 sm:pt-2${plain ? '' : ' border-t border-gray-100'}`}>
            <div className="flex flex-col min-w-0">
              <div className="text-base sm:text-base text-leaf-900 flex flex-wrap items-baseline gap-x-0.5">
                <span>{formatPrice(combo.salePrice)}đ</span>
                <span className="text-2xs lg:text-2xs text-text-muted">/combo {combo.totalItems} chai</span>
              </div>
              {/* Giá gốc + nhãn giảm giá nằm dưới giá bán (không đè lên ảnh) */}
              {combo.originalPrice > combo.salePrice && (
                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  <span className="text-2xs lg:text-2xs text-text-muted line-through">{formatPrice(combo.originalPrice)}đ</span>
                  <DiscountTag source={combo} />
                </div>
              )}
            </div>

            {isCustomizable ? (
              <span
                className="relative shrink-0 w-9 h-9 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center bg-brand-emerald text-white rounded-lg group-hover:bg-brand-forest transition-colors shadow-xs"
                title="Chọn vị trong combo"
                aria-hidden
              >
                <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </span>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                className="relative shrink-0 w-9 h-9 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center bg-brand-emerald text-white rounded-lg hover:bg-brand-forest transition-colors active:scale-95 cursor-pointer shadow-xs"
                aria-label={`Thêm ${combo.name} vào giỏ hàng`}
                title={added ? 'Đã thêm vào giỏ' : 'Thêm combo vào giỏ'}
              >
                <ShoppingBag className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

interface ComboCarouselProps {
  title: string;
  combos: Combo[];
  subtitle?: string;
  className?: string;
  /** Thẻ không khung kiểu Amazon (trang chi tiết sản phẩm & combo), giống ProductCarousel plain */
  plain?: boolean;
}

/**
 * Hàng combo cuộn ngang — cùng khung, tiêu đề, kích thước thẻ và nút mũi tên với ProductCarousel (bản wide),
 * để khu combo đồng bộ với các hàng sản phẩm khác trên trang chi tiết.
 */
export default function ComboCarousel({ title, combos, subtitle, className, plain = false }: ComboCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const mobileInitialCount = 4;

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
  }, [updateArrows, combos.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  if (combos.length === 0) return null;
  return (
    <section className={cn('max-w-[1800px] mx-auto px-4 sm:px-6 py-6 md:py-8', className)}>
      <div className="mb-3">
        <h2 className="text-xl md:text-2xl text-ink-950">{title}</h2>
        {subtitle && <p className="text-xs md:text-sm text-gray-600 mt-0.5">{subtitle}</p>}
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          className="grid grid-cols-2 sm:flex gap-3 md:gap-4 sm:overflow-x-auto sm:snap-x sm:snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {combos.map((combo, idx) => (
            <div
              key={combo.id}
              className={cn(
                'min-w-0 snap-start sm:shrink-0 sm:w-[31%] md:w-[23.5%] lg:w-[18.8%] xl:w-[15.6%] 2xl:w-[13.3%]',
                !expanded && idx >= mobileInitialCount && 'max-sm:hidden'
              )}
            >
              <ComboCard combo={combo} plain={plain} />
            </div>
          ))}
        </div>

        {combos.length > mobileInitialCount && (
          <div className="sm:hidden pt-3 text-center">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-300 bg-white text-sm text-ink-950 hover:bg-gray-50 cursor-pointer"
            >
              {expanded ? 'Thu gọn' : `Xem thêm ${combos.length - mobileInitialCount} combo`}
            </button>
          </div>
        )}

        {canPrev && (
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            aria-label="Xem combo trước"
            className="hidden md:flex absolute left-0 top-[30%] -translate-x-1/2 z-10 w-10 h-16 rounded-md bg-white border border-gray-300 shadow-md items-center justify-center text-gray-800 hover:bg-gray-50 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {canNext && (
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            aria-label="Xem combo tiếp theo"
            className="hidden md:flex absolute right-0 top-[30%] translate-x-1/2 z-10 w-10 h-16 rounded-md bg-white border border-gray-300 shadow-md items-center justify-center text-gray-800 hover:bg-gray-50 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </section>
  );
}
