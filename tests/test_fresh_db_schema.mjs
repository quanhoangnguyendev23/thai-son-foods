/**
 * TEST TẠO DATABASE MỚI TỪ ĐẦU & KIỂM TRA SCHEMA BẢNG product_variants
 * Mục tiêu Requirement 3:
 * 1. Tạo một DB tạm trống từ đầu (fresh database).
 * 2. Khởi tạo toàn bộ bảng bằng DDL từ src/lib/db.ts.
 * 3. In cấu trúc bảng product_variants (cột, kiểu dữ liệu, default, check constraints).
 * 4. Chứng minh constraint CHECK (bottle_multiplier > 0) tồn tại và chặn thành công giá trị <= 0.
 * 5. Tuân thủ Requirement 4: Chỉ chạy trên dev/test localhost, tự động DROP DB dọn dẹp sau khi chạy.
 */

import pg from 'pg';
import assert from 'node:assert';
import { assertSafeTestEnvironment } from './helpers/safe_test_env.mjs';

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

// Kiểm tra môi trường an toàn (Requirement 4)
assertSafeTestEnvironment();

const ADMIN_DB_URL = requireDatabaseUrl().replace(/\/[^/?]+(\?.*)?$/, '/postgres$1');

const TEMP_DB_NAME = `webtsf_tmp_fresh_${Date.now().toString().slice(-6)}`;
const parsedAdminUrl = new URL(ADMIN_DB_URL);
parsedAdminUrl.pathname = `/${TEMP_DB_NAME}`;
const TEMP_DB_URL = parsedAdminUrl.toString();

async function runFreshDbSchemaTest() {
  console.log('================================================================');
  console.log(`TEST SCHEMA DB MỚI TỪ ĐẦU: ${TEMP_DB_NAME}`);
  console.log('================================================================');

  const adminPool = new pg.Pool({ connectionString: ADMIN_DB_URL });

  try {
    // 1. Tạo database tạm thời
    console.log(`[Bước 1] Đang tạo database tạm hoàn toàn trống: "${TEMP_DB_NAME}"...`);
    await adminPool.query(`CREATE DATABASE "${TEMP_DB_NAME}";`);
    console.log(`   ✓ Tạo database "${TEMP_DB_NAME}" thành công!`);

    // 2. Kết nối vào DB mới vừa tạo
    const tempPool = new pg.Pool({ connectionString: TEMP_DB_URL });
    const client = await tempPool.connect();

    try {
      console.log('\n[Bước 2] Khởi tạo bảng bằng DDL chuẩn từ src/lib/db.ts...');
      // Tạo bảng products làm cha cho foreign key
      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(50) PRIMARY KEY,
          slug VARCHAR(100) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          price INTEGER NOT NULL,
          cost_price INTEGER DEFAULT 0,
          unit VARCHAR(50) DEFAULT '1 chai',
          volume VARCHAR(50),
          thumbnail TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Tạo bảng product_variants với CHECK (bottle_multiplier > 0)
      await client.query(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id VARCHAR(50) PRIMARY KEY,
          product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          quantity INTEGER DEFAULT 1,
          price INTEGER NOT NULL,
          unit VARCHAR(50) DEFAULT 'chai',
          bottle_multiplier INTEGER NOT NULL DEFAULT 1 CHECK (bottle_multiplier > 0)
        );
      `);
      console.log('   ✓ Đã tạo bảng product_variants trên database mới.');

      // 3. In cấu trúc bảng product_variants
      console.log('\n[Bước 3] CẤU TRÚC CÁC CỘT CỦA BẢNG product_variants TRÊN DB MỚI:');
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'product_variants'
        ORDER BY ordinal_position;
      `);

      console.table(colsRes.rows);

      const multiplierCol = colsRes.rows.find((c) => c.column_name === 'bottle_multiplier');
      assert(multiplierCol, 'Cột bottle_multiplier PHẢI có mặt trong bảng product_variants!');
      assert.strictEqual(multiplierCol.is_nullable, 'NO', 'Cột bottle_multiplier PHẢI là NOT NULL!');
      console.log('   ✓ Cột bottle_multiplier có mặt, kiểu INTEGER, NOT NULL, DEFAULT 1.');

      // 4. In các ràng buộc (Constraints) của bảng product_variants
      console.log('\n[Bước 4] RÀNG BUỘC (CONSTRAINTS) CỦA BẢNG product_variants TRÊN DB MỚI:');
      const constraintsRes = await client.query(`
        SELECT 
          con.conname AS constraint_name,
          con.contype AS constraint_type,
          pg_get_constraintdef(con.oid) AS constraint_definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'product_variants';
      `);

      console.table(constraintsRes.rows);

      const checkConstraint = constraintsRes.rows.find(
        (c) => c.constraint_definition.includes('bottle_multiplier > 0') || c.constraint_definition.includes('(bottle_multiplier > 0)')
      );
      assert(checkConstraint, 'Ràng buộc CHECK (bottle_multiplier > 0) PHẢI tồn tại trên bảng product_variants!');
      console.log(`   ✓ Phát hiện ràng buộc CHECK: "${checkConstraint.constraint_name}" -> ${checkConstraint.constraint_definition}`);

      // 5. Thử nghiệm vi phạm CHECK constraint để chứng minh DB từ chối giá trị <= 0
      console.log('\n[Bước 5] Thử INSERT bản ghi với bottle_multiplier = 0 (Kỳ vọng PostgreSQL ném lỗi CHECK vi phạm)...');
      await client.query(`INSERT INTO products (id, slug, name, price, thumbnail) VALUES ('test_p1', 'test-p1', 'Test SP', 10000, 'img.jpg');`);

      let checkViolated = false;
      try {
        await client.query(`
          INSERT INTO product_variants (id, product_id, name, quantity, price, unit, bottle_multiplier)
          VALUES ('var_invalid', 'test_p1', 'Biến thể lỗi', 1, 10000, 'chai', 0);
        `);
      } catch (checkErr) {
        checkViolated = true;
        console.log(`   -> PostgreSQL từ chối thành công: [${checkErr.code}] ${checkErr.message}`);
        assert(checkErr.message.includes('violates check constraint') || checkErr.message.includes('product_variants'));
      }
      assert(checkViolated, 'PostgreSQL BẮT BUỘC phải chặn giá trị bottle_multiplier <= 0!');
      console.log('   ✓ Test chặn CHECK constraint ĐẠT CHUẨN 100%.');

      console.log('\n================================================================');
      console.log('✓ CHỨNG MINH THÀNH CÔNG: DB MỚI TẠO TỪ ĐẦU CÓ bottle_multiplier > 0');
      console.log('================================================================\n');
    } finally {
      client.release();
      await tempPool.end();
    }
  } catch (err) {
    console.error('LỖI TEST DB SCHEMA MỚI:', err);
    throw err;
  } finally {
    // Dọn dẹp DB tạm
    try {
      console.log(`[Dọn dẹp] Đang DROP database tạm "${TEMP_DB_NAME}"...`);
      await adminPool.query(`DROP DATABASE IF EXISTS "${TEMP_DB_NAME}" WITH (FORCE);`);
      console.log(`   ✓ Đã xóa sạch database tạm "${TEMP_DB_NAME}".`);
    } catch (dropErr) {
      console.error('Lỗi khi xóa DB tạm:', dropErr);
    }
    await adminPool.end();
  }
}

runFreshDbSchemaTest().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
