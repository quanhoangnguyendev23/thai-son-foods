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

async function updateSchema() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: dbPasswordFromEnv(),
    database: 'WebTSF',
  });

  console.log('--- CẬP NHẬT CẤU TRÚC BẢNG QUẢN LÝ TỒN KHO & TÀI KHOẢN ---');

  // 1. Add stock_quantity to products table
  await pool.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 100;
  `);
  console.log('✅ Đã thêm cột stock_quantity vào bảng products');

  // 2. Create store_inventory table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_inventory (
      id VARCHAR(50) PRIMARY KEY,
      store_code VARCHAR(50) NOT NULL,
      product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      stock_quantity INTEGER NOT NULL DEFAULT 100,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(100),
      UNIQUE(store_code, product_id)
    );
  `);
  console.log('✅ Đã tạo bảng store_inventory quản lý tồn kho từng cửa hàng');

  // 3. Seed initial inventory for all 5 stores and all 12 products
  const prods = await pool.query('SELECT id, name FROM products ORDER BY id;');
  const stores = ['adminCH1', 'adminCH2', 'adminCH3', 'adminCH4', 'adminCH5'];

  for (const store of stores) {
    for (const p of prods.rows) {
      const invId = `inv_${store}_${p.id}`;
      await pool.query(
        `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, updated_by)
         VALUES ($1, $2, $3, 100, $2)
         ON CONFLICT (store_code, product_id) DO NOTHING;`,
        [invId, store, p.id]
      );
    }
  }
  console.log(`✅ Đã khởi tạo dữ liệu tồn kho ban đầu (100 chai/sản phẩm) cho 5 cửa hàng`);

  await pool.end();
}

updateSchema().catch(console.error);
