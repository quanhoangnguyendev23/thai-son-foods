'use client';

import { discountPercentSuffix } from '@/lib/discount-label';
import DiscountTag from '@/components/product/DiscountTag';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Flame, ShoppingBag, Check, ChevronRight, Clock } from 'lucide-react';
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
    <div
      className="inline-flex items-center gap-1.5 rounded-md bg-brand-crimson px-2 py-1 text-sm text-white leading-none"
      role="timer"
      aria-label={srText}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span aria-hidden>{language === 'en' ? 'Ends in' : 'Kết thúc sau'}</span>
      <span className="tabular-nums font-heading" aria-hidden>
        {ms === null ? '--:--:--' : parts.map(pad).join(':')}
      </span>
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

  // Thẻ gọn (cùng cỡ thẻ combo): ảnh 4:3 nhỏ, tên 2 dòng, giá + nhãn giảm giá dưới giá, nút giỏ nhỏ cạnh giá
  return (
    <article className="group flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-xs hover:shadow-md motion-safe:transition-shadow">
      <Link href={href} className="flex flex-col flex-1 min-w-0">
        <div ref={imgWrapRef} className="relative aspect-[4/3] w-full overflow-hidden bg-ivory">
          <Image
            src={src}
            alt={name}
            fill
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 200px"
            className="object-cover object-top motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
            onError={() => setSrc(MISSING_PRODUCT_IMAGE)}
          />
        </div>
        <div className="px-2 pt-1.5 sm:px-2.5 sm:pt-2 flex flex-col flex-1">
          <h3
            className="text-sm text-text-dark leading-snug line-clamp-2 min-h-[2.5em] group-hover:text-brand-emerald transition-colors"
            title={name}
          >
            {name}
          </h3>
          {/* Nhãn giảm giá nằm dưới tên, ngay trên giá (kiểu Amazon), không đè lên ảnh */}
          {saving > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-2xs text-brand-crimson">
              <DiscountTag source={combo} />
              {/* Nhãn đang hiện % thì ghi thêm số tiền; nhãn đã là số tiền thì không lặp lại */}
              {discountPercentSuffix(combo) && (
                <span>{language === 'en' ? `Save ${formatPrice(saving)}đ` : `Tiết kiệm ${formatPrice(saving)}đ`}</span>
              )}
            </p>
          )}
        </div>
      </Link>
      <div className="px-2 pb-2 sm:px-2.5 sm:pb-2.5 pt-1 flex items-end justify-between gap-1">
        <div className="min-w-0 flex flex-col">
          <span className="flex flex-wrap items-baseline gap-x-1">
            <span className="text-base font-heading text-brand-forest">{formatPrice(combo.salePrice)}đ</span>
            {combo.originalPrice > combo.salePrice && (
              <span className="text-2xs text-text-muted line-through">{formatPrice(combo.originalPrice)}đ</span>
            )}
          </span>
          {perUnit > 0 && (
            <span className="text-2xs text-text-muted">
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
          className={`shrink-0 w-10 h-10 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-lg text-white cursor-pointer transition-colors active:scale-95 ${
            added ? 'bg-brand-emerald' : 'bg-brand-forest hover:bg-brand-emerald'
          }`}
        >
          {added ? <Check className="w-4 h-4" aria-hidden /> : <ShoppingBag className="w-4 h-4" aria-hidden />}
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
 * - Bản gọn: header 1 dòng (tiêu đề + đồng hồ dạng nhãn), lưới thẻ nhỏ cùng cỡ khu combo
 *   (2 cột điện thoại, 3 tablet, 4 laptop, 6 màn rộng); ít deal thì thẻ giữ bề rộng, không kéo giãn.
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
      className="scroll-mt-[130px] bg-brand-forest rounded-2xl shadow-sm px-3 sm:px-5 py-3 sm:py-4"
      aria-labelledby="deal-trong-ngay-title"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 shrink-0 rounded-lg bg-brand-amber text-white flex items-center justify-center">
            <Flame className="w-5 h-5" aria-hidden />
          </span>
          <h2 id="deal-trong-ngay-title" className="font-heading text-lg sm:text-xl text-white leading-tight">
            {language === 'en' ? 'Deals of the day' : DEAL_COUNTDOWN_PLACEHOLDER.title}
          </h2>
          <span className="hidden sm:inline text-sm text-white/80">
            {language === 'en' ? `· Today ${dayLabel}` : `· Hôm nay ${dayLabel}`}
          </span>
        </div>
        <DealCountdown onNewDay={setDay} />
        <Link
          href="/#combo"
          className="ml-auto shrink-0 inline-flex items-center gap-0.5 min-h-[44px] text-sm text-white underline-offset-4 hover:underline"
        >
          {language === 'en' ? 'See all combos' : 'Xem tất cả combo'}
          <ChevronRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
        {deals.map((c) => (
          <DealTile key={c.id} combo={c} />
        ))}
      </div>
    </section>
  );
}
