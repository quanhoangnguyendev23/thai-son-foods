'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export interface ScrollBannerItem {
  id: string;
  image: string;
  /** Ảnh riêng cho điện thoại (tùy chọn). Không có thì dùng chung `image`. */
  mobileImage?: string;
  alt: string;
  tag?: string;
  title?: string;
  subtitle?: string;
}

interface ScrollBannerShowcaseProps {
  banners?: ScrollBannerItem[];
}

export const defaultScrollBanners: ScrollBannerItem[] = [
  {
    id: 'banner-slide-1',
    image: '/images/banners/banner-1920x850-chu-a.jpg',
    alt: 'Thái Sơn Group - Uống một bữa ăn ngon lành',
    tag: 'Bản sắc & Tự nhiên',
    title: 'UỐNG MỘT BỮA ĂN NGON LÀNH',
    subtitle: 'Nguồn dinh dưỡng thanh khiết từ 100% nông sản sạch quê hương',
  },
  {
    id: 'banner-slide-2',
    image: '/images/banners/banner-1920x850-slide-2.jpg',
    alt: 'Thái Sơn Foods - Banner thiết kế mẫu thứ 2',
    tag: 'Không gian & Trải nghiệm',
    title: 'HƯƠNG VỊ QUÊ VIỆT ĐỒNG HÀNH',
    subtitle: 'Không gian thiết kế sáng tạo — Sẵn sàng thay đổi theo bộ nhận diện mới của bạn',
  },
];

/** Hình của một slide: hỗ trợ ảnh riêng cho điện thoại (hiện dưới 640px) */
function SlideImage({ banner, priority }: { banner: ScrollBannerItem; priority: boolean }) {
  if (!banner.mobileImage) {
    return (
      <Image
        src={banner.image}
        alt={banner.alt}
        fill
        priority={priority}
        className="object-cover object-center"
        sizes="100vw"
      />
    );
  }
  return (
    <>
      <Image
        src={banner.image}
        alt={banner.alt}
        fill
        className="hidden sm:block object-cover object-center"
        sizes="100vw"
      />
      <Image
        src={banner.mobileImage}
        alt={banner.alt}
        fill
        className="sm:hidden object-cover object-center"
        sizes="100vw"
      />
    </>
  );
}

/** Khoảng cuộn (0 → 1) của slide thứ `index` trên tổng `count` slide, cùng độ chồng mờ `ov` giữa hai slide liền kề */
function slideRange(index: number, count: number) {
  const seg = 1 / count;
  const ov = Math.min(0.06, 0.4 * seg);
  return { start: index * seg, end: (index + 1) * seg, ov };
}

