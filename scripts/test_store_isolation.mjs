import pg from 'pg';

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
  console.log('--- Testing Store Inventory Deduction ---');

  // Simulate order deduction for CH1 of 15 bottles
  const qtyDeduct = 15;
  const storeToDeduct = 'adminCH1';

  await pool.query(
    `UPDATE store_inventory
     SET stock_quantity = GREATEST(0, stock_quantity - $1),
         updated_at = CURRENT_TIMESTAMP,
         updated_by = 'system_test'
     WHERE store_code = $2 AND product_id = $3;`,
    [qtyDeduct, storeToDeduct, 'prod-sb-01']
  );

  // Sync products.stock_quantity to SUM of store_inventory
  await pool.query(
    `UPDATE products 
     SET stock_quantity = (
       SELECT COALESCE(SUM(stock_quantity), 0) 
       FROM store_inventory 
       WHERE product_id = $1
     )
     WHERE id = $1;`,
    ['prod-sb-01']
  );

  const res = await pool.query(
    `SELECT store_code, stock_quantity FROM store_inventory WHERE product_id = 'prod-sb-01' ORDER BY store_code;`
  );
  console.log('Inventories after CH1 deducted 15 bottles:');
  console.table(res.rows);

  const prodRes = await pool.query(
    `SELECT id, name, stock_quantity FROM products WHERE id = 'prod-sb-01';`
  );
  console.log('Product Total Stock now:', prodRes.rows[0].stock_quantity);

  const storeMap = Object.fromEntries(res.rows.map((r) => [r.store_code, r.stock_quantity]));
  const okCH1 = storeMap['adminCH1'] === 30; // 45 - 15 = 30
  const okCH2 = storeMap['adminCH2'] === 80; // unchanged
  const okCH3 = storeMap['adminCH3'] === 10; // unchanged
  const okCH4 = storeMap['adminCH4'] === 0;  // unchanged
  const okCH5 = storeMap['adminCH5'] === 25; // unchanged
  const okTotal = prodRes.rows[0].stock_quantity === 145; // 30 + 80 + 10 + 0 + 25 = 145

  console.log('✓ CH1 reduced to 30:', okCH1);
  console.log('✓ CH2 remains 80:', okCH2);
  console.log('✓ CH3 remains 10:', okCH3);
  console.log('✓ CH4 remains 0:', okCH4);
  console.log('✓ CH5 remains 25:', okCH5);
  console.log('✓ Total stock is 145:', okTotal);

  if (okCH1 && okCH2 && okCH3 && okCH4 && okCH5 && okTotal) {
    console.log('\n>>> PASSED: Each store calculates inventory 100% separately! <<<');
  }

  await pool.end();
}

main();
