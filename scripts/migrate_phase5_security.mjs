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

const DB_URL = requireDatabaseUrl();
const pool = new pg.Pool({ connectionString: DB_URL });

async function run() {
  console.log('--- KHỞI CHẠY MIGRATION PHASE 5: BẢO MẬT TÀI KHOẢN ---');
  const client = await pool.connect();

  try {
    // 1. Cập nhật must_change_password = true cho tất cả 25 tài khoản cửa hàng STORE_STAFF
    const res = await client.query(`
      UPDATE admin_users
      SET must_change_password = true
      WHERE role = 'STORE_STAFF' AND is_active = true;
    `);
    console.log(`Đã cập nhật must_change_password = true cho ${res.rowCount} tài khoản nhân viên cửa hàng (STORE_STAFF).`);

    // 2. Kiểm tra danh sách tài khoản
    const usersRes = await client.query(`
      SELECT username, role, store_code, must_change_password, is_active
      FROM admin_users
      ORDER BY role, username;
    `);
    console.log('\nDanh sách tài khoản sau cập nhật:');
    console.table(usersRes.rows);

    console.log('--- HOÀN TẤT MIGRATION PHASE 5 THÀNH CÔNG ---');
  } catch (error) {
    console.error('Lỗi khi chạy migration Phase 5:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
