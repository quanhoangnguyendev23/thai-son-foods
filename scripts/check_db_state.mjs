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

  const tablesRes = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
  );
  console.log('=== TABLES IN WebTSF ===');
  console.log(tablesRes.rows.map((r) => r.table_name));

  const prodsRes = await pool.query('SELECT id, sku, name, price, unit FROM products ORDER BY id;');
  console.log('\n=== PRODUCTS IN DB ===');
  console.log(`Count: ${prodsRes.rows.length}`);
  prodsRes.rows.forEach((p) => console.log(`- [${p.sku}] ${p.name} | ${p.price}đ`));

  const combosRes = await pool.query('SELECT id, slug, name, sale_price, total_items FROM combos ORDER BY id;');
  console.log('\n=== COMBOS IN DB ===');
  console.log(`Count: ${combosRes.rows.length}`);
  combosRes.rows.forEach((c) => console.log(`- [${c.id}] ${c.name.slice(0, 60)}... | ${c.sale_price}đ (${c.total_items} chai)`));

  const ordersRes = await pool.query('SELECT count(*) as total_orders FROM orders;');
  console.log(`\n=== TOTAL ORDERS: ${ordersRes.rows[0].total_orders} ===`);

  await pool.end();
}

check().catch(console.error);
