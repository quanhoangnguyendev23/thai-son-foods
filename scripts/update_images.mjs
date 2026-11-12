import { Pool } from 'pg';

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase('WebTSF');

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: dbPasswordFromEnv(),
  database: 'WebTSF',
});

async function update() {
  await pool.query(
    'UPDATE products SET thumbnail = $1 WHERE slug = $2',
    ['/images/products/sua-bap-nep.jpg', 'sua-bap-nep-thai-son']
  );
  await pool.query(
    'UPDATE products SET thumbnail = $1 WHERE slug = $2',
    ['/images/products/mu-trom.jpg', 'nha-dam-mu-trom-thai-son']
  );
  const res = await pool.query(
    'SELECT name, thumbnail FROM products WHERE slug IN ($1, $2)',
    ['sua-bap-nep-thai-son', 'nha-dam-mu-trom-thai-son']
  );
  console.log('Updated in WebTSF:');
  console.table(res.rows);
  await pool.end();
}

update().catch(console.error);
