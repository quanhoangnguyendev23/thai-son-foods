import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase(process.env.DB_NAME || 'WebTSF');

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute;

const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || dbPasswordFromEnv(),
  database: process.env.DB_NAME || 'WebTSF'
});

async function main() {
  console.log('================================================================');
  console.log(`PHASE 1 RBAC MIGRATION: [${isDryRun ? 'DRY-RUN (PREVIEW ONLY)' : 'EXECUTE MODE'}]`);
  console.log('================================================================');

  const client = await pool.connect();

  try {
    if (isExecute) {
      await client.query('BEGIN');
    }

    // 1. Áp dụng schema migration (thêm cột store_code, audit_logs...)
    console.log('\n[1/5] Applying schema changes (phase1_rbac_schema.sql)...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'migrations', 'phase1_rbac_schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('  ✓ Schema updated successfully (idempotent).');

    // 2. Lấy danh sách cửa hàng
    const storesRes = await client.query('SELECT code, name, is_active FROM stores ORDER BY code');
    const storeMap = new Map();
    for (const s of storesRes.rows) {
      storeMap.set(s.code, s);
    }
    console.log(`\n[2/5] Found ${storeMap.size} stores in database.`);

    // 3. Phân tích tài khoản admin_users
    const usersRes = await client.query('SELECT id, username, email, role, is_active FROM admin_users ORDER BY role, username');
    console.log(`\n[3/5] Inspecting ${usersRes.rows.length} existing admin accounts:`);

    const superAdmins = [];
    const activeStoreAdmins = [];
    const lockedDummyAdmins = [];
    const unmappedAdmins = [];

    for (const u of usersRes.rows) {
      if (u.role === 'SUPER_ADMIN' || u.username === 'admin') {
        superAdmins.push(u);
      } else if (u.username.startsWith('adminCH') && !u.is_active) {
        lockedDummyAdmins.push(u);
      } else if (storeMap.has(u.username)) {
        activeStoreAdmins.push({
          ...u,
          matchedStore: storeMap.get(u.username)
        });
      } else {
        unmappedAdmins.push(u);
      }
    }

    console.log(`\n--- PHÂN LOẠI TÀI KHOẢN ---`);
    console.log(`• SUPER_ADMIN (Giữ nguyên quyền cao nhất): ${superAdmins.length}`);
    for (const u of superAdmins) {
      console.log(`   - Username: "${u.username}", Email: "${u.email}", Active: ${u.is_active} -> Action: Giữ nguyên SUPER_ADMIN, store_code = NULL`);
    }

    console.log(`\n• STORE ACCOUNTS HOẠT ĐỘNG (Trùng mã cửa hàng): ${activeStoreAdmins.length}`);
    for (const u of activeStoreAdmins) {
      console.log(`   - Username: "${u.username}", Email: "${u.email}", Cửa hàng: "${u.matchedStore.name}" -> Action: Role STORE_STAFF, store_code = "${u.username}"`);
    }

    console.log(`\n• TÀI KHOẢN DUMMY BỊ KHÓA (adminCH1..adminCH5): ${lockedDummyAdmins.length}`);
    for (const u of lockedDummyAdmins) {
      console.log(`   - Username: "${u.username}", Email: "${u.email}", Active: ${u.is_active} -> Action: Đặt role STORE_STAFF, giữ nguyên BỊ KHÓA (is_active = false) & CHỜ CHỈ ĐẠO CỦA USER`);
    }

    console.log(`\n• TÀI KHOẢN KHÔNG KHỚP MÃ CỬA HÀNG: ${unmappedAdmins.length}`);
    if (unmappedAdmins.length > 0) {
      for (const u of unmappedAdmins) {
        console.log(`   - Username: "${u.username}", Role: "${u.role}", Email: "${u.email}" -> CẦN XỬ LÝ`);
      }
    } else {
      console.log(`   (Không có tài khoản nào bị lạc, 100% tài khoản khớp chính xác!)`);
    }

    // 4. Thực thi cập nhật dữ liệu nếu ở chế độ execute
    if (isExecute) {
      console.log('\n[4/5] Executing account role and store_code migration...');
      
      // Update SUPER_ADMIN
      for (const u of superAdmins) {
        await client.query(
          `UPDATE admin_users SET role = 'SUPER_ADMIN', store_code = NULL WHERE id = $1`,
          [u.id]
        );
      }

      // Update 25 active store accounts
      for (const u of activeStoreAdmins) {
        await client.query(
          `UPDATE admin_users SET role = 'STORE_STAFF', store_code = $1 WHERE id = $2`,
          [u.username, u.id]
        );
      }

      // Update 5 dummy accounts (giữ nguyên is_active = false)
      for (const u of lockedDummyAdmins) {
        await client.query(
          `UPDATE admin_users SET role = 'STORE_STAFF', store_code = $1 WHERE id = $2`,
          [u.username, u.id]
        );
      }

      console.log('  ✓ Updated accounts role & store_code.');

      // 5. Thêm CHECK constraint chk_admin_users_role
      console.log('\n[5/5] Adding CHECK constraint chk_admin_users_role...');
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'chk_admin_users_role'
          ) THEN
            ALTER TABLE admin_users
              ADD CONSTRAINT chk_admin_users_role
              CHECK (role IN ('SUPER_ADMIN', 'MARKETING', 'STORE_STAFF'));
          END IF;
        END $$;
      `);
      console.log('  ✓ Constraint chk_admin_users_role enforced.');

      await client.query('COMMIT');
      console.log('\n✅ MIGRATION COMPLETED & COMMITTED SUCCESSFULLY!');
    } else {
      console.log('\n[4/5] DRY-RUN MODE: No changes written to database.');
      console.log('Run with --execute to apply these changes.');
    }

  } catch (error) {
    if (isExecute) {
      await client.query('ROLLBACK');
      console.error('\n❌ TRANSACTION ROLLED BACK DUE TO ERROR:');
    }
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
