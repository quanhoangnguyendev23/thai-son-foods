import pg from 'pg';
import { execSync } from 'child_process';

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

// Kết nối vào DB hệ thống "postgres" (cùng host/user/mật khẩu với DATABASE_URL) để xóa/tạo lại WebTSF_staging.
const DB_URL = (() => {
  dbPasswordFromEnv(); // nạp .env nếu cần, báo lỗi rõ nếu thiếu DATABASE_URL
  const u = new URL(process.env.DATABASE_URL);
  u.pathname = '/postgres';
  return u.toString();
})();
const pool = new pg.Pool({ connectionString: DB_URL });

async function setupStaging() {
  const client = await pool.connect();
  try {
    console.log('Terminating existing connections to WebTSF_staging...');
    await client.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = 'WebTSF_staging' AND pid <> pg_backend_pid();
    `);
    
    await client.query('DROP DATABASE IF EXISTS "WebTSF_staging";');
    console.log('Dropped WebTSF_staging.');

    // Try template clone by first terminating other connections to WebTSF if idle or just create empty and restore
    console.log('Creating fresh WebTSF_staging database...');
    await client.query('CREATE DATABASE "WebTSF_staging";');
    console.log('WebTSF_staging created.');

    console.log('Restoring data from pre_qa_audit_backup.sql to WebTSF_staging...');
    execSync('psql -U postgres -h 127.0.0.1 -p 5432 -d WebTSF_staging -f scripts/backups/pre_qa_audit_backup.sql', {
      env: { ...process.env, PGPASSWORD: dbPasswordFromEnv() },
      stdio: 'inherit'
    });
    console.log('Restore to WebTSF_staging completed successfully!');
  } catch (err) {
    console.error('Error setting up staging DB:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

setupStaging();
