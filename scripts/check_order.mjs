import pg from 'pg';
import { expandComboItems, resolveProductCanonical } from '../src/lib/inventory.ts';

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

const pool = new pg.Pool({
  connectionString: requireDatabaseUrl()
});

async function main() {
  const client = await pool.connect();
  const ord = await client.query('SELECT * FROM orders WHERE order_code = $1', ['TSF-976704']);
  const items = await client.query('SELECT id, name, price, quantity, product_id, combo_snapshot FROM order_items WHERE order_id = $1', [ord.rows[0].id]);
  
  console.log('--- Testing expandComboItems ---');
  const normalizedItems = items.rows.map(it => ({
    productId: it.product_id,
    name: it.name,
    quantity: it.quantity,
    price: it.price
  }));

  for (const it of normalizedItems) {
    const res = await resolveProductCanonical(it.productId, it.name, client);
    console.log(`resolveProductCanonical for [${it.productId}]:`, res);
  }

  const { expandedBottles, comboSnapshots } = await expandComboItems(normalizedItems, client);
  console.log('Expanded Bottles:', expandedBottles);

  client.release();
  await pool.end();
}

main().catch(console.error);
