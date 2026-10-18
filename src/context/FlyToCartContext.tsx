'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface FlyToCartOptions {
  startElement?: HTMLElement | null;
  startRect?: { left: number; top: number; width?: number; height?: number };
  imageSrc: string;
  onComplete?: () => void;
}

interface FlyToCartContextType {
  flyToCart: (options: FlyToCartOptions) => void;
  triggerCartCatch: () => void;
  isSoundEnabled: boolean;
  toggleSound: () => void;
}

const FlyToCartContext = createContext<FlyToCartContextType>({
  flyToCart: () => {},
  triggerCartCatch: () => {},
  isSoundEnabled: true,
  toggleSound: () => {},
});

export const useFlyToCart = () => useContext(FlyToCartContext);

// AudioContext singleton
let globalAudioCtx: AudioContext | null = null;

function playSoundEffect() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!globalAudioCtx || globalAudioCtx.state === 'suspended') {
      globalAudioCtx = new AudioContextClass();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume();
    }

    const now = globalAudioCtx.currentTime;

    // Pleasant high-frequency "plop/drop into basket" sound
    const osc = globalAudioCtx.createOscillator();
    const gain = globalAudioCtx.createGain();

    osc.type = 'sine';
    // Frequency sweeps down rapidly: 720Hz -> 240Hz for a crisp soft drop sensation
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.11);

    // Subtle gentle volume envelope
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(globalAudioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // Non-blocking audio fallback
  }
}

