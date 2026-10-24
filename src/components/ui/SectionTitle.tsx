'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export interface SectionTitleProps {
  title: string;
  subtitle?: string;
  badge?: string;
  variant?: 'default' | 'combo';
  highlightWord?: string;
  viewAllLink?: string;
  viewAllText?: string;
  className?: string;
}

/**
 * Tách và gắn organic blob highlight mềm mại phía sau từ khóa (VD: 'Sản phẩm', 'tiết kiệm')
 * Tạo cảm giác tự nhiên, mộc mạc và liên quan đến thức uống thiên nhiên
 */
function renderTitleWithHighlight(
  title: string,
  variant: 'default' | 'combo',
  customHighlight?: string
) {
  let target = customHighlight;
  if (!target) {
    if (variant === 'combo' || title.toLowerCase().includes('tiết kiệm') || title.toLowerCase().includes('combos')) {
      target = title.includes('tiết kiệm') ? 'tiết kiệm' : (title.includes('Combos') ? 'Combos' : undefined);
    } else if (title.includes('Sản phẩm')) {
      target = 'Sản phẩm';
    } else if (title.includes('Products')) {
      target = 'Products';
    }
  }

  if (!target || !title.includes(target)) {
    return <span>{title}</span>;
  }

  const parts = title.split(target);
  const blobColor =
    variant === 'combo'
      ? 'bg-amber-300/35 rounded-[52%_48%_60%_40%/48%_55%_45%_52%]'
      : 'bg-emerald-400/20 rounded-[45%_55%_63%_37%/48%_42%_58%_52%]';

  return (
    <span>
      {parts[0]}
      <span className="relative inline-block">
        <span className="relative z-10">{target}</span>
        {/* Organic Blob mềm mại phía sau chữ, opacity thấp */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute -inset-x-1.5 -inset-y-0.5 -rotate-1 pointer-events-none -z-0 transition-transform duration-300 ',
            blobColor
          )}
        />
      </span>
      {parts.slice(1).join(target)}
    </span>
  );
}

export default function SectionTitle({
  title,
  subtitle,
  badge,
  variant = 'default',
  highlightWord,
  viewAllLink,
  viewAllText = 'Xem tất cả',
  className,
}: SectionTitleProps) {
  const isCombo = variant === 'combo';

  return (
    <div
      className={cn(
        'group flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-left items-start mb-6 sm:mb-7 md:mb-8 select-none',
        className
      )}
    >
      <div className="flex flex-col items-start text-left">
        {/* Badge nhỏ tinh tế phía trên tiêu đề (dành riêng cho Combo hoặc khuyến mãi) */}
        {badge && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mb-1.5"
          >
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] sm:text-sm shadow-2xs transition-transform duration-200 ',
                isCombo
                  ? 'bg-amber-50 text-amber-900 border border-amber-200/90'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200/80'
              )}
            >
              <span>{badge}</span>
            </span>
          </motion.div>
        )}

        {/* Khối Heading chính với Animation vào Viewport */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative inline-flex flex-col items-start"
        >
          <div className="flex items-center flex-wrap">
            <h2 className="text-[27px] sm:text-[33px] md:text-[36px] lg:text-[40px] text-forest-900 font-heading tracking-tight leading-[1.15] text-left">
              {renderTitleWithHighlight(title, variant, highlightWord)}
            </h2>

          </div>

          {/* Nét cong mềm mại (Curved Organic Brush Accent) dưới chân heading */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: 0.55,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ transformOrigin: 'left' }}
            className="w-28 sm:w-36 md:w-44 mt-1 sm:mt-1.5 transition-transform duration-300 "
            aria-hidden="true"
          >
            {isCombo ? (
              <svg
                className="w-full h-2.5 sm:h-3 overflow-visible"
                viewBox="0 0 160 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 7C35 2.5 85 1.5 158 5.5"
                  stroke="var(--color-amber-600)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeOpacity="0.85"
                />
                <path
                  d="M20 8.5C65 4.5 115 4 145 6.5"
                  stroke="var(--color-amber-500)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeOpacity="0.6"
                />
              </svg>
            ) : (
              <svg
                className="w-full h-2.5 sm:h-3 overflow-visible"
                viewBox="0 0 160 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 7.5C40 2.5 90 2 158 6"
                  stroke="var(--color-emerald-600)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeOpacity="0.75"
                />
                <path
                  d="M15 8.5C55 5 105 4.5 140 7"
                  stroke="var(--color-emerald-300)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeOpacity="0.6"
                />
              </svg>
            )}
          </motion.div>
        </motion.div>

        {/* Subtitle nếu có */}
        {subtitle && (
          <p className="mt-2 text-xs sm:text-sm text-gray-500 font-normal max-w-xl text-left leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Nút Xem tất cả (nếu được truyền link) */}
      {viewAllLink && (
        <Link
          href={viewAllLink}
          className="group/link flex items-center gap-1.5 text-sm sm:text-base text-emerald-800 hover:text-emerald-950 transition-colors whitespace-nowrap pt-1 pb-1 shrink-0 cursor-pointer self-start sm:self-end"
        >
          <span>{viewAllText}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/link:translate-x-1 text-emerald-700" />
        </Link>
      )}
    </div>
  );
}
