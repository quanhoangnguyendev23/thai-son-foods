import pg from 'pg';

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

const { Pool } = pg;

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: process.env.DB_PASSWORD || dbPasswordFromEnv(),
  database: 'WebTSF'
});

async function main() {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'admin_users'
      ORDER BY ordinal_position
    `);
    console.log('--- ADMIN_USERS COLUMNS ---');
    console.table(cols.rows);

    const users = await pool.query(`
      SELECT id, username, email, role, is_active, created_at 
      FROM admin_users 
      ORDER BY role, username
    `);
    console.log(`--- TOTAL ADMIN_USERS: ${users.rows.length} ---`);
    console.table(users.rows);

    const stores = await pool.query(`
      SELECT code, name, is_active FROM stores ORDER BY code
    `);
    console.log(`--- TOTAL STORES: ${stores.rows.length} ---`);
    const storeCodes = new Set(stores.rows.map(s => s.code));

    console.log('--- ACCOUNT MATCHING CHECK ---');
    for (const u of users.rows) {
      const match = storeCodes.has(u.username);
      console.log(`User: ${u.username.padEnd(12)} Role: ${u.role.padEnd(12)} Active: ${u.is_active} -> Match store code: ${match ? 'YES (' + u.username + ')' : 'NO'}`);
    }
    const dummyStores = await pool.query(`
      SELECT code, name, is_active FROM stores WHERE code ILIKE 'admin%'
    `);
    console.log('--- DUMMY STORES IN STORES TABLE ---');
    console.table(dummyStores.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
