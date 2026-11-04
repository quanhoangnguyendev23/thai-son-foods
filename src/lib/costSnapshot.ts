import type { PoolClient } from 'pg';

/**
 * Snapshot giá vốn cho dòng hàng lúc đặt đơn.
 *
 * Giá vốn luôn tính từ giá vốn/chai của sản phẩm (products.cost_price) nhân số chai thực tế
 * của dòng hàng: chai lẻ, lốc/thùng (bottle_multiplier) hay combo (bóc tách theo thành phần)
 * đều dùng chung một cách tính. Nếu một chai bất kỳ trong dòng chưa nhập giá vốn thì trả về
 * null (không ghi giá vốn thiếu, để báo cáo tách riêng thay vì tính lãi sai).
 */

export interface BottleForCost {
  productId: string;
  bottleQuantity: number;
}

/** Lấy giá vốn/chai theo id (hoặc slug) sản phẩm. Chỉ trả về giá vốn > 0. */
export async function loadBottleCosts(client: PoolClient, productIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const res = await client.query(
    `SELECT id, slug, cost_price FROM products WHERE id = ANY($1::text[]) OR slug = ANY($1::text[]);`,
    [ids]
  );
  for (const r of res.rows) {
    const cost = Number(r.cost_price) || 0;
    if (cost <= 0) continue;
    map.set(String(r.id), cost);
    if (r.slug) map.set(String(r.slug), cost);
  }
  return map;
}

/** Tổng giá vốn của một nhóm chai; null nếu có chai chưa có giá vốn. */
export function totalCostOfBottles(bottles: BottleForCost[], costMap: Map<string, number>): number | null {
  if (bottles.length === 0) return null;
  let total = 0;
  for (const b of bottles) {
    const cost = costMap.get(b.productId);
    if (!cost || cost <= 0) return null;
    total += cost * (Number(b.bottleQuantity) || 0);
  }
  return total > 0 ? Math.round(total) : null;
}

/**
 * Giá vốn cho MỘT đơn vị của từng dòng hàng, dựa trên danh sách chai đã bóc tách
 * (expandComboItems trả về bottleQuantity = số chai × số lượng dòng).
 */
export async function computeLineUnitCosts(
  client: PoolClient,
  lineQuantities: number[],
  expandedBottles: Array<BottleForCost & { originalItemIndex: number }>
): Promise<Array<number | null>> {
  const costMap = await loadBottleCosts(client, expandedBottles.map((b) => b.productId));
  return lineQuantities.map((qty, idx) => {
    const total = totalCostOfBottles(
      expandedBottles.filter((b) => b.originalItemIndex === idx),
      costMap
    );
    if (total === null) return null;
    const lineQty = Math.max(1, Math.round(Number(qty) || 1));
    return Math.round(total / lineQty);
  });
}
