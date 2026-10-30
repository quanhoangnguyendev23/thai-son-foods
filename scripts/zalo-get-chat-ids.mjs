// Lấy chat_id của người đã nhắn cho bot Zalo (để điền ZALO_ORDER_CHAT_IDS).
// Cách dùng: mỗi người nhận báo đơn mở Zalo, tìm bot, nhắn 1 tin bất kỳ; sau đó chạy:
//   ZALO_BOT_TOKEN=<token> node scripts/zalo-get-chat-ids.mjs
// (PowerShell: $env:ZALO_BOT_TOKEN='<token>'; node scripts/zalo-get-chat-ids.mjs)
const token = process.env.ZALO_BOT_TOKEN?.trim();
if (!token) {
  console.error('Thiếu biến ZALO_BOT_TOKEN.');
  process.exit(1);
}
const base = process.env.ZALO_BOT_API_BASE || 'https://bot-api.zaloplatforms.com';
const res = await fetch(`${base}/bot${token}/getUpdates`, { method: 'POST' });
const data = await res.json().catch(() => null);
if (!res.ok || !data) {
  console.error('Gọi getUpdates lỗi:', res.status, data);
  process.exit(1);
}
const updates = Array.isArray(data.result) ? data.result : data.result ? [data.result] : [];
if (updates.length === 0) {
  console.log('Chưa có tin nhắn mới. Hãy nhắn 1 tin cho bot rồi chạy lại (tin cũ đã đọc sẽ không hiện lại).');
}
for (const u of updates) {
  const m = u.message || u;
  const chat = m.chat || {};
  const from = m.from || {};
  console.log(`chat_id=${chat.id}  tên=${from.display_name || from.name || ''}  tin="${(m.text || '').slice(0, 40)}"`);
}
