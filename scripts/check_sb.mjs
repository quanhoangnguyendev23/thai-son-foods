import { Pool } from 'pg';

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

async function check() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: dbPasswordFromEnv(),
    database: 'WebTSF',
  });

  const res = await pool.query("SELECT * FROM store_inventory WHERE product_id = 'prod-sb-01';");
  console.log('prod-sb-01 in store_inventory:', res.rows);

  const prodRes = await pool.query("SELECT id, slug, sku, name FROM products WHERE id = 'prod-sb-01' OR slug LIKE '%sua-bap%';");
  console.log('sua bap in products table:', prodRes.rows);

  await pool.end();
}

check().catch(console.error);
