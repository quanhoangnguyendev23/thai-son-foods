'use client';

import DiscountTag from '@/components/product/DiscountTag';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { combos } from '@/data/combos';
import { formatPrice, cn, safeFetchJson } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTodayDealIds } from '@/lib/daily-deals';

import { Combo } from '@/types';

interface ComboShowcaseProps {
  combos?: Combo[];
}

type ComboSort = 'newest' | 'best' | 'saving';

/** Số combo hiện khi thu gọn: 12 trên tablet/desktop (2 hàng x 6), 6 trên điện thoại (ẩn bớt bằng CSS) */
const COLLAPSED_COUNT = 12;
const COLLAPSED_COUNT_MOBILE = 6;
/** Combo tạo trong vòng N ngày gần đây → nhãn "Mới" */
const NEW_COMBO_DAYS = 14;

/** Thứ tự "mới nhất": theo createdAt giảm dần; thiếu createdAt thì coi vị trí sau trong danh sách (API xếp created_at tăng dần) là mới hơn */
function sortNewest(list: Combo[]): Combo[] {
  return list
    .map((c, i) => ({ c, i, t: c.createdAt ? Date.parse(c.createdAt) : NaN }))
    .sort((a, b) => {
      if (!Number.isNaN(a.t) && !Number.isNaN(b.t) && a.t !== b.t) return b.t - a.t;
      return b.i - a.i;
    })
    .map(({ c }) => c);
}

function savingRatio(c: Combo): number {
  return c.originalPrice > 0 ? (c.originalPrice - c.salePrice) / c.originalPrice : 0;
}

function isNewCombo(c: Combo, now: number): boolean {
  if (!c.createdAt || !now) return false;
  const t = Date.parse(c.createdAt);
  return !Number.isNaN(t) && now - t <= NEW_COMBO_DAYS * 24 * 60 * 60 * 1000;
}

