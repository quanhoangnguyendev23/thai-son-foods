'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ChevronDown, Layers } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export interface ScrollBannerItem {
  id: string;
  image: string;
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

export default function ScrollBannerShowcase(props: ScrollBannerShowcaseProps = {}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative w-full h-[180vh] sm:h-[260vh] bg-forest-950 select-none">
        <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center z-20">
          <div className="absolute inset-0 bg-gradient-to-b from-forest-950/60 via-forest-950 to-forest-950 z-0" />
          <div className="relative w-full h-full">
            <Image
              src={defaultScrollBanners[0].image}
              alt={defaultScrollBanners[0].alt}
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          </div>
        </div>
      </div>
    );
  }

  return <ScrollBannerContent {...props} />;
}

function ScrollBannerContent({
  banners: customBanners,
}: ScrollBannerShowcaseProps = {}) {
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
              alt: b.alt || b.title || 'Thái Sơn Foods',
              tag: b.tag || b.subtitle || 'Bản sắc & Tự nhiên',
              title: b.title || 'UỐNG MỘT BỮA ĂN NGON LÀNH',
              subtitle: b.subtitle || '',
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

  // Theo dõi tiến trình cuộn qua vùng 250vh
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Làm mượt tiến trình cuộn bằng Spring Physics (Apple-like smooth inertia)
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  // ─── HIỆU ỨNG SLIDE 1 (0% -> 50% cuộn) ───
  // Slide 1 rõ nét ở đầu, khi cuộn đến 35% -> 55% thì mờ dần và zoom nhẹ điện ảnh
  const slide1Opacity = useTransform(smoothProgress, [0, 0.35, 0.55], [1, 1, 0]);
  const slide1Scale = useTransform(smoothProgress, [0, 0.55], [1, 1.08]);
  const slide1Y = useTransform(smoothProgress, [0, 0.55], ['0%', '-4%']);

  // ─── HIỆU ỨNG SLIDE 2 (45% -> 100% cuộn) ───
  // Slide 2 xuất hiện từ 45% -> 65%, zoom từ 0.94 -> 1.00 tạo cảm giác tiến về người xem
  const slide2Opacity = useTransform(smoothProgress, [0.45, 0.65, 1], [0, 1, 1]);
  const slide2Scale = useTransform(smoothProgress, [0.45, 0.75], [0.94, 1.0]);
  const slide2Y = useTransform(smoothProgress, [0.45, 0.75], ['4%', '0%']);

  // Thanh tiến trình cuộn (0% -> 100%)
  const progressPercent = useTransform(smoothProgress, [0, 1], ['0%', '100%']);

  // Ẩn chỉ dẫn cuộn chuột sau khi người dùng bắt đầu cuộn
  const hintOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0]);

  // Độ sáng / hiển thị của 2 nút pill chỉ số
  const pill1Active = useTransform(smoothProgress, [0, 0.49, 0.51, 1], [1, 1, 0.45, 0.45]);
  const pill2Active = useTransform(smoothProgress, [0, 0.49, 0.51, 1], [0.45, 0.45, 1, 1]);

  // Nếu không có banner nào đang hoạt động (do admin tắt hiển thị), giữ ref nhưng ẩn hiển thị
  if (!banners || banners.length === 0) {
    return <div ref={containerRef} className="hidden" />;
  }

  const slide1 = banners[0] || defaultScrollBanners[0];
  const slide2 = banners[1] || defaultScrollBanners[1];

  const handleScrollToSlide = (slideIndex: 0 | 1) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const totalScrollable = containerRef.current.offsetHeight - window.innerHeight;
    const targetY = scrollTop + (slideIndex === 0 ? totalScrollable * 0.1 : totalScrollable * 0.85);
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[180vh] sm:h-[260vh] bg-forest-950 select-none"
      aria-label={language === 'en' ? 'Explore Thai Son Foods visual brand collection by scrolling' : 'Khám phá bộ sưu tập banner Thái Sơn Foods bằng cách lướt chuột'}
    >
      {/* 
        KHUNG STICKY GHIM TOÀN MÀN HÌNH:
        Ghim cố định trên màn hình suốt 260vh cuộn chuột để tạo trải nghiệm chuyển cảnh điện ảnh 
      */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center z-20">
        {/* Nền Gradient mờ tối điện ảnh */}
        <div className="absolute inset-0 bg-gradient-to-b from-forest-950/60 via-forest-950 to-forest-950 z-0" />

        {/* ════════════ SLIDE 1 ════════════ */}
        <motion.div
          style={{
            opacity: slide1Opacity,
            scale: slide1Scale,
            y: slide1Y,
          }}
          className="absolute inset-0 w-full h-full flex items-center justify-center will-change-transform"
        >
          <div className="relative w-full h-full">
            <Image
              src={slide1.image}
              alt={slide1.alt}
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          </div>
        </motion.div>

        {/* ════════════ SLIDE 2 ════════════ */}
        <motion.div
          style={{
            opacity: slide2Opacity,
            scale: slide2Scale,
            y: slide2Y,
          }}
          className="absolute inset-0 w-full h-full flex items-center justify-center will-change-transform"
        >
          <div className="relative w-full h-full">
            <Image
              src={slide2.image}
              alt={slide2.alt}
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          </div>
        </motion.div>

        {/* Lớp phủ chuyển sắc nhẹ ở viền để nổi bật nội dung */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/40 via-transparent to-ink-950/25 z-10" />

        {/* ════════════ GIAO DIỆN ĐIỀU HƯỚNG & TIẾN TRÌNH CAO CẤP ════════════ */}
        {/* Góc trên bên trái: Badge nhận diện thương hiệu (Ẩn trên mobile để không bị header che mất) */}
        <div className="hidden sm:block absolute top-8 left-10 z-30">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-ink-950/45 backdrop-blur-md border border-white/15 text-white/90 text-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tracking-wide uppercase text-[12px]">Thái Sơn Group • Brand Visual</span>
          </div>
        </div>

        {/* Giữa mép dưới: Chỉ dẫn lướt/vuốt cuộn ảnh (Nằm phía trên các nút trên mobile để không bị đè chữ) */}
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

        {/* Mép dưới: Chỉ số 01 / 02 và thanh tiến trình Apple-style (Căn giữa trên mobile, góc phải trên desktop) */}
        <div className="absolute bottom-5 sm:bottom-8 left-1/2 sm:left-auto sm:right-10 -translate-x-1/2 sm:translate-x-0 z-30 flex flex-col items-center sm:items-end gap-2 sm:gap-2.5">
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-ink-950/55 backdrop-blur-md border border-white/15 shadow-xl">
            {/* Nút Slide 1 */}
            <motion.button
              type="button"
              onClick={() => handleScrollToSlide(0)}
              style={{ opacity: pill1Active }}
              className="px-3.5 py-2 sm:py-2.5 rounded-xl text-sm text-white hover:bg-white/15 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="font-mono text-emerald-400">01</span>
              <span className="hidden sm:inline">
                {language === 'en' ? 'Wholesome Meal' : 'Uống một bữa ăn'}
              </span>
            </motion.button>

            <span className="text-white/30 text-xs">•</span>

            {/* Nút Slide 2 */}
            <motion.button
              type="button"
              onClick={() => handleScrollToSlide(1)}
              style={{ opacity: pill2Active }}
              className="px-3.5 py-2 sm:py-2.5 rounded-xl text-sm text-white hover:bg-white/15 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="font-mono text-amber-400">02</span>
              <span className="hidden sm:inline">
                {language === 'en' ? 'Brand Showcase' : 'Banner thiết kế 2'}
              </span>
            </motion.button>
          </div>

          {/* Vạch đo tiến trình cuộn mượt */}
          <div className="w-32 sm:w-44 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-xs">
            <motion.div
              style={{ width: progressPercent }}
              className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-amber-400 rounded-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
