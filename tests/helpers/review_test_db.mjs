/**
 * Chuẩn bị môi trường cho test tích hợp trên DB RIÊNG "webtsf_review_test" (PostgreSQL local, DB trống tạo riêng cho test).
 * - Lấy tài khoản/máy chủ từ DATABASE_URL trong .env.local / .env nhưng ĐỔI tên DB sang webtsf_review_test.
 * - Từ chối chạy nếu kết quả không phải localhost + đúng tên DB test.
 * - Tắt Telegram, Zalo, email, Resend để test không gửi tin thật.
 * PHẢI gọi trước khi import bất kỳ module nào của src/ (vì src/lib/db.ts đọc DATABASE_URL lúc nạp).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REVIEW_TEST_DB = 'webtsf_review_test';

function readEnvFileValue(file, key) {
  if (!fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

export function setupReviewTestEnv() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const base =
    process.env.REVIEW_TEST_BASE_DATABASE_URL ||
    readEnvFileValue(path.join(root, '.env.local'), 'DATABASE_URL') ||
    readEnvFileValue(path.join(root, '.env'), 'DATABASE_URL');
  if (!base) throw new Error('[REVIEW_TEST] Không tìm thấy DATABASE_URL để lấy tài khoản PostgreSQL local.');

  const u = new URL(base);
  const host = u.hostname.toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    throw new Error(`[REVIEW_TEST] Từ chối: máy chủ DB (${host}) không phải localhost.`);
  }
  u.pathname = `/${REVIEW_TEST_DB}`;
  if (decodeURIComponent(u.pathname.slice(1)) !== REVIEW_TEST_DB) throw new Error('[REVIEW_TEST] Tên DB test không hợp lệ.');

  process.env.DATABASE_URL = u.toString();
  process.env.NODE_ENV = 'test';
  // Giá trị rỗng vẫn được tính là "đã đặt" nên dotenv/config không ghi đè từ .env
  for (const k of [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ORDER_CHAT_IDS',
    'ZALO_BOT_TOKEN',
    'ZALO_ORDER_CHAT_IDS',
    'SMTP_USER',
    'SMTP_PASS',
    'RESEND_API_KEY',
  ]) {
    process.env[k] = '';
  }
  return { dbUrl: process.env.DATABASE_URL, dbName: REVIEW_TEST_DB };
}
