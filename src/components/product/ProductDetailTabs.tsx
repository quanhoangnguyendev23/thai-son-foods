'use client';

import { useId, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ShoppingBag, ZoomIn, X } from 'lucide-react';
import { Product } from '@/types';
import { cn, formatKcal, formatPrice } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { useCartStore } from '@/store/cart';
import { DEFAULT_PRODUCT_DETAIL, getProductDetailContent, mergeProductDetailContent } from '@/data/product-detail-content';
import { getBottleVolume, getProductImage, getShortProductName, getUnitPrice, getVariantLabel, sortVariants } from '@/lib/product-detail';

interface ProductDetailTabsProps {
  product: Product;
  categoryName?: string;
  /** Ô "Mua kèm thường gặp" dưới phần tab (tối đa 4 món). boughtTogether = có trong đơn hàng thật cùng sản phẩm này */
  companions?: { product: Product; boughtTogether?: boolean }[];
}

type TabKey = 'description' | 'ingredients' | 'usage' | 'nutrition' | 'specs' | 'packaging';

/**
 * Thông tin chi tiết sản phẩm, tổ chức thống nhất bằng tab (cuộn ngang trên mobile).
 * Tab chỉ hiển thị nội dung có trong dữ liệu; thiếu dữ liệu thì báo "đang cập nhật".
 */
