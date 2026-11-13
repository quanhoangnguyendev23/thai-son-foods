import type { CSSProperties, ReactNode } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bộ hiệu ứng "làm nổi bật" dùng chung toàn web (13/11). 3 mức, dùng đúng chỗ để trang không rối:
 *
 * 1. AttentionPrice — GIÁ NỔI BẬT: mỗi 2,4 giây giá lắc nhẹ qua lại (xoay ±3°, phóng 6%) và nháy màu
 *    forest ↔ crimson 2 lần trong ~1 giây rồi nghỉ. Chỉ dùng cho giá đứng riêng (dải Gói gợi ý, banner tài trợ,
 *    quảng cáo trong Đánh giá, Deal trong ngày). Nhiều giá cạnh nhau thì truyền delayMs lệch nhau để lắc lần lượt.
 * 2. attentionShine — VỆT SÁNG lướt qua nhãn "Tiết kiệm x%" / "Ưu đãi có hạn" mỗi 3,2 giây (nhẹ, không lắc chữ).
 *    Độ trễ lấy theo chuỗi seed → các nhãn trên cùng trang không loé cùng lúc, server và trình duyệt ra cùng giá trị.
 * 3. attentionBeat — NHỊP ĐẬP cho huy hiệu nhỏ ("HOT", "Deal Sốc"): phóng nhẹ 2 nhịp rồi nghỉ, chu kỳ 1,6 giây.
 * 4. attentionCta — NÚT HÀNH ĐỘNG: rê chuột nhấc nhẹ + bóng ấm + vệt sáng + mũi tên trượt; bấm thì nhún; nút chính có
 *    thêm vệt sáng tự lướt mỗi 6 giây (idle). 5. tsf-value-pop — số tiền đổi giá trị trượt lên nhẹ.
 * 6. tsf-success-pop — nảy nhẹ 1 lần khi thao tác thành công. 7. AttentionFlame — ngọn lửa bốc cháy (Deal trong ngày).
 *    Vệt sáng nhãn nền sáng: thêm lớp tsf-shine-gold (vệt amber).
 *
 * Màu: chỉ 2 màu gốc forest / crimson (đổi màu dứt khoát step-end, không sinh màu pha) + vệt sáng trắng trong suốt
 * trên nền nhãn (không đổi màu chữ). Tắt hết khi máy bật "giảm chuyển động". Giá dừng lắc khi rê chuột vào thẻ (.group).
 * CSS khai báo 1 lần: thẻ <style href precedence> được React 19 gom và đưa lên <head>, nhiều chỗ dùng cũng chỉ 1 bản.
 * Phần tử dùng attentionShine phải có position (Tailwind `relative` hoặc `absolute`) để vệt sáng nằm gọn trong nhãn.
 */
