'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import BrandBadge from './BrandBadge';
import { useLanguage } from '@/context/LanguageContext';
import { brandSlides as defaultBrandSlides } from '@/data/brand-showcase';
import { BrandSlide } from '@/types';

export default function BrandShowcase() {
  const { language } = useLanguage();
  const [slides, setSlides] = useState<BrandSlide[]>(defaultBrandSlides);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    fetch('/api/brand-slides')
      .then((res) => res.json())
      .then((data) => {
        const list = data?.data || data?.slides;
        if (Array.isArray(list)) {
          setSlides(list);
        }
      })
      .catch(() => {});
  }, []);

  if (!slides || slides.length === 0) return null;

  const currentSlide = slides[activeIdx] || slides[0];

  return (
    <section id="ve-chung-toi" className="w-full bg-ivory py-10 lg:py-16">
      {/* 
        Independent wrapper:
        - Avoids global .section-container limits
        - Ensures card reaches exact 1282.438px on desktop without altering other pages
      */}
      <div className="w-full px-4 sm:px-6 lg:px-8 mx-auto flex justify-center">
        {/* 
          Main Card Outer Relative Wrapper:
          - Holds the animated BrandBadge on the top-left corner
          - Allows the badge to overlap the card border naturally without being clipped
        */}
        <div
          className="relative w-full"
          style={{
            maxWidth: '1282.438px',
          }}
        >
          {/* Animated Brand Stamp Badge */}
          <BrandBadge />

          {/* 
            Main Card:
            - Exact dimensions: 1282.438px width x 612.063px height
            - Background: var(--color-ivory)
            - Border radius: 24px
          */}
          <div
            className="relative overflow-hidden bg-ivory rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col lg:flex-row items-stretch w-full lg:min-h-[612.063px]"
          >
            {/* ─── TEXT CONTENT: Nằm trên khi ở mobile, nằm bên trái khi ở desktop ─── */}
            <div
              className="w-full lg:flex-1 flex flex-col justify-between min-w-0 z-10"
              style={{
                padding: 'clamp(28px, 4vw, 56px) clamp(20px, 3.5vw, 52px) clamp(28px, 4vw, 52px) clamp(24px, 4.5vw, 64px)',
              }}
            >
              <div>
                {/* HACCP Certification Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: false, amount: 0.25 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-forest-700/10 border border-forest-700/20 text-forest-700 text-sm sm:text-base mb-3 sm:mb-4"
                >
                  <span>
                    {language === 'en' ? 'International HACCP Certification' : 'Chứng nhận Quốc tế HACCP'}
                  </span>
                </motion.div>

                {/* Title with Left-to-Right Scroll Animation (luôn luôn kích hoạt mỗi lần lướt tới) */}
                <h2
                  className="text-balance overflow-hidden"
                  style={{
                    fontFamily: 'var(--font-fira-sans), sans-serif',
                    fontSize: 'clamp(24px, 3.1vw, 48px)',
                    fontWeight: 400,
                    lineHeight: '1.26',
                    letterSpacing: '-0.02em',
                    color: 'var(--color-forest-950)',
                    marginBottom: 'clamp(16px, 2vw, 28px)',
                    textWrap: 'balance',
                  }}
                >
                  <motion.span
                    initial={{ opacity: 0, x: -80 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.25 }}
                    transition={{
                      duration: 1.5,
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.25,
                    }}
                    className="inline-block"
                  >
                    {language === 'en' ? 'Rooted in true passion' : 'Khởi nguồn với niềm đam mê'}
                  </motion.span>
                  <br />
                  <motion.span
                    initial={{ opacity: 0, x: -100 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.25 }}
                    transition={{
                      duration: 1.6,
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.5,
                    }}
                    className="inline-block"
                  >
                    {language === 'en' ? 'and deep love for Vietnamese flavors' : 'và tình yêu dành cho hương vị Việt'}
                  </motion.span>
                </h2>

                {/* 
                Paragraphs block:
                - Left gold border (var(--color-amber-400))
                - Text justified on both sides (căn đều hai bên mép)
                - Clean line height and gap
              */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.25 }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.85 }}
                  className="text-[14px] sm:text-[15.5px] lg:text-[18px] leading-[1.65] lg:leading-[1.75]"
                  style={{
                    borderLeft: '2.5px solid var(--color-amber-400)',
                    paddingLeft: 'clamp(16px, 2vw, 26px)',
                    textAlign: 'justify',
                    color: 'var(--color-forest-950)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'clamp(12px, 1.4vw, 16px)',
                  }}
                >
                  {language === 'en' ? (
                    <>
                      <p>
                        From cherished traditional recipes, Thai Son brings diverse choices of nutritious plant-based nut milk, herbal cooling refreshments, and trending drinks tailored for every daily need and palate. Thai Son Foods preserves the authentic touch of Vietnamese ingredients while investing deeply in supreme quality and convenience.
                      </p>
                      <p>
                        Guided by our core motto{' '}
                        <strong className="text-forest-950 text-[1.125em]">
                          &ldquo;Wholesome – Natural – Convenient&rdquo;
                        </strong>
                        , Thai Son Foods continuously innovates to offer beverages that enrich every life moment, bringing familiar comforting tastes of home to everyone.
                      </p>
                      <p className="text-forest-700 text-[17px] sm:text-[19px] lg:text-[22px]">
                        Thai Son Foods – A wholesome nutritious meal in every sip.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        Từ những sản phẩm quen thuộc, Thái Sơn mang đến đa dạng lựa chọn với dòng sữa hạt
                        dinh dưỡng, nước mát giải khát và dòng sản phẩm xu hướng, phù hợp với nhiều nhu cầu
                        và khẩu vị. Thái Sơn Foods chú trọng giữ lại nét gần gũi của nguyên liệu Việt, đồng
                        thời đầu tư vào chất lượng và sự tiện lợi trong từng sản phẩm.
                      </p>
                      <p>
                        Với định hướng{' '}
                        <strong className="text-forest-950 text-[1.125em]">
                          &ldquo;Ngon lành – Tự nhiên – Tiện lợi&rdquo;
                        </strong>
                        , Thái Sơn Foods không ngừng phát triển danh mục sản phẩm, mang đến những thức
                        uống phù hợp cho nhiều khoảnh khắc trong cuộc sống và đưa hương vị quen thuộc của
                        quê hương đến mọi người.
                      </p>
                      <p className="text-forest-700 text-[17px] sm:text-[19px] lg:text-[22px]">
                        Thái Sơn Foods – Uống một bữa ăn ngon lành.
                      </p>
                    </>
                  )}
                </motion.div>
              </div>

              {/* Button - Cleanly pinned below */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.25 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 1.1 }}
                style={{ marginTop: 'clamp(20px, 3vw, 36px)' }}
              >
                <Link
                  href="/#san-pham"
                  className="group inline-flex items-center gap-2.5 sm:gap-3 text-forest-950 transition-all hover:brightness-95 active:scale-[0.98] text-base sm:text-lg px-5 py-2.5 sm:px-7 sm:py-3.5 rounded-lg shadow-sm"
                  style={{
                    background: 'var(--color-amber-400)',
                    textDecoration: 'none',
                  }}
                >
                  <span>{language === 'en' ? 'About Us' : 'Về chúng tôi'}</span>
                  <ArrowRight
                    className="transition-transform duration-200 group-hover:translate-x-1 w-4 h-4 sm:w-5 sm:h-5"
                  />
                </Link>
              </motion.div>
            </div>

            {/* ─── IMAGE COLUMN: Nằm ở dưới khi ở mobile, nằm bên phải khi ở desktop ─── */}
            <motion.div
              initial={{ opacity: 0, scale: 1.03 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full lg:w-[489.656px] h-[320px] sm:h-[400px] lg:h-auto lg:self-stretch shrink-0 overflow-hidden"
            >
              <Image
                src={currentSlide.image || '/images/banners/490x740-SGL.jpg'}
                alt={currentSlide.title ? currentSlide.title.replace(/\n/g, ' ') : "Thái Sơn Foods – Hương vị tự nhiên nguyên liệu chọn lọc"}
                fill
                className="object-cover"
                style={{ objectPosition: 'center top' }}
                sizes="(min-width: 1024px) 490px, 100vw"
                priority
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
