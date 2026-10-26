'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Banner } from '@/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { HOMEPAGE_HERO } from '@/config/homepage';

interface AmazonHeroCarouselProps {
  banners: Banner[];
  /** Thời gian tự chuyển slide (ms), tối thiểu 5000. 0 = tắt tự chuyển. Mặc định lấy từ HOMEPAGE_HERO.AUTOPLAY_MS */
  autoplayMs?: number;
  className?: string;
}

const FALLBACK_BANNER = '/images/banners/banner-1600x900.png';
const MIN_AUTOPLAY_MS = 5000;

/**
 * Bề rộng thật của khung ảnh: desktop chiếm 2/3 lưới bento (tối đa ~965px), dưới 1024px tràn ngang.
 * Khai báo đúng để trình duyệt không tải ảnh 1920px cho khung 965px.
 */
const HERO_SIZES = '(min-width: 1500px) 965px, (min-width: 1024px) 64vw, 100vw';

interface SlideCopy {
  tag?: string;
  title?: string;
  subtitle?: string;
  ctaLabel: string;
  href: string;
}

/** Chữ trên slide — thứ tự ưu tiên xem chú thích HOMEPAGE_HERO trong src/config/homepage.ts */
function resolveCopy(banner: Banner, isEn: boolean): SlideCopy {
  const d = HOMEPAGE_HERO.DEFAULT_COPY;
  const ctaLabel =
    (isEn ? banner.ctaLabelEn : banner.ctaLabel) || banner.ctaLabel || (isEn ? d.ctaLabelEn : d.ctaLabel);
  const href = banner.link || d.ctaHref;
  const defaults: SlideCopy = {
    title: isEn ? d.titleEn : d.title,
    subtitle: isEn ? d.subtitleEn : d.subtitle,
    ctaLabel,
    href,
  };

  if (banner.source === 'db') {
    // Banner admin: chỉ coi là có chữ riêng khi đã điền Phụ đề (Tiêu đề cũ của banner hero chỉ dùng làm mô tả ảnh)
    if (!banner.subtitle) return defaults;
    return {
      tag: banner.tag,
      title: (isEn && banner.titleEn) || banner.title,
      subtitle: (isEn && banner.subtitleEn) || banner.subtitle,
      ctaLabel,
      href,
    };
  }
  if (banner.title !== undefined) {
    return {
      tag: banner.tag,
      title: (isEn && banner.titleEn) || banner.title,
      subtitle: (isEn && banner.subtitleEn) || banner.subtitle,
      ctaLabel,
      href,
    };
  }
  return defaults;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Ảnh một slide. Slide đầu: preload (ảnh LCP). Slide sau: lazy. Có ảnh điện thoại riêng → <picture> (art direction). */
function SlideImage({
  banner,
  src,
  first,
  onError,
}: {
  banner: Banner;
  src: string;
  first: boolean;
  onError: () => void;
}) {
  const alt = banner.alt || 'Thái Sơn Foods';
  const objectPosition = banner.objectPosition || 'center';

  if (banner.mobileImage) {
    const {
      props: { srcSet: desktopSrcSet },
    } = getImageProps({ src, alt, fill: true, sizes: HERO_SIZES });
    const {
      props: { srcSet: mobileSrcSet, style, ...rest },
    } = getImageProps({
      src: banner.mobileImage,
      alt,
      fill: true,
      sizes: '100vw',
      // Không dùng preload/eager với <picture> (sẽ tải cả 2 ảnh) — theo tài liệu next/image
      fetchPriority: first ? 'high' : undefined,
    });
    return (
      <picture>
        <source media="(min-width: 640px)" srcSet={desktopSrcSet} sizes={HERO_SIZES} />
        <img
          {...rest}
          srcSet={mobileSrcSet}
          alt={alt}
          style={{ ...style, objectPosition }}
          className="object-cover"
          onError={onError}
        />
      </picture>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={HERO_SIZES}
      className="object-cover"
      style={{ objectPosition }}
      {...(first ? { preload: true } : { loading: 'lazy' as const })}
      onError={onError}
    />
  );
}

/**
 * Hero carousel trang chủ: khung cao cố định (không để tỉ lệ ảnh quyết định), lớp phủ tối phía chữ,
 * tiêu đề + dòng phụ + nút CTA lấy từ banner/config. Tự chuyển ≥ 5 giây, dừng khi rê chuột / focus / tab ẩn,
 * tắt khi người dùng bật "giảm chuyển động". Có chấm chỉ số, nút trước/sau, vuốt, phím ←/→.
 * Slide đầu render sẵn ở server; ảnh các slide sau chỉ được gắn khi trang đã tải xong hoặc khi sắp tới lượt.
 */
export default function AmazonHeroCarousel({
  banners,
  autoplayMs = HOMEPAGE_HERO.AUTOPLAY_MS,
  className,
}: AmazonHeroCarouselProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const slides = banners.filter((b) => Boolean(b.image));
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  // Slide nào đã được phép gắn ảnh (slide 0 luôn có ngay từ server)
  const [rendered, setRendered] = useState<Set<number>>(() => new Set([0]));
  const reducedMotion = usePrefersReducedMotion();
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (count ? (i + dir + count) % count : 0)),
    [count]
  );

  // Gắn ảnh slide hiện tại + slide kế tiếp; lần đầu đợi trang tải xong để không tranh băng thông với ảnh LCP
  useEffect(() => {
    if (count < 2) return;
    const add = () =>
      setRendered((prev) => {
        const next = (index + 1) % count;
        if (prev.has(index) && prev.has(next)) return prev;
        const s = new Set(prev);
        s.add(index);
        s.add(next);
        return s;
      });
    if (document.readyState === 'complete') {
      add();
      return;
    }
    window.addEventListener('load', add, { once: true });
    return () => window.removeEventListener('load', add);
  }, [index, count]);

  const interval = autoplayMs > 0 ? Math.max(MIN_AUTOPLAY_MS, autoplayMs) : 0;
  const autoplayOn = Boolean(interval) && count > 1 && !reducedMotion;

  useEffect(() => {
    if (!autoplayOn || paused) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') go(1);
    }, interval);
    return () => window.clearInterval(timer);
  }, [autoplayOn, paused, interval, go]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={isEn ? 'Promotional banners' : 'Banner quảng cáo'}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl shadow-xs bg-ivory',
        // Chiều cao cố định theo khung (CLS ≈ 0). Ô khuyến mãi bên cạnh kéo giãn theo hàng lưới này.
        'h-[200px] sm:h-[240px] lg:h-[clamp(240px,26vw,340px)]',
        className
      )}
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
      <div className="absolute inset-0" aria-live={autoplayOn && !paused ? 'off' : 'polite'}>
        {slides.map((banner, i) => {
          const active = i === index;
          const src = failed[banner.id] ? FALLBACK_BANNER : banner.image;
          const copy = resolveCopy(banner, isEn);
          const hasText = Boolean(copy.title || copy.subtitle);
          return (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={!active}
              inert={!active}
              className={cn(
                'absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none',
                active ? 'opacity-100 z-[1]' : 'opacity-0 z-0 pointer-events-none'
              )}
            >
              {/* Ảnh — cả khung bấm được (chuột/cảm ứng); bàn phím dùng nút CTA */}
              <Link href={copy.href} tabIndex={-1} aria-hidden className="absolute inset-0 block">
                {(i === 0 || rendered.has(i)) && (
                  <SlideImage
                    banner={banner}
                    src={src}
                    first={i === 0}
                    onError={() => setFailed((f) => ({ ...f, [banner.id]: true }))}
                  />
                )}
              </Link>

              {/* Lớp phủ tối phía chữ (WCAG AA cho chữ trắng) */}
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-0',
                  hasText
                    ? 'bg-gradient-to-r from-ink-950/80 via-ink-950/45 to-transparent sm:via-ink-950/35 sm:to-55%'
                    : 'bg-gradient-to-t from-ink-950/55 via-transparent to-transparent'
                )}
              />

              <div
                className={cn(
                  'absolute inset-y-0 left-0 flex flex-col px-4 sm:px-8 lg:px-10 xl:px-12 max-w-[88%] sm:max-w-[64%] lg:max-w-[62%]',
                  hasText ? 'justify-center' : 'justify-end pb-4 sm:pb-6'
                )}
              >
                {hasText && copy.tag && (
                  <p className="mb-1 text-[12px] sm:text-[13px] uppercase tracking-wide text-corn-light [text-shadow:0_1px_2px_rgb(0_0_0/0.4)]">
                    {copy.tag}
                  </p>
                )}
                {copy.title && (
                  <h2 className="font-heading text-white text-[20px] sm:text-[28px] lg:text-[clamp(26px,2.2vw,36px)] leading-[1.15] line-clamp-2 [text-shadow:0_1px_3px_rgb(0_0_0/0.35)]">
                    {copy.title}
                  </h2>
                )}
                {copy.subtitle && (
                  <p className="mt-1 sm:mt-1.5 text-[13px] sm:text-[15px] lg:text-[16px] text-white/95 line-clamp-1 [text-shadow:0_1px_2px_rgb(0_0_0/0.4)]">
                    {copy.subtitle}
                  </p>
                )}
                <Link
                  href={copy.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 self-start rounded-full bg-corn hover:bg-corn-dark text-text-dark shadow-xs transition-colors',
                    'min-h-10 sm:min-h-11 px-4 sm:px-5 text-[14px] sm:text-[15px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
                    hasText ? 'mt-3 sm:mt-4' : ''
                  )}
                >
                  {copy.ctaLabel}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="absolute bottom-2.5 right-2.5 sm:bottom-4 sm:right-4 z-[3] flex items-center gap-0.5 rounded-full bg-ink-950/40 backdrop-blur-sm p-0.5">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={isEn ? 'Previous banner' : 'Banner trước'}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-white hover:bg-white/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-corn"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} aria-hidden />
          </button>
          <div className="flex items-center gap-1 px-1">
            {slides.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={isEn ? `Show banner ${i + 1}` : `Xem banner ${i + 1}`}
                aria-current={i === index}
                className="group relative h-6 w-4 flex items-center justify-center cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-corn data-[active=true]:w-7"
                data-active={i === index}
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full transition-all motion-reduce:transition-none',
                    i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60 group-hover:bg-white/85'
                  )}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={isEn ? 'Next banner' : 'Banner tiếp theo'}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-white hover:bg-white/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-corn"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}
