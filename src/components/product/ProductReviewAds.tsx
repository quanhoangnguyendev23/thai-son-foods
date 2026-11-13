import Image from 'next/image';
import { discountPercentSuffix } from '@/lib/discount-label';
import Link from 'next/link';
import { Info, Star } from 'lucide-react';
import { Combo, Product } from '@/types';
import { Brand } from '@/data/brands';
import { formatPrice, cn } from '@/lib/utils';
import { getProductImage, getVariantOriginalPrice } from '@/lib/product-detail';
import { AttentionPrice, AttentionStyles, attentionCta, attentionCtaDelay } from '@/components/ui/AttentionEffects';

/**
 * Hai ô gợi ý đặt trong mục Đánh giá của trang chi tiết (theo kiểu ô "Sponsored" của Amazon):
 *  - ReviewProductAd: thẻ dọc một sản phẩm lẻ, dưới khung "Đánh giá chung" (cột trái)
 *  - ReviewComboAd: thẻ ngang một combo, ngay dưới danh sách đánh giá (cột phải); điện thoại xếp dọc
 * Cả thẻ bấm được; nhãn nhỏ "Được tài trợ ⓘ" ở góc dưới phải. Chỉ dùng dữ liệu thật (giá niêm yết, đánh giá đã duyệt).
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
      <span className="sr-only">{value.toFixed(1)} trên 5 sao,</span>
      <span>{total}</span>
    </span>
  );
}

/** Nhãn "Được tài trợ ⓘ" (vị trí như "Sponsored" của Amazon) */
function SponsoredLabel() {
  return (
    <p className="mt-1 flex items-center justify-end gap-1 text-2xs text-gray-500">
      <span>Được tài trợ</span>
      <span title="Gợi ý từ Thái Sơn Foods" aria-label="Gợi ý từ Thái Sơn Foods" className="inline-flex">
        <Info className="w-3 h-3" aria-hidden />
      </span>
    </p>
  );
}

const CARD = 'group block rounded-lg border border-gray-200 bg-white transition-shadow duration-200 hover:border-gray-300 hover:shadow-md motion-reduce:transition-none';
const CTA = 'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-amber px-4 py-1.5 text-sm text-white group-hover:opacity-90';

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
  const originalPrice = variant ? getVariantOriginalPrice(product, variant) : null;
  const perBottle = variant && variant.quantity > 1 ? Math.round(variant.price / variant.quantity) : null;
  const href = `/san-pham/${product.slug}`;

  return (
    <div>
      <Link href={href} title={product.name} className={cn(CARD, 'tsf-cta-trigger p-3')}>
        {/* Ảnh theo đúng tỉ lệ của file (ảnh SP 1200x900), hiện trọn ảnh — không cắt nhãn/logo ở góc */}
        <span className="block overflow-hidden rounded-md bg-white">
          <Image
            src={getProductImage(product)}
            alt={product.name}
            width={1200}
            height={900}
            sizes="(max-width: 1024px) 90vw, 360px"
            className="block w-full h-auto object-contain"
          />
        </span>
        {brand && (
          <span className="relative mt-3 block h-6 w-20">
            <Image src={brand.logo} alt={`Logo ${brand.name}`} fill sizes="80px" className="object-contain object-left" />
          </span>
        )}
        <span className="mt-1.5 block text-sm leading-snug text-ink-950 line-clamp-3 group-hover:text-green-primary group-hover:underline">
          {product.name}
        </span>
        {rating && rating.totalReviews > 0 && (
          <span className="mt-1 block">
            <Stars value={rating.averageRating} total={rating.totalReviews} />
          </span>
        )}
        <span className="mt-2 flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-lg leading-tight text-ink-950">{formatPrice(price)}đ</span>
              {originalPrice && <span className="text-xs text-gray-500 line-through">{formatPrice(originalPrice)}đ</span>}
            </span>
            <span className="block text-2xs text-gray-500 truncate">
              {variant ? `${variant.unit === 'thùng' ? 'Thùng' : 'Lốc'} ${variant.name}` : product.unit}
              {perBottle ? ` · ${formatPrice(perBottle)}đ/chai` : ''}
            </span>
          </span>
          <AttentionStyles />
          <span className={cn(CTA, attentionCta(true))} style={attentionCtaDelay(1200)}>Mua ngay</span>
        </span>
      </Link>
      <SponsoredLabel />
    </div>
  );
}

export function ReviewComboAd({ combo, brand, headline }: { combo: Combo; brand?: Brand; headline?: string }) {
  const saving = Math.max(0, (combo.originalPrice || 0) - (combo.salePrice || 0));
  const href = `/combo/${combo.slug}`;

  return (
    <div>
      <Link href={href} title={combo.name} className={cn(CARD, 'tsf-cta-trigger overflow-hidden')}>
        <span className="flex flex-col sm:flex-row sm:items-stretch">
          {/* Logo hãng: chỉ khi cả combo cùng một hãng (không có → bỏ hẳn ô logo) */}
          {brand && (
            <span className="flex items-center px-3 pt-3 sm:w-28 sm:shrink-0 sm:justify-center sm:p-3">
              <span className="relative block h-8 w-20 sm:h-12 sm:w-24">
                <Image src={brand.logo} alt={`Logo ${brand.name}`} fill sizes="96px" className="object-contain object-left sm:object-center" />
              </span>
            </span>
          )}
          {/* Ảnh combo theo đúng tỉ lệ của file, hiện trọn ảnh (không cắt) */}
          <span className="flex items-center bg-white sm:w-44 sm:shrink-0">
            <Image
              src={combo.image}
              alt={combo.name}
              width={1200}
              height={900}
              sizes="(max-width: 640px) 90vw, 176px"
              className="block w-full h-auto object-contain"
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:px-4">
            {headline && <span className="block text-xs text-copper-600 line-clamp-1">{headline}</span>}
            <span className="block text-sm leading-snug text-ink-950 line-clamp-2 group-hover:text-green-primary group-hover:underline">
              {combo.name}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <AttentionPrice className="text-lg leading-tight text-ink-950">{formatPrice(combo.salePrice)}đ</AttentionPrice>
              {saving > 0 && <span className="text-xs text-gray-500 line-through">{formatPrice(combo.originalPrice)}đ</span>}
            </span>
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-600">
                {combo.totalItems} chai
                {saving > 0 && (
                  <span className="text-copper-600">
                    {' · '}Tiết kiệm {formatPrice(saving)}đ{discountPercentSuffix(combo)}
                  </span>
                )}
              </span>
              <span className={cn(CTA, attentionCta(true))} style={attentionCtaDelay(4200)}>Xem gói</span>
            </span>
          </span>
        </span>
      </Link>
      <SponsoredLabel />
    </div>
  );
}
