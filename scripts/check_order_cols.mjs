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
  connectionString: requireDatabaseUrl(),
});

async function main() {
  const r = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders';"
  );
  console.log(r.rows.map((row) => `${row.column_name}: ${row.data_type}`).join('\n'));
  await pool.end();
}

main().catch(console.error);
