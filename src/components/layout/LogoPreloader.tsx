'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function LogoPreloader() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'drawing' | 'revealed' | 'exiting' | 'done'>('drawing');

  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname === '/2010') return;

    // 1. Giai đoạn 1: Chữ & nét outline viền logo chạy từ trái sang phải (1.4s)
    const t1 = setTimeout(() => {
      setPhase('revealed'); // Chuyển thành logo hoàn chỉnh đầy đủ màu sắc
    }, 1450);

    // 2. Giai đoạn 2: Giữ logo hoàn chỉnh trong 0.9s để người dùng chiêm ngưỡng, sau đó bắt đầu thoát
    const t2 = setTimeout(() => {
      setPhase('exiting'); // Bắt đầu làm mờ trang trắng để nhảy vào trang web
    }, 2450);

    // 3. Giai đoạn 3: Kết thúc animation và gỡ bỏ hoàn toàn khỏi DOM (sau 3.1s)
    const t3 = setTimeout(() => {
      setPhase('done');
    }, 3100);

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
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="logo-preloader"
          initial={{ opacity: 1 }}
          animate={{
            opacity: phase === 'exiting' ? 0 : 1,
            scale: phase === 'exiting' ? 1.04 : 1,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            pointerEvents: phase === 'exiting' ? 'none' : 'auto',
          }}
        >
          {/* Subtle background ambiance glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-100/60 via-amber-50/40 to-transparent blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Logo Container */}
            <div className="relative w-[280px] sm:w-[380px] md:w-[460px] aspect-[1000/342]">
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
                  animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                  transition={{
                    duration: 1.35,
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
                      duration: 1.35,
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
  );
}