export default function ProductDetailTabs({ product, categoryName, companions = [] }: ProductDetailTabsProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const baseId = useId();
  const [active, setActive] = useState<TabKey>('description');
  const [labelOpen, setLabelOpen] = useState(false);

  // Nội dung admin nhập (CSDL) ưu tiên; trường trống dùng nội dung trong code, rồi tới câu mặc định
  const content = mergeProductDetailContent(getProductDetailContent(product), product.detailContent);
  const variants = useMemo(() => sortVariants(product.variants), [product.variants]);
  const description = (isEn && product.descriptionEn) || product.description || product.shortDescription;
  const usage = content.usage || DEFAULT_PRODUCT_DETAIL.usage;
  const storage = content.storage || DEFAULT_PRODUCT_DETAIL.storage;
  const expiry = content.expiry || DEFAULT_PRODUCT_DETAIL.expiry;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'description', label: isEn ? 'Description' : 'Mô tả sản phẩm' },
    { key: 'ingredients', label: isEn ? 'Ingredients' : 'Thành phần' },
    { key: 'usage', label: isEn ? 'Usage & storage' : 'Sử dụng & bảo quản' },
    { key: 'nutrition', label: isEn ? 'Nutrition' : 'Dinh dưỡng' },
    { key: 'specs', label: isEn ? 'Product details' : 'Thông tin chi tiết' },
    { key: 'packaging', label: isEn ? 'Packaging & dimensions' : 'Quy cách & Kích thước' },
  ];

  const specs: { label: string; value: string }[] = [
    { label: isEn ? 'Brand' : 'Thương hiệu', value: 'Thái Sơn Foods' },
    ...(content.manufacturer ? [{ label: isEn ? 'Manufacturer' : 'Nhà sản xuất', value: content.manufacturer }] : []),
    { label: isEn ? 'Origin' : 'Xuất xứ', value: content.origin || DEFAULT_PRODUCT_DETAIL.origin },
    ...(categoryName ? [{ label: isEn ? 'Category' : 'Danh mục', value: categoryName }] : []),
    { label: isEn ? 'SKU' : 'Mã sản phẩm', value: product.sku },
    { label: isEn ? 'Certification' : 'Chứng nhận', value: content.certification || DEFAULT_PRODUCT_DETAIL.certification },
    { label: isEn ? 'Expiry date' : 'Hạn sử dụng', value: expiry },
    { label: isEn ? 'Usage instructions' : 'Hướng dẫn sử dụng', value: usage },
    { label: isEn ? 'Storage instructions' : 'Hướng dẫn bảo quản', value: storage },
  ];
  const bottleVolume = getBottleVolume(product, variants[0]);

  const pendingNote = (
    <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
      {isEn
        ? 'Detailed information is being updated. Please refer to the label printed on the product.'
        : 'Thông tin chi tiết đang được cập nhật. Vui lòng xem thông tin in trên nhãn sản phẩm.'}
    </p>
  );

  return (
    <section className="max-w-[1800px] mx-auto px-4 sm:px-6 py-8 md:py-10" aria-labelledby={`${baseId}-title`}>
      <h2 id={`${baseId}-title`} className="text-2xl md:text-2xl text-ink-950 mb-4">
        {isEn ? 'Product information' : 'Thông tin sản phẩm'}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-8 lg:col-start-1 lg:row-start-1 min-w-0">
          {/* Tab list */}
          <div
            role="tablist"
            aria-label={isEn ? 'Product information' : 'Thông tin sản phẩm'}
            className="flex gap-1 max-sm:flex-wrap sm:overflow-x-auto border-b border-gray-200 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab) => {
              const isActive = tab.key === active;
              return (
                <button
                  key={tab.key}
                  id={`${baseId}-tab-${tab.key}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`${baseId}-panel-${tab.key}`}
                  onClick={() => setActive(tab.key)}
                  className={cn(
                    'shrink-0 px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer',
                    isActive
                      ? 'border-green-primary text-green-primary'
                      : 'border-transparent text-gray-600 hover:text-ink-950'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            id={`${baseId}-panel-${active}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${active}`}
            className="pt-5 text-base leading-relaxed text-gray-800 min-h-[160px]"
          >
            {active === 'description' && (
              <div className="space-y-3 max-w-3xl">
                {description ? <p>{description}</p> : pendingNote}
                {product.shortDescription && product.shortDescription !== description && (
                  <p className="text-gray-600">{(isEn && product.shortDescriptionEn) || product.shortDescription}</p>
                )}
              </div>
            )}

            {active === 'ingredients' && (
              <div className="max-w-3xl">{content.ingredients ? <p>{content.ingredients}</p> : pendingNote}</div>
            )}

            {active === 'usage' && (
              <dl className="max-w-3xl divide-y divide-gray-100 border-y border-gray-100">
                {[
                  { k: isEn ? 'How to use' : 'Hướng dẫn sử dụng', v: usage },
                  { k: isEn ? 'Storage' : 'Bảo quản', v: storage },
                  { k: isEn ? 'Production & expiry date' : 'Ngày sản xuất & hạn sử dụng', v: expiry },
                ].map((row) => (
                  <div key={row.k} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 py-3">
                    <dt className="text-gray-700 text-base">{row.k}</dt>
                    <dd className="text-sm">{row.v}</dd>
                  </div>
                ))}
              </dl>
            )}

            {active === 'nutrition' && (
              <div className="max-w-md">
                {content.nutrition ? (
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 text-base text-ink-950 border-b border-gray-300">
                      {content.nutrition.basis}
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {content.nutrition.rows.map((r) => (/năng lượng/i.test(r.label) && formatKcal(product.energyKcal) ? { ...r, value: formatKcal(product.energyKcal) as string } : r)).map((row) => (
                          <tr key={row.label} className="border-b border-gray-100 last:border-0">
                            <th scope="row" className="text-left font-normal text-gray-700 px-4 py-2">{row.label}</th>
                            <td className="text-right text-ink-950 px-4 py-2 text-emph">{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-2xs text-gray-500 px-4 py-2 border-t border-gray-200">{content.nutrition.source}</p>
                  </div>
                ) : formatKcal(product.energyKcal) ? (
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 text-base text-ink-950 border-b border-gray-300">
                      {isEn ? 'Average nutrition per 100ml' : 'Giá trị dinh dưỡng trung bình trong 100ml'}
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr>
                          <th scope="row" className="text-left font-normal text-gray-700 px-4 py-2">{isEn ? 'Energy' : 'Năng lượng'}</th>
                          <td className="text-right text-ink-950 px-4 py-2 text-emph">{formatKcal(product.energyKcal)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-2xs text-gray-500 px-4 py-2 border-t border-gray-200">
                      {isEn ? 'Other nutrition values are being updated.' : 'Các chỉ số dinh dưỡng khác đang được cập nhật.'}
                    </p>
                  </div>
                ) : (
                  pendingNote
                )}
              </div>
            )}

            {active === 'packaging' && (
              <div className="max-w-3xl space-y-4">
                <ul className="space-y-1.5 text-sm">
                  {bottleVolume && (
                    <li>
                      • {isEn ? 'Standard bottle volume: ' : 'Dung tích đóng chai tiêu chuẩn: '}
                      <strong className="text-emph">{bottleVolume}</strong>
                    </li>
                  )}
                  <li>
                    • {isEn ? 'Packaging material: ' : 'Chất liệu bao bì: '}
                    <strong className="text-emph">{content.packagingMaterial || DEFAULT_PRODUCT_DETAIL.packagingMaterial}</strong>
                  </li>
                </ul>
                {variants.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm border border-gray-200">
                      <caption className="text-left text-base text-ink-950 pb-2">
                        {isEn ? 'Price list by pack size' : 'Bảng giá theo quy cách'}
                      </caption>
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="text-left text-gray-700 px-3 py-2 text-emph">{isEn ? 'Pack' : 'Quy cách'}</th>
                          <th scope="col" className="text-left text-gray-700 px-3 py-2 text-emph">{isEn ? 'Contents' : 'Quy đổi'}</th>
                          <th scope="col" className="text-right text-gray-700 px-3 py-2 text-emph">{isEn ? 'Price' : 'Giá'}</th>
                          <th scope="col" className="text-right text-gray-700 px-3 py-2 text-emph">{isEn ? 'Per bottle' : 'Đơn giá/chai'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v) => (
                          <tr key={v.id} className="border-t border-gray-100">
                            <td className="px-3 py-2">{getVariantLabel(v, language)}</td>
                            <td className="px-3 py-2 text-gray-600">{v.volume || `${v.quantity} chai`}</td>
                            <td className="px-3 py-2 text-right text-emph">{formatPrice(v.price)}đ</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatPrice(getUnitPrice(v))}đ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {active === 'specs' && (
              <div className="max-w-3xl overflow-x-auto">
                <table className="w-full text-sm border-y border-gray-200">
                  <tbody>
                    {specs.map((row) => (
                      <tr key={row.label} className="border-b border-gray-100 last:border-0 align-top">
                        <th scope="row" className="text-left text-gray-700 bg-gray-50 px-4 py-2.5 w-[38%] sm:w-[220px] text-emph">
                          {row.label}
                        </th>
                        <td className="px-4 py-2.5 text-ink-950">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Ảnh nhãn sản phẩm (nếu có) — nguồn gốc của số liệu dinh dưỡng / thành phần */}
        {content.labelImage && (
          <aside className="lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:row-span-2">
            <button
              type="button"
              onClick={() => setLabelOpen(true)}
              className="group block w-full text-left cursor-zoom-in"
            >
              <div className="relative w-full aspect-[4/3] rounded-lg border border-gray-200 overflow-hidden bg-white">
                <Image
                  src={content.labelImage}
                  alt={isEn ? 'Product label' : `Nhãn thông tin ${product.name}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 420px"
                  className="object-contain"
                />
              </div>
              <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-600 group-hover:text-green-primary">
                <ZoomIn className="w-3.5 h-3.5" aria-hidden />
                {isEn ? 'View product label' : 'Xem nhãn sản phẩm cỡ lớn'}
              </span>
            </button>
          </aside>
        )}

        {/* Mua kèm thường gặp: lấp khoảng trống dưới phần mô tả, đáy ô thẳng hàng với ảnh nhãn */}
        {companions.length > 0 && (
          <div className="lg:col-span-8 lg:col-start-1 lg:row-start-2 lg:self-end min-w-0">
            <CompanionList companions={companions.slice(0, 4)} />
          </div>
        )}
      </div>

      {labelOpen && content.labelImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isEn ? 'Product label' : 'Nhãn sản phẩm'}
          onClick={() => setLabelOpen(false)}
          className="fixed inset-0 z-[9999] bg-ink-950/85 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setLabelOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
            aria-label={isEn ? 'Close' : 'Đóng'}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative w-full max-w-4xl aspect-[4/3]" onClick={(e) => e.stopPropagation()}>
            <Image src={content.labelImage} alt="" fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </section>
  );
}