const ATTENTION_CSS = `
@keyframes tsf-price-shake {
  0%, 40%, 100% { transform: none; }
  5% { transform: scale(0.96) rotate(-2deg); }
  10%, 20%, 30% { transform: scale(1.06) rotate(3deg); }
  15%, 25% { transform: scale(1.06) rotate(-3deg); }
  35% { transform: scale(1.03) rotate(-1deg); }
}
@keyframes tsf-price-blink {
  0%, 30% { color: var(--color-brand-crimson); }
  15%, 45%, 100% { color: var(--color-brand-forest); }
}
.tsf-attn-price {
  display: inline-block;
  transform-origin: center;
  animation: tsf-price-shake 2.4s ease-in-out infinite, tsf-price-blink 2.4s step-end infinite;
  animation-delay: var(--tsf-attn-delay, 0s);
}
.group:hover .tsf-attn-price { animation: none; }

@keyframes tsf-shine {
  0% { transform: translateX(-120%); }
  35%, 100% { transform: translateX(260%); }
}
.tsf-attn-shine { overflow: hidden; }
.tsf-attn-shine::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 60%;
  pointer-events: none;
  background: linear-gradient(100deg, transparent, var(--tsf-shine-color, color-mix(in srgb, white 60%, transparent)), transparent);
  transform: translateX(-120%);
  animation: tsf-shine 3.2s ease-in-out infinite;
  animation-delay: var(--tsf-attn-delay, 0s);
}
/* Nhãn nền sáng (vd. "Bán chạy nhất" nền vàng nhạt): vệt sáng màu amber thay cho trắng để còn thấy được */
.tsf-shine-gold { --tsf-shine-color: color-mix(in srgb, var(--color-brand-amber) 45%, transparent); }

/* 4. Nút hành động (CTA): rê chuột/chạm → nhấc nhẹ, bóng ấm, vệt sáng lướt 1 lần, mũi tên trượt; bấm → nhún.
      .tsf-cta-idle: thêm vệt sáng tự lướt mỗi 6 giây (nút chính, khó bỏ qua nhưng không ồn).
      .tsf-cta-trigger: đặt ở thẻ cha (cả thẻ là liên kết) để rê chuột vào thẻ cũng kích hoạt nút. */
.tsf-cta {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.28s ease, background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}
.tsf-cta::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 45%;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(100deg, transparent, color-mix(in srgb, white 45%, transparent), transparent);
  transform: translateX(-130%) skewX(-12deg);
}
.tsf-cta:hover, .tsf-cta-trigger:hover .tsf-cta {
  transform: translateY(-2px);
  box-shadow: 0 10px 22px -10px color-mix(in srgb, var(--color-brand-copper) 70%, transparent);
}
.tsf-cta:hover::after, .tsf-cta-trigger:hover .tsf-cta::after { animation: tsf-cta-sheen 0.9s cubic-bezier(0.2, 0.8, 0.2, 1); }
.tsf-cta:active { transform: translateY(0) scale(0.97); transition-duration: 0.08s; }
.tsf-cta-idle::after { animation: tsf-cta-sheen-idle 6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite; animation-delay: var(--tsf-attn-delay, 1.2s); }
.tsf-cta-idle:hover::after, .tsf-cta-trigger:hover .tsf-cta-idle::after { animation: tsf-cta-sheen 0.9s cubic-bezier(0.2, 0.8, 0.2, 1); }
.tsf-cta:disabled { transform: none; box-shadow: none; }
.tsf-cta:disabled::after { display: none; }
.tsf-cta-arrow { transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1); }
.tsf-cta:hover .tsf-cta-arrow, .tsf-cta-trigger:hover .tsf-cta-arrow { transform: translateX(3px); }
@keyframes tsf-cta-sheen { from { transform: translateX(-130%) skewX(-12deg); } to { transform: translateX(330%) skewX(-12deg); } }
@keyframes tsf-cta-sheen-idle {
  0% { transform: translateX(-130%) skewX(-12deg); }
  15%, 100% { transform: translateX(330%) skewX(-12deg); }
}

/* 5. Số tiền đổi giá trị (vd. tổng tiền khi chọn/bỏ món): số mới trượt lên nhẹ. Gắn key={giá trị} để chạy lại mỗi lần đổi */
@keyframes tsf-value-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.tsf-value-pop { display: inline-block; animation: tsf-value-in 0.32s cubic-bezier(0.2, 0.8, 0.2, 1); }

/* 6. Xác nhận thành công (vd. nút vừa thêm vào giỏ): nảy nhẹ 1 lần */
@keyframes tsf-success-pop { 0% { transform: scale(1); } 40% { transform: scale(1.04); } 100% { transform: scale(1); } }
.tsf-success-pop { animation: tsf-success-pop 0.45s cubic-bezier(0.2, 0.8, 0.2, 1); }

/* 7. Ngọn lửa bốc cháy (AttentionFlame): lửa ngoài crimson + lõi amber lay động lệch nhịp, quầng sáng ấm, đốm lửa bay lên */
.tsf-flame { position: relative; display: inline-block; width: 1.25rem; height: 1.25rem; }
.tsf-flame-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0 auto;
  transform-origin: 50% 100%;
}
.tsf-flame-outer { width: 100%; height: 100%; animation: tsf-flame-outer 1.1s ease-in-out infinite alternate; }
.tsf-flame-inner { width: 60%; height: 60%; bottom: 1px; animation: tsf-flame-inner 0.8s ease-in-out infinite alternate; }
.tsf-flame-glow {
  position: absolute;
  left: -35%;
  right: -35%;
  bottom: -25%;
  height: 95%;
  border-radius: 9999px;
  pointer-events: none;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--color-brand-amber) 55%, transparent), transparent);
  animation: tsf-flame-glow 1.6s ease-in-out infinite;
}
.tsf-ember {
  position: absolute;
  bottom: 70%;
  width: 2px;
  height: 2px;
  border-radius: 9999px;
  pointer-events: none;
  background: var(--color-brand-amber);
  opacity: 0;
  animation: tsf-ember 1.8s ease-out infinite;
}
.tsf-ember-1 { left: 22%; animation-delay: 0.1s; --tsf-ember-x: -3px; }
.tsf-ember-2 { left: 48%; animation-delay: 0.7s; --tsf-ember-x: 1px; }
.tsf-ember-3 { left: 70%; animation-delay: 1.3s; --tsf-ember-x: 3px; }
@keyframes tsf-flame-outer {
  0% { transform: scale(1, 1) skewX(0deg); }
  25% { transform: scale(0.96, 1.06) skewX(-2deg); }
  50% { transform: scale(1.02, 0.97) skewX(1.5deg); }
  75% { transform: scale(0.97, 1.08) skewX(2deg); }
  100% { transform: scale(1.01, 0.99) skewX(-1deg); }
}
@keyframes tsf-flame-inner {
  0% { transform: scale(1, 1) translateY(0); }
  33% { transform: scale(0.9, 1.12) translateY(-1px); }
  66% { transform: scale(1.05, 0.92) translateY(0); }
  100% { transform: scale(0.95, 1.08) translateY(-1px); }
}
@keyframes tsf-flame-glow { 0%, 100% { opacity: 0.45; transform: scale(0.9); } 50% { opacity: 0.9; transform: scale(1.05); } }
@keyframes tsf-ember {
  0% { opacity: 0; transform: translate(0, 0) scale(1); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--tsf-ember-x, 0px), -12px) scale(0.4); }
}

@keyframes tsf-beat {
  0%, 50%, 100% { transform: scale(1); }
  12% { transform: scale(1.18); }
  24% { transform: scale(1); }
  36% { transform: scale(1.12); }
}
.tsf-attn-beat { display: inline-block; animation: tsf-beat 1.6s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .tsf-attn-price, .tsf-attn-shine::after, .tsf-attn-beat { animation: none; }
  .tsf-cta, .tsf-cta-arrow { transition: none; }
  .tsf-cta:hover, .tsf-cta-trigger:hover .tsf-cta, .tsf-cta:active { transform: none; }
  .tsf-cta::after, .tsf-cta:hover::after, .tsf-cta-trigger:hover .tsf-cta::after { animation: none; display: none; }
  .tsf-cta:hover .tsf-cta-arrow, .tsf-cta-trigger:hover .tsf-cta-arrow { transform: none; }
  .tsf-value-pop, .tsf-success-pop, .tsf-flame-layer, .tsf-flame-glow { animation: none; }
  .tsf-ember { display: none; }
}
`;

