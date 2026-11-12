/**
 * migrate_phase4_cost_price.mjs
 * 
 * Migration Phase 4: Quản lý giá vốn & Báo cáo lợi nhuận
 * 
 * Thực thi:
 *   node scripts/migrate_phase4_cost_price.mjs --dry-run
 *   node scripts/migrate_phase4_cost_price.mjs --apply
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const DB_URL = requireDatabaseUrl();
const pool = new pg.Pool({ connectionString: DB_URL });
const isDryRun = !process.argv.includes('--apply');

async function main() {
  console.log('=====================================================');
  console.log(`MIGRATION PHASE 4: GIÁ VỐN & SNAPSHOT LỢI NHUẬN`);
  console.log(`MODE: ${isDryRun ? 'DRY-RUN (Không thay đổi DB)' : 'APPLY (Thực thi trực tiếp)'}`);
  console.log('=====================================================\n');

  const client = await pool.connect();
  try {
    const sqlPath = path.resolve('scripts/migrations/phase4_cost_price_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('1. Kiểm tra cấu trúc hiện tại:');
    const currentCols = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('products', 'combos', 'order_items') 
        AND column_name = 'cost_price';
    `);
    console.log(`- Các cột cost_price đã có: ${currentCols.rows.length === 0 ? 'Chưa có' : currentCols.rows.map(r => `${r.table_name}.${r.column_name}`).join(', ')}`);

    if (isDryRun) {
      console.log('\n[DRY RUN] Các câu lệnh SQL sẽ thực hiện:');
      console.log(sql);
      console.log('\n>>> Chạy lại với cờ --apply để áp dụng migration.');
      return;
    }

    console.log('\n2. Đang thực thi migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✓ Migration Phase 4 hoàn tất thành công!');

    // Kiểm tra lại sau khi apply
    const afterCols = await client.query(`
      SELECT table_name, column_name, data_type, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name IN ('products', 'combos', 'order_items') 
        AND column_name = 'cost_price'
      ORDER BY table_name;
    `);
    console.log('\n3. Cột cost_price sau migration:');
    afterCols.rows.forEach(r => {
      console.log(`  - ${r.table_name}.${r.column_name} (${r.data_type}, default: ${r.column_default}, nullable: ${r.is_nullable})`);
    });

  } catch (err) {
    if (!isDryRun) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Lỗi khi thực thi migration:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
