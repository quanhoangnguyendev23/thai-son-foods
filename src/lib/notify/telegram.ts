/**
 * Báo đơn hàng mới về Telegram (bot @thaisonfoods_order_bot).
 *
 * Cấu hình (.env.local / Vercel env, KHÔNG commit giá trị thật):
 *   TELEGRAM_BOT_TOKEN        — token bot lấy từ @BotFather, dạng "123456789:AA..."
 *   TELEGRAM_ORDER_CHAT_IDS   — danh sách chat_id nhận báo đơn, cách nhau bằng dấu phẩy
 *                               (người nhận /start bot, rồi mở https://api.telegram.org/bot<TOKEN>/getUpdates)
 * Thiếu 1 trong 2 biến → bỏ qua, không ảnh hưởng đặt hàng.
 */
import { buildOrderText, type ZaloOrderNotice } from './zalo';

const API_BASE = 'https://api.telegram.org';

/** Gửi báo đơn tới mọi chat_id đã cấu hình. Không bao giờ ném lỗi ra ngoài. */
export async function notifyNewOrderTelegram(order: ZaloOrderNotice): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = (process.env.TELEGRAM_ORDER_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return;

  let text: string;
  try {
    text = buildOrderText(order);
  } catch (err) {
    console.error('[TelegramNotify] Không tạo được nội dung báo đơn:', (err as Error)?.message || err);
    return;
  }

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          console.error(`[TelegramNotify] Gửi báo đơn #${order.orderCode} tới ${chatId} lỗi HTTP ${res.status}`);
        }
      } catch (err) {
        console.error(`[TelegramNotify] Không gửi được báo đơn #${order.orderCode}:`, (err as Error)?.message || err);
      }
    })
  );
}
