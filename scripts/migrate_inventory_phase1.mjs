import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { INVENTORY_CONFIG } from '../src/config/inventory.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

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
  connectionString:
    requireDatabaseUrl(),
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Bắt đầu chạy Migration Giai đoạn 1: Nền tảng dữ liệu & Chống bán lố...\n');

    await client.query('BEGIN;');

    // 1. Thêm cột reserved và safety_stock vào store_inventory
    console.log('1️⃣ Cập nhật bảng store_inventory...');
    await client.query(`
      ALTER TABLE store_inventory ADD COLUMN IF NOT EXISTS reserved INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE store_inventory ADD COLUMN IF NOT EXISTS safety_stock INTEGER NOT NULL DEFAULT 0;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_store_inventory_reserved'
        ) THEN
          ALTER TABLE store_inventory ADD CONSTRAINT chk_store_inventory_reserved CHECK (reserved >= 0);
        END IF;
      END $$;
    `);
    console.log('   ✅ Đã cập nhật reserved và safety_stock, ràng buộc reserved >= 0.');

    // 2. Thêm combo_snapshot vào order_items
    console.log('\n2️⃣ Cập nhật bảng order_items...');
    await client.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS combo_snapshot JSONB;
    `);
    console.log('   ✅ Đã thêm cột combo_snapshot JSONB.');

    // 3. Tạo bảng stock_reservations
    console.log('\n3️⃣ Tạo bảng stock_reservations & indexes...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_reservations (
        id VARCHAR(100) PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        store_code VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        released_at TIMESTAMP WITH TIME ZONE
      );
      CREATE INDEX IF NOT EXISTS idx_stock_res_order ON stock_reservations(order_id);
      CREATE INDEX IF NOT EXISTS idx_stock_res_status ON stock_reservations(status);
      CREATE INDEX IF NOT EXISTS idx_stock_res_expires ON stock_reservations(expires_at);
      CREATE INDEX IF NOT EXISTS idx_stock_res_store_prod ON stock_reservations(store_code, product_id);
    `);
    console.log('   ✅ Đã tạo bảng stock_reservations thành công.');

    // 4. Xử lý dữ liệu đơn PENDING hiện có
    console.log('\n4️⃣ Khảo sát và xử lý các đơn PENDING cũ...');
    const pendingRes = await client.query(`
      SELECT id, order_code, store_code, created_at,
             EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/3600 AS age_hours
      FROM orders
      WHERE status = 'PENDING'
      ORDER BY created_at ASC;
    `);

    console.log(`   Tìm thấy ${pendingRes.rows.length} đơn hàng PENDING trong cơ sở dữ liệu:`);

    let compensatedCount = 0;
    let expiredOldCount = 0;
    let missingStoreCount = 0;

    for (const order of pendingRes.rows) {
      const ageHours = parseFloat(order.age_hours);
      console.log(`   - Đơn ${order.order_code} (ID: ${order.id}): tạo cách đây ${ageHours.toFixed(1)} giờ, chi nhánh: ${order.store_code || 'null'}`);

      if (ageHours > INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS) {
        expiredOldCount++;
        console.log(`     -> Đơn cũ quá ${INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS}h: Giữ nguyên trạng thái PENDING theo quy định, không tạo reservation giữ chỗ.`);
      } else if (!order.store_code) {
        missingStoreCount++;
        console.log(`     -> Đơn thiếu store_code: Không thể tự động gán kho, ghi log cho Admin gán thủ công.`);
      } else {
        // Kiểm tra xem đơn đã có reservation chưa
        const checkRes = await client.query(
          `SELECT count(*) FROM stock_reservations WHERE order_id = $1;`,
          [order.id]
        );
        if (parseInt(checkRes.rows[0].count, 10) > 0) {
          console.log(`     -> Đơn đã có reservation, bỏ qua.`);
          continue;
        }

        // Lấy danh sách món để tạo reservation bù
        const itemsRes = await client.query(
          `SELECT oi.id, oi.product_id, oi.name, oi.quantity, oi.unit
           FROM order_items oi WHERE oi.order_id = $1;`,
          [order.id]
        );

        let orderCompensated = true;
        for (const it of itemsRes.rows) {
          // Tìm canonical product
          const prodRes = await client.query(
            `SELECT id, name FROM products
             WHERE id = $1 OR slug = $1 OR sku = $1 OR name ILIKE $2
             LIMIT 1;`,
            [it.product_id, `%${it.name}%`]
          );

          if (prodRes.rows.length > 0) {
            const canonicalProdId = prodRes.rows[0].id;
            const resId = `res_migration_${order.id}_${canonicalProdId}`;
            const qty = Math.max(1, parseInt(it.quantity, 10));

            // Kiểm tra tồn
            const invRes = await client.query(
              `SELECT stock_quantity, reserved FROM store_inventory
               WHERE store_code = $1 AND product_id = $2;`,
              [order.store_code, canonicalProdId]
            );

            if (invRes.rows.length > 0) {
              const curStock = invRes.rows[0].stock_quantity;
              const curReserved = invRes.rows[0].reserved;
              if (curStock - curReserved >= qty) {
                await client.query(
                  `INSERT INTO stock_reservations (id, order_id, store_code, product_id, quantity, status, expires_at)
                   VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP + ($6 || ' hours')::INTERVAL)
                   ON CONFLICT (id) DO NOTHING;`,
                  [resId, order.id, order.store_code, canonicalProdId, qty, INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS.toString()]
                );

                await client.query(
                  `UPDATE store_inventory
                   SET reserved = reserved + $1, updated_at = CURRENT_TIMESTAMP
                   WHERE store_code = $2 AND product_id = $3;`,
                  [qty, order.store_code, canonicalProdId]
                );
              } else {
                console.warn(`     ⚠️ Kho ${order.store_code} không đủ tồn cho sản phẩm ${canonicalProdId} (Tồn: ${curStock}, Giữ: ${curReserved}, Cần: ${qty})`);
                orderCompensated = false;
              }
            }
          }
        }

        if (orderCompensated) {
          compensatedCount++;
          console.log(`     ✅ Đã bù reservation thành công cho đơn ${order.order_code}.`);
        }
      }
    }

    await client.query('COMMIT;');

    console.log('\n🎉 Migration Giai đoạn 1 hoàn tất thành công!');
    console.log(`   - Đơn PENDING quá 24h không giữ chỗ: ${expiredOldCount}`);
    console.log(`   - Đơn PENDING thiếu chi nhánh: ${missingStoreCount}`);
    console.log(`   - Đơn PENDING trong 24h đã được bù reservation: ${compensatedCount}`);
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Lỗi khi chạy migration:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
