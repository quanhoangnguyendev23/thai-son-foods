'use client';

import { useId, useMemo, useState } from 'react';
import Image from 'next/image';
import { ZoomIn, X } from 'lucide-react';
import { Product } from '@/types';
import { cn, formatKcal, formatPrice } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_PRODUCT_DETAIL, getProductDetailContent } from '@/data/product-detail-content';
import { getBottleVolume, getUnitPrice, getVariantLabel, sortVariants } from '@/lib/product-detail';

interface ProductDetailTabsProps {
  product: Product;
  categoryName?: string;
}

type TabKey = 'description' | 'ingredients' | 'usage' | 'nutrition' | 'specs' | 'packaging';

/**
 * Thông tin chi tiết sản phẩm, tổ chức thống nhất bằng tab (cuộn ngang trên mobile).
 * Tab chỉ hiển thị nội dung có trong dữ liệu; thiếu dữ liệu thì báo "đang cập nhật".
 */
export default function ProductDetailTabs({ product, categoryName }: ProductDetailTabsProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const baseId = useId();
  const [active, setActive] = useState<TabKey>('description');
  const [labelOpen, setLabelOpen] = useState(false);

  const content = getProductDetailContent(product);
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
    <section className="max-w-[1456px] mx-auto px-4 sm:px-6 py-8 md:py-10" aria-labelledby={`${baseId}-title`}>
      <h2 id={`${baseId}-title`} className="text-2xl md:text-2xl text-ink-950 mb-4">
        {isEn ? 'Product information' : 'Thông tin sản phẩm'}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-8 min-w-0">
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
            className="pt-5 text-[15px] leading-relaxed text-gray-800 min-h-[160px]"
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
                            <td className="text-right text-ink-950 px-4 py-2 text-[1.125em]">{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[11px] text-gray-500 px-4 py-2 border-t border-gray-200">{content.nutrition.source}</p>
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
                          <td className="text-right text-ink-950 px-4 py-2 text-[1.125em]">{formatKcal(product.energyKcal)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-[11px] text-gray-500 px-4 py-2 border-t border-gray-200">
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
                      <strong className="text-[1.125em]">{bottleVolume}</strong>
                    </li>
                  )}
                  <li>
                    • {isEn ? 'Packaging material: ' : 'Chất liệu bao bì: '}
                    <strong className="text-[1.125em]">{content.packagingMaterial || DEFAULT_PRODUCT_DETAIL.packagingMaterial}</strong>
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
                          <th scope="col" className="text-left text-gray-700 px-3 py-2 text-[1.125em]">{isEn ? 'Pack' : 'Quy cách'}</th>
                          <th scope="col" className="text-left text-gray-700 px-3 py-2 text-[1.125em]">{isEn ? 'Contents' : 'Quy đổi'}</th>
                          <th scope="col" className="text-right text-gray-700 px-3 py-2 text-[1.125em]">{isEn ? 'Price' : 'Giá'}</th>
                          <th scope="col" className="text-right text-gray-700 px-3 py-2 text-[1.125em]">{isEn ? 'Per bottle' : 'Đơn giá/chai'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v) => (
                          <tr key={v.id} className="border-t border-gray-100">
                            <td className="px-3 py-2">{getVariantLabel(v, language)}</td>
                            <td className="px-3 py-2 text-gray-600">{v.volume || `${v.quantity} chai`}</td>
                            <td className="px-3 py-2 text-right text-[1.125em]">{formatPrice(v.price)}đ</td>
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
                        <th scope="row" className="text-left text-gray-700 bg-gray-50 px-4 py-2.5 w-[38%] sm:w-[220px] text-[1.125em]">
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
          <aside className="lg:col-span-4">
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
