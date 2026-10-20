'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types';
import { products as catalog } from '@/data/products';
import { useLanguage } from '@/context/LanguageContext';
import ProductCarousel from '@/components/product/ProductCarousel';

const STORAGE_KEY = 'tsf:recently-viewed';
const MAX_ITEMS = 12;

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
 * "Sản phẩm bạn đã xem gần đây" — lưu cục bộ trên trình duyệt của khách (localStorage),
 * không gửi về máy chủ. Ẩn hoàn toàn khi chưa có lịch sử xem.
 */
export default function RecentlyViewedProducts({ currentSlug }: { currentSlug: string }) {
  const { language } = useLanguage();
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    const previous = readSlugs().filter((s) => s !== currentSlug);
    const viewed = previous
      .map((slug) => catalog.find((p) => p.slug === slug && p.isActive))
      .filter((p): p is Product => Boolean(p));
    setItems(viewed);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([currentSlug, ...previous].slice(0, MAX_ITEMS)));
    } catch {
      // Trình duyệt chặn lưu trữ — bỏ qua, tính năng chỉ mang tính tiện ích
    }
  }, [currentSlug]);

  if (items.length === 0) return null;

  return (
    <div className="border-t border-gray-200">
      <ProductCarousel
        title={language === 'en' ? 'Your recently viewed items' : 'Sản phẩm bạn đã xem gần đây'}
        products={items}
        mobileGrid
      />
    </div>
  );
}
