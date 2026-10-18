'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';

export default function BrandBadge() {
  const { language } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Animation variants
  // 1. Hover rotation speeds: standard ~26s, hover ~8s per revolution
  const rotationDuration = isHovered ? 8 : 26;

  return (
    <motion.div
      // 1. Entrance on scroll: scale 0.6 to 1 with spring, fade in (runs once)
      initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        type: 'spring',
        stiffness: 240,
        damping: 18,
        duration: 0.7,
      }}
      className="absolute -top-[30px] -left-[10px] sm:-top-[46px] sm:-left-[24px] lg:-top-[50px] lg:-left-[32px] z-20 pointer-events-auto select-none"
      style={{ willChange: 'transform' }}
    >
      <motion.div
        // 4. Floating / levitation: translateY ±4px, 4s, ease-in-out, infinite
        animate={
          shouldReduceMotion
            ? { y: 0 }
            : {
              y: [-4, 4, -4],
              transition: {
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }
        }
        // 5. Hover: scale 1.06, 300ms transition
        whileHover={
          shouldReduceMotion
            ? {}
            : {
              scale: 1.06,
              transition: { duration: 0.3, ease: 'easeOut' },
            }
        }
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative w-[56px] h-[56px] sm:w-[72px] sm:h-[72px] lg:w-[100px] lg:h-[100px] cursor-pointer"
      >
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full drop-shadow-[0_4px_14px_rgba(34,84,76,0.14)]"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Circular Path for Text (Radius 43px, Circumference ≈ 270px) */}
            <path
              id="brandBadgeTextPath"
              d="M 60,60 m -43,0 a 43,43 0 1,1 86,0 a 43,43 0 1,1 -86,0"
              fill="none"
            />
            {/* Subtle inner shadow gradient for tactile seal effect */}
            <radialGradient id="badgeBgGradient" cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="85%" stopColor="#FFFDF8" />
              <stop offset="100%" stopColor="var(--color-ivory-dark)" />
            </radialGradient>
          </defs>

          {/* ─── 1. Badge Base (Warm Cream, Subtle Green Border) ─── */}
          <circle
            cx="60"
            cy="60"
            r="57"
            fill="url(#badgeBgGradient)"
            stroke="var(--color-forest-700)"
            strokeWidth="1.2"
            strokeOpacity="0.35"
          />

          {/* ─── 2. Delicate Drawn Outer Ring (PathLength Entrance) ─── */}
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--color-forest-700)"
            strokeWidth="1"
            strokeDasharray="3 3"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 0.7 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />

          {/* ─── 3. Inner Ring Frame ─── */}
          <circle
            cx="60"
            cy="60"
            r="32"
            fill="none"
            stroke="var(--color-forest-700)"
            strokeWidth="0.8"
            strokeOpacity="0.25"
          />

          {/* ─── 4. Rotating Outer Text Ring ─── */}
          <motion.g
            animate={
              shouldReduceMotion
                ? { rotate: 0 }
                : {
                  rotate: 360,
                  transition: {
                    duration: rotationDuration,
                    repeat: Infinity,
                    ease: 'linear',
                  },
                }
            }
            style={{ transformOrigin: '60px 60px' }}
          >
            <text
              fill="var(--color-forest-700)"
              fontSize="7.6"
              fontWeight="700"
              letterSpacing="0.09em"
              style={{
                fontFamily: "'Inter', sans-serif",
                textTransform: 'uppercase',
              }}
            >
              <textPath
                href="#brandBadgeTextPath"
                startOffset="0%"
                textLength="262"
                lengthAdjust="spacing"
              >
                {language === 'en' ? (
                  <>THAI SON FOODS<tspan fill="var(--color-amber-600)" fontSize="9" fontWeight="900"> • </tspan>NATURAL BEVERAGES<tspan fill="var(--color-amber-600)" fontSize="9" fontWeight="900"> • </tspan></>
                ) : (
                  <>THÁI SƠN FOODS<tspan fill="var(--color-amber-600)" fontSize="9" fontWeight="900"> • </tspan>THỨC UỐNG TỰ NHIÊN<tspan fill="var(--color-amber-600)" fontSize="9" fontWeight="900"> • </tspan></>
                )}
              </textPath>
            </text>
          </motion.g>

          {/* ─── 5. Center TS Monogram (Static, Never Rotates) ─── */}
          <g>
            {/* Monogram Box: Rounded green-primary rectangle */}
            <rect
              x="44"
              y="44"
              width="32"
              height="32"
              rx="9"
              fill="var(--color-forest-700)"
              className="drop-shadow-xs"
            />
            {/* Inner subtle border line */}
            <rect
              x="45.5"
              y="45.5"
              width="29"
              height="29"
              rx="7.5"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.6"
              strokeOpacity="0.3"
            />
            {/* Monogram "TS" Typography */}
            <text
              x="60"
              y="65.5"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="15"
              fontWeight="bold"
              style={{
                fontFamily: "'Queens Condensed', 'Playfair Display', Georgia, serif",
                letterSpacing: '-0.02em',
              }}
            >
              TSF
            </text>
          </g>

          {/* ─── 6. Accent Mint / Tea Leaf (Sways gently at the rim) ─── */}
          <motion.g
            animate={
              shouldReduceMotion
                ? { rotate: 0 }
                : {
                  rotate: [-6, 6, -6],
                  transition: {
                    duration: 3.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
            }
            style={{
              transformOrigin: '106px 20px',
            }}
          >
            {/* Tea leaf / clover motif with stem */}
            <g transform="translate(98, 12) rotate(22) scale(0.85)">
              {/* Leaf body */}
              <path
                d="M 0,16 C 0,7 8,0 16,0 C 16,9 8,16 0,16 Z"
                fill="var(--color-emerald-600)"
                stroke="var(--color-forest-700)"
                strokeWidth="0.8"
              />
              {/* Leaf center vein */}
              <path
                d="M 2,14 Q 8,8 14,2"
                fill="none"
                stroke="var(--color-ivory)"
                strokeWidth="0.7"
                strokeLinecap="round"
                strokeOpacity="0.8"
              />
              {/* Little dew highlight */}
              <circle cx="8" cy="6" r="0.9" fill="#FFFFFF" opacity="0.8" />
            </g>
          </motion.g>
        </svg>
      </motion.div>
    </motion.div>

  );
}
