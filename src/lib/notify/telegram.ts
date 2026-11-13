/**
 * Báo đơn hàng mới về Telegram (bot @thaisonfoods_order_bot).
 *
 * Cấu hình (.env.local / Vercel env, KHÔNG commit giá trị thật):
 *   TELEGRAM_BOT_TOKEN        — token bot lấy từ @BotFather, dạng "123456789:AA..."
 *   TELEGRAM_ORDER_CHAT_IDS   — danh sách chat_id nhận báo đơn, cách nhau bằng dấu phẩy
 *                               (group có id âm, vd -5123220583; lấy qua https://api.telegram.org/bot<TOKEN>/getUpdates)
 * Thiếu 1 trong 2 biến → bỏ qua, không ảnh hưởng đặt hàng.
 *
 * Tin gửi dạng HTML của Telegram (in đậm, khung trích dẫn, chữ đơn cách bấm để sao chép).
 * Telegram không cho đổi màu chữ, nên dùng biểu tượng màu để phân nhóm thông tin.
 * Nếu Telegram từ chối HTML thì gửi lại bản chữ thường (buildOrderText) để không mất tin.
 */
import { buildOrderText, shortItemCode, type ZaloOrderNotice } from './zalo';

const API_BASE = 'https://api.telegram.org';
const MAX_TEXT = 4000; // Telegram giới hạn 4096 ký tự / tin
const MAX_ITEMS = 25;
const LINE = '━━━━━━━━━━━━━━━━';

export interface TelegramOrderNotice extends Omit<ZaloOrderNotice, 'items'> {
  subtotal?: number | null;
  shippingFee?: number | null;
  createdAt?: Date;
  items: (ZaloOrderNotice['items'][number] & { price?: number | null })[];
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const vnd = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

const PAYMENT_LABEL: Record<string, string> = {
  cod: '💵 COD · thu tiền khi giao',
  bank: '🏦 Chuyển khoản',
  transfer: '🏦 Chuyển khoản',
};

function vnTime(d: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function buildOrderHtml(o: TelegramOrderNotice): string {
  const items = o.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  // Dòng sản phẩm: không icon cho đỡ rối, chỉ STT · mã · quy cách · số lượng · thành tiền
  const itemLines = items.slice(0, MAX_ITEMS).map((it, i) => {
    const qty = Number(it.quantity) || 0;
    const code = shortItemCode(it);
    const price = Number(it.price);
    const lineTotal = Number.isFinite(price) && price > 0 ? `  =  <b>${vnd(price * qty)}</b>` : '';
    const spec = it.isCombo ? 'Gói' : it.unit ? esc(it.unit) : '';
    return `${i + 1}. <b>${esc(code)}</b>${spec ? ` · ${spec}` : ''} × ${qty}${lineTotal}`;
  });
  if (items.length > MAX_ITEMS) itemLines.push(`… và ${items.length - MAX_ITEMS} dòng khác`);

  const pay = PAYMENT_LABEL[String(o.paymentMethod || 'cod').toLowerCase()] || `💳 ${esc(String(o.paymentMethod).toUpperCase())}`;
  const hasBreakdown = o.subtotal != null || o.shippingFee != null;
  const ship = Number(o.shippingFee) || 0;

  const customer = [
    `<b>${esc(o.fullName)}</b>`,
    `📞 <code>${esc(o.phone)}</code>`,
    `📍 ${esc(o.address)}`,
    o.storeCode ? `🏪 Chi nhánh <b>${esc(o.storeCode)}</b>` : '',
  ].filter(Boolean);

  const money = [
    hasBreakdown ? `Tạm tính:  ${vnd(Number(o.subtotal) || 0)}` : '',
    hasBreakdown ? `Phí giao:  ${ship > 0 ? vnd(ship) : 'Miễn phí'}` : '',
    `<b>TỔNG THU:  ${vnd(o.total)}</b>`,
    pay,
  ].filter(Boolean);

  const parts = [
    `🟢 <b>ĐƠN HÀNG MỚI</b>  <code>${esc(o.orderCode)}</code>`,
    `🕒 ${esc(vnTime(o.createdAt || new Date()))}`,
    o.deliveryLabel
      ? o.deliveryScheduled
        ? `🚚 <b>GIAO: ${esc(o.deliveryLabel)}</b>  (đơn hẹn)`
        : `🚚 <b>${esc(o.deliveryLabel)}</b>`
      : '',
    LINE,
    `👤 <b>KHÁCH HÀNG</b>`,
    `<blockquote>${customer.join('\n')}</blockquote>`,
    `📦 <b>SẢN PHẨM</b>  ·  ${items.length} dòng, ${totalQty} món`,
    `<blockquote>${itemLines.join('\n')}</blockquote>`,
    `💰 <b>THANH TOÁN</b>`,
    `<blockquote>${money.join('\n')}</blockquote>`,
    o.note ? `📝 <b>Ghi chú:</b> <i>${esc(o.note)}</i>` : '',
  ].filter(Boolean);

  const html = parts.join('\n');
  // Quá dài thì để bản chữ thường lo (cắt HTML giữa chừng sẽ vỡ thẻ)
  return html.length > MAX_TEXT ? '' : html;
}

// Group Telegram chỉ nhận ~20 tin/phút: nhiều đơn dồn cùng lúc sẽ bị 429 kèm retry_after (giây).
// Chờ đúng thời gian Telegram yêu cầu rồi gửi lại, tối đa RETRY_BUDGET_MS để không vượt thời gian chạy của hàm Vercel.
const RETRY_BUDGET_MS = 200_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(token: string, chatId: string, payload: Record<string, unknown>) {
  const started = Date.now();
  for (;;) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, disable_web_page_preview: true, ...payload }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      // Mạng chập chờn / Telegram trả lời chậm lúc đông: thử lại sau vài giây (thà trùng tin còn hơn mất đơn)
      if (Date.now() - started + 5000 > RETRY_BUDGET_MS) throw err;
      await sleep(3000 + Math.random() * 4000);
      continue;
    }
    if (res.status !== 429) return res;
    const body = await res.clone().json().catch(() => null);
    const waitMs = (Math.max(1, Number(body?.parameters?.retry_after) || 5) + Math.random() * 5) * 1000;
    if (Date.now() - started + waitMs > RETRY_BUDGET_MS) return res;
    await sleep(waitMs);
  }
}

