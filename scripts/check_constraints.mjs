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

async function main() {
  const res = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'store_inventory';
  `);
  console.table(res.rows);
  await pool.end();
}

main().catch(console.error);