/** Một slide: tự mờ vào/ra và phóng nhẹ theo tiến trình cuộn */
function ScrollSlide({
  banner,
  index,
  count,
  progress,
}: {
  banner: ScrollBannerItem;
  index: number;
  count: number;
  progress: MotionValue<number>;
}) {
  const isFirst = index === 0;
  const isLast = index === count - 1;
  const { start, end, ov } = slideRange(index, count);

  // Mốc đầu vào tăng dần; slide đầu không mờ vào, slide cuối không mờ ra
  const inputs: number[] = [];
  const opacity: number[] = [];
  const scale: number[] = [];
  const y: string[] = [];
  if (!isFirst) {
    inputs.push(start - ov, start + ov);
    opacity.push(0, 1);
    scale.push(0.94, 1);
    y.push('4%', '0%');
  } else {
    inputs.push(0);
    opacity.push(1);
    scale.push(1);
    y.push('0%');
  }
  if (!isLast) {
    inputs.push(end - ov, end + ov);
    opacity.push(1, 0);
    scale.push(1, 1.08);
    y.push('0%', '-4%');
  } else {
    inputs.push(1);
    opacity.push(1);
    scale.push(1);
    y.push('0%');
  }

  const slideOpacity = useTransform(progress, inputs, opacity);
  const slideScale = useTransform(progress, inputs, scale);
  const slideY = useTransform(progress, inputs, y);

  return (
    <motion.div
      style={{ opacity: slideOpacity, scale: slideScale, y: slideY }}
      className="absolute inset-0 w-full h-full flex items-center justify-center will-change-transform"
    >
      <div className="relative w-full h-full">
        <SlideImage banner={banner} priority={isFirst} />
      </div>

      {(banner.tag || banner.title || banner.subtitle) && (
        <div className="absolute left-5 right-5 sm:left-10 sm:right-auto bottom-36 sm:bottom-28 z-20 sm:max-w-xl text-white pointer-events-none">
          {banner.tag && (
            <span className="inline-block px-3 py-1 mb-2 rounded-full bg-ink-950/45 backdrop-blur-md border border-white/15 text-[12px] uppercase tracking-wider text-emerald-300">
              {banner.tag}
            </span>
          )}
          {banner.title && (
            <h2 className="text-2xl sm:text-4xl leading-tight drop-shadow-[0_2px_8px_rgba(34,84,76,0.55)]">{banner.title}</h2>
          )}
          {banner.subtitle && (
            <p className="mt-2 text-sm sm:text-base text-white/90 drop-shadow-[0_1px_6px_rgba(34,84,76,0.55)]">{banner.subtitle}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** Nút chỉ số: sáng khi đang ở đúng slide */
function ScrollPill({
  index,
  count,
  label,
  progress,
  onSelect,
  ariaLabel,
}: {
  index: number;
  count: number;
  label: string;
  progress: MotionValue<number>;
  onSelect: () => void;
  ariaLabel: string;
}) {
  const { start, end } = slideRange(index, count);
  const active = useTransform(progress, [start - 0.02, start + 0.0001, end - 0.0001, end + 0.02], [0.45, 1, 1, 0.45]);
  const numberColor = index % 2 === 0 ? 'text-emerald-400' : 'text-amber-400';
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      style={{ opacity: active }}
      aria-label={ariaLabel}
      className="px-3.5 py-2 sm:py-2.5 rounded-xl text-sm text-white hover:bg-white/15 transition-all cursor-pointer flex items-center gap-1.5"
    >
      <span className={`font-mono ${numberColor}`}>{String(index + 1).padStart(2, '0')}</span>
      {label && <span className="hidden sm:inline max-w-[160px] truncate">{label}</span>}
    </motion.button>
  );
}

export default function ScrollBannerShowcase(props: ScrollBannerShowcaseProps = {}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    const first = props.banners && props.banners.length > 0 ? props.banners[0] : defaultScrollBanners[0];
    // Chỉ dựng khung giữ chỗ khi thật sự sẽ có banner (tránh nhấp nháy khi banner bị tắt)
    if (props.banners !== undefined && props.banners.length === 0) return null;
    return (
      <div className="relative w-full h-[180vh] sm:h-[260vh] bg-forest-950 select-none">
        <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center z-20">
          <div className="absolute inset-0 bg-gradient-to-b from-forest-950/60 via-forest-950 to-forest-950 z-0" />
          <div className="relative w-full h-full">
            <Image src={first.image} alt={first.alt} fill priority className="object-cover object-center" sizes="100vw" />
          </div>
        </div>
      </div>
    );
  }

  return <ScrollBannerContent {...props} />;
}

function ScrollBannerContent({ banners: customBanners }: ScrollBannerShowcaseProps = {}) {
  const { language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [banners, setBanners] = useState<ScrollBannerItem[]>(
    customBanners !== undefined ? customBanners : defaultScrollBanners
  );

  useEffect(() => {
    if (customBanners !== undefined) {
      setBanners(customBanners);
      return;
    }
    fetch('/api/banners?placement=scroll')
      .then((res) => res.json())
      .then((data) => {
        const list = data?.data || data?.banners;
        if (Array.isArray(list) && list.length > 0) {
          setBanners(
            list.map((b: any) => ({
              id: b.id,
              image: b.image,
              mobileImage: b.mobile_image || b.mobileImage || undefined,
              alt: b.alt || b.title || 'Thái Sơn Foods',
              tag: b.tag || undefined,
              title: b.title || undefined,
              subtitle: b.subtitle || undefined,
            }))
          );
        } else if (Array.isArray(list) && list.length === 0) {
          setBanners([]);
        }
      })
      .catch(() => {
        setBanners(defaultScrollBanners);
      });
  }, [customBanners]);

  // Theo dõi tiến trình cuộn qua toàn bộ vùng ghim
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Làm mượt tiến trình cuộn bằng Spring Physics
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  const progressPercent = useTransform(smoothProgress, [0, 1], ['0%', '100%']);
  // Ẩn chỉ dẫn cuộn sau khi người dùng bắt đầu cuộn
  const hintOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0]);

  // Nếu không có banner nào đang hoạt động (admin tắt hiển thị), giữ ref nhưng ẩn
  if (!banners || banners.length === 0) {
    return <div ref={containerRef} className="hidden" />;
  }

  const count = banners.length;
  const single = count === 1;

  const handleScrollToSlide = (slideIndex: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const totalScrollable = containerRef.current.offsetHeight - window.innerHeight;
    // Cuộn tới giữa đoạn của slide (slide cuối: gần cuối vùng để thấy trọn ảnh)
    const { start, end } = slideRange(slideIndex, count);
    const target = slideIndex === 0 ? 0.02 : slideIndex === count - 1 ? 0.98 : (start + end) / 2;
    window.scrollTo({ top: scrollTop + totalScrollable * target, behavior: 'smooth' });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-forest-950 select-none ${single ? 'h-screen' : 'h-[var(--sb-h-m)] sm:h-[var(--sb-h-d)]'}`}
      style={{ '--sb-h-m': `${count * 90}vh`, '--sb-h-d': `${count * 130}vh` } as React.CSSProperties}
      aria-label={language === 'en' ? 'Explore Thai Son Foods visual brand collection by scrolling' : 'Khám phá bộ sưu tập banner Thái Sơn Foods bằng cách lướt chuột'}
    >
      {/* Khung ghim toàn màn hình: ghim cố định trong suốt quãng cuộn để chuyển cảnh từng banner */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center z-20">
        <div className="absolute inset-0 bg-gradient-to-b from-forest-950/60 via-forest-950 to-forest-950 z-0" />

        {banners.map((banner, i) => (
          <ScrollSlide key={`${banner.id}-${count}`} banner={banner} index={i} count={count} progress={smoothProgress} />
        ))}

        {/* Lớp phủ chuyển sắc nhẹ ở viền để nổi bật nội dung */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/40 via-transparent to-ink-950/25 z-10" />

        {/* Góc trên bên trái: Badge nhận diện thương hiệu (ẩn trên mobile để không bị header che) */}
        <div className="hidden sm:block absolute top-8 left-10 z-30">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-ink-950/45 backdrop-blur-md border border-white/15 text-white/90 text-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tracking-wide uppercase text-[12px]">Thái Sơn Group • Brand Visual</span>
          </div>
        </div>

        {!single && (
          <>
            {/* Chỉ dẫn lướt/vuốt */}
            <motion.div
              style={{ opacity: hintOpacity }}
              className="pointer-events-none absolute bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 text-white/90"
            >
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-ink-950/50 backdrop-blur-md border border-white/15 shadow-lg text-[13px] tracking-wide whitespace-nowrap">
                <span className="hidden sm:inline">
                  {language === 'en' ? 'Scroll down to switch banner' : 'Lướt chuột xuống để chuyển đổi banner'}
                </span>
                <span className="sm:hidden">
                  {language === 'en' ? 'Swipe down to explore' : 'Vuốt xuống để chuyển đổi banner'}
                </span>
                <ChevronDown className="w-4 h-4 text-emerald-400 animate-bounce" />
              </div>
            </motion.div>

            {/* Mép dưới: chỉ số các banner và thanh tiến trình */}
            <div className="absolute bottom-5 sm:bottom-8 left-1/2 sm:left-auto sm:right-10 -translate-x-1/2 sm:translate-x-0 z-30 flex flex-col items-center sm:items-end gap-2 sm:gap-2.5 max-w-[94vw]">
              <div className="flex items-center gap-1 sm:gap-2 p-1.5 rounded-2xl bg-ink-950/55 backdrop-blur-md border border-white/15 shadow-xl overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-w-full">
                {banners.map((b, i) => (
                  <div key={`pill-${b.id}-${count}`} className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {i > 0 && <span className="text-white/30 text-xs">•</span>}
                    <ScrollPill
                      index={i}
                      count={count}
                      label={b.tag || b.title || ''}
                      progress={smoothProgress}
                      onSelect={() => handleScrollToSlide(i)}
                      ariaLabel={`${language === 'en' ? 'Go to banner' : 'Chuyển tới banner'} ${i + 1}`}
                    />
                  </div>
                ))}
              </div>

              <div className="w-32 sm:w-44 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-xs">
                <motion.div
                  style={{ width: progressPercent }}
                  className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-amber-400 rounded-full"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
