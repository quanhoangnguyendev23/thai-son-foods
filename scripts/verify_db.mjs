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

async function verify() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: dbPasswordFromEnv(),
    database: 'WebTSF',
  });

  const orders = await pool.query('SELECT order_code, full_name, phone, total, status, created_at FROM orders;');
  console.log('=== ORDERS IN DATABASE WebTSF ===');
  console.table(orders.rows);

  const items = await pool.query('SELECT name, price, quantity, unit FROM order_items;');
  console.log('=== ORDER ITEMS IN DATABASE WebTSF ===');
  console.table(items.rows);

  const products = await pool.query('SELECT name, price, unit FROM products LIMIT 5;');
  console.log('=== PRODUCTS IN DATABASE WebTSF (5 of 12) ===');
  console.table(products.rows);

  await pool.end();
}

verify().catch(console.error);
