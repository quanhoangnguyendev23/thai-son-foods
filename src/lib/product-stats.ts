import { query, initDatabase } from '@/lib/db';

/**
 * Thống kê THẬT cho trang chi tiết sản phẩm / combo (không dùng số liệu mẫu).
 *  - getTotalSold: tổng đã bán = kênh ngoài website (admin nhập) + đơn trên web
 *  - getAlsoViewedIds: sản phẩm khách khác cùng xem trong cùng phiên (từ bảng product_views)
 */

const SAFE_ID = /^[a-zA-Z0-9_-]{1,100}$/;

export function isSafeItemId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

/**
 * Tổng số lượng (gói/combo) ĐÃ BÁN = số bán thật ở kênh ngoài website (admin nhập, cột sold_offset)
 * + số đã đặt trên website từ trước đến nay (không tính đơn đã hủy).
 */
export async function getTotalSold(
  itemId: string,
  itemType: 'product' | 'combo' = 'product',
  slug?: string
): Promise<number> {
  if (!isSafeItemId(itemId)) return 0;
  // Trong CSDL id sản phẩm có thể khác id dùng trên web (vd prod-sb-01 ↔ sua-bap-nep) → ghép theo slug
  const slugKey = isSafeItemId(slug) ? slug : itemId;
  await initDatabase();
  // Dòng đơn của sản phẩm có dạng "<id>-<mã quy cách>" (vd sua-bap-nep-sb-7chai); combo lưu đúng "<id>"
  const matchClause =
    itemType === 'product' ? `(oi.product_id = $1 OR oi.product_id LIKE $1 || '-%')` : `oi.product_id = $1`;
  const table = itemType === 'product' ? 'products' : 'combos';
  const res = await query(
    `SELECT
        COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                   WHERE o.status <> 'CANCELLED' AND ${matchClause}), 0)::int AS web_total,
        COALESCE((SELECT MAX(sold_offset) FROM ${table} WHERE id = $1 OR slug = $2), 0)::int AS offline_total`,
    [itemId, slugKey]
  );
  return Number(res.rows[0]?.web_total || 0) + Number(res.rows[0]?.offline_total || 0);
}

/** Sản phẩm được xem nhiều nhất bởi những khách cũng xem `productId` (30 ngày gần nhất) */
export async function getAlsoViewedIds(productId: string, limit = 12): Promise<string[]> {
  if (!isSafeItemId(productId)) return [];
  await initDatabase();
  const res = await query(
    `SELECT v2.product_id, COUNT(DISTINCT v2.session_id)::int AS viewers
       FROM product_views v1
       JOIN product_views v2
         ON v1.session_id = v2.session_id AND v2.product_id <> v1.product_id
      WHERE v1.product_id = $1
        AND v1.viewed_on >= CURRENT_DATE - 30
        AND v2.viewed_on >= CURRENT_DATE - 30
      GROUP BY v2.product_id
      ORDER BY viewers DESC, v2.product_id ASC
      LIMIT $2`,
    [productId, limit]
  );
  return res.rows.map((r) => String(r.product_id));
}
