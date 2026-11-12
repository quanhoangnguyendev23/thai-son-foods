'use client';

import { discountPercentSuffix } from '@/lib/discount-label';
import DiscountTag from '@/components/product/DiscountTag';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Flame, ShoppingBag, Check, ChevronRight } from 'lucide-react';
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
 *  Hiển thị 3 ô số Giờ : Phút : Giây nền crimson đặc, số chữ trắng. */
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
  const labels = language === 'en' ? ['Hours', 'Minutes', 'Seconds'] : ['Giờ', 'Phút', 'Giây'];
  const srText =
    ms === null
      ? undefined
      : language === 'en'
        ? `Time left for today's deals: ${parts[0]} hours ${parts[1]} minutes`
        : `Thời gian còn lại của deal trong ngày: ${parts[0]} giờ ${parts[1]} phút`;

  return (
    <div className="flex items-start gap-1.5" role="timer" aria-label={srText}>
      {parts.map((v, i) => (
        <div key={labels[i]} className="flex items-start gap-1.5">
          <div className="flex flex-col items-center">
            <span
              className="min-w-[3rem] px-1.5 py-1 rounded-lg bg-brand-crimson text-white text-2xl font-heading tabular-nums text-center leading-tight"
              aria-hidden
            >
              {ms === null ? '--' : pad(v)}
            </span>
            <span className="mt-1 text-2xs text-white" aria-hidden>
              {labels[i]}
            </span>
          </div>
          {i < 2 && (
            <span className="text-2xl font-heading text-white leading-tight py-1" aria-hidden>
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DealTile({ combo }: { combo: Combo }) {
  const { language } = useLanguage();
  const { flyToCart } = useFlyToCart();
  const [src, setSrc] = useState(combo.image || MISSING_PRODUCT_IMAGE);
  const [added, setAdded] = useState(false);
  const imgWrapRef = useRef<HTMLDivElement>(null);
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

  return (
    <article className="group flex flex-col h-full bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-lg motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1">
      <Link href={href} className="flex flex-col flex-1 min-w-0">
        <div ref={imgWrapRef} className="relative aspect-[4/3] w-full overflow-hidden bg-ivory">
          <Image
            src={src}
            alt={name}
            fill
            sizes="(max-width: 1024px) 46vw, 340px"
            className="object-cover object-top motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
            onError={() => setSrc(MISSING_PRODUCT_IMAGE)}
          />
        </div>
        <div className="p-2.5 sm:p-3 md:p-4 flex flex-col flex-1">
          <h3
            className="text-base text-text-dark leading-snug line-clamp-2 min-h-[2.75em] group-hover:text-brand-emerald transition-colors"
            title={name}
          >
            {name}
          </h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-heading text-brand-forest">{formatPrice(combo.salePrice)}đ</span>
            {combo.originalPrice > combo.salePrice && (
              <span className="text-sm text-text-muted line-through">{formatPrice(combo.originalPrice)}đ</span>
            )}
          </div>
          {/* Nhãn giảm giá nằm dưới giá (kiểu "Save 7%" của Amazon), không đè lên ảnh */}
          {saving > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-brand-crimson">
              <DiscountTag source={combo} size="md" />
              {/* Nhãn đang hiện % thì ghi thêm số tiền; nhãn đã là số tiền thì không lặp lại */}
              {discountPercentSuffix(combo) && (
                <span>{language === 'en' ? `Save ${formatPrice(saving)}đ` : `Tiết kiệm ${formatPrice(saving)}đ`}</span>
              )}
            </p>
          )}
          {perUnit > 0 && (
            <p className="mt-0.5 text-xs text-text-muted">
              {language === 'en'
                ? `${formatPrice(perUnit)}đ/bottle · ${combo.totalItems} bottles`
                : `${formatPrice(perUnit)}đ/chai · ${combo.totalItems} chai`}
            </p>
          )}
        </div>
      </Link>
      <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3 md:px-4 md:pb-4">
        <button
          type="button"
          onClick={handleAdd}
          aria-label={language === 'en' ? `Add ${name} to cart` : `Thêm ${name} vào giỏ`}
          className={`w-full inline-flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-lg text-sm sm:text-base text-white cursor-pointer transition-colors ${
            added ? 'bg-brand-emerald' : 'bg-brand-forest hover:bg-brand-emerald'
          }`}
        >
          {added ? <Check className="w-4 h-4 shrink-0" aria-hidden /> : <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden />}
          {added ? (language === 'en' ? 'Added' : 'Đã thêm') : language === 'en' ? 'Add to cart' : 'Thêm vào giỏ'}
        </button>
      </div>
    </article>
  );
}

/**
 * "Deal trong ngày" — dải nổi bật ngay dưới hero (anchor #deal-trong-ngay cho menu "Deal Sốc" ở header).
 * - Combo, giá bán, giá gốc, % giảm: DỮ LIỆU THẬT (bảng combos).
 * - Bộ deal tự xoay vòng mỗi ngày theo giờ Việt Nam (pickDailyDeals); đồng hồ đếm thật tới lúc đổi deal (0h).
 * - initialDay: số ngày VN do máy chủ tính lúc render → server và trình duyệt chọn cùng bộ deal (không lệch hydration).
 * - Nền forest đặc + chữ trắng; lưới 2 cột (điện thoại/tablet), 4 cột (máy tính); ít hơn 4 deal thì thẻ giữ bề rộng.
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
      className="scroll-mt-[130px] bg-brand-forest rounded-2xl shadow-sm px-3 sm:px-6 lg:px-8 py-5 sm:py-6"
      aria-labelledby="deal-trong-ngay-title"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 mb-4 sm:mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-brand-amber text-white flex items-center justify-center">
            <Flame className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="deal-trong-ngay-title" className="font-heading text-2xl md:text-3xl text-white leading-tight">
              {language === 'en' ? 'Deals of the day' : DEAL_COUNTDOWN_PLACEHOLDER.title}
            </h2>
            <p className="text-sm text-white mt-0.5">
              {language === 'en' ? `Today ${dayLabel}` : `Hôm nay ${dayLabel}`}
            </p>
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 md:ml-auto md:justify-end">
          <DealCountdown onNewDay={setDay} />
          <Link
            href="/#combo"
            className="shrink-0 inline-flex items-center gap-0.5 min-h-[44px] text-base text-white underline-offset-4 hover:underline"
          >
            {language === 'en' ? 'See all combos' : 'Xem tất cả combo'}
            <ChevronRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {deals.map((c) => (
          <DealTile key={c.id} combo={c} />
        ))}
      </div>
    </section>
  );
}
