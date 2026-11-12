import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import pg from 'pg';

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || dbPasswordFromEnv(),
  database: process.env.DB_NAME || 'WebTSF_staging',
});

async function run() {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_store_inventory_stock_quantity'
      ) THEN
        ALTER TABLE store_inventory ADD CONSTRAINT chk_store_inventory_stock_quantity CHECK (stock_quantity >= 0);
      END IF;
    END $$;
  `);
  console.log('Migration SUCCESS: chk_store_inventory_stock_quantity added!');
  await pool.end();
}

run().catch(console.error);
