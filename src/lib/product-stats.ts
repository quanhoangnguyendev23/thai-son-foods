import { query, initDatabase } from '@/lib/db';
import { buildLiveCatalog, type ProductCatalogRow } from '@/lib/product-detail';
import { products as staticProducts } from '@/data/products';
import type { Product } from '@/types';

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
 * Danh mục sản phẩm cho các khối gợi ý (trang chi tiết SP / combo / thương hiệu): bảng products là nguồn chính
 * (gồm sản phẩm admin mới thêm, nhãn, tạm ẩn), src/data/products.ts bổ sung — xem buildLiveCatalog.
 * Lỗi CSDL → danh mục tĩnh (không làm hỏng trang).
 */
export async function getLiveCatalog(): Promise<Product[]> {
  try {
    await initDatabase();
    const res = await query(
      `SELECT p.id, p.slug, p.sku, p.name, p.price, p.unit, p.thumbnail, p.category_id, p.short_description, p.description,
              p.is_featured, p.is_best_seller, p.is_new, p.is_active, p.volume, p.energy_kcal,
              COALESCE((SELECT json_agg(json_build_object('id', pv.id, 'name', pv.name, 'quantity', pv.quantity, 'price', pv.price, 'unit', pv.unit)
                                 ORDER BY pv.quantity ASC)
                          FROM product_variants pv WHERE pv.product_id = p.id), '[]') AS variants,
              COALESCE((SELECT json_agg(json_build_object('url', pi.url, 'isThumbnail', (pi.image_type = 'thumbnail')) ORDER BY pi.sort_order ASC)
                          FROM product_images pi WHERE pi.product_id = p.id AND pi.is_active = true), '[]') AS images
         FROM products p
        ORDER BY p.created_at ASC`
    );
    return buildLiveCatalog(staticProducts, res.rows as ProductCatalogRow[]);
  } catch (err) {
    console.error('Không thể lấy danh mục sản phẩm từ CSDL:', err);
    return staticProducts;
  }
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
