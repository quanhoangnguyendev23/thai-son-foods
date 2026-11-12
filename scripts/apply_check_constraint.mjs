import pg from 'pg';

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
  connectionString: requireDatabaseUrl()
});

async function main() {
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_variants_bottle_multiplier'
      ) THEN
        ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_bottle_multiplier CHECK (bottle_multiplier > 0);
      END IF;
    END $$;
  `);
  console.log('CHECK constraint chk_product_variants_bottle_multiplier verified on product_variants.');

  // Kiểm tra thông tin ràng buộc
  const res = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'product_variants'::regclass;
  `);
  console.log('Constraints on product_variants:', res.rows);
  await pool.end();
}

main().catch(console.error);
