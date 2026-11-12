import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
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

const { Pool } = pg;

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : { connectionString: requireDatabaseUrl() }
);

async function main() {
  const client = await pool.connect();
  try {
    console.log('--- ÁP DỤNG MIGRATION PHASE 7: MEMBERSHIP & SUBSCRIBE & SAVE ---');
    const sqlPath = path.resolve(process.cwd(), 'scripts/migrations/phase7_membership_schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    await client.query('BEGIN;');
    await client.query(sqlContent);
    await client.query('COMMIT;');
    console.log('✓ Migration Phase 7 đã được áp dụng thành công vào PostgreSQL!');

    // Kiểm tra lại các bảng
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'membership_tiers',
          'user_memberships',
          'subscriptions',
          'subscription_items',
          'subscription_schedules',
          'loyalty_point_ledger'
        );
    `);
    console.log('Danh sách các bảng thành viên đã tạo:', res.rows.map(r => r.table_name));

    // Kiểm tra dữ liệu khởi tạo
    const tiers = await client.query('SELECT code, name, price, discount_rate FROM membership_tiers ORDER BY price ASC;');
    console.log('Các gói thành viên đã khởi tạo:', tiers.rows);
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Lỗi khi áp dụng migration Phase 7:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
