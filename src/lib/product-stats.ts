import { query, initDatabase } from '@/lib/db';

/**
 * Thống kê THẬT cho trang chi tiết sản phẩm / combo (không dùng số liệu mẫu).
 *  - getMonthlySales: tổng số lượng đã đặt trong 30 ngày qua (bỏ đơn đã hủy)
 *  - getAlsoViewedIds: sản phẩm khách khác cùng xem trong cùng phiên (từ bảng product_views)
 */

const SAFE_ID = /^[a-zA-Z0-9_-]{1,100}$/;

export function isSafeItemId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

/** Số lượng (gói/combo) đã đặt trong 30 ngày qua, không tính đơn đã hủy */
export async function getMonthlySales(itemId: string, itemType: 'product' | 'combo' = 'product'): Promise<number> {
  if (!isSafeItemId(itemId)) return 0;
  await initDatabase();
  // Dòng đơn của sản phẩm có dạng "<id>-<mã quy cách>" (vd sua-bap-nep-sb-7chai); combo lưu đúng "<id>"
  const matchClause =
    itemType === 'product' ? `(oi.product_id = $1 OR oi.product_id LIKE $1 || '-%')` : `oi.product_id = $1`;
  const res = await query(
    `SELECT COALESCE(SUM(oi.quantity), 0)::int AS total
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'CANCELLED'
        AND o.created_at >= NOW() - INTERVAL '30 days'
        AND ${matchClause}`,
    [itemId]
  );
  return Number(res.rows[0]?.total || 0);
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
