'use client';

import { useEffect, useState } from 'react';
import { products as staticProducts } from '@/data/products';
import type { Product } from '@/types';

/**
 * Danh mục sản phẩm đang bán cho các khối gợi ý phía trình duyệt (mua kèm, được tài trợ, đã xem gần đây...).
 * Nguồn: /api/products (CSDL là chính, gồm sản phẩm admin mới thêm; src/data/products.ts bổ sung).
 * Lần render đầu dùng danh mục tĩnh → HTML máy chủ và trình duyệt khớp nhau; tải xong thì cập nhật.
 * Cả trang dùng chung MỘT lần gọi API (bộ nhớ đệm trong module); lỗi mạng → giữ danh mục tĩnh.
 */
let cached: Product[] | null = null;
let inflight: Promise<Product[] | null> | null = null;

function loadLiveCatalog(): Promise<Product[] | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch('/api/products')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const data = json && json.success && Array.isArray(json.data) ? (json.data as Product[]) : null;
        if (data && data.length > 0) cached = data;
        return cached;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useLiveCatalog(): Product[] {
  const [catalog, setCatalog] = useState<Product[]>(() => staticProducts);
  useEffect(() => {
    let alive = true;
    loadLiveCatalog().then((data) => {
      if (alive && data) setCatalog(data);
    });
    return () => {
      alive = false;
    };
  }, []);
  return catalog;
}
