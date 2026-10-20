'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { Product } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import ProductCarousel from '@/components/product/ProductCarousel';

// Cùng khoá với RecentlyViewedProducts (trang chi tiết sản phẩm ghi vào, trang chủ chỉ đọc)
const STORAGE_KEY = 'tsf:recently-viewed';

function readSlugs(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * "Sản phẩm bạn đã xem gần đây" trên trang chủ — dữ liệu thật lưu cục bộ trên trình duyệt của khách.
 * Chưa có lịch sử → hiển thị trạng thái trống (không bịa sản phẩm).
 */
export default function AmazonRecentlyViewed({ products }: { products: Product[] }) {
  const { language } = useLanguage();
  const [items, setItems] = useState<Product[] | null>(null);

  useEffect(() => {
    const viewed = readSlugs()
      .map((slug) => products.find((p) => p.slug === slug && p.isActive))
      .filter((p): p is Product => Boolean(p));
    setItems(viewed);
  }, [products]);

  const title = language === 'en' ? 'Your recently viewed items' : 'Sản phẩm bạn đã xem gần đây';

  if (items && items.length > 0) {
    return (
      <div className="bg-white rounded-2xl border border-border shadow-xs">
        <ProductCarousel title={title} products={items} mobileGrid />
      </div>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-border shadow-xs px-4 sm:px-6 py-5" aria-label={title}>
      <h2 className="font-heading text-xl md:text-2xl text-text-dark mb-2">{title}</h2>
      <div className="flex items-center gap-3 text-sm text-text-muted">
        <History className="w-5 h-5 text-green-primary shrink-0" />
        <p>
          {language === 'en'
            ? 'Products you view will appear here. '
            : 'Sản phẩm bạn xem sẽ được lưu ở đây để quay lại nhanh. '}
          <Link href="/#san-pham" className="text-green-primary hover:underline text-[1.125em]">
            {language === 'en' ? 'Start browsing' : 'Bắt đầu xem sản phẩm'}
          </Link>
        </p>
      </div>
    </section>
  );
}
