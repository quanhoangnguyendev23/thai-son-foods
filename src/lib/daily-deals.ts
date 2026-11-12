'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Combo } from '@/types';
import { useComboCatalog, useDailyDealsEnabled } from '@/lib/savings';
import { ENABLE_DAILY_DEALS } from '@/config/features';

/* ── Deal tự xoay vòng mỗi ngày (thuật toán chạy, không cần người vận hành) ──
 * Ngày tính theo giờ Việt Nam (UTC+7, không có giờ mùa hè). Mỗi ngày chọn DEALS_PER_DAY combo đang giảm giá.
 * Tất định theo ngày → mọi khách thấy cùng bộ deal. Mỗi chu kỳ dài ceil(n / DEALS_PER_DAY) ngày, danh sách
 * được xáo lại (seed = số thứ tự chu kỳ) → thứ tự trông ngẫu nhiên nhưng mỗi combo lên deal đều nhau.
 * Dùng chung cho dải "Deal trong ngày" (trang chủ), nhãn đếm ngược ở trang chi tiết combo và nhãn "Deal hôm nay" ở thẻ combo.
 * Lưu ý: deal chỉ quyết định combo nào được làm nổi bật; giá combo không đổi khi qua 0h. */
export const DEALS_PER_DAY = 4;
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function vnDayIndex(now: number = Date.now()): number {
  return Math.floor((now + VN_OFFSET_MS) / DAY_MS);
}

export function msUntilNextVnMidnight(now: number = Date.now()): number {
  return DAY_MS - ((now + VN_OFFSET_MS) % DAY_MS);
}

/** Xáo Fisher–Yates với bộ sinh số mulberry32 (cùng seed → cùng kết quả ở server và trình duyệt) */
function seededShuffle<T>(list: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickDailyDeals(pool: Combo[], dayIndex: number, perDay: number = DEALS_PER_DAY): Combo[] {
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (sorted.length <= perDay) return sorted;
  const daysPerCycle = Math.ceil(sorted.length / perDay);
  const cycle = Math.floor(dayIndex / daysPerCycle);
  const pos = dayIndex - cycle * daysPerCycle;
  const order = seededShuffle(sorted, cycle + 1);
  const picked = order.slice(pos * perDay, pos * perDay + perDay);
  // Lát cuối chu kỳ bị thiếu → bù từ đầu danh sách đã xáo, không trùng trong cùng ngày
  for (const c of order) {
    if (picked.length >= perDay) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

/** Combo được xét làm deal: đang bán và có giảm giá */
export function getDailyDealPool(combos: Combo[]): Combo[] {
  return combos.filter((c) => c.isActive !== false && c.discount > 0);
}

/** Số ngày VN hiện tại, tự cập nhật đúng lúc 0h. null trước khi mount (không render gì phía server → không lệch hydration). */
export function useVnDay(): number | null {
  const [day, setDay] = useState<number | null>(null);
  useEffect(() => {
    let timer: number;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        setDay(vnDayIndex());
        schedule(msUntilNextVnMidnight() + 50);
      }, delay);
    };
    schedule(0);
    return () => window.clearTimeout(timer);
  }, []);
  return day;
}

/** Mã các combo thuộc bộ deal hôm nay (cùng nguồn /api/combos và cùng thuật toán với trang chủ). Rỗng trước khi mount. */
export function useTodayDealIds(): Set<string> {
  const catalog = useComboCatalog();
  const day = useVnDay();
  const dealsOn = useDailyDealsEnabled();
  return useMemo(
    // Tắt Deal trong ngày (khoá tổng ENABLE_DAILY_DEALS hoặc công tắc admin) → rỗng: mọi nhãn deal/đồng hồ tự ẩn
    () => (!ENABLE_DAILY_DEALS || !dealsOn || day === null ? new Set<string>() : new Set(pickDailyDeals(getDailyDealPool(catalog), day).map((c) => c.id))),
    [catalog, day]
  );
}
