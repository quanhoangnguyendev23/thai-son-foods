import pg from 'pg';
import { getAvailability, expandComboItems } from '../src/lib/inventory.ts';

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
  const c = await pool.connect();
  const testItem = [{
    productId: 'prod-sb-01',
    name: 'Sữa Bắp Nếp nguyên chất (10 chai)',
    quantity: 1,
    unit: '10 chai'
  }];

  const exp = await expandComboItems(testItem, c);
  console.log('Expanded:', JSON.stringify(exp, null, 2));

  const avail = await getAvailability('staff_empty_store', testItem, c);
  console.log('Availability on staff_empty_store:', JSON.stringify(avail, null, 2));

  // Check store_inventory for staff_empty_store
  const inv = await c.query("SELECT * FROM store_inventory WHERE store_code = 'staff_empty_store';");
  console.log('Rows in store_inventory for staff_empty_store:', inv.rows.length);
  console.table(inv.rows);

  c.release();
  await pool.end();
}

main().catch(console.error);
