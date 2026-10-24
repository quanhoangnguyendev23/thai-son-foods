'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Banner } from '@/types';
import { cn } from '@/lib/utils';

interface AmazonHeroCarouselProps {
  banners: Banner[];
  /** Thời gian tự chuyển slide (ms). 0 = tắt tự chuyển */
  autoplayMs?: number;
}

const FALLBACK_BANNER = '/images/banners/banner-1600x900.png';

/**
 * Hero carousel bố cục Amazon: ảnh tràn ngang, mờ dần xuống nền trang ở chân,
 * nút trái/phải cao 2 bên, tự chuyển (dừng khi rê chuột / focus / tab ẩn), vuốt trên cảm ứng.
 */
export default function AmazonHeroCarousel({ banners, autoplayMs = 6000 }: AmazonHeroCarouselProps) {
  const slides = banners.filter((b) => Boolean(b.image));
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (count ? (i + dir + count) % count : 0)),
    [count]
  );

  useEffect(() => {
    if (!autoplayMs || count < 2 || paused) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') go(1);
    }, autoplayMs);
    return () => window.clearInterval(timer);
  }, [autoplayMs, count, paused, go]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Banner quảng cáo"
      className="relative w-full overflow-hidden rounded-2xl shadow-xs"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="relative w-full aspect-[16/9] sm:aspect-[1920/850]">
        {slides.map((banner, i) => {
          const active = i === index;
          const src = failed[banner.id] ? FALLBACK_BANNER : banner.image;
          const hasMobile = Boolean(banner.mobileImage) && !failed[banner.id];
          const img = hasMobile ? (
            // Có ảnh riêng cho điện thoại: ảnh ngang từ 640px trở lên, ảnh điện thoại bên dưới đó
            <>
              <Image
                src={src}
                alt={banner.alt || 'Thái Sơn Foods'}
                fill
                sizes="(max-width: 1500px) 100vw, 1500px"
                className="hidden sm:block object-cover object-center"
                loading="lazy"
                onError={() => setFailed((f) => ({ ...f, [banner.id]: true }))}
              />
              <Image
                src={banner.mobileImage as string}
                alt={banner.alt || 'Thái Sơn Foods'}
                fill
                sizes="100vw"
                className="sm:hidden object-cover object-center"
                loading="lazy"
                onError={() => setFailed((f) => ({ ...f, [banner.id]: true }))}
              />
            </>
          ) : (
            <Image
              src={src}
              alt={banner.alt || 'Thái Sơn Foods'}
              fill
              sizes="(max-width: 1500px) 100vw, 1500px"
              className="object-cover object-center"
              priority={i === 0}
              loading={i === 0 ? 'eager' : 'lazy'}
              onError={() => setFailed((f) => ({ ...f, [banner.id]: true }))}
            />
          );
          return (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={!active}
              className={cn(
                'absolute inset-0 transition-opacity duration-700 ease-out',
                active ? 'opacity-100 z-[1]' : 'opacity-0 z-0 pointer-events-none'
              )}
            >
              {banner.link ? (
                <Link href={banner.link} tabIndex={active ? 0 : -1} className="block w-full h-full relative">
                  {img}
                </Link>
              ) : (
                img
              )}
            </div>
          );
        })}


        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Banner trước"
              className="absolute left-0 top-0 z-[3] h-full w-12 sm:w-16 lg:w-20 flex items-center justify-center text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-corn cursor-pointer group"
            >
              <span className="flex items-center justify-center w-9 h-9 lg:w-11 lg:h-11 rounded-full bg-ink-950/25 group-hover:bg-ink-950/45 transition-colors">
                <ChevronLeft className="w-6 h-6 lg:w-8 lg:h-8" strokeWidth={2.5} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Banner tiếp theo"
              className="absolute right-0 top-0 z-[3] h-full w-12 sm:w-16 lg:w-20 flex items-center justify-center text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-corn cursor-pointer group"
            >
              <span className="flex items-center justify-center w-9 h-9 lg:w-11 lg:h-11 rounded-full bg-ink-950/25 group-hover:bg-ink-950/45 transition-colors">
                <ChevronRight className="w-6 h-6 lg:w-8 lg:h-8" strokeWidth={2.5} />
              </span>
            </button>

            {/* Chấm chỉ số slide (mobile/tablet — trên desktop phần chân hero bị lưới thẻ che) */}
            <div className="absolute bottom-3 inset-x-0 z-[3] flex justify-center gap-1.5">
              {slides.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Xem banner ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    'relative before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[\'\'] h-1.5 rounded-full transition-all cursor-pointer',
                    i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/60'
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
