'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Banner } from '@/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { MISSING_PRODUCT_IMAGE } from '@/lib/product-detail';

interface HeroPromoTilesProps {
  /** Banner admin placement = 'promo' (tối đa 2), hoặc ô mẫu HERO_PROMO_PLACEHOLDER_TILES */
  tiles: Banner[];
  className?: string;
}

// Hai tông nền xen kẽ, đều đủ tương phản với chữ trắng
const TILE_BG = ['bg-green-dark', 'bg-leaf-900'];

function TileImage({ tile }: { tile: Banner }) {
  const [src, setSrc] = useState(tile.image || MISSING_PRODUCT_IMAGE);
  return (
    <Image
      src={src}
      alt={tile.alt || ''}
      fill
      // Ảnh chiếm ~48% ô: desktop ô rộng ~476px; tablet 2 ô chia đôi; mobile ô ~82vw
      sizes="(min-width: 1024px) 240px, (min-width: 640px) 25vw, 42vw"
      className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
      style={{ objectPosition: tile.objectPosition || 'center' }}
      onError={() => setSrc(MISSING_PRODUCT_IMAGE)}
    />
  );
}

/**
 * 2 ô khuyến mãi cạnh hero (bố cục bento).
 *  - Desktop ≥1024px: xếp dọc, cùng chiều cao với banner chính (kéo giãn theo hàng lưới).
 *  - Tablet: 2 ô chia đôi một hàng. Mobile: hàng vuốt ngang (scroll-snap), ô sau ló ra để gợi ý vuốt.
 * Chữ: tag (nhãn nhỏ), title, subtitle, ctaLabel — từ banner admin hoặc file mẫu, không viết cứng trong bố cục.
 */
export default function HeroPromoTiles({ tiles, className }: HeroPromoTilesProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const items = tiles.filter((t) => Boolean(t.image)).slice(0, 2);
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'lg:flex-col lg:overflow-visible lg:h-full',
        className
      )}
      aria-label={isEn ? 'Promotions' : 'Khuyến mãi'}
      role="region"
    >
      {items.map((tile, i) => {
        const title = (isEn && tile.titleEn) || tile.title;
        const subtitle = (isEn && tile.subtitleEn) || tile.subtitle;
        const cta = (isEn ? tile.ctaLabelEn : tile.ctaLabel) || tile.ctaLabel || (isEn ? 'See more' : 'Xem ngay');
        return (
          <Link
            key={tile.id}
            href={tile.link || '/#san-pham'}
            className={cn(
              'group relative flex overflow-hidden rounded-2xl text-white shadow-xs',
              // Chiều cao tối thiểu (không cố định) để tiêu đề 2 dòng + dòng phụ + CTA không bị cắt trên điện thoại
              'snap-start shrink-0 w-[82%] min-h-[112px] sm:w-[calc(50%-8px)] sm:min-h-[132px]',
              'lg:w-auto lg:h-auto lg:flex-1 lg:min-h-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-corn focus-visible:ring-offset-2 focus-visible:ring-offset-ivory-dark',
              TILE_BG[i % TILE_BG.length]
            )}
          >
            {/* Ảnh nửa phải, mờ dần sang nền để chữ luôn đọc rõ */}
            <div className="absolute inset-y-0 right-0 w-[48%]">
              <TileImage tile={tile} />
              <div
                aria-hidden
                className={cn(
                  'absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r to-transparent',
                  i % 2 === 0 ? 'from-green-dark' : 'from-leaf-900'
                )}
              />
            </div>

            <div className="relative z-[1] w-[58%] flex flex-col justify-center gap-1 px-4 lg:px-5 py-3">
              {tile.tag && (
                <span className="self-start rounded-full bg-corn px-2 py-0.5 text-[12px] leading-tight text-text-dark">
                  {tile.tag}
                </span>
              )}
              {title && (
                <p className="font-heading text-[17px] sm:text-[19px] lg:text-[clamp(18px,1.45vw,22px)] leading-tight line-clamp-2">
                  {title}
                </p>
              )}
              {subtitle && <p className="text-[13px] text-white/85 leading-snug line-clamp-1">{subtitle}</p>}
              <span className="mt-0.5 inline-flex items-center gap-1 text-[14px] text-corn group-hover:underline">
                {cta}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