/** Gửi báo đơn tới mọi chat_id đã cấu hình. Không bao giờ ném lỗi ra ngoài. */
export async function notifyNewOrderTelegram(order: TelegramOrderNotice): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = (process.env.TELEGRAM_ORDER_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return;

  let html = '';
  let plain = '';
  try {
    html = buildOrderHtml(order);
  } catch (err) {
    console.error('[TelegramNotify] Không tạo được tin HTML:', (err as Error)?.message || err);
  }
  try {
    plain = buildOrderText(order);
  } catch (err) {
    console.error('[TelegramNotify] Không tạo được nội dung báo đơn:', (err as Error)?.message || err);
    if (!html) return;
  }

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        let res = html ? await send(token, chatId, { text: html, parse_mode: 'HTML' }) : null;
        // HTML bị từ chối (400) hoặc không có HTML → gửi bản chữ thường
        if ((!res || res.status === 400) && plain) {
          if (res) console.error(`[TelegramNotify] HTML bị từ chối cho #${order.orderCode}, gửi lại dạng chữ thường`);
          res = await send(token, chatId, { text: plain });
        }
        if (res && !res.ok) {
          console.error(`[TelegramNotify] Gửi báo đơn #${order.orderCode} tới ${chatId} lỗi HTTP ${res.status}`);
        }
      } catch (err) {
        console.error(`[TelegramNotify] Không gửi được báo đơn #${order.orderCode}:`, (err as Error)?.message || err);
      }
    })
  );
}
