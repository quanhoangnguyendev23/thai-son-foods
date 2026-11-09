/**
 * Báo đơn hàng mới về Zalo (Zalo Bot Platform — bot.zaloplatforms.com).
 *
 * Cấu hình (.env, KHÔNG commit giá trị thật):
 *   ZALO_BOT_TOKEN        — token của bot, dạng "123456789:xxxx" (lấy khi tạo bot)
 *   ZALO_ORDER_CHAT_IDS   — danh sách chat_id nhận báo đơn, cách nhau bằng dấu phẩy
 *                           (lấy bằng: node scripts/zalo-get-chat-ids.mjs sau khi người nhận nhắn cho bot)
 * Thiếu 1 trong 2 biến → bỏ qua, không ảnh hưởng đặt hàng.
 */

const API_BASE = process.env.ZALO_BOT_API_BASE || 'https://bot-api.zaloplatforms.com';
const MAX_TEXT = 2000; // giới hạn độ dài tin nhắn của Zalo Bot

export interface ZaloOrderNotice {
  orderCode: string;
  fullName: string;
  phone: string;
  address: string;
  storeCode?: string | null;
  paymentMethod?: string | null;
  total: number;
  note?: string | null;
  /** Giờ giao: "Thứ Sáu 06/11, 08:00–09:00" hoặc "Giao ngay, dự kiến 10:15 hôm nay" */
  deliveryLabel?: string | null;
  /** true = đơn hẹn khung giờ (đặt ngoài giờ hoặc khách tự hẹn) */
  deliveryScheduled?: boolean;
  items: {
    name: string;
    quantity: number;
    unit?: string | null;
    /** productId chuẩn trong DB — fallback mã khi không có sku */
    productId?: string | null;
    /** products.sku (vd "TSG-01") — giống cách admin hiển thị mã */
    sku?: string | null;
    isCombo?: boolean;
  }[];
}

const cut = (s: string, max = 30) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Mã ngắn như admin: sku bỏ hậu tố "-01" → id bỏ "prod-" → tên cắt gọn. Combo: tên bỏ chữ "Combo", cắt gọn. */
export function shortItemCode(it: ZaloOrderNotice['items'][number]): string {
  const name = String(it.name || '').trim();
  if (it.isCombo) return cut(name.replace(/^combo\s+/i, '') || name || 'Combo');
  const sku = String(it.sku || '').trim();
  if (sku) return sku.replace(/-\d+$/, '');
  const id = String(it.productId || '').trim();
  if (/^prod-/i.test(id)) return id.replace(/^prod-/i, '').replace(/-\d+$/, '').toUpperCase();
  // Bỏ phần quy cách "(...)" ở cuối tên vì đã in riêng
  return cut(name.replace(/\s*\([^)]*\)\s*$/, '') || 'Sản phẩm');
}

const vnd = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

export function buildOrderText(o: ZaloOrderNotice): string {
  const lines = [
    `🛒 ĐƠN MỚI #${o.orderCode}`,
    `Khách: ${o.fullName} - ${o.phone}`,
    `Địa chỉ: ${o.address}`,
    o.storeCode ? `Chi nhánh: ${o.storeCode}` : '',
    o.deliveryLabel ? `Giao: ${o.deliveryLabel}${o.deliveryScheduled ? ' (ĐƠN HẸN)' : ''}` : '',
    '',
    ...o.items.slice(0, 20).map((it) => `• ${shortItemCode(it)}${it.unit ? ` (${it.unit})` : ''} x${it.quantity}`),
    o.items.length > 20 ? `… và ${o.items.length - 20} dòng khác` : '',
    '',
    `Tổng: ${vnd(o.total)} - ${String(o.paymentMethod || 'cod').toUpperCase()}`,
    o.note ? `Ghi chú: ${o.note}` : '',
  ].filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i > 0));
  const text = lines.join('\n').trim();
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/** Gửi báo đơn tới mọi chat_id đã cấu hình. Không bao giờ ném lỗi ra ngoài. */
export async function notifyNewOrderZalo(order: ZaloOrderNotice): Promise<void> {
  const token = process.env.ZALO_BOT_TOKEN?.trim();
  const chatIds = (process.env.ZALO_ORDER_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return;

  const text = buildOrderText(order);
  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          console.error(`[ZaloNotify] Gửi báo đơn #${order.orderCode} tới ${chatId} lỗi HTTP ${res.status}`);
        }
      } catch (err) {
        console.error(`[ZaloNotify] Không gửi được báo đơn #${order.orderCode}:`, (err as Error)?.message || err);
      }
    })
  );
}
