'use client';

import DiscountTag from '@/components/product/DiscountTag';
import { AttentionFlame, AttentionPrice } from '@/components/ui/AttentionEffects';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Check, ChevronRight, Clock } from 'lucide-react';
import { Combo } from '@/types';
import { formatPrice } from '@/lib/utils';
import { MISSING_PRODUCT_IMAGE } from '@/lib/product-detail';
import { useLanguage } from '@/context/LanguageContext';
import { useCartStore } from '@/store/cart';
import { DAY_MS, getDailyDealPool, msUntilNextVnMidnight, pickDailyDeals, vnDayIndex } from '@/lib/daily-deals';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { DEAL_COUNTDOWN_PLACEHOLDER } from '@/data/homepage-placeholders';

// Thuật toán chọn deal theo ngày VN + mốc 0h: dùng chung ở src/lib/daily-deals.ts

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Đồng hồ thật: đếm tới 00:00 giờ Việt Nam, lúc bộ deal đổi. Chỉ chạy phía trình duyệt (tránh lệch hydration).
 *  Bản gọn: một nhãn crimson "Kết thúc sau 09:28:32" (kiểu "Ends in" của Amazon). */
function DealCountdown({ onNewDay }: { onNewDay: (day: number) => void }) {
  const { language } = useLanguage();
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setMs(msUntilNextVnMidnight());
      onNewDay(vnDayIndex());
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [onNewDay]);

  const total = Math.floor((ms ?? 0) / 1000);
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  const srText =
    ms === null
      ? undefined
      : language === 'en'
        ? `Time left for today's deals: ${parts[0]} hours ${parts[1]} minutes`
        : `Thời gian còn lại của deal trong ngày: ${parts[0]} giờ ${parts[1]} phút`;

  return (
    <div className="inline-flex items-center gap-1.5 text-sm text-text-muted leading-none" role="timer" aria-label={srText}>
      <Clock className="w-4 h-4 shrink-0" aria-hidden />
      <span aria-hidden>{language === 'en' ? 'Ends in' : 'Kết thúc sau'}</span>
      {/* Ô số kiểu flash sale: HH : MM : SS */}
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {(ms === null ? ['--', '--', '--'] : parts.map(pad)).map((v, i) => (
          <span key={i} className="inline-flex items-center gap-0.5">
            {i > 0 && <span className="text-brand-crimson">:</span>}
            <span className="min-w-[1.75rem] rounded-md bg-brand-crimson px-1 py-1 text-center font-heading text-sm text-white tabular-nums">
              {v}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

/** index: thứ tự thẻ trong dải → giá lắc lệch nhau 0,6 giây (lần lượt từng thẻ, không lắc cùng lúc) */
function DealTile({ combo, index = 0 }: { combo: Combo; index?: number }) {
  const { language } = useLanguage();
  const { flyToCart } = useFlyToCart();
  const [src, setSrc] = useState(combo.image || MISSING_PRODUCT_IMAGE);
  const [added, setAdded] = useState(false);
  const imgWrapRef = useRef<HTMLAnchorElement>(null);
  const name = (language === 'en' && combo.nameEn ? combo.nameEn : combo.name).split(',')[0].trim();
  const href = `/combo/${combo.slug}`;
  const saving = Math.max(0, combo.originalPrice - combo.salePrice);
  const perUnit = combo.totalItems > 0 ? Math.round(combo.salePrice / combo.totalItems) : 0;

  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(false), 2000);
    return () => window.clearTimeout(t);
  }, [added]);

  // Cùng luồng thêm combo vào giỏ như ComboShowcase: ảnh bay vào giỏ + addItem
  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    const imgEl = imgWrapRef.current?.querySelector('img') as HTMLElement | null;
    flyToCart({ startElement: imgEl || e.currentTarget, imageSrc: src });
    useCartStore.getState().addItem({
      productId: combo.id,
      name: language === 'en' && combo.nameEn ? combo.nameEn : combo.name,
      slug: combo.slug || '#combo',
      price: combo.salePrice,
      unit: language === 'en' ? `${combo.totalItems} bottles` : `${combo.totalItems} chai`,
      thumbnail: combo.image,
    });
    setAdded(true);
  };

  // Thẻ ngang (phương án A, bản 2): ảnh 4:3 tràn mép trái thẻ; bên phải: nhãn "-x% · Ưu đãi có hạn" (kiểu Amazon),
  // tên 2 dòng, hàng giá + nút giỏ amber nằm cùng hàng (không đè chữ)
  return (
    <article className="group flex h-full overflow-hidden rounded-xl border border-gray-200 bg-white motion-safe:transition-shadow hover:shadow-md">
      {/* Khung ảnh đúng tỉ lệ ảnh gói (4:3, xem ImageSizeGuide) + object-contain: hiện trọn ảnh, không cắt, không phóng khi rê chuột */}
      <Link href={href} ref={imgWrapRef} className="relative my-2 ml-2 aspect-[4/3] w-[42%] max-w-48 shrink-0 self-center overflow-hidden rounded-lg bg-ivory" tabIndex={-1} aria-hidden>
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 640px) 36vw, 192px"
          className="object-contain"
          onError={() => setSrc(MISSING_PRODUCT_IMAGE)}
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        {saving > 0 && (
          <span className="flex flex-wrap items-center gap-1.5 text-2xs">
            <DiscountTag source={combo} />
            <span className="text-brand-crimson">{language === 'en' ? 'Limited-time deal' : 'Ưu đãi có hạn'}</span>
          </span>
        )}
        <Link href={href} className="min-w-0">
          <h3
            className="text-sm text-text-dark leading-snug line-clamp-2 group-hover:text-brand-emerald group-hover:underline transition-colors"
            title={name}
          >
            {name}
          </h3>
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <AttentionPrice className="text-xl font-heading leading-tight text-brand-forest" delayMs={index * 600}>
                {formatPrice(combo.salePrice)}đ
              </AttentionPrice>
              {combo.originalPrice > combo.salePrice && (
                <span className="text-xs text-text-muted line-through">{formatPrice(combo.originalPrice)}đ</span>
              )}
            </span>
            {perUnit > 0 && (
              <span className="block truncate text-2xs text-text-muted">
                {language === 'en'
                  ? `${formatPrice(perUnit)}đ/bottle · ${combo.totalItems} bottles`
                  : `${formatPrice(perUnit)}đ/chai · ${combo.totalItems} chai`}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            aria-label={language === 'en' ? `Add ${name} to cart` : `Thêm ${name} vào giỏ`}
            title={added ? (language === 'en' ? 'Added' : 'Đã thêm') : language === 'en' ? 'Add to cart' : 'Thêm vào giỏ'}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm cursor-pointer transition-colors active:scale-95 ${
              added ? 'bg-brand-emerald' : 'bg-brand-amber hover:bg-brand-copper'
            }`}
          >
            {added ? <Check className="w-4 h-4" aria-hidden /> : <ShoppingBag className="w-4 h-4" aria-hidden />}
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * "Deal trong ngày" — dải nổi bật ngay dưới hero (anchor #deal-trong-ngay cho menu "Deal Sốc" ở header).
 * - Combo, giá bán, giá gốc, % giảm: DỮ LIỆU THẬT (bảng combos).
 * - Bộ deal tự xoay vòng mỗi ngày theo giờ Việt Nam (pickDailyDeals); đồng hồ đếm thật tới lúc đổi deal (0h).
 * - initialDay: số ngày VN do máy chủ tính lúc render → server và trình duyệt chọn cùng bộ deal (không lệch hydration).
 * - Bản gọn (phương án A, 13/11): nền trắng viền mảnh, header 1 dòng (tiêu đề + đồng hồ dạng nhãn), thẻ ngang
 *   (ảnh vuông nhỏ trái, tên + giá phải). Điện thoại cuộn ngang; tablet 2 cột; desktop số cột = số deal (tối đa 4).
 */
export default function AmazonDealsRow({ combos, initialDay }: { combos: Combo[]; initialDay?: number }) {
  const { language } = useLanguage();
  const [day, setDay] = useState(() => initialDay ?? vnDayIndex());
  const deals = useMemo(
    () =>
      pickDailyDeals(getDailyDealPool(combos), day).sort((a, b) => b.discount - a.discount),
    [combos, day]
  );
  // Ngày VN hôm nay dạng "10/11" (theo bộ deal đang hiện)
  const dayLabel = new Date(day * DAY_MS).toISOString().slice(5, 10).split('-').reverse().join('/');

  if (deals.length === 0) return null;

  return (
    <section
      id="deal-trong-ngay"
      className="scroll-mt-[130px] bg-white rounded-2xl border border-gray-200 px-3 sm:px-4 py-3"
      aria-labelledby="deal-trong-ngay-title"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* 13/11: ngọn lửa bốc cháy (hiệu ứng chung) thay icon Flame tĩnh, cùng cỡ 20px */}
          <AttentionFlame />
          <h2 id="deal-trong-ngay-title" className="font-heading text-lg sm:text-xl text-ink-950 leading-tight">
            {language === 'en' ? 'Deals of the day' : DEAL_COUNTDOWN_PLACEHOLDER.title}
          </h2>
          <span className="hidden sm:inline text-sm text-text-muted">
            {language === 'en' ? `· Today ${dayLabel}` : `· Hôm nay ${dayLabel}`}
          </span>
        </div>
        <DealCountdown onNewDay={setDay} />
        <Link
          href="/#combo"
          className="ml-auto shrink-0 inline-flex items-center gap-0.5 min-h-[44px] text-sm text-brand-forest underline-offset-4 hover:underline"
        >
          {language === 'en' ? 'See all bundles' : 'Xem tất cả gói'}
          <ChevronRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>
      {/* Số cột theo số deal thật (mỗi ngày DEALS_PER_DAY = 4): không để thẻ lẻ rớt hàng (lưới 3 cột) hay trống 1/3 dải (lưới 6 cột) */}
      {/* Điện thoại: cuộn ngang (mỗi thẻ ~85% bề ngang). Tablet: 2 cột. Desktop: số cột = số deal (tối đa 4) */}
      <div
        className={`flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 ${
          deals.length >= 4 ? 'xl:grid-cols-4' : deals.length === 3 ? 'xl:grid-cols-3' : ''
        }`}
      >
        {deals.map((c, i) => (
          <div key={c.id} className="w-[85%] shrink-0 snap-start sm:w-auto">
            <DealTile combo={c} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}
