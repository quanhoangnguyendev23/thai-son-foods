'use client';

import { useEffect, useState } from 'react';
import { safeFetchJson } from '@/lib/utils';

/**
 * Số sao + số đánh giá đã duyệt cho thẻ sản phẩm ở các dải cuộn ngang (21/11/2026).
 * Gọi GET /api/reviews/summary?ids=… một lần cho cả dải; kết quả nhớ trong trang (không gọi lại khi dải khác có cùng sản phẩm).
 */
export type ProductRating = { average: number; count: number };

const cache = new Map<string, ProductRating>();
const pending = new Map<string, Promise<void>>();

async function load(ids: string[]): Promise<void> {
  const missing = ids.filter((id) => !cache.has(id) && !pending.has(id));
  if (missing.length > 0) {
    const p = safeFetchJson<{ success: boolean; data: Record<string, ProductRating> }>(
      `/api/reviews/summary?ids=${encodeURIComponent(missing.join(','))}`
    )
      .then((res) => {
        for (const id of missing) cache.set(id, res?.success && res.data?.[id] ? res.data[id] : { average: 0, count: 0 });
      })
      .catch(() => {
        for (const id of missing) cache.set(id, { average: 0, count: 0 });
      })
      .finally(() => {
        for (const id of missing) pending.delete(id);
      });
    for (const id of missing) pending.set(id, p);
  }
  await Promise.all(ids.map((id) => pending.get(id)).filter(Boolean));
}

/** Trả về bảng mã sản phẩm → điểm; rỗng cho tới khi tải xong (thẻ chưa hiện sao) */
export function useProductRatings(ids: string[]): Record<string, ProductRating> {
  const key = ids.join(',');
  const [map, setMap] = useState<Record<string, ProductRating>>({});
  useEffect(() => {
    if (!key) return;
    let active = true;
    const list = key.split(',');
    load(list).then(() => {
      if (!active) return;
      const out: Record<string, ProductRating> = {};
      for (const id of list) {
        const r = cache.get(id);
        if (r) out[id] = r;
      }
      setMap(out);
    });
    return () => {
      active = false;
    };
  }, [key]);
  return map;
}
