import pg from 'pg';
import bcrypt from 'bcryptjs';

import { assertSafeDatabase } from './db-guard.mjs';

// F-02: mật khẩu tài khoản test / secret đọc từ biến môi trường, không viết cứng trong Git
// (đặt trong .env local, xem docs/golive/F-02-SECRET-PRODUCTION.md)
function requireSecretEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Thiếu biến môi trường ${name}. Đặt trong .env local (xem docs/golive/F-02-SECRET-PRODUCTION.md).`);
    process.exit(1);
  }
  return value;
}

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

const DB_URL = requireDatabaseUrl();
const pool = new pg.Pool({ connectionString: DB_URL });

async function seedTestAccounts() {
  const client = await pool.connect();
  try {
    const dummyHash = await bcrypt.hash(requireSecretEnv('QA_SEED_PASSWORD'), 10);

    // 1. Admin test accounts
    await client.query(`
      INSERT INTO admin_users (id, username, email, password_hash, full_name, role, store_code, is_active, must_change_password)
      VALUES 
        ('qa_admin_super_id', 'qa_super_admin', 'qa_super@example.com', $1, 'QA Super Admin', 'SUPER_ADMIN', NULL, true, false),
        ('qa_admin_mkt_id', 'qa_marketing', 'qa_mkt@example.com', $1, 'QA Marketing Lead', 'MARKETING', NULL, true, false),
        ('qa_admin_staff_ama_id', 'qa_staff_ama', 'qa_ama@example.com', $1, 'QA Staff Chi Nhánh AMA', 'STORE_STAFF', 'AMA', true, false),
        ('qa_admin_staff_d1_id', 'qa_staff_d1', 'qa_d1@example.com', $1, 'QA Staff Chi Nhánh D1', 'STORE_STAFF', 'D1', true, false)
      ON CONFLICT (username) DO UPDATE 
      SET is_active = true, must_change_password = false;
    `, [dummyHash]);
    console.log('Seeded 4 QA Admin accounts.');

    // 2. Customer test accounts
    await client.query(`
      INSERT INTO users (id, email, password_hash, full_name, phone, address, province, district, ward, is_active)
      VALUES 
        ('qa_user_cust_1_id', 'qa_test_cust1@example.com', $1, 'QA_TEST_Khách Hàng 1', '0900000001', '123 Đường Test 1', 'Hồ Chí Minh', 'Quận 1', 'Bến Nghé', true),
        ('qa_user_cust_2_id', 'qa_test_cust2@example.com', $1, 'QA_TEST_Khách Hàng 2', '0900000002', '456 Đường Test 2', 'Hồ Chí Minh', 'Quận Tân Bình', 'Phường 2', true)
      ON CONFLICT (email) DO UPDATE 
      SET is_active = true;
    `, [dummyHash]);
    console.log('Seeded 2 QA Customer accounts.');

  } catch (err) {
    console.error('Error seeding test accounts:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestAccounts();