/** Khai báo CSS của bộ hiệu ứng (React gộp các bản trùng href thành 1). Đặt ở component nào dùng lớp tsf-attn-*. */
export function AttentionStyles() {
  return (
    <style href="tsf-attention-effects" precedence="medium">
      {ATTENTION_CSS}
    </style>
  );
}

/** Độ trễ cố định theo chuỗi (0–2,8 giây, bước 0,4 giây): mỗi nhãn loé lúc khác nhau, SSR và trình duyệt trùng nhau */
export function attentionDelayMs(seed: string, steps = 8, stepMs = 400): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % steps) * stepMs;
}

function delayStyle(delayMs: number): CSSProperties | undefined {
  return delayMs > 0 ? ({ ['--tsf-attn-delay' as string]: `${delayMs}ms` } as CSSProperties) : undefined;
}

/** Thuộc tính cho nhãn có vệt sáng: gộp vào className/style của nhãn (nhãn cần `relative` hoặc `absolute`) */
export function attentionShine(seed: string): { className: string; style?: CSSProperties } {
  return { className: 'tsf-attn-shine', style: delayStyle(attentionDelayMs(seed)) };
}

/** Lớp nhịp đập cho huy hiệu nhỏ */
export const attentionBeat = 'tsf-attn-beat';

/** Lớp cho nút hành động: idle = thêm vệt sáng tự lướt mỗi 6 giây (chỉ dùng cho nút chính) */
export function attentionCta(idle = false): string {
  return idle ? 'tsf-cta tsf-cta-idle' : 'tsf-cta';
}
/** Độ trễ vệt sáng tự lướt của nút (để 2 nút cạnh nhau không loé cùng lúc) */
export function attentionCtaDelay(delayMs: number): CSSProperties {
  return { ['--tsf-attn-delay' as string]: `${delayMs}ms` } as CSSProperties;
}

/** Ngọn lửa bốc cháy (thay icon Flame tĩnh): 2 lớp lửa lay động + quầng sáng + 3 đốm lửa bay lên. Kích thước 20px */
export function AttentionFlame({ className }: { className?: string }) {
  return (
    <>
      <AttentionStyles />
      <span className={cn('tsf-flame shrink-0', className)} aria-hidden>
        <span className="tsf-flame-glow" />
        <Flame className="tsf-flame-layer tsf-flame-outer fill-brand-crimson text-brand-crimson" />
        <Flame className="tsf-flame-layer tsf-flame-inner fill-brand-amber text-brand-amber" />
        <span className="tsf-ember tsf-ember-1" />
        <span className="tsf-ember tsf-ember-2" />
        <span className="tsf-ember tsf-ember-3" />
      </span>
    </>
  );
}

/** Giá nổi bật: lắc nhẹ + nháy màu. Không truyền màu chữ khác forest (hiệu ứng tự đặt màu forest/crimson). */
export function AttentionPrice({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <>
      <AttentionStyles />
      <span className={cn('tsf-attn-price', className)} style={delayStyle(delayMs)}>
        {children}
      </span>
    </>
  );
}
