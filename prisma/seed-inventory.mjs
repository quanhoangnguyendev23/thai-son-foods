/**
 * Seed/Sync Store Inventory
 * Ensures all active stores have inventory records for all 12 products
 * Run: node prisma/seed-inventory.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from '../scripts/db-guard.mjs';

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
  connectionString:
    requireDatabaseUrl(),
});

async function seedInventory() {
  const client = await pool.connect();
  try {
    console.log('📦 Syncing store inventory for active branches...\n');

    // Get all active stores
    const storesRes = await client.query(
      `SELECT code, name FROM stores WHERE is_active = true ORDER BY code ASC;`
    );
    const activeStores = storesRes.rows;

    // Get all products
    const productsRes = await client.query(
      `SELECT id, name, sku FROM products WHERE is_active = true ORDER BY id ASC;`
    );
    const activeProducts = productsRes.rows;

    console.log(`Found ${activeStores.length} active stores and ${activeProducts.length} active products.`);

    let createdCount = 0;
    let existingCount = 0;

    for (const store of activeStores) {
      for (const prod of activeProducts) {
        const invId = `inv_${store.code}_${prod.id}`;
        const res = await client.query(
          `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, updated_by)
           VALUES ($1, $2, $3, 100, 'system_seed')
           ON CONFLICT (store_code, product_id) DO NOTHING
           RETURNING id;`,
          [invId, store.code, prod.id]
        );

        if (res.rows.length > 0) {
          createdCount++;
        } else {
          existingCount++;
        }
      }
    }

    console.log(`\n✅ Inventory sync complete!`);
    console.log(`   - New inventory records created: ${createdCount}`);
    console.log(`   - Existing inventory records kept: ${existingCount}`);

    // Summary per store
    const summaryRes = await client.query(`
      SELECT 
        s.code,
        s.name,
        COUNT(si.id) AS total_items,
        SUM(si.stock_quantity) AS total_stock
      FROM stores s
      JOIN store_inventory si ON si.store_code = s.code
      WHERE s.is_active = true
      GROUP BY s.code, s.name
      ORDER BY s.code ASC;
    `);

    console.log('\n📊 Inventory Summary per Active Store:');
    console.log('─'.repeat(70));
    console.log('Store Code │ Store Name                  │ Items │ Total Stock');
    console.log('─'.repeat(70));
    for (const row of summaryRes.rows) {
      const code = row.code.padEnd(10);
      const name = (row.name || '').substring(0, 26).padEnd(27);
      const items = String(row.total_items).padStart(5);
      const stock = String(row.total_stock).padStart(11);
      console.log(`${code} │ ${name} │ ${items} │ ${stock}`);
    }
    console.log('─'.repeat(70));
  } catch (err) {
    console.error('❌ Error syncing inventory:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedInventory();