export default function ComboShowcase({ combos: initialCombos }: ComboShowcaseProps = {}) {
  const { language } = useLanguage();
  const { flyToCart } = useFlyToCart();
  const router = useRouter();
  const [addedId, setAddedId] = useState<string | null>(null);
  // Combo thuộc bộ "Deal trong ngày" hôm nay → nhãn "Deal hôm nay" (rỗng trước khi mount)
  const dealIds = useTodayDealIds();
  const [comboList, setComboList] = useState<Combo[]>(initialCombos || combos);
  // Mặc định "Mới nhất" → combo admin vừa thêm luôn nằm đầu khu, không bị đẩy ra sau
  const [sortBy, setSortBy] = useState<ComboSort>('newest');
  const [expanded, setExpanded] = useState(false);
  // Chỉ tính nhãn "Mới" sau khi mount (tránh lệch giờ server/trình duyệt khi hydrate)
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);

  useEffect(() => {
    if (initialCombos) {
      setComboList(initialCombos);
      return;
    }
    let active = true;
    safeFetchJson<{ success: boolean; data: Combo[] }>('/api/combos').then((data) => {
      if (!active || !data) return;
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setComboList(data.data);
      }
    });
    return () => {
      active = false;
    };
  }, [initialCombos]);

  const handleAddToCart = (combo: Combo, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 3 Combo tùy chỉnh bắt buộc phải vào trang chi tiết combo để chọn vị
    const isCustomizable =
      combo.id === 'combo-van-phong' ||
      combo.id === 'combo-uu-dai' ||
      combo.id === 'combo-sieu-hoi' ||
      combo.id === 'combo-4-chai';

    if (isCustomizable) {
      router.push(`/combo/${combo.slug}`);
      return;
    }

    const cardEl = (e.currentTarget as HTMLElement).closest('article') as HTMLElement | null;
    const imgEl = cardEl?.querySelector('img') as HTMLElement | null;

    flyToCart({
      startElement: imgEl || (e.currentTarget as HTMLElement),
      imageSrc: combo.image,
    });

    const comboName = language === 'en' && combo.nameEn ? combo.nameEn : combo.name;
    const unitText = language === 'en' ? `${combo.totalItems} bottles` : `${combo.totalItems} chai`;

    useCartStore.getState().addItem({
      productId: combo.id,
      name: comboName,
      slug: combo.slug || '#combo',
      price: combo.salePrice,
      unit: unitText,
      thumbnail: combo.image,
    });

    setAddedId(combo.id);
    setTimeout(() => setAddedId(null), 2000);
  };

  const activeCombos = useMemo(() => comboList.filter((c) => c.isActive), [comboList]);
  const hasBestSeller = activeCombos.some((c) => c.isBestSeller);

  // Sắp xếp theo tab đang chọn; mọi tab đều lấy "mới nhất" làm thứ tự phụ
  const sortedCombos = useMemo(() => {
    const newest = sortNewest(activeCombos);
    if (sortBy === 'best') {
      return newest
        .map((c, i) => ({ c, i }))
        .sort((a, b) => Number(Boolean(b.c.isBestSeller)) - Number(Boolean(a.c.isBestSeller)) || a.i - b.i)
        .map(({ c }) => c);
    }
    if (sortBy === 'saving') {
      return newest
        .map((c, i) => ({ c, i }))
        .sort((a, b) => savingRatio(b.c) - savingRatio(a.c) || a.i - b.i)
        .map(({ c }) => c);
    }
    return newest;
  }, [activeCombos, sortBy]);

  // Không có combo đang bán → ẩn cả khu, không hiện khung trống
  if (activeCombos.length === 0) return null;

  const total = sortedCombos.length;
  const visibleCombos = expanded ? sortedCombos : sortedCombos.slice(0, COLLAPSED_COUNT);
  // Còn combo bị ẩn (desktop > 12, hoặc điện thoại > 6) → hiện nút "Xem tất cả"; ≤ 12 thì nút chỉ cần trên điện thoại
  const canToggle = total > COLLAPSED_COUNT_MOBILE;
  const toggleOnlyMobile = total <= COLLAPSED_COUNT;

  const tabs: { key: ComboSort; vi: string; en: string }[] = [
    { key: 'newest', vi: 'Mới nhất', en: 'Newest' },
    ...(hasBestSeller ? [{ key: 'best' as const, vi: 'Bán chạy', en: 'Best sellers' }] : []),
    { key: 'saving', vi: 'Tiết kiệm nhất', en: 'Biggest savings' },
  ];

  const handleToggle = () => {
    if (expanded) {
      // Thu gọn → cuộn về đầu khu combo để không bị "lạc" giữa trang
      document.getElementById('combo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setExpanded((v) => !v);
  };

  return (
    <section id="combo" className="max-w-[1456px] mx-auto px-4 sm:px-6 py-6 md:py-8">
      {/* Tiêu đề + số combo + tab sắp xếp */}
      <div className="mb-3 md:mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl text-ink-950">
            {language === 'en' ? 'Value Combos' : 'Combo tiết kiệm'}
            <span className="ml-2 align-middle text-xs md:text-sm text-gray-500">
              ({total} {language === 'en' ? 'combos' : 'combo'})
            </span>
          </h2>
          <p className="text-xs md:text-sm text-gray-600 mt-0.5">
            {language === 'en' ? 'Mix your favourite drinks and save more' : 'Kết hợp nhiều loại thức uống, tiết kiệm hơn mua lẻ'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label={language === 'en' ? 'Sort combos' : 'Sắp xếp combo'}
          className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1"
        >
          {tabs.map((t) => {
            const active = sortBy === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSortBy(t.key)}
                className={cn(
                  'shrink-0 h-9 px-3.5 rounded-full text-xs sm:text-sm border transition-colors cursor-pointer',
                  active
                    ? 'bg-brand-emerald border-brand-emerald text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-brand-emerald hover:text-brand-emerald'
                )}
              >
                {language === 'en' ? t.en : t.vi}
              </button>
            );
          })}
        </div>
      </div>

      {/* Một lưới duy nhất: 2 cột (điện thoại) / 3 cột (tablet) / 6 cột (desktop) */}
      <div className="w-full">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-3.5 lg:gap-4 w-full">
            {visibleCombos.map((combo, cIdx) => {
              const isJustAdded = addedId === combo.id;
              const comboName = language === 'en' && combo.nameEn ? combo.nameEn : combo.name;
              const shortComboName = comboName.includes(',') ? comboName.split(',')[0].trim() : comboName;
              const comboDesc = language === 'en' && combo.descriptionEn ? combo.descriptionEn : combo.description;
              const targetLink = `/combo/${combo.slug}`;

              return (
                <motion.div
                  key={combo.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{
                    duration: 0.4,
                    ease: 'easeOut',
                    delay: (cIdx % 6) * 0.04,
                  }}
                  // Điện thoại khi thu gọn: chỉ hiện 6 combo đầu
                  className={cn('h-full', !expanded && cIdx >= COLLAPSED_COUNT_MOBILE && 'hidden sm:block')}
                >
                  <article className="group h-full flex flex-col bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs transition-all duration-300 hover:shadow-md">
                    {/* Phần trên: Ảnh + Tiêu đề mô tả (Bọc trong thẻ Link điều hướng vào chi tiết combo) */}
                    <Link
                      href={targetLink}
                      className="flex flex-col flex-1 cursor-pointer"
                      title={
                        language === 'en'
                          ? `View details ${comboName}`
                          : `Xem chi tiết ${comboName}`
                      }
                    >
                      {/* Khung ảnh Combo tỉ lệ 4:3 */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden flex items-center justify-center bg-ivory">
                        <Image
                          src={combo.image}
                          alt={comboName}
                          fill
                          className="object-cover object-top transition-transform duration-500"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 34vw, 22vw"
                          loading="lazy"
                        />

                        {/* Nhãn Deal hôm nay / Mới (Góc trên trái) */}
                        {(dealIds.has(combo.id) || isNewCombo(combo, now)) && (
                          <div className="absolute top-1 sm:top-2 left-1 sm:left-2 z-10 pointer-events-none flex flex-col items-start gap-0.5">
                            {dealIds.has(combo.id) && (
                              <span className="px-1.5 py-0.5 text-2xs bg-brand-crimson text-white rounded shadow-xs">
                                {language === 'en' ? "Today's deal" : 'Deal hôm nay'}
                              </span>
                            )}
                            {isNewCombo(combo, now) && (
                              <span className="px-1.5 py-0.5 text-2xs bg-amber-500 text-white rounded shadow-xs">
                                {language === 'en' ? 'New' : 'Mới'}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Nhãn Bán chạy (Góc trên phải); nhãn giảm giá nằm ở khu giá bên dưới */}
                        {combo.isBestSeller && (
                          <div className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10 pointer-events-none">
                            <span className="px-1.5 py-0.5 text-2xs lg:text-2xs bg-brand-emerald text-white rounded shadow-xs">
                              {language === 'en' ? 'Best seller' : 'Bán chạy'}
                            </span>
                          </div>
                        )}

                        {/* Huy hiệu số lượng chai (Góc dưới phải) */}
                        <div className="absolute bottom-1 sm:bottom-2 right-1 sm:right-2 z-10 pointer-events-none">
                          <span className="px-1.5 py-0.5 text-2xs lg:text-2xs bg-emerald-800/90 backdrop-blur-xs text-white rounded shadow-xs w-fit">
                            {combo.totalItems} {language === 'en' ? 'bottles' : 'chai'}
                          </span>
                        </div>
                      </div>

                      {/* Thông tin Combo */}
                      <div className="p-2 sm:p-2.5 md:p-3 pb-1 flex-1 flex flex-col justify-between">
                        <div>
                          <h3
                            title={comboName}
                            className="text-sm sm:text-base text-text-dark mb-1 leading-snug group-hover:text-green-primary transition-colors line-clamp-2"
                          >
                            {shortComboName}
                          </h3>
                          <p
                            className="text-2xs sm:text-2xs text-text-muted leading-tight mb-1.5 line-clamp-2"
                            title={comboDesc}
                          >
                            {comboDesc}
                          </p>
                        </div>
                      </div>
                    </Link>

                    {/* Hàng giá bán & Nút hành động */}
                    <div className="px-2 pb-2 sm:px-2.5 sm:pb-2.5 md:px-3 md:pb-3 mt-auto pt-1.5 sm:pt-2 border-t border-gray-100 flex items-center justify-between gap-1">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm sm:text-base text-green-primary">
                          {formatPrice(combo.salePrice)}đ
                        </span>
                        {/* Giá gốc + nhãn giảm giá nằm dưới giá bán */}
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          {combo.originalPrice > combo.salePrice && (
                            <span className="text-2xs lg:text-2xs text-gray-400 line-through">
                              {formatPrice(combo.originalPrice)}đ
                            </span>
                          )}
                          <DiscountTag source={combo} />
                        </div>
                      </div>

                      {/* Nút thêm vào giỏ hàng */}
                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(combo, e)}
                        className={cn(
                          'shrink-0 w-10 h-10 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs',
                          isJustAdded
                            ? 'bg-brand-forest text-white'
                            : 'bg-brand-emerald hover:bg-brand-forest text-white'
                        )}
                        title={language === 'en' ? 'Add combo to cart' : 'Thêm combo vào giỏ hàng'}
                        aria-label={language === 'en' ? `Add ${comboName} to cart` : `Thêm ${comboName} vào giỏ hàng`}
                      >
                        {isJustAdded ? (
                          <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        ) : (
                          <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        )}
                      </button>
                    </div>
                  </article>
                </motion.div>
              );
            })}
          </div>
      </div>

      {/* Nút xem tất cả / thu gọn — chỉ khi còn combo bị ẩn */}
      {canToggle && (
        <div className={cn('mt-4 md:mt-5 flex justify-center', toggleOnlyMobile && 'sm:hidden')}>
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full border border-brand-emerald text-brand-emerald text-sm hover:bg-brand-emerald hover:text-white transition-colors cursor-pointer"
          >
            {expanded ? (
              <>
                {language === 'en' ? 'Show less' : 'Thu gọn'}
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                {language === 'en' ? `View all ${total} combos` : `Xem tất cả ${total} combo`}
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
