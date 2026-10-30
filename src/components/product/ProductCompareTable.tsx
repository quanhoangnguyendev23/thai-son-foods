'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Star, StarHalf } from 'lucide-react';
import { Product } from '@/types';
import { cn, formatKcal, formatPrice } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { useCartStore } from '@/store/cart';
import { useFlyToCart } from '@/context/FlyToCartContext';
import { categories as catalogCategories } from '@/data/products';
import { getProductDetailContent, DEFAULT_PRODUCT_DETAIL } from '@/data/product-detail-content';
import {
  getBottleVolume,
  getShortProductName,
  getUnitPrice,
  getVariantLabel,
  sortVariants,
  isSameProduct,
  getProductImage,
  MISSING_PRODUCT_IMAGE,
} from '@/lib/product-detail';

interface ProductCompareTableProps {
  current: Product;
  others: Product[];
  /** Số cột sản phẩm tối đa (gồm sản phẩm đang xem) */
  maxColumns?: number;
}

interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
}

type Row =
  | { kind: 'text'; key: string; label: string; render: (p: Product) => React.ReactNode }
  | { kind: 'check'; key: string; label: string; test: (p: Product) => boolean };

/** Đánh giá thật cho từng cột — gọi API tóm tắt đánh giá sẵn có (chỉ đọc) */
function useReviewSummaries(products: Product[]) {
  const [data, setData] = useState<Record<string, ReviewSummary | null>>({});
  const key = products.map((p) => p.slug || p.id).join('|');

  useEffect(() => {
    let active = true;
    const ids = key.split('|').filter(Boolean);
    Promise.all(
      ids.map((id) =>
        fetch(`/api/reviews/summary?productId=${encodeURIComponent(id)}`)
          .then((r) => r.json())
          .then((json) =>
            json?.success && json.data
              ? { averageRating: Number(json.data.averageRating) || 0, totalReviews: Number(json.data.totalReviews) || 0 }
              : null
          )
          .catch(() => null)
      )
    ).then((list) => {
      if (!active) return;
      setData(Object.fromEntries(ids.map((id, i) => [id, list[i]])));
    });
    return () => {
      active = false;
    };
  }, [key]);

  return data;
}

function RatingStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center" aria-hidden>
      {[1, 2, 3, 4, 5].map((s) => {
        const full = value >= s - 0.25;
        const half = !full && value >= s - 0.75;
        return half ? (
          <span key={s} className="relative w-4 h-4">
            <Star className="absolute inset-0 w-4 h-4 fill-gray-200 text-gray-200" />
            <StarHalf className="absolute inset-0 w-4 h-4 fill-amber-500 text-amber-500" />
          </span>
        ) : (
          <Star key={s} className={cn('w-4 h-4', full ? 'fill-amber-500 text-amber-500' : 'fill-gray-200 text-gray-200')} />
        );
      })}
    </span>
  );
}

function CompareImage({ product, alt }: { product: Product; alt: string }) {
  const [src, setSrc] = useState(getProductImage(product));
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="160px"
      className="object-contain transition-transform duration-300"
      onError={() => setSrc(MISSING_PRODUCT_IMAGE)}
    />
  );
}

/**
 * "So sánh với sản phẩm tương tự" — bố cục bảng so sánh Amazon:
 * ảnh lớn + tên + nút mua ở đầu cột, sau đó các hàng Đánh giá / Giá / Lợi ích / thông số
 * và các hàng đánh dấu ✓. Mọi ô lấy từ dữ liệu thật (sản phẩm, quy cách, đánh giá từ API,
 * nội dung chi tiết); ô thiếu dữ liệu hiển thị "—", không tự điền.
 */
