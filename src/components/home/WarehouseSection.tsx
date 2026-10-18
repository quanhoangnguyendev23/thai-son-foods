'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

interface TabItem {
  id: string;
  num: string;
  subTitle?: string;
  subTitleEn?: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  image: string;
}

const warehouseTabs: TabItem[] = [
  {
    id: 'ho-tro-khach-hang',
    num: '01',
    title: 'Hỗ Trợ Khách Hàng',
    titleEn: 'Customer Support',
    description:
      'Tiếp nhận và xử lý kịp thời các phản hồi, thắc mắc phát sinh qua các kênh liên hệ, đồng thời hướng dẫn sử dụng và áp dụng phương án xử lý phù hợp cho từng trường hợp cụ thể.',
    descriptionEn:
      'Promptly receive and address customer inquiries, guiding optimal usage and providing tailored support solutions.',
    image: '/images/warehouse/1920x850-6.png',
  },
  {
    id: 'khach-hang-than-thiet',
    num: '02',
    title: 'Xây Dựng Khách Hàng Thân Thiết',
    titleEn: 'Customer Loyalty & Partnerships',
    description:
      'Triển khai các chính sách ưu đãi, chương trình thành viên và giải pháp đặt hàng định kỳ nhằm gia tăng gắn kết cũng như hỗ trợ nhu cầu của khách hàng.',
    descriptionEn:
      'Offering exclusive discounts, membership rewards, and flexible recurring order schedules for wholesale and retail partners.',
    image: '/images/warehouse/1920x850-3.png',
  },
  {
    id: 'thong-tin-minh-bach',
    num: '03',
    title: 'Thông Tin Minh Bạch',
    titleEn: 'Transparent Product Standards',
    description:
      'Cung cấp đầy đủ, rõ ràng các quy định về hạn sử dụng, đặc tính tự nhiên của sản phẩm và các điều khoản liên quan đến chính sách bán hàng',
    descriptionEn:
      'Transparent disclosure of ingredients, natural product shelf life, certifications, and reliable wholesale distribution policies.',
    image: '/images/warehouse/1920x850-2.png',
  },
];

