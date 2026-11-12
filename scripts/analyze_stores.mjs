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
  const res = await pool.query('SELECT * FROM stores ORDER BY id');
  console.log(`TOTAL_COUNT: ${res.rows.length}`);
  res.rows.forEach((s, i) => {
    console.log(`[${i + 1}] ID: ${s.id} | CODE: ${s.code} | NAME: ${s.name} | ACTIVE: ${s.is_active} | ADDR: ${s.address} | PHONE: ${s.phone}`);
  });
  await pool.end();
}

main().catch(console.error);
