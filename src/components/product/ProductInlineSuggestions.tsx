import Image from 'next/image';
import Link from 'next/link';
import { Combo, Product } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { getShortProductName, getProductImage } from '@/lib/product-detail';

/** Một ô gợi ý nhỏ: sản phẩm hoặc combo */
export interface InlineSuggestItem {
  key: string;
  href: string;
  image: string;
  name: string;
  price: number;
  originalPrice?: number;
  /** Dòng phụ ngắn, ví dụ "Lốc 7 chai" hoặc "10 chai · -11%" */
  meta?: string;
}

export function productToInlineItem(product: Product): InlineSuggestItem {
  const firstVariant = [...(product.variants || [])].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0];
  return {
    key: `p-${product.id}`,
    href: `/san-pham/${product.slug}`,
    image: getProductImage(product),
    name: getShortProductName(product),
    price: firstVariant?.price || product.price,
    meta: firstVariant ? `${firstVariant.unit === 'thùng' ? 'Thùng' : 'Lốc'} ${firstVariant.name}` : product.volume,
  };
}

export function comboToInlineItem(combo: Combo): InlineSuggestItem {
  return {
    key: `c-${combo.id}`,
    href: `/combo/${combo.slug}`,
    image: combo.image,
    name: combo.name,
    price: combo.salePrice,
    originalPrice: combo.originalPrice > combo.salePrice ? combo.originalPrice : undefined,
    meta: `${combo.totalItems} chai${combo.discount > 0 ? ` · -${combo.discount}%` : ''}`,
  };
}

interface ProductInlineSuggestionsProps {
  title: string;
  items: InlineSuggestItem[];
  /** Nhãn nhỏ góc phải, ví dụ "Combo gợi ý" */
  label?: string;
  /** Số ô tối thiểu để hiện khối (mặc định 3) */
  minItems?: number;
  className?: string;
}

/**
 * Khối gợi ý NHỎ chen giữa các phần ảnh / thông tin của trang chi tiết (kiểu các dải nhỏ của Amazon):
 * một hàng ô nhỏ (ảnh, tên ngắn, giá), cuộn ngang trên điện thoại. Chỉ dùng dữ liệu thật.
 */
export default function ProductInlineSuggestions({
  title,
  items,
  label,
  minItems = 3,
  className,
}: ProductInlineSuggestionsProps) {
  if (items.length < minItems) return null;
  const shown = items.slice(0, 8);

  return (
    <div className={cn('max-w-[1800px] mx-auto px-4 sm:px-6 py-4', className)}>
      <div className="rounded-md border border-gray-200 bg-white px-3 py-3 sm:px-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-sm sm:text-base font-semibold text-ink-950">{title}</h3>
          {label && <span className="shrink-0 text-[11px] text-gray-500">{label}</span>}
        </div>
        <ul className="flex gap-3 overflow-x-auto snap-x pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-8 lg:overflow-visible">
          {shown.map((item) => (
            <li key={item.key} className="snap-start shrink-0 w-[46%] sm:w-[30%] md:w-[23%] lg:w-auto min-w-0">
              <Link href={item.href} className="group flex items-center gap-2.5" title={item.name}>
                <span className="relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 overflow-hidden rounded bg-ivory">
                  <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="text-xs sm:text-[13px] leading-snug text-ink-950 line-clamp-2 group-hover:text-green-primary group-hover:underline">
                    {item.name}
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-xs sm:text-[13px] font-semibold text-ink-950">{formatPrice(item.price)}đ</span>
                    {item.originalPrice && (
                      <span className="text-[10px] text-gray-500 line-through">{formatPrice(item.originalPrice)}đ</span>
                    )}
                  </span>
                  {item.meta && <span className="block text-[11px] text-gray-500 truncate">{item.meta}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