function CompanionList({
  companions,
}: {
  companions: { product: Product; boughtTogether?: boolean }[];
}) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const addItem = useCartStore((s) => s.addItem);
  const [addedId, setAddedId] = useState<string | null>(null);

  const handleAdd = (p: Product) => {
    const variant = sortVariants(p.variants)[0];
    addItem({
      productId: variant ? `${p.id}-${variant.id}` : p.id,
      name: variant ? `${p.name} (${variant.name})` : p.name,
      slug: p.slug,
      price: variant ? variant.price : p.price,
      unit: variant ? variant.name : p.unit,
      thumbnail: p.thumbnail,
      variantId: variant?.id,
      variantName: variant?.name,
    });
    setAddedId(p.id);
    setTimeout(() => setAddedId((cur) => (cur === p.id ? null : cur)), 2000);
  };

  return (
    <div className="border-t border-gray-200 pt-5">
      <h3 className="text-lg text-ink-950 mb-4">
        {isEn ? 'Frequently bought with this item' : 'Thường được mua kèm'}
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {companions.map(({ product: p, boughtTogether }) => {
          const variant = sortVariants(p.variants)[0];
          const price = variant ? variant.price : p.price;
          const pack = variant ? getVariantLabel(variant, language) : p.unit;
          const name = getShortProductName(p, language);
          const added = addedId === p.id;
          return (
            <li key={p.id} className="group flex items-center gap-3.5">
              <Link
                href={`/san-pham/${p.slug}`}
                className="relative w-[96px] aspect-[4/3] shrink-0 rounded-lg overflow-hidden bg-ivory"
              >
                <Image src={getProductImage(p)} alt={name} fill sizes="96px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/san-pham/${p.slug}`}
                  className="block text-base text-text-dark leading-snug line-clamp-2 hover:text-leaf-900 hover:underline"
                >
                  {name}
                </Link>
                <div className="mt-0.5 text-base text-leaf-900">
                  {formatPrice(price)}đ
                  {pack && <span className="text-2xs text-text-muted"> /{pack}</span>}
                </div>
                {boughtTogether && (
                  <div className="text-2xs text-text-muted">{isEn ? 'Often bought together' : 'Khách hay mua cùng'}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAdd(p)}
                aria-label={isEn ? `Add ${name} to cart` : `Thêm ${name} vào giỏ`}
                title={added ? (isEn ? 'Added' : 'Đã thêm vào giỏ') : isEn ? 'Add to cart' : 'Thêm vào giỏ'}
                className={cn(
                  'shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors active:scale-95 cursor-pointer shadow-xs',
                  added ? 'bg-emerald-600' : 'bg-brand-emerald hover:bg-brand-forest'
                )}
              >
                {added ? <Check className="w-4 h-4" aria-hidden /> : <ShoppingBag className="w-3.5 h-3.5" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
