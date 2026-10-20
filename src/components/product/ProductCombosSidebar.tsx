'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { combos } from '@/data/combos';
import { Combo } from '@/types';
import { formatPrice, cn, safeFetchJson } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { useLanguage } from '@/context/LanguageContext';
import { ArrowRight, ShoppingBag, Check, Layers, ChevronLeft, ChevronRight } from 'lucide-react';

import SectionTitle from '@/components/ui/SectionTitle';

interface ProductCombosSidebarProps {
  layout?: 'vertical' | 'horizontal';
  title?: string;
  showViewAll?: boolean;
}

export default function ProductCombosSidebar({
  layout = 'vertical',
  title,
  showViewAll = false,
}: ProductCombosSidebarProps) {
  const { language } = useLanguage();
  const { flyToCart } = useFlyToCart();
  const [comboList, setComboList] = useState<Combo[]>(combos);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const maxDiscount = Math.max(...comboList.map((c) => c.discount || 0), 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    let active = true;
    safeFetchJson<{ success: boolean; data: Combo[] }>('/api/combos').then((json) => {
      if (!active || !json?.success) return;
      if (Array.isArray(json.data) && json.data.length > 0) {
        setComboList(json.data.filter((c: Combo) => c.isActive !== false));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const sectionTitle = title === 'Combo tiết kiệm'
    ? (language === 'en' ? 'Value Combos' : 'Combo tiết kiệm')
    : title === 'Combo gợi ý' || title === 'Các combo nổi bật đáng cân nhắc' || !title
    ? (language === 'en' ? 'Featured Combos to Consider' : 'Các combo nổi bật đáng cân nhắc')
    : title;

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    if (layout !== 'horizontal') return;
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(checkScroll, 300);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [layout, checkScroll]);

  const handleScroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollAmount = Math.max(container.clientWidth * 0.65, 320);
    container.scrollBy({
      left: dir === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleQuickAdd = (combo: Combo, e?: React.MouseEvent) => {
    const comboName = (language === 'en' && combo.nameEn) ? combo.nameEn : combo.name;
    const comboUnit = `${combo.totalItems} ${language === 'en' ? 'bottles' : 'chai'}`;

    if (e) {
      const cardEl = (e.currentTarget as HTMLElement).closest('article, div.border') as HTMLElement | null;
      const imgEl = cardEl?.querySelector('img') as HTMLElement | null;

      flyToCart({
        startElement: imgEl || (e.currentTarget as HTMLElement),
        imageSrc: combo.image,
      });
    }

    useCartStore.getState().addItem({
      productId: combo.id,
      name: comboName,
      slug: combo.slug || '#combo',
      price: combo.salePrice,
      unit: comboUnit,
      thumbnail: combo.image,
    });
    setAddedId(combo.id);
    setTimeout(() => setAddedId(null), 2000);
  };

  // ──────────────────────────────────────────────────────
  // Card layout ngang (7 combo 1 hàng trên desktop, chuẩn ProductSection)
  // ──────────────────────────────────────────────────────
  const renderHorizontalCard = (combo: Combo, index: number) => {
    const isCombo01 = combo.id === 'combo-4-chai';
    const isCombo02 = combo.id === 'combo-van-phong';
    const isComboUuDai = combo.id === 'combo-uu-dai' || combo.id === 'combo-5-old';
    const isComboSieuHoi = combo.id === 'combo-sieu-hoi' || combo.id === 'combo-6-old';
    const isCustomizable = isCombo01 || isCombo02 || isComboUuDai || isComboSieuHoi;
    const isJustAdded = addedId === combo.id;

    const customText = language === 'en'
      ? (isCombo01
        ? 'Custom 4'
        : isCombo02
        ? 'Custom 10'
        : isComboUuDai
        ? 'Buy 10+5 Free 2'
        : 'Custom 20-30')
      : (isCombo01
        ? 'Tùy chọn 4 chai'
        : isCombo02
        ? 'Tùy chọn 10 chai'
        : isComboUuDai
        ? 'Mua 10+5 Tặng 2'
        : 'Tùy chọn 20-30 chai');

    const comboTitle = (language === 'en' && combo.nameEn) ? combo.nameEn : combo.name;
    const comboDesc = (language === 'en' && combo.descriptionEn) ? combo.descriptionEn : combo.description;

    return (
      <div
        key={combo.id}
        className={`snap-start max-sm:min-w-0 sm:shrink-0 sm:w-[calc((100%-16px)/3)] md:w-[calc((100%-36px)/4)] lg:w-[calc((100%-72px)/7)] self-stretch flex flex-col ${!showAllMobile && index >= 4 ? 'max-sm:hidden' : ''}`}
      >
        <article className="group h-full flex flex-col bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          {/* Link toàn bộ phần trên thẻ đến trang chi tiết combo */}
          <Link
            href={`/combo/${combo.slug}`}
            className="flex flex-col flex-1 cursor-pointer"
            title={`Xem chi tiết ${combo.name}`}
          >
            {/* Ảnh Combo Thumbnail (aspect 4/3 đồng bộ ProductCard) */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-ivory flex items-center justify-center">
              <Image
                src={combo.image}
                alt={comboTitle}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 34vw, 22vw"
                loading="lazy"
              />

              {/* Badge số chai */}
              <span className="absolute bottom-1 right-1 bg-ink-950/75 backdrop-blur-xs text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded">
                {combo.totalItems} {language === 'en' ? 'chai' : 'chai'}
              </span>

              {/* Badge giảm giá */}
              {combo.discount > 0 && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] sm:text-[10px] bg-sale text-white rounded shadow-xs">
                  -{combo.discount}%
                </span>
              )}
            </div>

            {/* Thông tin Text */}
            <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
              <div>
                <h4
                  title={comboTitle}
                  className="text-sm sm:text-[15px] text-text-dark leading-snug group-hover:text-green-primary transition-colors"
                >
                  {comboTitle}
                </h4>

                <p className="text-[11px] text-text-muted leading-tight mt-0.5" title={comboDesc}>
                  {comboDesc}
                </p>

                {/* Giá bán */}
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-sm sm:text-[15px] text-green-primary">
                    {formatPrice(combo.salePrice)}đ
                  </span>
                  <span className="text-[10px] text-gray-400 line-through">
                    {formatPrice(combo.originalPrice)}đ
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Nút hành động cố định chân thẻ */}
          <div className="p-2 sm:p-2.5 pt-0 mt-auto">
            <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between gap-1">
              {isCustomizable ? (
                <Link
                  href={`/combo/${combo.slug}`}
                  className="w-full py-2.5 px-1.5 rounded-lg bg-emerald-50 hover:bg-green-primary text-emerald-900 hover:text-white text-[11px] sm:text-[12px] flex items-center justify-center gap-1 transition-all active:scale-95 shadow-2xs"
                >
                  <span>{customText}</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleQuickAdd(combo, e)}
                  className={cn(
                    'w-full py-2.5 px-1.5 rounded-lg text-[11px] sm:text-[12px] flex items-center justify-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer',
                    isJustAdded
                      ? 'bg-green-primary text-white'
                      : 'bg-ivory hover:bg-green-primary text-gray-800 hover:text-white border border-gray-200/80 hover:border-green-primary'
                  )}
                >
                  {isJustAdded ? (
                    <>
                      <Check className="w-3 h-3 shrink-0" />
                      <span>{language === 'en' ? 'Added!' : 'Đã thêm!'}</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-3 h-3 text-green-primary group-hover:text-white shrink-0" />
                      <span>{language === 'en' ? 'Add combo' : 'Thêm combo'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </article>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────
  // Card layout dọc (dùng cho sidebar)
  // ──────────────────────────────────────────────────────
  const renderVerticalCard = (combo: Combo, index: number) => {
    const isCombo01 = combo.id === 'combo-4-chai';
    const isCombo02 = combo.id === 'combo-van-phong';
    const isComboUuDai = combo.id === 'combo-uu-dai' || combo.id === 'combo-5-old';
    const isComboSieuHoi = combo.id === 'combo-sieu-hoi' || combo.id === 'combo-6-old';
    const isCustomizable = isCombo01 || isCombo02 || isComboUuDai || isComboSieuHoi;
    const isJustAdded = addedId === combo.id;

    const customText = language === 'en'
      ? (isCombo01
        ? 'Custom 4 bottles'
        : isCombo02
        ? 'Custom 10 bottles'
        : isComboUuDai
        ? 'Buy 10+5 Get 2 Free'
        : 'Custom 20 - 30 bottles')
      : (isCombo01
        ? 'Tùy chọn 4 chai'
        : isCombo02
        ? 'Tùy chọn 10 chai'
        : isComboUuDai
        ? 'Tùy chọn Mua 10+5 Tặng 2'
        : 'Tùy chọn 20 - 30 chai');

    const comboTitle = (language === 'en' && combo.nameEn) ? combo.nameEn : combo.name;
    const comboDesc = (language === 'en' && combo.descriptionEn) ? combo.descriptionEn : combo.description;

    return (
      <div
        key={combo.id}
        className="group bg-white rounded-xl border border-gray-200/90 hover:border-emerald-600/70 p-2.5 transition-all duration-200 hover:shadow-sm flex flex-col justify-between"
      >
        <Link
          href={`/combo/${combo.slug}`}
          className="flex gap-2.5 items-start cursor-pointer w-full group/card"
          title={`Xem chi tiết ${combo.name}`}
        >
          {/* Ảnh Combo Thumbnail */}
          <div className="relative rounded-lg overflow-hidden bg-ivory-dark shrink-0 border border-gray-100 w-16 h-16 sm:w-18 sm:h-18">
            <Image
              src={combo.image}
              alt={comboTitle}
              fill
              className="object-cover group-hover/card:scale-105 transition-transform duration-300"
              sizes="72px"
            />
            {/* Badge số chai */}
            <span className="absolute bottom-1 right-1 bg-ink-950/75 backdrop-blur-xs text-white text-[10px] px-1.5 py-0.2 rounded">
              {combo.totalItems} {language === 'en' ? 'bottles' : 'chai'}
            </span>
          </div>

          {/* Thông tin Text */}
          <div className="min-w-0 flex-1 w-full">
            <h4 className="text-sm text-text-dark leading-snug group-hover/card:text-emerald-800 transition-colors">
              {comboTitle}
            </h4>

            <p className="text-[11px] text-text-muted leading-tight mt-0.5" title={comboDesc}>
              {comboDesc}
            </p>

            {/* Giá bán */}
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-sm sm:text-base text-emerald-800">
                {formatPrice(combo.salePrice)}đ
              </span>
              <span className="text-[10px] text-gray-400 line-through">
                {formatPrice(combo.originalPrice)}đ
              </span>
              <span className="text-[10px] text-sale bg-red-50 px-1 py-0.2 rounded">
                -{combo.discount}%
              </span>
            </div>
          </div>
        </Link>

        {/* Nút hành động */}
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5">
          {isCustomizable ? (
            <Link
              href={`/combo/${combo.slug}`}
              className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-700 text-emerald-900 hover:text-white text-[12px] flex items-center justify-center gap-1 transition-all active:scale-95 shadow-2xs"
            >
              <span>{customText}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={(e) => handleQuickAdd(combo, e)}
              className={cn(
                'w-full py-1.5 px-2.5 rounded-lg text-[12px] flex items-center justify-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer',
                isJustAdded
                  ? 'bg-emerald-700 text-white'
                  : 'bg-ivory hover:bg-emerald-800 text-gray-800 hover:text-white border border-gray-200/80 hover:border-emerald-800'
              )}
            >
              {isJustAdded ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>{language === 'en' ? 'Added to cart!' : 'Đã thêm giỏ!'}</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3 h-3 text-emerald-700 group-hover:text-white" />
                  <span>{language === 'en' ? 'Add combo to cart' : 'Thêm combo vào giỏ'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────
  // LAYOUT NGANG (horizontal) — chuẩn 7 combo 1 hàng, đồng bộ SectionTitle
  // ──────────────────────────────────────────────────────
  if (layout === 'horizontal') {
    return (
      <section className="w-full">
        {/* Tiêu đề đồng bộ chuẩn SectionTitle giống Sản phẩm gợi ý */}
        <SectionTitle
          title={sectionTitle}
          viewAllLink={showViewAll ? '/combo' : undefined}
          viewAllText={language === 'en' ? 'View all' : 'Xem tất cả'}
          className="mb-4 sm:mb-6 md:mb-8"
        />

        {/* Khung slider combo với nút mũi tên lướt */}
        <div className="relative w-full group">
          {/* Mũi tên lướt sang trái */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="absolute -left-2 sm:-left-3.5 md:-left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white shadow-md hover:shadow-xl border border-gray-200/90 flex items-center justify-center text-gray-700 hover:text-white hover:bg-green-primary transition-all duration-200 cursor-pointer active:scale-90"
              aria-label={language === 'en' ? 'Previous combos' : 'Lướt sang trái xem combo trước'}
              title={language === 'en' ? 'Previous combos' : 'Xem combo trước'}
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </button>
          )}

          {/* Danh sách combo cuộn ngang (7 combo 1 hàng trên desktop) */}
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="grid grid-cols-2 gap-2 sm:flex sm:gap-3 lg:gap-3.5 sm:overflow-x-auto scroll-smooth scrollbar-none py-2 px-0.5 sm:snap-x sm:snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {comboList.map((combo, index) => renderHorizontalCard(combo, index))}
          </div>

          {/* Mobile: lưới 2 cột xếp dọc, 4 combo đầu + nút Xem thêm */}
          {comboList.length > 4 && (
            <div className="sm:hidden pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowAllMobile((v) => !v)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-300 bg-white text-sm text-ink-950 hover:bg-gray-50 cursor-pointer"
              >
                {showAllMobile
                  ? (language === 'en' ? 'Show less' : 'Thu gọn')
                  : (language === 'en' ? `Show ${comboList.length - 4} more combos` : `Xem thêm ${comboList.length - 4} combo`)}
              </button>
            </div>
          )}

          {/* Mũi tên lướt sang phải */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="absolute -right-2 sm:-right-3.5 md:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-md hover:shadow-xl border border-gray-200/90 flex items-center justify-center text-gray-700 hover:text-white hover:bg-green-primary transition-all duration-200 cursor-pointer active:scale-90"
              aria-label={language === 'en' ? 'Next combos' : 'Lướt sang phải xem thêm combo'}
              title={language === 'en' ? 'Next combos' : 'Xem thêm combo'}
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </button>
          )}
        </div>
      </section>
    );
  }

  // ──────────────────────────────────────────────────────
  // LAYOUT DỌC (vertical) — sidebar gốc
  // ──────────────────────────────────────────────────────
  return (
    <aside className="w-full bg-ivory border border-amber-200 rounded-2xl p-3.5 sm:p-4 shadow-xs">
      {/* Tiêu đề Khối Combo */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-200">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-800 text-white flex items-center justify-center shadow-xs">
            <Layers className="w-3.5 h-3.5 text-corn" />
          </div>
          <div>
            <h3 className="text-base text-forest-950 font-heading leading-none">
              {language === 'en' ? 'Value Combos' : 'Combo tiết kiệm'}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              {language === 'en' ? 'Multi-bottle bundle savings' : 'Gói nhiều chai giá ưu đãi'}
            </p>
          </div>
        </div>
        <span className="text-[11px] bg-sale/10 text-sale px-2 py-0.5 rounded-full border border-sale/20">
          {language === 'en' ? `Up to ${maxDiscount}% off` : `Giảm đến ${maxDiscount}%`}
        </span>
      </div>

      {/* Danh sách 4 Combo đầy đủ thông tin */}
      <div className="flex flex-col gap-2.5">
        {comboList.map((combo, index) => renderVerticalCard(combo, index))}
      </div>

      {/* Ghi chú chân sidebar */}
      <div className="mt-3 pt-2.5 border-t border-amber-200/70 text-center">
        <Link
          href="/combo"
          className="text-[12px] text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1 hover:underline"
        >
          <span>{language === 'en' ? 'View all combo offers' : 'Xem tất cả ưu đãi Combo'}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </aside>
  );
}
