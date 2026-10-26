'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Chỉ hiện ở lần truy cập đầu tiên trong phiên trình duyệt
const SEEN_KEY = 'tsf-intro-seen';

// Chạy ngay khi HTML được đọc (trước khi React chạy): đã xem trong phiên này hoặc bật "giảm chuyển động"
// → thêm CSS ẩn lớp phủ, tránh chớp trắng khi tải lại trang. Chỉ chèn <style> vào <head>, không sửa thẻ React.
const SKIP_SCRIPT = `try{if(sessionStorage.getItem('${SEEN_KEY}')||window.matchMedia('(prefers-reduced-motion: reduce)').matches){var s=document.createElement('style');s.textContent='[data-logo-preloader]{display:none!important}';document.head.appendChild(s)}}catch(e){}`;

export default function LogoPreloader() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'drawing' | 'revealed' | 'exiting' | 'done'>('drawing');

  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname === '/2010') return;

    let skip = false;
    try {
      skip =
        Boolean(sessionStorage.getItem(SEEN_KEY)) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // sessionStorage bị chặn (chế độ riêng tư...) → vẫn hiện hiệu ứng ngắn
    }
    if (skip) {
      // Lớp phủ đã bị CSS của SKIP_SCRIPT ẩn ngay từ đầu; gỡ khỏi DOM ở lượt kế tiếp
      const t0 = setTimeout(() => setPhase('done'), 0);
      return () => clearTimeout(t0);
    }

    // Tổng thời gian ~1,2s: chạy nét logo 0,55s → logo màu → mờ dần từ 0,9s → gỡ khỏi DOM ở 1,2s
    const t1 = setTimeout(() => {
      setPhase('revealed'); // Chuyển thành logo hoàn chỉnh đầy đủ màu sắc
    }, 550);

    const t2 = setTimeout(() => {
      setPhase('exiting'); // Bắt đầu làm mờ trang trắng để nhảy vào trang web
    }, 900);

    const t3 = setTimeout(() => {
      setPhase('done');
    }, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pathname.startsWith('/admin') || pathname === '/2010') {
    return null;
  }

  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: SKIP_SCRIPT }} />
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="logo-preloader"
          data-logo-preloader=""
          initial={{ opacity: 1 }}
          animate={{
            opacity: phase === 'exiting' ? 0 : 1,
            scale: phase === 'exiting' ? 1.04 : 1,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer"
          style={{
            pointerEvents: phase === 'exiting' ? 'none' : 'auto',
          }}
          // Chạm/bấm bất kỳ đâu để vào trang ngay
          onClick={() => setPhase('done')}
        >
          {/* Subtle background ambiance glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-100/60 via-amber-50/40 to-transparent blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Logo Container */}
            {/* Không vượt bề ngang màn hình (360–390px) để không cắt chữ "Việt" */}
            <div className="relative w-[min(280px,calc(100vw-48px))] sm:w-[380px] md:w-[460px] aspect-[1000/342]">
              {/* ─── LỚP 1: Nét vẽ Outline Logo đang chạy từ trái sang phải ─── */}
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 1 }}
                animate={{
                  opacity: phase === 'drawing' ? 1 : 0,
                }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                {/* Mask clip-path quét từ trái sang phải */}
                <motion.div
                  className="relative w-full h-full"
                  initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
                  // Mở rộng ra ngoài mép một chút để nét cuối (chữ "t") không bị cắt do làm tròn pixel
                  animate={{ clipPath: 'inset(0% -4% 0% 0%)' }}
                  transition={{
                    duration: 0.5,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                >
                  <Image
                    src="/images/logo-outline.png"
                    alt="Thái Sơn Foods outline"
                    fill
                    sizes="480px"
                    className="object-contain"
                    priority
                  />

                  {/* Vệt sáng dẫn đầu nét vẽ chạy dọc mép */}
                  <motion.div
                    className="absolute top-0 bottom-0 w-[3px] bg-gradient-to-b from-transparent via-forest-700 to-transparent shadow-[0_0_12px_var(--color-forest-700)]"
                    initial={{ left: '0%' }}
                    animate={{ left: '100%' }}
                    transition={{
                      duration: 0.5,
                      ease: [0.25, 1, 0.5, 1],
                    }}
                  />
                </motion.div>
              </motion.div>

              {/* ─── LỚP 2: Logo hoàn chỉnh đầy đủ màu sắc hiện lên sau khi chạy nét ─── */}
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{
                  opacity: phase !== 'drawing' ? 1 : 0,
                  scale: phase !== 'drawing' ? 1 : 0.96,
                }}
                transition={{
                  duration: 0.55,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Image
                  src="/images/logo-clean-1000.png"
                  alt="Thái Sơn Foods - Món ngon quê Việt"
                  fill
                  sizes="480px"
                  className="object-contain drop-shadow-sm"
                  priority
                />
              </motion.div>
            </div>

            {/* ─── Dòng chữ khẩu hiệu thương hiệu xuất hiện nhẹ nhàng phía dưới ─── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: phase !== 'drawing' ? 1 : 0,
                y: phase !== 'drawing' ? 0 : 10,
              }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
              className="mt-4 sm:mt-5 flex items-center gap-3"
            >
              <span className="w-8 sm:w-12 h-[1px] bg-gradient-to-r from-transparent via-forest-700/30 to-transparent inline-block" />
              <span
                className="text-base sm:text-lg md:text-xl italic font-medium tracking-wide text-forest-700"
                style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
              >
                Uống một bữa ăn ngon lành
              </span>
              <span className="w-8 sm:w-12 h-[1px] bg-gradient-to-r from-transparent via-forest-700/30 to-transparent inline-block" />
            </motion.div>
          </div>

          {/* Nút bấm bỏ qua nhanh (dành cho người dùng muốn vào web ngay lập tức) */}
          <button
            onClick={() => setPhase('done')}
            className="absolute bottom-6 text-[11px] sm:text-xs text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest cursor-pointer px-3 py-2.5 rounded-full hover:bg-gray-100"
            aria-label="Bỏ qua hiệu ứng giới thiệu"
          >
            Bỏ qua
          </button>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
