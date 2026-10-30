'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Check } from 'lucide-react';
import { combos } from '@/data/combos';
import { formatPrice, cn, safeFetchJson } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { useLanguage } from '@/context/LanguageContext';

import { Combo } from '@/types';

interface ComboShowcaseProps {
  combos?: Combo[];
}

export default function ComboShowcase({ combos: initialCombos }: ComboShowcaseProps = {}) {
  const { language } = useLanguage();
  const { flyToCart } = useFlyToCart();
  const router = useRouter();
  const [addedId, setAddedId] = useState<string | null>(null);
  const [comboList, setComboList] = useState<Combo[]>(initialCombos || combos);

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

  // Chia các combo đang hoạt động thành 2 hàng x 6 cột (giống hệt bố cục Sản Phẩm Thái Sơn)
  const activeCombos = comboList.filter((c) => c.isActive);
  const rows = [
    { id: 'combo-row-1', items: activeCombos.slice(0, 6) },
    { id: 'combo-row-2', items: activeCombos.slice(6, 12) },
  ];

  return (
    <section id="combo" className="max-w-[1456px] mx-auto px-4 sm:px-6 py-6 md:py-8">
      {/* Tiêu đề cùng kiểu với các hàng sản phẩm trang chủ (ProductCarousel) */}
      <div className="mb-3">
        <h2 className="text-xl md:text-2xl text-ink-950">{language === 'en' ? 'Value Combos' : 'Combo tiết kiệm'}</h2>
        <p className="text-xs md:text-sm text-gray-600 mt-0.5">
          {language === 'en' ? 'Mix your favourite drinks and save more' : 'Kết hợp nhiều loại thức uống, tiết kiệm hơn mua lẻ'}
        </p>
      </div>

      {/* Lưới 2 hàng x 6 cột chuẩn giao diện trang chủ */}
      <div className="space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6 w-full">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-3.5 lg:gap-4 w-full"
          >
            {row.items.map((combo, cIdx) => {
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
                    delay: cIdx * 0.04,
                  }}
                  className="h-full"
                >
                  <article className="group h-full flex flex-col bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
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
                          className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 34vw, 22vw"
                          loading="lazy"
                        />

                        {/* Huy hiệu giảm giá (Góc trên phải) */}
                        <div className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10 pointer-events-none">
                          <span className="px-1.5 py-0.5 text-[11px] lg:text-[10px] bg-sale text-white rounded shadow-xs">
                            -{combo.discount}%
                          </span>
                        </div>

                        {/* Huy hiệu số lượng chai (Góc dưới trái) */}
                        <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 z-10 pointer-events-none">
                          <span className="px-1.5 py-0.5 text-[11px] lg:text-[10px] bg-emerald-800/90 backdrop-blur-xs text-white rounded shadow-xs w-fit">
                            {combo.totalItems} {language === 'en' ? 'bottles' : 'chai'}
                          </span>
                        </div>
                      </div>

                      {/* Thông tin Combo */}
                      <div className="p-2 sm:p-2.5 md:p-3 pb-1 flex-1 flex flex-col justify-between">
                        <div>
                          <h3
                            title={comboName}
                            className="text-sm sm:text-[15px] text-text-dark mb-1 leading-snug group-hover:text-green-primary transition-colors line-clamp-2"
                          >
                            {shortComboName}
                          </h3>
                          <p
                            className="text-[10px] sm:text-[11px] text-text-muted leading-tight mb-1.5 line-clamp-2"
                            title={comboDesc}
                          >
                            {comboDesc}
                          </p>
                        </div>
                      </div>
                    </Link>

                    {/* Hàng giá bán & Nút hành động */}
                    <div className="px-2 pb-2 sm:px-2.5 sm:pb-2.5 md:px-3 md:pb-3 mt-auto pt-1.5 sm:pt-2 border-t border-gray-100 flex items-center justify-between gap-1">
                      <div className="flex flex-col sm:flex-row sm:items-baseline">
                        <span className="text-sm sm:text-[15px] text-green-primary">
                          {formatPrice(combo.salePrice)}đ
                        </span>
                        <span className="text-[11px] lg:text-[10px] text-gray-400 line-through sm:ml-1">
                          {formatPrice(combo.originalPrice)}đ
                        </span>
                      </div>

                      {/* Nút thêm vào giỏ hàng đồng bộ tất cả 12 combo */}
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
        ))}
      </div>
    </section>
  );
}
