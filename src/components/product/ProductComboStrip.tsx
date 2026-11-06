import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Combo, Product } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { getShortProductName } from '@/lib/product-detail';

interface ProductComboStripProps {
  combo: Combo & { isBestSeller?: boolean };
  /** Danh mục sản phẩm web, để đổi mã sản phẩm trong combo thành tên ngắn */
  catalog: Product[];
  /** Đánh giá thật của combo (đã duyệt); 0 đánh giá thì ẩn */
  rating?: { averageRating: number; totalReviews: number } | null;
  /** Tổng số combo đã bán thật; 0 thì ẩn */
  sold?: number;
}

/**
 * Dải giới thiệu combo phía trên breadcrumb trang chi tiết sản phẩm (kiểu dải "Sponsored" của Amazon).
 * Chỉ hiển thị dữ liệu thật: tên, ảnh, giá, giá gốc, số chai, thành phần combo, đánh giá và số đã bán.
 */
export default function ProductComboStrip({ combo, catalog, rating, sold = 0 }: ProductComboStripProps) {
  const saving = Math.max(0, (combo.originalPrice || 0) - (combo.salePrice || 0));
  const contents = (combo.products || [])
    .map((item) => {
      const product = catalog.find((p) => p.id === item.productId);
      return product ? `${item.quantity} ${getShortProductName(product)}` : null;
    })
    .filter(Boolean)
    .join(', ');
  const hasRating = Boolean(rating && rating.totalReviews > 0);

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-3">
      <Link
        href={`/combo/${combo.slug}`}
        title={`Xem combo: ${combo.name}`}
        className="group block rounded-md border border-gray-200 bg-white px-3 py-2 sm:px-4 hover:border-gray-300 hover:shadow-sm transition-shadow"
      >
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <div className="relative shrink-0 w-[72px] h-[54px] sm:w-[104px] sm:h-[78px] overflow-hidden rounded-lg bg-white border border-gray-100">
            <Image src={combo.image} alt={combo.name} fill sizes="104px" className="object-contain" />
          </div>

          <div className="min-w-0 flex-1 max-w-[760px]">
            <p className="text-sm sm:text-[15px] font-semibold text-ink-950 leading-snug line-clamp-2 sm:line-clamp-1 group-hover:text-green-primary">
              {combo.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-gray-600">
              {hasRating && rating && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-ink-950">{rating.averageRating.toFixed(1)}</span>
                  <span className="flex items-center gap-px" aria-hidden>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'w-3.5 h-3.5',
                          s <= Math.round(rating.averageRating) ? 'fill-amber-500 text-amber-500' : 'fill-gray-200 text-gray-200'
                        )}
                      />
                    ))}
                  </span>
                  <span>{rating.totalReviews}</span>
                </span>
              )}
              {combo.isBestSeller && (
                <span className="rounded bg-forest-50 px-1.5 py-px text-[11px] text-forest-700">Bán chạy</span>
              )}
              {sold > 0 && <span>Đã bán {formatPrice(sold)}</span>}
              <span>{combo.totalItems} chai</span>
              {contents && <span className="hidden md:inline truncate max-w-[420px]">Gồm {contents}</span>}
            </div>
            {/* Giá trên điện thoại nằm dưới tên */}
            <div className="mt-1 flex items-baseline gap-1.5 sm:hidden">
              <span className="text-sm font-semibold text-ink-950">{formatPrice(combo.salePrice)}đ</span>
              {saving > 0 && <span className="text-[11px] text-gray-500 line-through">{formatPrice(combo.originalPrice)}đ</span>}
              {combo.discount > 0 && <span className="text-[11px] text-copper-600">-{combo.discount}%</span>}
            </div>
          </div>

          <div className="hidden sm:block shrink-0 text-right">
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-lg font-semibold text-ink-950">{formatPrice(combo.salePrice)}đ</span>
              {saving > 0 && <span className="text-xs text-gray-500 line-through">{formatPrice(combo.originalPrice)}đ</span>}
            </div>
            {saving > 0 && (
              <p className="text-xs text-copper-600">
                Tiết kiệm {formatPrice(saving)}đ{combo.discount > 0 ? ` (-${combo.discount}%)` : ''}
              </p>
            )}
          </div>
        </div>
      </Link>
      <p className="mt-0.5 text-right text-[11px] text-gray-500">Combo gợi ý</p>
    </div>
  );
}
