import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Combo, Product } from '@/types';
import { Brand } from '@/data/brands';
import { formatPrice, cn } from '@/lib/utils';
import { getProductImage } from '@/lib/product-detail';

/**
 * Hai ô gợi ý đặt trong mục Đánh giá của trang chi tiết (kiểu ô "Sponsored" của Amazon):
 *  - ReviewProductAd: thẻ dọc một sản phẩm lẻ, dưới khung "Đánh giá chung" (cột trái)
 *  - ReviewComboAd: dải ngang một combo, cuối danh sách đánh giá (cột phải)
 * Chỉ dùng dữ liệu thật (giá niêm yết, đánh giá đã duyệt).
 */

function Stars({ value, total }: { value: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
      <span className="flex items-center gap-px" aria-hidden>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={cn('w-3.5 h-3.5', s <= Math.round(value) ? 'fill-amber-500 text-amber-500' : 'fill-gray-200 text-gray-200')}
          />
        ))}
      </span>
      <span>{total}</span>
    </span>
  );
}

export function ReviewProductAd({
  product,
  brand,
  rating,
}: {
  product: Product;
  brand?: Brand;
  rating?: { averageRating: number; totalReviews: number } | null;
}) {
  const variant = [...(product.variants || [])].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0];
  const price = variant?.price || product.price;
  const perBottle = variant && variant.quantity > 1 ? Math.round(variant.price / variant.quantity) : null;
  const href = `/san-pham/${product.slug}`;

  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <Link href={href} className="group block" title={product.name}>
          <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-ivory">
            <Image src={getProductImage(product)} alt={product.name} fill sizes="(max-width: 1024px) 90vw, 360px" className="object-cover" />
          </span>
          {brand && (
            <span className="relative mt-3 block h-7 w-20">
              <Image src={brand.logo} alt={`Logo ${brand.name}`} fill sizes="80px" className="object-contain object-left" />
            </span>
          )}
          <span className="mt-1.5 text-sm leading-snug text-ink-950 line-clamp-2 group-hover:text-green-primary group-hover:underline">
            {product.name}
          </span>
        </Link>
        {rating && rating.totalReviews > 0 && (
          <div className="mt-1">
            <Stars value={rating.averageRating} total={rating.totalReviews} />
          </div>
        )}
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-ink-950">{formatPrice(price)}đ</p>
            <p className="text-2xs text-gray-500 truncate">
              {variant ? `${variant.unit === 'thùng' ? 'Thùng' : 'Lốc'} ${variant.name}` : product.unit}
              {perBottle ? ` · ${formatPrice(perBottle)}đ/chai` : ''}
            </p>
          </div>
          <Link
            href={href}
            className="shrink-0 rounded-full bg-brand-amber px-4 py-1.5 text-sm text-white hover:opacity-90"
          >
            Mua ngay
          </Link>
        </div>
      </div>
      <p className="mt-1 text-right text-2xs text-gray-500">Sản phẩm gợi ý</p>
    </div>
  );
}

export function ReviewComboAd({ combo, brand }: { combo: Combo; brand?: Brand }) {
  const saving = Math.max(0, (combo.originalPrice || 0) - (combo.salePrice || 0));
  const href = `/combo/${combo.slug}`;

  return (
    <div>
      <Link
        href={href}
        title={combo.name}
        className="group grid grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[120px_160px_minmax(0,1fr)] items-center overflow-hidden rounded-md border border-gray-200 bg-white hover:shadow-sm transition-shadow"
      >
        <span className="hidden sm:flex h-full items-center justify-center px-3">
          {brand && (
            <span className="relative block h-12 w-24">
              <Image src={brand.logo} alt={`Logo ${brand.name}`} fill sizes="96px" className="object-contain" />
            </span>
          )}
        </span>
        <span className="relative block aspect-[4/3] bg-ivory">
          <Image src={combo.image} alt={combo.name} fill sizes="160px" className="object-cover" />
        </span>
        <span className="min-w-0 px-3 py-2.5 sm:px-4">
          <span className="text-sm font-semibold leading-snug text-ink-950 line-clamp-2 group-hover:text-green-primary">
            {combo.name}
          </span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-semibold text-ink-950">{formatPrice(combo.salePrice)}đ</span>
            {saving > 0 && <span className="text-xs text-gray-500 line-through">{formatPrice(combo.originalPrice)}đ</span>}
          </span>
          <span className="mt-0.5 block text-xs text-gray-600">
            {combo.totalItems} chai
            {saving > 0 && (
              <span className="text-copper-600">
                {' · '}Tiết kiệm {formatPrice(saving)}đ{combo.discount > 0 ? ` (-${combo.discount}%)` : ''}
              </span>
            )}
          </span>
        </span>
      </Link>
      <p className="mt-1 text-right text-2xs text-gray-500">Combo gợi ý</p>
    </div>
  );
}
