// ==============================================================================
// THÁI SƠN FOODS - CLOUD DATABASE RESTORE SCRIPT
// Tự động đẩy toàn bộ cấu trúc & dữ liệu từ file backup lên Database Cloud
// (Vercel Postgres, Neon, Supabase, hoặc AWS RDS)
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { assertSafeDatabase } from './db-guard.mjs';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetConnectionString = process.argv[2] || process.env.TARGET_DATABASE_URL;
// TEST-GUARD: chỉ khôi phục vào DB staging/test, hoặc chạy kèm ALLOW_PROD_DB=yes.
if (targetConnectionString) assertSafeDatabase(targetConnectionString);

if (!targetConnectionString) {
  console.error('\n❌ LỖI: Vui lòng cung cấp chuỗi kết nối Database Cloud!');
  console.log('Cách dùng:');
  console.log('  node scripts/restore_to_cloud_db.mjs "postgresql://user:pass@host:port/dbname?sslmode=require"\n');
  process.exit(1);
}

const sqlDumpPath = path.join(__dirname, '..', 'backups', 'WebTSF_production_ready.sql');

if (!fs.existsSync(sqlDumpPath)) {
  console.error(`❌ LỖI: Không tìm thấy file dump tại: ${sqlDumpPath}`);
  process.exit(1);
}

console.log('===============================================================');
console.log('🚀 Bắt đầu import dữ liệu lên Cloud Database...');
console.log('Target URL:', targetConnectionString.replace(/:[^:@]+@/, ':****@'));
console.log('Source dump:', sqlDumpPath);
console.log('===============================================================');

const pool = new Pool({
  connectionString: targetConnectionString,
  ssl: targetConnectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('-> Đã kết nối thành công tới Cloud Database!');
    console.log('-> Đang đọc file SQL dump (830 KB)...');
    const sqlContent = fs.readFileSync(sqlDumpPath, 'utf8');

    console.log('-> Đang thực thi các câu lệnh SQL khởi tạo bảng và chèn dữ liệu...');
    const startTime = Date.now();
    await client.query(sqlContent);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Thành công! Đã khôi phục toàn bộ database trong ${duration}s.`);

    // Đối soát số lượng bảng và sản phẩm
    const tablesRes = await client.query("SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'");
    const prodRes = await client.query("SELECT count(*) as count FROM products");
    const storeRes = await client.query("SELECT count(*) as count FROM stores");

    console.log('\n📊 THỐNG KÊ SAU KHI IMPORT:');
    console.log(`- Tổng số bảng: ${tablesRes.rows[0].count} bảng`);
    console.log(`- Tổng số sản phẩm: ${prodRes.rows[0].count} sản phẩm`);
    console.log(`- Tổng số chi nhánh: ${storeRes.rows[0].count} chi nhánh`);
    console.log('\n🎉 Database Cloud đã sẵn sàng phục vụ Website trên Vercel!');
  } catch (err) {
    console.error('❌ LỖI trong quá trình import:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
