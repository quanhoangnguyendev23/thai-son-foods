import pg from 'pg';

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
  const cols = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'product_variants' ORDER BY ordinal_position`);
  console.log('Columns:', cols.rows);

  const res = await pool.query('SELECT * FROM product_variants ORDER BY product_id, id');
  console.log(`Total variants in DB: ${res.rows.length}`);
  res.rows.slice(0, 10).forEach(r => console.log(r));
  await pool.end();
}

main().catch(console.error);
