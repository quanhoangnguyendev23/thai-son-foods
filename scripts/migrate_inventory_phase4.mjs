import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const pool = new pg.Pool({
  connectionString:
    requireDatabaseUrl(),
});

async function migratePhase4() {
  const client = await pool.connect();
  try {
    console.log('🚀 Bắt đầu chạy Migration Giai đoạn 4: Bảng lịch sử thay đổi tồn kho (inventory_logs)...\n');
    await client.query('BEGIN;');

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id VARCHAR(100) PRIMARY KEY,
        store_code VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        old_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        old_reserved INTEGER NOT NULL DEFAULT 0,
        new_reserved INTEGER NOT NULL DEFAULT 0,
        change_type VARCHAR(50) NOT NULL,
        order_id VARCHAR(50),
        actor VARCHAR(100) NOT NULL,
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_inv_logs_store ON inventory_logs(store_code);
      CREATE INDEX IF NOT EXISTS idx_inv_logs_product ON inventory_logs(product_id);
      CREATE INDEX IF NOT EXISTS idx_inv_logs_created_at ON inventory_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inv_logs_order ON inventory_logs(order_id);
    `);

    await client.query('COMMIT;');
    console.log('✅ Tạo bảng inventory_logs và các index thành công!');
  } catch (error) {
    await client.query('ROLLBACK;');
    console.error('❌ Lỗi migration Phase 4:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migratePhase4();
