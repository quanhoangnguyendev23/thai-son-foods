// Gửi thử 1 tin báo đơn qua Telegram để kiểm tra TELEGRAM_BOT_TOKEN / TELEGRAM_ORDER_CHAT_IDS.
// Cách dùng (đọc biến từ .env.local):
//   node --env-file=.env.local scripts/telegram-test-order.mjs
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatIds = (process.env.TELEGRAM_ORDER_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!token || chatIds.length === 0) {
  console.error('Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_ORDER_CHAT_IDS.');
  process.exit(1);
}
const text = '🛒 TIN THỬ — báo đơn Thái Sơn Foods qua Telegram đã hoạt động.';
for (const chatId of chatIds) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const data = await res.json().catch(() => null);
  console.log(chatId, res.ok && data?.ok ? 'ĐÃ GỬI' : `LỖI ${res.status} ${data?.description || ''}`);
}