export default function ProductCompareTable({ current, others, maxColumns = 6 }: ProductCompareTableProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const addItem = useCartStore((s) => s.addItem);
  const { flyToCart } = useFlyToCart();
  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimer = useRef<number | null>(null);

  // Chỉ so sánh với sản phẩm CÙNG DANH MỤC (vd. Sữa Hạt chỉ so với sữa hạt, Trà Sữa chỉ với Ciao/Go)
  const categoryOf = (p: Product) => (p.categoryId || '').replace(/^cat-/, '');
  const columns = [
    current,
    ...others.filter((p) => !isSameProduct(p, current) && categoryOf(p) === categoryOf(current)),
  ].slice(0, maxColumns);
  const reviews = useReviewSummaries(columns);

  useEffect(() => () => {
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
  }, []);

  if (columns.length < 2) return null;

  const fullName = (p: Product) => (isEn && p.nameEn ? p.nameEn : p.name);

  // Thêm quy cách nhỏ nhất vào giỏ — cùng định dạng mục giỏ với ProductCard (thẻ sản phẩm)
  const handleAdd = (p: Product, e: React.MouseEvent<HTMLButtonElement>) => {
    const v = sortVariants(p.variants)[0];
    if (!v) return;
    const imgEl = (e.currentTarget.closest('th') as HTMLElement | null)?.querySelector('img') as HTMLElement | null;
    flyToCart({ startElement: imgEl || e.currentTarget, imageSrc: getProductImage(p) });
    addItem({
      productId: `${p.id}-${v.id}`,
      name: `${fullName(p)} (${v.name})`,
      slug: p.slug,
      price: v.price,
      unit: isEn ? `Pack of ${v.quantity} bottles` : `Lốc ${v.name}`,
      thumbnail: getProductImage(p),
      variantId: v.id,
      variantName: v.name,
    });
    setAddedId(p.id);
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAddedId(null), 2000);
  };

  const categoryName = (p: Product) => {
    const id = (p.categoryId || '').replace(/^cat-/, '');
    const c = catalogCategories.find((x) => x.id === id || x.slug === id);
    return (isEn ? c?.nameEn : c?.name) || p.category_name || '—';
  };

  const dash = <span className="text-gray-500">—</span>;

  const rows: Row[] = [
    {
      kind: 'text',
      key: 'rating',
      label: isEn ? 'Customer ratings' : 'Đánh giá của khách hàng',
      render: (p) => {
        const r = reviews[p.slug || p.id];
        if (!r || r.totalReviews === 0) return dash;
        return (
          <Link
            href={isSameProduct(p, current) ? '#danh-gia-khach-hang' : `/san-pham/${p.slug}#danh-gia-khach-hang`}
            className="inline-flex items-center gap-1 group"
            aria-label={`${r.averageRating.toFixed(1)} / 5 — ${r.totalReviews} ${isEn ? 'ratings' : 'đánh giá'}`}
          >
            <RatingStars value={r.averageRating} />
            <span className="text-forest-700 group-hover:text-copper-600 group-hover:underline">{r.totalReviews}</span>
          </Link>
        );
      },
    },
    {
      kind: 'text',
      key: 'price',
      label: isEn ? 'Price' : 'Giá cả',
      render: (p) => {
        const v = sortVariants(p.variants)[0];
        if (!v) return p.price > 0 ? <span className="text-[17px] font-medium text-ink-950">{formatPrice(p.price)}đ</span> : dash;
        return (
          <span className="block">
            <span className="text-[17px] font-medium text-ink-950">{formatPrice(v.price)}đ</span>
            <span className="block text-xs text-gray-600">/{getVariantLabel(v, language)}</span>
            <span className="block text-xs text-gray-500">
              ({formatPrice(getUnitPrice(v))}đ/{isEn ? 'bottle' : 'chai'})
            </span>
          </span>
        );
      },
    },
    {
      kind: 'text',
      key: 'benefit',
      label: isEn ? 'Benefits' : 'Lợi ích',
      render: (p) => {
        const text = (isEn && p.shortDescriptionEn ? p.shortDescriptionEn : p.shortDescription || '').trim();
        return text ? (
          <span className="block line-clamp-5" title={text}>
            {text}
          </span>
        ) : (
          dash
        );
      },
    },
    {
      kind: 'text',
      key: 'volume',
      label: isEn ? 'Bottle volume' : 'Dung tích chai',
      render: (p) => getBottleVolume(p, sortVariants(p.variants)[0]) || dash,
    },
    {
      kind: 'text',
      key: 'packs',
      label: isEn ? 'Pack sizes' : 'Quy cách',
      render: (p) => sortVariants(p.variants).map((v) => getVariantLabel(v, language)).join(', ') || dash,
    },
    {
      kind: 'text',
      key: 'energy',
      label: isEn ? 'Energy / 100ml' : 'Năng lượng / 100ml',
      // Chỉ hiển thị khi đã số hoá nhãn dinh dưỡng thật (product-detail-content), không ước tính
      render: (p) => formatKcal(p.energyKcal) || getProductDetailContent(p).nutrition?.rows.find((r) => /năng lượng/i.test(r.label))?.value || dash,
    },
    { kind: 'text', key: 'category', label: isEn ? 'Category' : 'Danh mục', render: (p) => categoryName(p) },
    { kind: 'check', key: 'vegan', label: isEn ? 'Plant-based (vegan)' : 'Thuần chay, từ thực vật', test: (p) => Boolean(p.isVegan) },
    {
      kind: 'check',
      key: 'haccp',
      label: isEn ? 'HACCP certified' : 'Chứng nhận HACCP',
      test: (p) => /haccp/i.test(getProductDetailContent(p).certification || DEFAULT_PRODUCT_DETAIL.certification),
    },
    {
      kind: 'check',
      key: 'case',
      label: isEn ? 'Case pack (12+ bottles)' : 'Có quy cách thùng (từ 12 chai)',
      test: (p) => sortVariants(p.variants).some((v) => v.quantity >= 12),
    },
    { kind: 'check', key: 'best', label: isEn ? 'Best seller' : 'Sản phẩm bán chạy', test: (p) => Boolean(p.isBestSeller) },
    { kind: 'check', key: 'new', label: isEn ? 'New arrival' : 'Sản phẩm mới', test: (p) => Boolean(p.isNew) },
  ];

  const cellBase = 'px-3 py-2.5 text-center align-middle text-[13px] text-ink-950 border-b border-gray-200';
  const labelCell =
    'sticky left-0 z-[1] bg-ink-50 px-3 py-2.5 text-center align-middle text-[13px] font-normal text-gray-700 border-b border-r border-gray-200';
  const currentTint = 'bg-green-primary/[0.035]';

  return (
    <section className="max-w-[1456px] mx-auto px-4 sm:px-6 py-6 md:py-8" aria-labelledby="compare-title">
      <h2 id="compare-title" className="text-xl md:text-2xl text-ink-950 mb-4">
        {isEn ? 'Compare with similar items' : 'So sánh với sản phẩm tương tự'}
      </h2>

      {/* Bảng nhiều cột: trên mobile cần vuốt ngang — nhắc khách để không bỏ sót */}
      <p className="sm:hidden text-xs text-gray-500 mb-2">{isEn ? 'Swipe sideways to compare more products →' : 'Vuốt ngang để so sánh thêm sản phẩm →'}</p>
      {/* relative: giữ các phần tử absolute (sr-only) trong khung cuộn, tránh tràn ngang trang */}
      <div className="relative overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table
          className="w-full border-collapse table-fixed"
          // Cột nhãn 132px + mỗi cột sản phẩm tối thiểu 150px; hẹp hơn thì cuộn ngang trong khung
          style={{ minWidth: 132 + columns.length * 150 }}
        >
          <colgroup>
            <col className="w-[132px] sm:w-[170px]" />
            {columns.map((p) => (
              <col key={p.id} />
            ))}
          </colgroup>

          <thead>
            <tr>
              <td className="sticky left-0 z-[1] bg-white" />
              {columns.map((p) => {
                const isCurrent = isSameProduct(p, current);
                const name = getShortProductName(p, language);
                const v = sortVariants(p.variants)[0];
                const justAdded = addedId === p.id;
                return (
                  <th key={p.id} scope="col" className={cn('px-2 pt-2 pb-4 align-bottom font-normal', isCurrent && currentTint)}>
                    <Link href={`/san-pham/${p.slug}`} className="group block" aria-current={isCurrent ? 'page' : undefined}>
                      <span className="relative block mx-auto w-full max-w-[150px] aspect-[4/3]">
                        <CompareImage product={p} alt={name} />
                      </span>
                      <span
                        className="mt-3 block min-h-[2.5em] text-[15px] sm:text-base leading-tight text-forest-700 group-hover:text-copper-600 group-hover:underline line-clamp-2"
                        title={fullName(p)}
                      >
                        {name}
                      </span>
                    </Link>

                    <div className="mt-2 flex justify-center">
                      {isCurrent ? (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-green-primary/40 bg-white px-3 py-1.5 text-[13px] sm:text-[15px] text-green-primary">
                          {isEn ? 'This item' : 'Sản phẩm đang xem'}
                        </span>
                      ) : v ? (
                        <button
                          type="button"
                          onClick={(e) => handleAdd(p, e)}
                          className={cn(
                            'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] sm:text-[13px] leading-tight shadow-xs transition-colors cursor-pointer',
                            justAdded ? 'bg-green-primary text-white' : 'bg-corn hover:bg-corn-dark text-ink-950'
                          )}
                          aria-label={
                            isEn
                              ? `Add ${name} (${getVariantLabel(v, language)}) to cart`
                              : `Thêm ${name} (${getVariantLabel(v, language)}) vào giỏ hàng`
                          }
                        >
                          {justAdded ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> {isEn ? 'Added' : 'Đã thêm'}
                            </span>
                          ) : isEn ? (
                            'Add to cart'
                          ) : (
                            'Thêm vào giỏ hàng'
                          )}
                        </button>
                      ) : (
                        // Chưa có quy cách đóng gói → chọn trên trang chi tiết
                        <Link
                          href={`/san-pham/${p.slug}`}
                          className="whitespace-nowrap rounded-full border border-gray-400 bg-white px-3.5 py-1.5 text-[12px] sm:text-[13px] text-ink-950 hover:bg-gray-50 shadow-xs"
                        >
                          {isEn ? 'See options' : 'Tùy chọn mua'}
                        </Link>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="border-t border-gray-200">
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className={labelCell}>
                  {row.label}
                </th>
                {columns.map((p) => {
                  const isCurrent = isSameProduct(p, current);
                  if (row.kind === 'check') {
                    const ok = row.test(p);
                    return (
                      <td key={p.id} className={cn(cellBase, isCurrent && currentTint)}>
                        {ok ? (
                          <Check className="w-4 h-4 mx-auto text-ink-950" strokeWidth={2} aria-label={isEn ? 'Yes' : 'Có'} />
                        ) : (
                          <span className="sr-only">{isEn ? 'No' : 'Không'}</span>
                        )}
                      </td>
                    );
                  }
                  return (
                    <td key={p.id} className={cn(cellBase, isCurrent && currentTint)}>
                      {row.render(p)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
