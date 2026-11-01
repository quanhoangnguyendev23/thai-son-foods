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

/**
 * Dòng đơn hàng lưu mã sản phẩm theo nhiều dạng: id web ("sua-bap-nep"), id CSDL ("prod-sb-01"),
 * hoặc kèm mã quy cách ("sua-bap-nep-sb-7chai"). Ghép về đúng sản phẩm trong danh mục web
 * theo bí danh dài nhất khớp được (tránh nhận nhầm khi một bí danh là tiền tố của bí danh khác).
 */
type CatalogItem = { id: string; slug: string; sku?: string };

function buildAliasResolver(catalog: CatalogItem[], dbRows: { id: string; slug: string }[]) {
  const aliases: { alias: string; productId: string }[] = [];
  for (const p of catalog) {
    const dbIds = dbRows.filter((r) => r.slug === p.slug).map((r) => r.id);
    const list = [p.id, p.slug, ...(p.sku ? [`prod-${p.sku.toLowerCase()}`] : []), ...dbIds];
    for (const alias of new Set(list.filter(Boolean))) aliases.push({ alias, productId: p.id });
  }
  aliases.sort((a, b) => b.alias.length - a.alias.length);
  return (orderProductId: string): string | null => {
    const hit = aliases.find((a) => orderProductId === a.alias || orderProductId.startsWith(`${a.alias}-`));
    return hit ? hit.productId : null;
  };
}

/**
 * Xếp hạng bán chạy THẬT: số gói đã đặt trên web (không tính đơn hủy) + số bán kênh ngoài (sold_offset).
 * Trả về id sản phẩm trong danh mục web, chỉ gồm sản phẩm đã bán được ít nhất 1 gói.
 */
export async function getBestSellerRanking(catalog: CatalogItem[]): Promise<{ productId: string; sold: number }[]> {
  await initDatabase();
  const [itemsRes, productsRes] = await Promise.all([
    query(
      `SELECT oi.product_id, SUM(oi.quantity)::int AS qty
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status <> 'CANCELLED'
        GROUP BY oi.product_id`
    ),
    query(`SELECT id, slug, COALESCE(sold_offset, 0)::int AS sold_offset FROM products`),
  ]);
  const resolve = buildAliasResolver(catalog, productsRes.rows);
  const totals = new Map<string, number>();
  for (const row of itemsRes.rows) {
    const id = resolve(String(row.product_id));
    if (id) totals.set(id, (totals.get(id) || 0) + Number(row.qty || 0));
  }
  for (const row of productsRes.rows) {
    const id = resolve(String(row.slug)) || resolve(String(row.id));
    if (id && Number(row.sold_offset) > 0) totals.set(id, (totals.get(id) || 0) + Number(row.sold_offset));
  }
  return [...totals.entries()]
    .filter(([, sold]) => sold > 0)
    .map(([productId, sold]) => ({ productId, sold }))
    .sort((a, b) => b.sold - a.sold || a.productId.localeCompare(b.productId));
}

/**
 * "Khách mua sản phẩm này cũng mua": sản phẩm khác nằm chung đơn với sản phẩm hiện tại
 * (đơn không hủy), xếp theo số đơn chung. Bỏ qua dòng combo.
 */
export async function getBoughtTogetherIds(productId: string, catalog: CatalogItem[], limit = 12): Promise<string[]> {
  await initDatabase();
  const [itemsRes, productsRes] = await Promise.all([
    query(
      `SELECT oi.order_id, oi.product_id
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status <> 'CANCELLED'
          AND oi.order_id IN (SELECT order_id FROM order_items GROUP BY order_id HAVING COUNT(DISTINCT product_id) > 1)`
    ),
    query(`SELECT id, slug FROM products`),
  ]);
  const resolve = buildAliasResolver(catalog, productsRes.rows);
  const byOrder = new Map<string, Set<string>>();
  for (const row of itemsRes.rows) {
    const id = resolve(String(row.product_id));
    if (!id) continue;
    const key = String(row.order_id);
    if (!byOrder.has(key)) byOrder.set(key, new Set());
    byOrder.get(key)!.add(id);
  }
  const counts = new Map<string, number>();
  for (const ids of byOrder.values()) {
    if (!ids.has(productId)) continue;
    for (const other of ids) {
      if (other !== productId) counts.set(other, (counts.get(other) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => id);
}

/**
 * Sản phẩm được khách đánh giá cao THẬT (đánh giá đã duyệt, trung bình >= minRating).
 * Trả về id sản phẩm web kèm điểm trung bình và số đánh giá, xếp điểm cao trước.
 */
export async function getTopRatedProducts(
  catalog: CatalogItem[],
  minRating = 4
): Promise<{ productId: string; averageRating: number; totalReviews: number }[]> {
  await initDatabase();
  const [reviewsRes, productsRes] = await Promise.all([
    query(
      `SELECT product_id, SUM(rating)::float AS total, COUNT(*)::int AS n
         FROM product_reviews WHERE status = 'APPROVED' AND product_id NOT LIKE 'combo%'
        GROUP BY product_id`
    ),
    query(`SELECT id, slug FROM products`),
  ]);
  const resolve = buildAliasResolver(catalog, productsRes.rows);
  const agg = new Map<string, { total: number; n: number }>();
  for (const row of reviewsRes.rows) {
    const id = resolve(String(row.product_id).toLowerCase());
    if (!id) continue;
    const cur = agg.get(id) || { total: 0, n: 0 };
    agg.set(id, { total: cur.total + Number(row.total || 0), n: cur.n + Number(row.n || 0) });
  }
  return [...agg.entries()]
    .map(([productId, { total, n }]) => ({ productId, averageRating: n > 0 ? total / n : 0, totalReviews: n }))
    .filter((r) => r.totalReviews > 0 && r.averageRating >= minRating)
    .sort((a, b) => b.averageRating - a.averageRating || b.totalReviews - a.totalReviews);
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
