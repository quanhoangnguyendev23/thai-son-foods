/**
 * TEST-GUARD: chốt chặn database cho test và script có ghi / xóa dữ liệu.
 *
 * Chỉ cho chạy khi tên database có chứa "staging" hoặc "test" (không phân biệt hoa thường).
 * Ngoại lệ duy nhất: chạy kèm biến môi trường ALLOW_PROD_DB=yes (chủ động xác nhận chạy trên DB thật).
 * Không thỏa: in lỗi rõ ràng rồi dừng tiến trình (exit code 1) trước khi chạm vào dữ liệu.
 *
 * Cách dùng (gọi ở đầu file, ngay sau các dòng import):
 *   import { assertSafeDatabase } from './db-guard.mjs';
 *   assertSafeDatabase();                  // kiểm tra DATABASE_URL (tự nạp .env nếu chưa có)
 *   assertSafeDatabase('WebTSF');          // kiểm tra tên DB mà script ghi vào (khi script không dùng DATABASE_URL)
 *   assertSafeDatabase(urlTuThamSo);       // kiểm tra chuỗi kết nối nhận từ tham số dòng lệnh
 */

export const SAFE_DATABASE_NAME_PATTERN = /staging|test/i;

/** Tên database từ chuỗi kết nối postgres(ql)://... hoặc trả nguyên nếu đã là tên DB. */
export function getDatabaseName(target) {
  if (!target) return '';
  const value = String(target).trim();
  if (/^postgres(ql)?:\/\//i.test(value)) {
    return decodeURIComponent(new URL(value).pathname.replace(/^\//, ''));
  }
  return value;
}

export function assertSafeDatabase(target, { label } = {}) {
  if (target === undefined && !process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const source = target === undefined ? process.env.DATABASE_URL : target;
  const where = label || process.argv[1] || 'script';

  let dbName = '';
  let parseError = '';
  try {
    dbName = getDatabaseName(source);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }

  if (dbName && SAFE_DATABASE_NAME_PATTERN.test(dbName)) return dbName;

  if (process.env.ALLOW_PROD_DB === 'yes') {
    console.warn(
      `[DB-GUARD] ALLOW_PROD_DB=yes: cho phép ${where} chạy trên database "${dbName || '(không xác định)'}" ` +
        '(không phải staging/test). / Running against a non-staging/test database because ALLOW_PROD_DB=yes.'
    );
    return dbName;
  }

  const reason = !source
    ? 'Thiếu DATABASE_URL (đặt trong .env hoặc biến môi trường). / DATABASE_URL is not set.'
    : parseError
      ? `Không đọc được tên database từ chuỗi kết nối: ${parseError}. / Cannot parse database name.`
      : `Database "${dbName}" không chứa "staging" hoặc "test". / Database "${dbName}" is not a staging/test database.`;

  console.error(
    [
      '',
      '[DB-GUARD] DỪNG: không chạy trên database này để tránh ghi / xóa nhầm dữ liệu thật.',
      '[DB-GUARD] STOPPED: refusing to write to this database.',
      `  File: ${where}`,
      `  Lý do / Reason: ${reason}`,
      '  Cách xử lý / Fix: trỏ DATABASE_URL vào DB có tên chứa "staging" hoặc "test";',
      '  hoặc nếu CHẮC CHẮN muốn chạy trên DB thật / or, if you are sure: ALLOW_PROD_DB=yes',
      '',
    ].join('\n')
  );
  process.exit(1);
}
