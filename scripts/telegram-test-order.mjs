// Gửi thử 1 ĐƠN MẪU qua Telegram bằng đúng mẫu tin thật (src/lib/notify/telegram.ts),
// để kiểm tra TELEGRAM_BOT_TOKEN / TELEGRAM_ORDER_CHAT_IDS và xem giao diện tin.
// Cách dùng (đọc biến từ .env.local), chạy trong thư mục thai-son-foods:
//   node --env-file=.env.local scripts/telegram-test-order.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatIds = (process.env.TELEGRAM_ORDER_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!token || chatIds.length === 0) {
  console.error('Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_ORDER_CHAT_IDS.');
  process.exit(1);
}

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(ROOT, 'src') } });
const { notifyNewOrderTelegram } = await jiti.import(path.join(ROOT, 'src/lib/notify/telegram.ts'));

const errors = [];
const origError = console.error;
console.error = (...a) => errors.push(a.join(' '));
await notifyNewOrderTelegram({
  orderCode: 'TSF-MAU-0001',
  fullName: 'Nguyễn Văn Mẫu (ĐƠN TEST)',
  phone: '0901234567',
  address: '123 Đường Số 7, Phường Bình Trị Đông, Quận Bình Tân, TP. Hồ Chí Minh',
  storeCode: 'DN',
  paymentMethod: 'cod',
  subtotal: 435000,
  shippingFee: 15000,
  total: 450000,
  note: 'Giao giờ hành chính, gọi trước 15 phút. (Đây là đơn mẫu để test, không giao)',
  items: [
    { name: 'Sữa bắp nếp (Lốc 7 chai)', quantity: 2, unit: 'Lốc 7 chai', sku: 'SB-01', price: 140000 },
    { name: 'Sữa hạt sen Yoo (Lốc 7 chai)', quantity: 1, unit: 'Lốc 7 chai', sku: 'HS-01', price: 105000 },
    { name: 'Combo Gia đình khỏe mạnh', quantity: 1, unit: 'Combo', isCombo: true, price: 50000 },
  ],
});
console.error = origError;
if (errors.length) {
  errors.forEach((e) => console.log('LỖI:', e));
  process.exit(1);
}
console.log(`ĐÃ GỬI đơn mẫu tới ${chatIds.join(', ')}`);
