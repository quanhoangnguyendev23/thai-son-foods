'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from '@/types';
import { products } from '@/data/products';

export const MAX_BOTTLES_LIMIT = 1000;

export function getItemBottleMultiplier(item: { productId?: string; variantId?: string; unit?: string; name?: string }): number {
  const combined = `${item.productId || ''} ${item.variantId || ''} ${item.unit || ''} ${item.name || ''}`.toLowerCase();
  
  // 1. Direct bottle pattern: "7 chai", "10 chai", "17 chai", "5 chai", "12 chai", "15 chai", "24 chai"
  const m1 = combined.match(/(\d+)\s*(?:chai|bottle)/);
  if (m1) {
    const val = parseInt(m1[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  
  // 2. Pack/carton patterns: "thùng 24", "lốc 6", "thùng 12", "lốc 5", "lốc 7"
  const m2 = combined.match(/(?:lốc|thùng|pack|set)\s*(\d+)/);
  if (m2) {
    const val = parseInt(m2[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 3. Variant ID pattern: "-7chai", "-10chai", "-loc5"
  const m3 = combined.match(/[-_](\d+)(?:chai|loc|thung)/);
  if (m3) {
    const val = parseInt(m3[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 3b. Số đứng sau chữ: "-loc5", "-thung24" (cùng mẫu với extractBottleMultiplier ở src/lib/inventory.ts để giỏ và máy chủ không lệch nhau)
  const m4 = combined.match(/[-_](?:loc|thung|pack|lon)(\d+)/);
  if (m4) {
    const val = parseInt(m4[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  return 1;
}

export function getItemMaxQuantity(item: { productId?: string; variantId?: string; unit?: string; name?: string }): number {
  const mult = getItemBottleMultiplier(item);
  if (mult > 1) {
    return Math.max(1, Math.floor(MAX_BOTTLES_LIMIT / mult));
  }
  return MAX_BOTTLES_LIMIT;
}

// Số lượng từ giao diện/mã gọi: NaN không hợp lệ (dùng giá trị dự phòng); số lẻ làm tròn xuống thành số nguyên
function toWholeQuantity(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isNaN(n) ? fallback : Math.floor(n);
}

// Khóa gộp dòng trong giỏ: cùng sản phẩm + cùng số chai/lốc thì là MỘT dòng,
// dù mã quy cách khác nhau (trang chi tiết dùng mã quy cách trong CSDL như "var_...",
// còn thẻ sản phẩm/kệ gợi ý dùng mã tĩnh như "sb-7chai").
export function getCartMergeKey(item: { productId: string; variantId?: string; variantName?: string; unit?: string }): string {
  const pid = String(item.productId || '');
  const vid = item.variantId ? String(item.variantId) : '';
  if (!vid || !pid.endsWith(`-${vid}`)) return pid;
  const baseId = pid.slice(0, pid.length - vid.length - 1);
  const fromName = (item.variantName || '').match(/(\d+)/);
  const fromUnit = (item.unit || '').match(/(\d+)\s*(?:chai|bottle)/i);
  const bottles = fromName ? parseInt(fromName[1], 10) : fromUnit ? parseInt(fromUnit[1], 10) : NaN;
  if (!baseId || !Number.isFinite(bottles) || bottles <= 0) return pid;
  return `${baseId}::${bottles}`;
}

/** Dòng trong giỏ cùng sản phẩm + cùng quy cách với `ref` (so theo khóa gộp, không theo mã vì addItem giữ mã của dòng có trước) */
export function findCartLine<T extends { productId: string; variantId?: string; variantName?: string; unit?: string }>(
  items: T[],
  ref: { productId: string; variantId?: string; variantName?: string; unit?: string }
): T | undefined {
  const key = getCartMergeKey(ref);
  return items.find((i) => getCartMergeKey(i) === key);
}

// Chuẩn hóa sản phẩm: Tuyệt đối không cho phép bán hoặc thêm chai lẻ (1 chai), luôn quy đổi về Lốc nhỏ nhất
function sanitizeCartProduct(product: Omit<CartItem, 'quantity'>): Omit<CartItem, 'quantity'> {
  const rawUnit = (product.unit || '').trim().toLowerCase();
  const isSingleBottle =
    !rawUnit ||
    rawUnit === '1 chai' ||
    rawUnit === 'chai' ||
    rawUnit === '1 bottle' ||
    rawUnit === 'bottle';

  if (!isSingleBottle) return product;

  // Tra cứu sản phẩm trong danh mục chuẩn để tìm quy cách tối thiểu (Lốc 7 chai hoặc Lốc 5 chai)
  const baseProd = products.find(
    (p) => p.id === product.productId || p.slug === product.slug
  );

  const minVariant = (baseProd?.variants && baseProd.variants.length > 0)
    ? [...baseProd.variants].sort((a, b) => (a.quantity || 0) - (b.quantity || 0))[0]
    : null;

  if (minVariant && baseProd) {
    const isEn = rawUnit.includes('bottle');
    const packUnit = isEn ? `Pack of ${minVariant.quantity} bottles` : `Lốc ${minVariant.name}`;
    return {
      ...product,
      productId: `${baseProd.id}-${minVariant.id}`,
      name: `${baseProd.name} (${minVariant.name})`,
      price: minVariant.price,
      unit: packUnit,
      variantId: minVariant.id,
      variantName: minVariant.name,
    };
  }

  // Dự phòng nếu không tìm thấy base product
  const isYoo = product.slug?.includes('yoo') || product.name?.toLowerCase().includes('yoo') || product.price === 25000;
  const qty = isYoo ? 5 : 7;
  return {
    ...product,
    productId: `${product.productId}-${qty}chai`,
    name: `${product.name} (${qty} chai)`,
    price: product.price * qty,
    unit: `Lốc ${qty} chai`,
    variantId: `${qty}chai`,
    variantName: `${qty} chai`,
  };
}

function sanitizeCartItems(items: CartItem[]): CartItem[] {
  if (!Array.isArray(items)) return [];
  const result: CartItem[] = [];

  for (const item of items) {
    const rawUnit = (item.unit || '').trim().toLowerCase();
    const isSingleBottle =
      !rawUnit ||
      rawUnit === '1 chai' ||
      rawUnit === 'chai' ||
      rawUnit === '1 bottle' ||
      rawUnit === 'bottle';

    const maxAllowed = getItemMaxQuantity(item);
    const safeQty = Math.max(1, Math.min(maxAllowed, Number(item.quantity) || 1));

    if (isSingleBottle) {
      const sanitized = sanitizeCartProduct(item);
      // Chia theo số chai của lốc nhỏ nhất mà sanitizeCartProduct đã chọn cho CHÍNH sản phẩm này (6, 7, 5...), không đoán cứng 5 hoặc 7
      const packDivisor = Math.max(1, getItemBottleMultiplier(sanitized));
      const sanitizedMax = getItemMaxQuantity(sanitized);
      const packQty = Math.max(1, Math.min(sanitizedMax, Math.round(safeQty / packDivisor)));

      const existing = result.find((r) => getCartMergeKey(r) === getCartMergeKey(sanitized));
      if (existing) {
        existing.quantity = Math.min(sanitizedMax, existing.quantity + packQty);
      } else {
        result.push({
          ...sanitized,
          quantity: packQty,
        });
      }
    } else {
      const existing = result.find((r) => getCartMergeKey(r) === getCartMergeKey(item));
      if (existing) {
        existing.quantity = Math.min(maxAllowed, existing.quantity + safeQty);
      } else {
        result.push({
          ...item,
          quantity: safeQty,
        });
      }
    }
  }

  return result;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  lastAddedItem: CartItem | null;
  clearLastAddedItem: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (product: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  increaseQuantity: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  /** Hoàn tác thêm giỏ: trừ `quantity` khỏi dòng cùng sản phẩm + quy cách (tìm theo khóa gộp, không theo mã), hết thì xóa dòng */
  undoAdd: (item: { productId: string; variantId?: string; variantName?: string; unit?: string }, quantity: number) => void;
  clearCart: () => void;
  getTotalQuantity: () => number;
  getSubtotal: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      lastAddedItem: null,

      clearLastAddedItem: () => set({ lastAddedItem: null }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      addItem: (product, quantity = 1) => {
        // Tuyệt đối chặn và chuẩn hóa: không bao giờ thêm chai lẻ vào giỏ
        const sanitized = sanitizeCartProduct(product);
        const maxAllowed = getItemMaxQuantity(sanitized);
        const validQuantity = Math.max(1, Math.min(maxAllowed, toWholeQuantity(quantity, 1)));

        set((state) => {
          const mergeKey = getCartMergeKey(sanitized);
          const existingItem = state.items.find(
            (item) => getCartMergeKey(item) === mergeKey
          );

          const addedItem: CartItem = { ...sanitized, quantity: validQuantity };

          if (existingItem) {
            // Cộng vào dòng đã có (giữ nguyên mã của dòng đó để các nút +/−/xóa vẫn đúng)
            return {
              items: state.items.map((item) =>
                item === existingItem
                  ? { ...item, quantity: Math.min(maxAllowed, item.quantity + validQuantity) }
                  : item
              ),
              lastAddedItem: addedItem,
            };
          }

          return {
            items: [...state.items, addedItem],
            lastAddedItem: addedItem,
          };
        });
      },

      removeItem: (productId, _variantId) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }));
      },

      increaseQuantity: (productId) => {
        set((state) => {
          const item = state.items.find((i) => i.productId === productId);
          if (!item) return state;
          const maxAllowed = getItemMaxQuantity(item);
          if (item.quantity >= maxAllowed) return state;

          return {
            items: state.items.map((i) =>
              i.productId === productId
                ? { ...i, quantity: Math.min(maxAllowed, i.quantity + 1) }
                : i
            ),
          };
        });
      },

      decreaseQuantity: (productId) => {
        set((state) => {
          const item = state.items.find((i) => i.productId === productId);
          if (item && item.quantity <= 1) {
            return {
              items: state.items.filter((i) => i.productId !== productId),
            };
          }
          return {
            items: state.items.map((i) =>
              i.productId === productId
                ? { ...i, quantity: i.quantity - 1 }
                : i
            ),
          };
        });
      },

      setQuantity: (productId, quantity) => {
        // NaN: bỏ qua, giữ nguyên dòng hàng thay vì ghi NaN vào giỏ (làm tạm tính và tổng số lượng thành NaN)
        if (Number.isNaN(Number(quantity))) return;
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => {
          const item = state.items.find((i) => i.productId === productId);
          const maxAllowed = item ? getItemMaxQuantity(item) : MAX_BOTTLES_LIMIT;
          const boundedQuantity = Math.max(1, Math.min(maxAllowed, toWholeQuantity(quantity, 1)));
          return {
            items: state.items.map((item) =>
              item.productId === productId ? { ...item, quantity: boundedQuantity } : item
            ),
          };
        });
      },

      updateQuantity: (productId, quantity, _variantId) => {
        get().setQuantity(productId, quantity);
      },

      undoAdd: (item, quantity) => {
        const undoQty = Math.max(0, toWholeQuantity(quantity, 0));
        set((state) => {
          // Dòng có thể nằm dưới mã khác với mã của thẻ (addItem giữ mã của dòng có trước), nên tìm theo khóa gộp
          const line = findCartLine(state.items, item);
          if (!line || undoQty === 0) return state;
          const rest = line.quantity - undoQty;
          return {
            items:
              rest > 0
                ? state.items.map((i) => (i === line ? { ...i, quantity: rest } : i))
                : state.items.filter((i) => i !== line),
          };
        });
      },

      clearCart: () => set({ items: [] }),

      getTotalQuantity: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },

      getTotalPrice: () => {
        return get().getSubtotal();
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.items)) {
          // Tự động quét và nâng cấp mọi item chai lẻ cũ thành quy cách Lốc chuẩn
          state.items = sanitizeCartItems(state.items);
        }
      },
    }
  )
);
