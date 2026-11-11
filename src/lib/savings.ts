'use client';

import { useEffect, useState } from 'react';
import { combos as staticCombos } from '@/data/combos';
import type { CartItem, Combo } from '@/types';

/**
 * TÚI TIẾT KIỆM — tiện ích dùng chung phía trình duyệt.
 * Tiết kiệm của một dòng hàng = (giá gốc - giá bán) * số lượng. Hiện chỉ combo có giá gốc > giá bán.
 * Con số chính thức của đơn do server tính khi đặt hàng (cột order_items.original_price).
 */

export const SAVINGS_BAG_PATH = '/tai-khoan/tui-tiet-kiem';
export const SAVINGS_INTRO_KEY = 'tsf-savings-bag-intro-seen';

// Danh sách combo lấy từ DB (giá do admin chỉnh), tải một lần cho cả trang; trước khi tải xong dùng dữ liệu tĩnh
let comboCache: Combo[] | null = null;
let comboPromise: Promise<Combo[]> | null = null;

function loadCombos(): Promise<Combo[]> {
  if (comboCache) return Promise.resolve(comboCache);
  if (!comboPromise) {
    comboPromise = fetch('/api/combos')
      .then((r) => r.json())
      .then((json) => {
        const list = json?.success && Array.isArray(json.data) && json.data.length > 0 ? json.data : staticCombos;
        comboCache = list.filter((c: Combo) => c.isActive !== false);
        return comboCache as Combo[];
      })
      .catch(() => {
        comboPromise = null;
        return staticCombos.filter((c) => c.isActive !== false);
      });
  }
  return comboPromise;
}

export function useComboCatalog(): Combo[] {
  const [list, setList] = useState<Combo[]>(() => comboCache || staticCombos.filter((c) => c.isActive !== false));
  useEffect(() => {
    let alive = true;
    loadCombos().then((l) => {
      if (alive) setList(l);
    });
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

export function findCombo(list: Combo[], item: Pick<CartItem, 'productId' | 'slug'>): Combo | undefined {
  return (
    list.find((c) => c.id === item.productId || c.slug === item.slug) ||
    staticCombos.find((c) => c.id === item.productId || c.slug === item.slug)
  );
}

export function getCartSavings(items: CartItem[], list: Combo[]): number {
  return items.reduce((t, i) => {
    const c = findCombo(list, i);
    return c ? t + Math.max(0, (Number(c.originalPrice) || 0) - i.price) * i.quantity : t;
  }, 0);
}

export function getComboSaving(c: Combo): number {
  return Math.max(0, (Number(c.originalPrice) || 0) - (Number(c.salePrice) || 0));
}

/** 40000 → "40K", 1250000 → "1,25Tr" — dùng cho huy hiệu nhỏ trên header */
export function formatShortVND(n: number): string {
  // Làm tròn nghìn trước khi chọn đơn vị: 999.500 → 1000K sai, phải là 1Tr
  const thousands = Math.round(n / 1_000);
  if (n >= 1_000_000 || thousands >= 1_000) return `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}Tr`;
  if (n >= 1_000) return `${thousands}K`;
  return `${n}`;
}

export function hasSeenSavingsIntro(): boolean {
  try {
    return window.localStorage.getItem(SAVINGS_INTRO_KEY) === '1';
  } catch {
    return true;
  }
}

export function markSavingsIntroSeen() {
  try {
    window.localStorage.setItem(SAVINGS_INTRO_KEY, '1');
  } catch {
    /* bỏ qua: trình duyệt chặn lưu trữ */
  }
}
