'use client';

import { useEffect, useState } from 'react';
import { Product, ProductVariant } from '@/types';
import { useLiveCatalog } from '@/hooks/useLiveCatalog';

/**
 * Chọn NGẪU NHIÊN sản phẩm cho các khối "Được tài trợ" trên trang chi tiết sản phẩm.
 * - Mỗi lần mở một sản phẩm (đổi currentProductId) danh sách được xáo lại.
 * - Các khối dùng vị trí (slot) khác nhau trong cùng một lượt xáo → không trùng sản phẩm.
 * - Chỉ chạy phía trình duyệt (sau khi mount) để HTML server và client khớp nhau.
 */
let rotationKey: string | null = null;
let rotationSource: Product[] | null = null;
let rotation: Product[] = [];

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRotation(currentProductId: string, catalog: Product[]): Product[] {
  // Xáo lại khi đổi sản phẩm đang xem hoặc khi danh mục sống (CSDL) vừa tải xong
  if (rotationKey !== currentProductId || rotationSource !== catalog) {
    rotationKey = currentProductId;
    rotationSource = catalog;
    rotation = shuffle(
      catalog.filter((p) => p.isActive && p.id !== currentProductId && p.slug !== currentProductId)
    );
  }
  return rotation;
}

/** Trả về sản phẩm ngẫu nhiên cho `slot`; null khi chưa mount hoặc khi tắt (`enabled = false`). */
export function useRandomSponsoredProduct(currentProductId: string | undefined, slot: number, enabled: boolean): Product | null {
  const [picked, setPicked] = useState<Product | null>(null);
  const catalog = useLiveCatalog();

  useEffect(() => {
    if (!enabled || !currentProductId) return;
    const list = getRotation(currentProductId, catalog);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chọn ngẫu nhiên chỉ được làm phía client
    setPicked(list.length ? list[slot % list.length] : null);
  }, [currentProductId, slot, enabled, catalog]);

  return picked;
}

/** Quy cách hiển thị đúng theo dữ liệu (vd. "Lốc 6 chai 568ml"), thay cho nhãn cố định "Lốc 7 chai 330ml" */
export function getPackLabel(product: Product, variant?: ProductVariant): string {
  const qty = variant?.quantity || 7;
  const unit = variant?.unit === 'thùng' ? 'Thùng' : 'Lốc';
  const volume = product.volume || (variant?.volume?.split('x')[1] || '').trim();
  return `${unit} ${qty} chai${volume ? ` ${volume}` : ''}`;
}
