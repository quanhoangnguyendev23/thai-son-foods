import pg from 'pg';
import fs from 'fs';
import path from 'path';

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

const { Pool } = pg;
const pool = new Pool({
  connectionString: requireDatabaseUrl(),
});

async function main() {
  const newName = 'Trà Sữa nấu từ trà nguyên bản, đậm vị trà béo vị sữa, thức uống tiện lợi dùng ngay, chai 330ml';
  
  // 1. Update in DB
  await pool.query('UPDATE products SET name = $1 WHERE id = $2;', [newName, 'prod-tsg-01']);
  const dbRes = await pool.query('SELECT id, sku, name FROM products WHERE id = $1;', ['prod-tsg-01']);
  console.log('1. DB updated:', dbRes.rows[0]);

  // 2. Update in src/data/products.ts
  const filePath = path.join(process.cwd(), 'src', 'data', 'products.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace name in TSG-01 block
  const oldText = "name: 'Trà Sữa nấu từ trà nguyên bản, đậm vị trà béo vị sữa, thức uống tiện lợi dùng ngay, chai 330ml, đạt chuẩn HACCP.',";
  const replacementText = `name: ${JSON.stringify(newName)},`;

  if (content.includes(oldText)) {
    content = content.replace(oldText, replacementText);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('2. File src/data/products.ts updated successfully!');
  } else {
    console.log('Old text not found directly, checking if already updated...');
    if (content.includes(newName)) {
      console.log('Already contains newName in products.ts');
    }
  }

  await pool.end();
}

main();
