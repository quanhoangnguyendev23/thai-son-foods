import { Pool } from 'pg';

const users = ['postgres', 'ITPM2', 'itpm2', 'webtsf', 'WebTSF', 'admin'];
// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

// Thử mật khẩu trong DATABASE_URL, cộng thêm các mật khẩu (nếu có) trong DB_TRY_PASSWORDS, cách nhau dấu phẩy.
const passwords = [
  dbPasswordFromEnv(),
  ...(process.env.DB_TRY_PASSWORDS || '').split(',').map((p) => p.trim()).filter(Boolean),
];

async function tryConnect(user, pw) {
  const p = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: user,
    password: pw,
    database: 'postgres',
    connectionTimeoutMillis: 1500,
  });

  try {
    const res = await p.query('SELECT current_user, current_database();');
    console.log(`>>> SUCCESS! User: "${user}", Password: "${pw}"`);
    console.log(res.rows[0]);
    await p.end();
    return true;
  } catch (err) {
    await p.end().catch(() => {});
    return false;
  }
}

async function run() {
  console.log('Testing combinations...');
  for (const u of users) {
    for (const pw of passwords) {
      const ok = await tryConnect(u, pw);
      if (ok) return;
    }
  }
  console.log('All combinations failed.');
}

run();
