/**
 * Chia combo gợi ý thành 2 hàng KHÔNG TRÙNG NHAU cho trang chi tiết sản phẩm và trang chi tiết combo,
 * để xen kẽ với các hàng sản phẩm (hàng SP → hàng combo → hàng SP → hàng combo).
 *
 * - primary: combo liên quan nhất (có sản phẩm đang xem / có cùng sản phẩm với combo đang xem), đã xếp sẵn.
 * - pool: mọi combo có thể gợi ý (đã bỏ combo đang xem), đã xếp sẵn theo thứ tự muốn hiện ở hàng thứ hai.
 *
 * Quy tắc:
 * - primary ít hơn `min` combo → không có hàng liên quan; toàn bộ pool thành một hàng "nổi bật".
 * - Hàng liên quan lấy tối đa `max` combo; hàng thứ hai là các combo còn lại (không lặp combo của hàng trên).
 * - Hàng thứ hai ít hơn `min` combo → bỏ hàng đó, hàng liên quan hiện đủ mọi combo liên quan.
 */
export function splitComboRows<T extends { id: string }>(
  primary: T[],
  pool: T[],
  { max = 6, min = 2 }: { max?: number; min?: number } = {}
): { related: T[]; others: T[] } {
  if (primary.length < min) return { related: [], others: pool.length >= min ? pool : [] };
  const head = primary.slice(0, max);
  const headIds = new Set(head.map((c) => c.id));
  const others = pool.filter((c) => !headIds.has(c.id));
  if (others.length < min) return { related: primary, others: [] };
  return { related: head, others };
}