export function FlyToCartProvider({ children }: { children: React.ReactNode }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const isSoundEnabledRef = useRef(true);

  // Load sound setting from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tsf_cart_sound_enabled');
      if (saved !== null) {
        const enabled = saved === 'true';
        setIsSoundEnabled(enabled);
        isSoundEnabledRef.current = enabled;
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      isSoundEnabledRef.current = next;
      try {
        localStorage.setItem('tsf_cart_sound_enabled', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Determine current active cart target (Sticky sidebar on desktop or header cart icon on mobile)
  const getActiveCartTarget = useCallback((): { element: HTMLElement | null; rect: { left: number; top: number; width: number; height: number } } => {
    if (typeof window === 'undefined') {
      return { element: null, rect: { left: 0, top: 0, width: 0, height: 0 } };
    }

    // 1. Check desktop sticky sidebar target
    const stickyTarget = document.getElementById('cart-target-sticky') || document.getElementById('cart-target-sticky-ssr');
    if (stickyTarget) {
      const rect = stickyTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.left < window.innerWidth && rect.right > 0) {
        return { element: stickyTarget, rect };
      }
    }

    // 2. Check floating mini-cart widget target (trang chủ / các trang mua sắm)
    const floatingTarget = document.getElementById('cart-target-floating');
    if (floatingTarget) {
      const rect = floatingTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
        return { element: floatingTarget, rect };
      }
    }

    // 3. Check mobile/header cart target
    const headerTarget = document.getElementById('cart-target-header');
    if (headerTarget) {
      const rect = headerTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.bottom > 0) {
        return { element: headerTarget, rect };
      }
    }

    // 3. Fallback: top right corner of viewport
    return {
      element: null,
      rect: {
        left: Math.max(window.innerWidth - 64, 0),
        top: 18,
        width: 44,
        height: 44,
      },
    };
  }, []);

  // Trigger bounce & ripple effect on the cart icon when item lands
  const triggerCartCatch = useCallback(() => {
    const { element } = getActiveCartTarget();
    if (element) {
      element.classList.remove('animate-cart-catch', 'animate-cart-ripple');
      // Trigger reflow to restart animation reliably
      void element.offsetWidth;
      element.classList.add('animate-cart-catch', 'animate-cart-ripple');

      setTimeout(() => {
        element.classList.remove('animate-cart-catch', 'animate-cart-ripple');
      }, 600);
    }

    // Play pleasant drop sound if enabled
    if (isSoundEnabledRef.current) {
      playSoundEffect();
    }
  }, [getActiveCartTarget]);

  // Main fly-to-cart animation function
  const flyToCart = useCallback(
    ({ startElement, startRect, imageSrc, onComplete }: FlyToCartOptions) => {
      if (typeof window === 'undefined' || !document.body) return;

      // 1. Calculate origin position
      let x0 = window.innerWidth / 2;
      let y0 = window.innerHeight / 2;
      let initialWidth = 72;
      let initialHeight = 72;

      if (startElement) {
        const r = startElement.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          x0 = r.left + r.width / 2;
          y0 = r.top + r.height / 2;
          initialWidth = Math.min(Math.max(r.width, 48), 96);
          initialHeight = Math.min(Math.max(r.height, 48), 96);
        }
      } else if (startRect) {
        x0 = startRect.left + (startRect.width ? startRect.width / 2 : 24);
        y0 = startRect.top + (startRect.height ? startRect.height / 2 : 24);
      }

      // 2. Calculate destination position
      const { rect: endRect } = getActiveCartTarget();
      const x1 = endRect.left + endRect.width / 2;
      const y1 = endRect.top + endRect.height / 2;

      const deltaX = x1 - x0;
      const deltaY = y1 - y0;

      // 3. Create flying clone element
      const flyEl = document.createElement('div');
      flyEl.setAttribute('aria-hidden', 'true');
      flyEl.style.position = 'fixed';
      flyEl.style.zIndex = '999999';
      flyEl.style.pointerEvents = 'none';
      flyEl.style.width = `${initialWidth}px`;
      flyEl.style.height = `${initialHeight}px`;
      flyEl.style.left = `${x0 - initialWidth / 2}px`;
      flyEl.style.top = `${y0 - initialHeight / 2}px`;
      flyEl.style.borderRadius = '16px';
      flyEl.style.overflow = 'hidden';
      flyEl.style.backgroundColor = '#ffffff';
      flyEl.style.border = '2px solid rgba(34,84,76, 0.25)';
      flyEl.style.boxShadow = '0 12px 28px -4px rgba(34,84,76,0.28), 0 6px 14px -3px rgba(34,84,76,0.15)';
      flyEl.style.display = 'flex';
      flyEl.style.alignItems = 'center';
      flyEl.style.justifyContent = 'center';
      flyEl.style.padding = '4px';
      flyEl.style.willChange = 'transform, opacity';

      const img = document.createElement('img');
      img.src = imageSrc;
      img.alt = 'Sản phẩm đang bay';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.pointerEvents = 'none';

      flyEl.appendChild(img);
      document.body.appendChild(flyEl);

      // 4. Parabolic arc mathematics (Quadratic Bézier curve)
      // Control point peak: arc upward to simulate a physical supermarket toss
      const arcHeight = Math.max(90, Math.min(220, Math.abs(deltaX) * 0.28));
      const peakY = Math.min(0, deltaY) - arcHeight;
      const midX = deltaX * 0.45;

      const keyframes: Keyframe[] = [];
      const steps = 24;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;

        // Quadratic Bézier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const curX = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * midX + t * t * deltaX;
        const curY = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * peakY + t * t * deltaY;

        // Scale: starts at 1, remains clear during flight, contracts to 0.22 right as it enters cart
        const scale = 1 - 0.78 * Math.pow(t, 1.35);

        // Rotation: gentle spin during throw (-18deg to +22deg based on direction)
        const dir = deltaX >= 0 ? 1 : -1;
        const rot = dir * Math.sin(t * Math.PI) * 24;

        // Fade out right as it lands (last 12% of duration)
        const opacity = t > 0.88 ? (1 - t) / 0.12 : 1;

        keyframes.push({
          transform: `translate3d(${curX}px, ${curY}px, 0) scale(${scale}) rotate(${rot}deg)`,
          opacity,
        });
      }

      // 5. Execute hardware-accelerated Web Animations API
      const duration = Math.max(520, Math.min(680, 500 + Math.abs(deltaX) * 0.15));
      const animation = flyEl.animate(keyframes, {
        duration,
        easing: 'cubic-bezier(0.22, 0.85, 0.36, 1)',
        fill: 'forwards',
      });

      animation.onfinish = () => {
        try {
          flyEl.remove();
        } catch {
          // Ignore if already detached
        }
        triggerCartCatch();
        onComplete?.();
      };
    },
    [getActiveCartTarget, triggerCartCatch]
  );

  return (
    <FlyToCartContext.Provider
      value={{
        flyToCart,
        triggerCartCatch,
        isSoundEnabled,
        toggleSound,
      }}
    >
      {children}
    </FlyToCartContext.Provider>
  );
}
