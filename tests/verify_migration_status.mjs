import 'dotenv/config';
import pg from 'pg';

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
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (
          lower(table_name) LIKE '%membership%' 
          OR lower(table_name) LIKE '%subscription%'
          OR lower(table_name) LIKE '%loyalty%'
        );
    `);
    console.log('=== XÁC NHẬN TRẠNG THÁI MIGRATION TRONG CƠ SỞ DỮ LIỆU ===');
    console.log('Số lượng bảng thành viên trong CSDL thực tế:', res.rows.length);
    if (res.rows.length === 0) {
      console.log('CHỨNG MINH THÀNH CÔNG: Migration CHỈ ĐƯỢC TẠO dưới dạng file SQL, KHÔNG ĐƯỢC ÁP DỤNG vào database (0 bảng mới trong CSDL).');
    } else {
      console.log('Các bảng tìm thấy:', res.rows.map(r => r.table_name));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Lỗi kết nối DB:', err.message);
  process.exit(1);
});
