'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import { Product, ProductVariant } from '@/types';
import { products } from '@/data/products';
import { cn, formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart';
import { useLanguage } from '@/context/LanguageContext';
import { getShortProductName, getSimilarProducts, getVariantLabel, sortVariants, getProductImage } from '@/lib/product-detail';

interface ProductBundleSuggestionsProps {
  currentProduct: Product;
  className?: string;
}

interface BundleItem {
  product: Product;
  variant: ProductVariant | undefined;
  price: number;
  isCurrent: boolean;
}

/**
 * Gợi ý mua kèm: sản phẩm hiện tại + 2 sản phẩm cùng danh mục, mỗi món ở quy cách nhỏ nhất.
 * Tổng tiền = tổng giá niêm yết của các món ĐANG ĐƯỢC CHỌN (không có giá combo ưu đãi).
 * Ghi chú: chưa có dữ liệu "thường được mua cùng" thật — danh sách dựa trên danh mục (xem báo cáo GĐ2).
 */
export default function ProductBundleSuggestions({
  currentProduct,
  className = '',
}: ProductBundleSuggestionsProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const addItem = useCartStore((s) => s.addItem);

  const bundleItems: BundleItem[] = useMemo(() => {
    const toItem = (p: Product, isCurrent: boolean): BundleItem => {
      const variant = sortVariants(p.variants)[0];
      return { product: p, variant, price: variant ? variant.price : p.price, isCurrent };
    };
    const companions = getSimilarProducts(currentProduct, products, 2);
    return [toItem(currentProduct, true), ...companions.map((p) => toItem(p, false))];
  }, [currentProduct]);

  // Mặc định chọn tất cả; chỉ lưu các món khách bỏ chọn
  const [deselectedIds, setDeselectedIds] = useState<Record<string, boolean>>({});
  const isItemSelected = (id: string) => !deselectedIds[id];

  const [successCount, setSuccessCount] = useState<number | null>(null);

  const toggleItem = (id: string) => {
    setDeselectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedItems = bundleItems.filter((item) => isItemSelected(item.product.id));
  const selectedCount = selectedItems.length;
  const totalPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);

  const handleAddToCart = () => {
    if (selectedCount === 0) return;

    selectedItems.forEach(({ product, variant, price }) => {
      addItem({
        productId: variant ? `${product.id}-${variant.id}` : product.id,
        name: variant ? `${product.name} (${variant.name})` : product.name,
        slug: product.slug,
        price,
        unit: variant ? variant.name : product.unit,
        thumbnail: product.thumbnail,
        variantId: variant?.id,
        variantName: variant?.name,
      });
    });

    setSuccessCount(selectedCount);
    setTimeout(() => setSuccessCount(null), 2500);
  };

  if (bundleItems.length < 2) return null;

  return (
    <section className={cn('max-w-[1456px] mx-auto px-4 sm:px-6 py-6 md:py-8', className)}>
      <h2 className="text-xl md:text-2xl text-ink-950 mb-1">
        {isEn ? 'Frequently paired' : 'Gợi ý mua kèm'}
      </h2>
      <p className="text-xs md:text-sm text-gray-600 mb-4">
        {isEn
          ? 'Products from the same category. Prices are regular list prices.'
          : 'Các sản phẩm cùng dòng thường dùng kèm. Giá tính theo giá niêm yết, không áp dụng ưu đãi combo.'}
      </p>

      <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
        {/* Danh sách sản phẩm */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-2 min-w-0">
          {bundleItems.map((item, index) => {
            const isSelected = isItemSelected(item.product.id);
            const name = getShortProductName(item.product, language);
            const packLabel = item.variant ? getVariantLabel(item.variant, language) : item.product.unit;
            const checkboxId = `fbt-${item.product.id}`;

            return (
              <React.Fragment key={item.product.id}>
                {index > 0 && (
                  <div className="hidden sm:flex items-center self-center text-gray-400 px-1" aria-hidden>
                    <Plus className="w-5 h-5" />
                  </div>
                )}

                <div
                  className={cn(
                    'flex sm:flex-col gap-3 sm:gap-2 sm:w-[170px] shrink-0 transition-opacity',
                    !isSelected && 'opacity-50'
                  )}
                >
                  <Link
                    href={`/san-pham/${item.product.slug}`}
                    className="relative w-24 sm:w-full aspect-[4/3] shrink-0 rounded-lg border border-gray-200 bg-white overflow-hidden"
                  >
                    <Image
                      src={getProductImage(item.product)}
                      alt={name}
                      fill
                      sizes="(max-width: 640px) 96px, 170px"
                      className="object-contain"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <label htmlFor={checkboxId} className="flex items-start gap-2 cursor-pointer">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(item.product.id)}
                        className="mt-0.5 w-4 h-4 shrink-0 accent-forest-700 cursor-pointer"
                      />
                      <span className="text-[13px] leading-snug text-ink-950 line-clamp-3">
                        {item.isCurrent && (
                          <strong className="text-[1.125em]">{isEn ? 'This item: ' : 'Sản phẩm này: '}</strong>
                        )}
                        {name} ({packLabel})
                      </span>
                    </label>
                    <div className="pl-6 mt-1 text-base text-ink-950">{formatPrice(item.price)}đ</div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Tổng giá & hành động */}
        <div className="lg:w-[260px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 pt-4 lg:pt-0 lg:pl-6">
          <div className="text-sm text-gray-700 mb-2.5">
            {isEn ? 'Total for selected items: ' : `Tổng (${selectedCount} sản phẩm): `}
            <span className="text-xl text-ink-950">{formatPrice(totalPrice)}đ</span>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={selectedCount === 0 || successCount !== null}
            className={cn(
              'w-full h-10 px-5 rounded-full text-base transition-colors border',
              successCount !== null
                ? 'bg-emerald-600 border-emerald-600 text-white cursor-default'
                : 'bg-corn hover:bg-corn-dark border-corn-dark/60 text-ink-950 cursor-pointer',
              'disabled:cursor-not-allowed',
              selectedCount === 0 && 'bg-gray-200 border-gray-300 text-gray-500 hover:bg-gray-200'
            )}
          >
            {successCount !== null ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" aria-hidden />
                {isEn ? `Added ${successCount} items` : `Đã thêm ${successCount} sản phẩm vào giỏ`}
              </span>
            ) : selectedCount === 0 ? (
              isEn ? 'Select at least 1 item' : 'Chọn ít nhất 1 sản phẩm'
            ) : selectedCount === 1 ? (
              isEn ? 'Add to cart' : 'Thêm vào giỏ hàng'
            ) : isEn ? (
              `Add all ${selectedCount} to cart`
            ) : (
              `Thêm cả ${selectedCount} vào giỏ hàng`
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
