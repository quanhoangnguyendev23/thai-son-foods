import { query } from '@/lib/db';
import { combos as staticCombos } from '@/data/combos';
import { Combo } from '@/types';

/**
 * Dữ liệu combo dùng cho các khối gợi ý trên trang chi tiết sản phẩm / combo.
 * Nguồn chính là CSDL (admin quản lý); CSDL trống hoặc lỗi thì dùng dữ liệu mẫu trong combos.ts.
 */
export type SuggestCombo = Combo & { isBestSeller?: boolean };

export async function getActiveCombos(): Promise<SuggestCombo[]> {
  try {
    const res = await query(
      `SELECT c.*,
         COALESCE((SELECT json_agg(json_build_object('product_id', ci.product_id, 'quantity', ci.quantity))
                   FROM combo_items ci WHERE ci.combo_id = c.id), '[]') AS items
       FROM combos c WHERE c.is_active = true ORDER BY c.created_at ASC`
    );
    if (res.rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res.rows.map((row: any) => {
        const base = staticCombos.find((c) => c.id === row.id || c.slug === row.slug);
        return {
          ...(base || {}),
          id: row.id,
          slug: row.slug || base?.slug || row.id,
          name: row.name || base?.name || '',
          description: row.description || base?.description || '',
          image: row.image || base?.image || '/images/combos/combo-1.jpg',
          originalPrice: Number(row.original_price) || base?.originalPrice || 0,
          salePrice: Number(row.sale_price) || base?.salePrice || 0,
          totalItems: Number(row.total_items) || base?.totalItems || 0,
          discount: Number(row.discount) || 0,
          isActive: true,
          isBestSeller: Boolean(row.is_best_seller),
          products:
            Array.isArray(row.items) && row.items.length > 0
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? row.items.map((it: any) => ({ productId: String(it.product_id), quantity: Number(it.quantity) || 1 }))
              : base?.products || [],
        } as SuggestCombo;
      });
    }
  } catch (err) {
    console.error('Không thể lấy combo cho khối gợi ý:', err);
  }
  return staticCombos.filter((c) => c.isActive);
}

const qtyOf = (c: Combo, productId: string) => c.products.find((it) => it.productId === productId)?.quantity || 0;

/**
 * Xếp combo theo mức liên quan tới các sản phẩm cho trước:
 * có chứa sản phẩm trước, rồi giảm nhiều hơn, rồi chứa nhiều chai sản phẩm đó hơn.
 */
export function rankCombosForProducts(list: SuggestCombo[], productIds: string[], excludeId?: string): SuggestCombo[] {
  const overlap = (c: SuggestCombo) => productIds.reduce((sum, id) => sum + qtyOf(c, id), 0);
  return [...list]
    .filter((c) => c.salePrice > 0 && c.slug && c.id !== excludeId)
    .sort(
      (a, b) =>
        Number(overlap(b) > 0) - Number(overlap(a) > 0) ||
        (b.discount || 0) - (a.discount || 0) ||
        overlap(b) - overlap(a)
    );
}

/** Combo chứa ít nhất một trong các sản phẩm cho trước */
export function combosContaining(list: SuggestCombo[], productIds: string[], excludeId?: string): SuggestCombo[] {
  return rankCombosForProducts(list, productIds, excludeId).filter((c) =>
    productIds.some((id) => qtyOf(c, id) > 0)
  );
}
