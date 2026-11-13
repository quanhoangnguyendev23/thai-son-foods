import Image from 'next/image';
import { discountLabel, discountPercentSuffix } from '@/lib/discount-label';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Combo, Product } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { getShortProductName } from '@/lib/product-detail';
import { canonicalProductId } from '@/lib/inventory';
import { ComboStripRotator, LimitedDealTag } from '@/components/product/ComboCarousel';
import { AttentionPrice } from '@/components/ui/AttentionEffects';

type StripRating = { averageRating: number; totalReviews: number } | null;

/** Một gói trong vòng xoay của dải (đánh giá + số đã bán thật, lấy sẵn ở máy chủ) */
export interface ComboStripItem {
  combo: Combo & { isBestSeller?: boolean };
  rating?: StripRating;
  sold?: number;
}

interface ProductComboStripProps {
  combo: Combo & { isBestSeller?: boolean };
  /** Danh mục sản phẩm web, để đổi mã sản phẩm trong combo thành tên ngắn */
  catalog: Product[];
  /** Đánh giá thật của combo (đã duyệt); 0 đánh giá thì ẩn */
  rating?: StripRating;
  /** Tổng số combo đã bán thật; 0 thì ẩn */
  sold?: number;
  /** Các gói khác để dải tự đổi ngẫu nhiên mỗi 10 giây trên desktop (13/11). Trống → chỉ hiện `combo` như cũ */
  pool?: ComboStripItem[];
}

/**
 * Dải giới thiệu combo phía trên breadcrumb trang chi tiết sản phẩm / gói (kiểu dải "Sponsored" của Amazon).
 * Chỉ hiển thị dữ liệu thật: tên, ảnh, giá, giá gốc, số chai, thành phần combo, đánh giá và số đã bán.
 * 13/11: desktop tự đổi gói ngẫu nhiên mỗi 10 giây (gói đầu = `combo` do trang chọn). Giá bán nổi bật bằng hiệu ứng
 * "lắc nhẹ + nháy màu" (AttentionPrice dùng chung), thay cho viền phát sáng đỏ đã bỏ.
 * Thẻ của mọi gói dựng sẵn ở máy chủ; ComboStripRotator (client) chỉ chọn thẻ nào hiện.
 */
export default function ProductComboStrip({ combo, catalog, rating, sold = 0, pool = [] }: ProductComboStripProps) {
  const items: ComboStripItem[] = [{ combo, rating, sold }, ...pool.filter((it) => it.combo.id !== combo.id)];
  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-3">
      {/* Giá dùng hiệu ứng chung AttentionPrice (lắc nhẹ + nháy màu, xem components/ui/AttentionEffects.tsx).
          Gói mới hiện ra (vòng xoay) thì giá lắc ngay từ đầu chu kỳ. */}
      <ComboStripRotator>
        {items.map((it) => (
          <StripCard key={it.combo.id} combo={it.combo} catalog={catalog} rating={it.rating} sold={it.sold ?? 0} />
        ))}
      </ComboStripRotator>
      <p className="mt-0.5 text-right text-2xs text-gray-500">Gói gợi ý</p>
    </div>
  );
}

function StripCard({ combo, catalog, rating, sold = 0 }: { combo: ComboStripItem['combo']; catalog: Product[]; rating?: StripRating; sold?: number }) {
  const saving = Math.max(0, (combo.originalPrice || 0) - (combo.salePrice || 0));
  const contents = (combo.products || [])
    .map((item) => {
      // Combo lưu mã kho (prod-sb-01), danh mục dùng mã sua-bap-nep → so theo mã chuẩn
      const product = catalog.find((p) => canonicalProductId(p.id) === canonicalProductId(item.productId));
      return product ? `${item.quantity} ${getShortProductName(product)}` : null;
    })
    .filter(Boolean)
    .join(', ');
  const hasRating = Boolean(rating && rating.totalReviews > 0);

  return (
      <Link
        href={`/combo/${combo.slug}`}
        title={`Xem gói: ${combo.name}`}
        className="group block rounded-md border border-gray-200 bg-white px-3 py-2 sm:px-4 hover:border-gray-300 hover:shadow-sm transition-shadow"
      >
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <div className="relative shrink-0 w-[72px] h-[54px] sm:w-[104px] sm:h-[78px] overflow-hidden rounded-lg bg-white border border-gray-100">
            <Image src={combo.image} alt={combo.name} fill sizes="104px" className="object-contain" />
          </div>

          <div className="min-w-0 flex-1 max-w-[760px]">
            <p className="text-sm sm:text-base font-semibold text-ink-950 leading-snug line-clamp-2 sm:line-clamp-1 group-hover:text-green-primary">
              {combo.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-gray-600">
              <LimitedDealTag comboId={combo.id} />
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
                <span className="rounded bg-forest-50 px-1.5 py-px text-2xs text-forest-700">Bán chạy</span>
              )}
              {sold > 0 && <span>Đã bán {formatPrice(sold)}</span>}
              <span>{combo.totalItems} chai</span>
              {contents && <span className="hidden md:inline truncate max-w-[420px]">Gồm {contents}</span>}
            </div>
            {/* Giá trên điện thoại nằm dưới tên */}
            <div className="mt-1 flex items-baseline gap-1.5 sm:hidden">
              <AttentionPrice className="text-sm font-semibold text-ink-950">{formatPrice(combo.salePrice)}đ</AttentionPrice>
              {saving > 0 && <span className="text-2xs text-gray-500 line-through">{formatPrice(combo.originalPrice)}đ</span>}
              {discountLabel(combo) && <span className="text-2xs text-copper-600">{discountLabel(combo)}</span>}
            </div>
          </div>

          <div className="hidden sm:block shrink-0 text-right">
            <div className="flex items-baseline justify-end gap-2">
              <AttentionPrice className="text-lg font-semibold text-ink-950">{formatPrice(combo.salePrice)}đ</AttentionPrice>
              {saving > 0 && <span className="text-xs text-gray-500 line-through">{formatPrice(combo.originalPrice)}đ</span>}
            </div>
            {saving > 0 && (
              <p className="text-xs text-copper-600">
                Tiết kiệm {formatPrice(saving)}đ{discountPercentSuffix(combo)}
              </p>
            )}
          </div>
        </div>
      </Link>
  );
}