export default function WarehouseSection() {
  const { language } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const currentTab = warehouseTabs[activeIndex];
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-slide every 7s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % warehouseTabs.length);
    }, 7000);
    return () => {
      clearInterval(timer);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleTabHover = (index: number) => {
    if (index === activeIndex) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // Độ trễ nhẹ khi hover để chuyển cảnh chậm rãi, êm ái
    hoverTimerRef.current = setTimeout(() => {
      setActiveIndex(index);
    }, 180);
  };

  const handleTabClick = (index: number) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setActiveIndex(index);
  };

  return (
    <section
      id="kho-si"
      className="max-w-[1456px] mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10 select-none"
    >
      {/* ══════════════════════════════════════════════════════════
          1. GIAO DIỆN MOBILE & TABLET (< lg): Bố cục tách lớp thông minh
          - Hình ảnh hiển thị tỷ lệ 16:9 đầy đủ (không bị che mất nhân vật/kệ hàng)
          - Thẻ thông tin màu ngà (răng cưa) nằm ngay dưới, rõ ràng và dễ đọc
          ══════════════════════════════════════════════════════════ */}
      <div className="block lg:hidden">
        {/* Tiêu đề mục trên Mobile */}
        <div className="mb-2.5 px-0.5 text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl uppercase tracking-tight font-serif text-forest-950">
            {language === 'en' ? 'WHY CHOOSE THAI SON FOODS?' : 'VÌ SAO THÁI SƠN FOODS ĐƯỢC TIN CHỌN?'}
          </h2>
        </div>

        {/* Khung thẻ chính trên Mobile */}
        <div className="relative w-full overflow-hidden rounded-2xl shadow-md border border-neutral-200/80 bg-neutral-900">
          {/* Phần 1: Ảnh minh họa chuẩn tỷ lệ 16:9 */}
          <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] overflow-hidden bg-neutral-900">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentTab.id}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute inset-0"
              >
                <Image
                  src={currentTab.image}
                  alt={currentTab.title}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 800px"
                  priority
                />
              </motion.div>
            </AnimatePresence>

            {/* Gradient đáy ảnh để nút Tab Pill nổi bật */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-950/70 to-transparent pointer-events-none z-10" />

            {/* Nút Tab Pill chuyển tab trên Mobile */}
            <div className="absolute bottom-2.5 left-0 right-0 flex justify-center z-20 px-2">
              <div className="flex items-center p-1 rounded-full bg-ink-950/65 backdrop-blur-md border border-white/20 shadow-xl">
                {warehouseTabs.map((tab, index) => {
                  const isActive = activeIndex === index;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabClick(index)}
                      className={cn(
                        'px-3 py-1 rounded-full transition-all duration-300 font-mono text-sm flex items-center gap-1.5 cursor-pointer',
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60 scale-105'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <span>{tab.num}</span>
                      {isActive && (
                        <span className="font-sans font-medium text-[11px] max-w-[125px] truncate">
                          {language === 'en' ? tab.titleEn : tab.title}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Phần 2: Thẻ vé màu ngà với mép cắt răng cưa */}
          <div className="bg-ivory p-4 sm:p-5 relative pb-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                {currentTab.subTitle && (
                  <h3 className="text-sm text-forest-700 mb-1 font-sans">
                    {currentTab.subTitle}
                  </h3>
                )}

                <h4 className="text-xl sm:text-2xl text-forest-950 leading-snug font-serif tracking-tight mb-1.5">
                  {language === 'en' ? currentTab.titleEn : currentTab.title}
                </h4>

                <p className="text-xs sm:text-[13px] text-forest-950/80 leading-relaxed font-sans mb-3">
                  {language === 'en' ? currentTab.descriptionEn : currentTab.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Hotline & Liên kết */}
            <div className="pt-2.5 border-t border-forest-950/10 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <a
                href="tel:02862915024"
                className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-800 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{language === 'en' ? 'Wholesale: 028 6291 5024' : 'Hotline sỉ: 028 6291 5024'}</span>
              </a>

              <Link
                href="/#san-pham"
                className="inline-flex items-center gap-1 text-sm text-forest-950 hover:text-forest-700 transition-colors"
              >
                <span>{language === 'en' ? 'Explore products' : 'Xem sản phẩm'}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Mép răng cưa ziczac The 350F */}
            <div className="absolute -bottom-[9px] left-0 right-0 h-[10px] overflow-hidden leading-none pointer-events-none">
              <svg
                viewBox="0 0 1200 24"
                className="w-full h-[10px] fill-ivory"
                preserveAspectRatio="none"
              >
                <path d="M0,0 L15,24 L30,0 L45,24 L60,0 L75,24 L90,0 L105,24 L120,0 L135,24 L150,0 L165,24 L180,0 L195,24 L210,0 L225,24 L240,0 L255,24 L270,0 L285,24 L300,0 L315,24 L330,0 L345,24 L360,0 L375,24 L390,0 L405,24 L420,0 L435,24 L450,0 L465,24 L480,0 L495,24 L510,0 L525,24 L540,0 L555,24 L570,0 L585,24 L600,0 L615,24 L630,0 L645,24 L660,0 L675,24 L690,0 L705,24 L720,0 L735,24 L750,0 L765,24 L780,0 L795,24 L810,0 L825,24 L840,0 L855,24 L870,0 L885,24 L900,0 L915,24 L930,0 L945,24 L960,0 L975,24 L990,0 L1005,24 L1020,0 L1035,24 L1050,0 L1065,24 L1080,0 L1095,24 L1110,0 L1125,24 L1140,0 L1155,24 L1170,0 L1185,24 L1200,0 Z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          2. GIAO DIỆN DESKTOP (>= lg): Phong cách The 350F Canvas
          - Khung viền canvas đồng nhất, không bị tràn viền đột biến
          - Thẻ nổi bên trái + Cột số bên phải + Tiêu đề lớn đáy
          ══════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:block relative w-full overflow-hidden rounded-2xl md:rounded-3xl shadow-lg bg-neutral-900 border border-neutral-800/40"
        style={{ minHeight: 'clamp(520px, 38vw, 580px)' }}
      >
        {/* Background Image (Animation chuyển cảnh mượt mà 1.5s) */}
        <div className="absolute inset-0 overflow-hidden">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={currentTab.id}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{
                duration: 1.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute inset-0"
            >
              <Image
                src={currentTab.image}
                alt={currentTab.title}
                fill
                className="object-cover object-center"
                sizes="(max-width: 1500px) 100vw, 1500px"
                priority
              />
            </motion.div>
          </AnimatePresence>

          {/* Gradient đáy dưới & cạnh phải */}
          <div className="absolute bottom-0 left-0 right-0 h-44 sm:h-56 bg-gradient-to-t from-ink-950/95 via-ink-950/60 to-transparent pointer-events-none z-10" />
          <div className="absolute top-0 right-0 bottom-0 w-48 sm:w-60 bg-gradient-to-l from-ink-950/30 to-transparent pointer-events-none z-10" />
        </div>

        {/* Content Wrapper trên Desktop */}
        <div className="relative z-10 w-full min-h-[520px] lg:min-h-[580px] flex flex-col justify-between p-6 md:p-8 lg:p-10 pb-6">
          {/* HÀNG TRÊN: Khung thẻ bên trái + Cột số bên phải */}
          <div className="flex items-start justify-between gap-6 w-full">
            {/* THẺ NỔI MÀU NGÀ BÊN TRÁI */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="w-full max-w-[380px] lg:max-w-[440px] relative"
            >
              <div className="bg-ivory p-5 lg:p-6 shadow-[0_12px_36px_rgba(34,84,76,0.35)] relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTab.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  >
                    {currentTab.subTitle && (
                      <h3 className="text-sm text-forest-700 mb-1 font-sans">
                        {currentTab.subTitle}
                      </h3>
                    )}

                    <h4 className="text-2xl lg:text-2xl text-forest-950 leading-snug font-serif tracking-tight mb-2">
                      {language === 'en' ? currentTab.titleEn : currentTab.title}
                    </h4>

                    <p className="text-xs sm:text-[13px] text-forest-950/80 leading-relaxed font-sans mb-4">
                      {language === 'en' ? currentTab.descriptionEn : currentTab.description}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Hotline & Liên hệ trực tiếp */}
                <div className="pt-3 border-t border-forest-950/10 flex items-center justify-between gap-2">
                  <a
                    href="tel:02862915024"
                    className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-800 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'Wholesale: 028 6291 5024' : 'Hotline sỉ: 028 6291 5024'}</span>
                  </a>

                  <Link
                    href="/#san-pham"
                    className="inline-flex items-center gap-1 text-sm text-forest-950 hover:text-forest-700 transition-colors"
                  >
                    <span>{language === 'en' ? 'Explore products' : 'Xem sản phẩm'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* Răng cưa viền đáy */}
                <div className="absolute -bottom-[9px] left-0 right-0 h-[10px] overflow-hidden leading-none pointer-events-none">
                  <svg
                    viewBox="0 0 1200 24"
                    className="w-full h-[10px] fill-ivory"
                    preserveAspectRatio="none"
                  >
                    <path d="M0,0 L15,24 L30,0 L45,24 L60,0 L75,24 L90,0 L105,24 L120,0 L135,24 L150,0 L165,24 L180,0 L195,24 L210,0 L225,24 L240,0 L255,24 L270,0 L285,24 L300,0 L315,24 L330,0 L345,24 L360,0 L375,24 L390,0 L405,24 L420,0 L435,24 L450,0 L465,24 L480,0 L495,24 L510,0 L525,24 L540,0 L555,24 L570,0 L585,24 L600,0 L615,24 L630,0 L645,24 L660,0 L675,24 L690,0 L705,24 L720,0 L735,24 L750,0 L765,24 L780,0 L795,24 L810,0 L825,24 L840,0 L855,24 L870,0 L885,24 L900,0 L915,24 L930,0 L945,24 L960,0 L975,24 L990,0 L1005,24 L1020,0 L1035,24 L1050,0 L1065,24 L1080,0 L1095,24 L1110,0 L1125,24 L1140,0 L1155,24 L1170,0 L1185,24 L1200,0 Z" />
                  </svg>
                </div>
              </div>
            </motion.div>

            {/* CỘT SỐ DỌC BÊN PHẢI (01, 02, 03) */}
            <motion.nav
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
              className="flex justify-end mt-2 lg:mt-4"
            >
              <ul className="flex flex-col items-center gap-5">
                {warehouseTabs.map((tab, index) => {
                  const isActive = activeIndex === index;
                  return (
                    <li
                      key={tab.id}
                      onClick={() => handleTabClick(index)}
                      onMouseEnter={() => handleTabHover(index)}
                      className="cursor-pointer group py-0.5"
                    >
                      <div className="flex items-center gap-4 transition-all duration-300">
                        <span
                          className={cn(
                            'text-3xl lg:text-4xl font-serif transition-all duration-300 drop-shadow-[0_2px_8px_rgba(34,84,76,0.8)]',
                            isActive
                              ? 'text-white scale-110'
                              : 'text-white/40 group-hover:text-white/80'
                          )}
                        >
                          {tab.num}
                        </span>

                        <span
                          className={cn(
                            'h-[1px] transition-all duration-300',
                            isActive
                              ? 'w-14 bg-white drop-shadow-[0_0_6px_white]'
                              : 'w-7 bg-white/30 group-hover:bg-white/60'
                          )}
                        />

                        <span
                          className={cn(
                            'w-3 h-3 rounded-full border transition-all duration-300 flex items-center justify-center',
                            isActive
                              ? 'border-white bg-white/20'
                              : 'border-white/30 group-hover:border-white/60'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full transition-all',
                              isActive ? 'bg-white' : 'bg-transparent'
                            )}
                          />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.nav>
          </div>

          {/* HÀNG DƯỚI: TIÊU ĐỀ LỚN CHẠY DỌC ĐÁY */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            className="w-full pt-4 pb-0.5"
          >
            <h2
              className="text-2xl md:text-3xl lg:text-4xl uppercase tracking-tight font-serif text-left leading-tight"
              style={{
                color: '#FFFFFF',
                textShadow: '0 2px 12px rgba(34,84,76,0.95), 0 4px 28px rgba(34,84,76,0.9), 0 1px 4px rgba(34,84,76,1)',
              }}
            >
              {language === 'en' ? 'WHY CHOOSE THAI SON FOODS?' : 'VÌ SAO THÁI SƠN FOODS ĐƯỢC TIN CHỌN?'}
            </h2>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
