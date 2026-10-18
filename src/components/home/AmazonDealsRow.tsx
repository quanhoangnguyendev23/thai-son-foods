'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { Combo } from '@/types';
import { formatPrice } from '@/lib/utils';
import { MISSING_PRODUCT_IMAGE } from '@/lib/product-detail';
import { useLanguage } from '@/context/LanguageContext';
import { PlaceholderBadge } from '@/components/product/ProductPlaceholderBlocks';
import { DEAL_COUNTDOWN_PLACEHOLDER } from '@/data/homepage-placeholders';

function msUntilPlaceholderEnd(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(DEAL_COUNTDOWN_PLACEHOLDER.endHour, DEAL_COUNTDOWN_PLACEHOLDER.endMinute, DEAL_COUNTDOWN_PLACEHOLDER.endSecond, 999);
  return Math.max(0, end.getTime() - now.getTime());
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Đồng hồ minh hoạ — chỉ chạy phía trình duyệt để tránh lệch giờ SSR/hydration */
function PlaceholderCountdown() {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setMs(msUntilPlaceholderEnd());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const total = Math.floor((ms ?? 0) / 1000);
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[15px] text-text-dark" aria-label="Đồng hồ đếm ngược minh hoạ">
      <Clock className="w-4 h-4 text-sale" />
      {ms === null ? '--:--:--' : parts.map(pad).join(':')}
    </span>
  );
}

function DealTile({ combo }: { combo: Combo }) {
  const { language } = useLanguage();
  const [src, setSrc] = useState(combo.image || MISSING_PRODUCT_IMAGE);
  const name = (language === 'en' && combo.nameEn ? combo.nameEn : combo.name).split(',')[0].trim();

  return (
    <Link
      href={`/combo/${combo.slug}`}
      className="group snap-start shrink-0 w-[46%] sm:w-[31%] md:w-[23.5%] lg:w-[15.8%] flex flex-col"
    >
      <div className="relative aspect-square rounded-xl bg-ivory overflow-hidden border border-border">
        <Image
          src={src}
          alt={name}
          fill
          sizes="(max-width: 640px) 45vw, 220px"
          className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
          onError={() => setSrc(MISSING_PRODUCT_IMAGE)}
        />
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {combo.discount > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-sale text-white text-[12px]">-{combo.discount}%</span>
        )}
        <span className="text-[12px] text-sale">{language === 'en' ? 'Combo deal' : 'Ưu đãi combo'}</span>
      </div>
      <p className="mt-1 text-[15px] text-green-primary">
        {formatPrice(combo.salePrice)}đ
        {combo.originalPrice > combo.salePrice && (
          <span className="ml-1.5 text-[11px] font-normal text-text-muted line-through">{formatPrice(combo.originalPrice)}đ</span>
        )}
      </p>
      <p className="text-[12px] text-text-body leading-tight line-clamp-2 group-hover:text-green-primary" title={name}>
        {name}
      </p>
    </Link>
  );
}

/**
 * "Deal trong ngày" theo bố cục Amazon.
 * - Combo, giá bán, giá gốc, % giảm: DỮ LIỆU THẬT (bảng combos).
 * - Đồng hồ đếm ngược: PLACEHOLDER (website chưa có nghiệp vụ flash sale có thời hạn).
 */
export default function AmazonDealsRow({ combos }: { combos: Combo[] }) {
  const { language } = useLanguage();
  const deals = [...combos]
    .filter((c) => c.isActive !== false && c.discount > 0)
    .sort((a, b) => b.discount - a.discount)
    .slice(0, DEAL_COUNTDOWN_PLACEHOLDER.comboCount);

  if (deals.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-border shadow-xs px-4 sm:px-6 py-5" aria-label="Deal trong ngày">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <h2 className="font-heading text-xl md:text-2xl text-text-dark">
          {language === 'en' ? "Today's deals" : DEAL_COUNTDOWN_PLACEHOLDER.title}
        </h2>
        <PlaceholderCountdown />
        <PlaceholderBadge />
        <span className="text-[11px] text-text-muted">{DEAL_COUNTDOWN_PLACEHOLDER.note}</span>
        <Link href="/#combo" className="relative before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] ml-auto text-[15px] text-green-primary hover:underline">
          {language === 'en' ? 'See all deals' : 'Xem tất cả ưu đãi'}
        </Link>
      </div>
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {deals.map((c) => (
          <DealTile key={c.id} combo={c} />
        ))}
      </div>
    </section>
  );
}
