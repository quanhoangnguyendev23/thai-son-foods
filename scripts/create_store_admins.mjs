import { Pool } from 'pg';
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

const ACTIVE_STORE_ADMINS = [
  { code: 'TCH', name: 'Cửa Hàng Tân Chánh Hiệp (Quận 12)' },
  { code: 'TN', name: 'Cửa Hàng Tân Nhơn (Gò Vấp)' },
  { code: 'THB', name: 'Cửa Hàng Phổ Quang (Tân Bình)' },
  { code: 'D1', name: 'Cửa Hàng Ung Văn Khiêm (Bình Thạnh)' },
  { code: 'NTB', name: 'Cửa Hàng Nguyễn Thái Bình (Quận 1)' },
  { code: 'TTH', name: 'Cửa Hàng Huỳnh Tấn Phát (Quận 7)' },
  { code: 'DN', name: 'Cửa Hàng Cư Xá Đồng Tiến (Quận 10)' },
  { code: 'NB', name: 'Cửa Hàng Cao Lỗ (Quận 8)' },
  { code: 'RD', name: 'Cửa Hàng Chiến Lược (Bình Tân)' },
  { code: 'NH', name: 'Cửa Hàng Vườn Lài (Tân Phú)' },
  { code: 'TBA', name: 'Cửa Hàng Trảng Bàng (Tây Ninh)' },
  { code: 'XA', name: 'Cửa Hàng Củ Chi (TP. HCM)' },
  { code: 'MP', name: 'Cửa Hàng Mỹ Phước (Bến Cát)' },
  { code: 'ME', name: 'Cửa Hàng An Phú (Thuận An)' },
  { code: 'TDM', name: 'Cửa Hàng Thủ Dầu Một (Bình Dương)' },
  { code: 'TB', name: 'Cửa Hàng Bình Chiểu (Thủ Đức)' },
  { code: 'LX', name: 'Cửa Hàng Linh Tây (Thủ Đức)' },
  { code: 'TD', name: 'Cửa Hàng Tăng Nhơn Phú (Quận 9)' },
  { code: 'AMA', name: 'Cửa Hàng Tân Hiệp (Biên Hòa)' },
  { code: 'LB', name: 'Cửa Hàng Phước Tân (Đồng Nai)' },
  { code: 'CM', name: 'Cửa Hàng Cầu Xéo (Long Thành)' },
  { code: 'TRB', name: 'Cửa Hàng Trảng Bom (Đồng Nai)' },
  { code: 'CTH', name: 'Cửa Hàng Ninh Kiều (Cần Thơ)' },
  { code: 'XL', name: 'Cửa Hàng Xuân Lộc (Đồng Nai)' },
  { code: 'VT', name: 'Cửa Hàng Vũng Tàu (Bà Rịa - Vũng Tàu)' },
];

async function seedAdmins() {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
  });

  console.log('--- KHỞI TẠO TÀI KHOẢN ADMIN CHO 25 CỬA HÀNG ĐANG HOẠT ĐỘNG ---');

  // Vô hiệu hóa các tài khoản dummy cũ (adminCH1 -> adminCH5)
  const dummyUsernames = ['adminCH1', 'adminCH2', 'adminCH3', 'adminCH4', 'adminCH5'];
  await pool.query(
    `UPDATE admin_users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE username = ANY($1);`,
    [dummyUsernames]
  );
  console.log(`Đã khóa các tài khoản test: ${dummyUsernames.join(', ')}`);

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(requireSecretEnv('STORE_ADMIN_INITIAL_PASSWORD'), salt);

  for (const st of ACTIVE_STORE_ADMINS) {
    const id = `admin_store_${st.code.toLowerCase()}`;
    const username = st.code;
    const email = `${st.code.toLowerCase()}@thaisonfoods.vn`;
    const fullName = `Quản trị viên ${st.name}`;

    await pool.query(
      `INSERT INTO admin_users (id, username, email, password_hash, full_name, role, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ADMIN', true, CURRENT_TIMESTAMP)
       ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           role = 'ADMIN',
           is_active = true,
           updated_at = CURRENT_TIMESTAMP;`,
      [id, username, email, hash, fullName]
    );

    console.log(`✅ [${username}] ${email} - ${fullName} (Mật khẩu: giá trị STORE_ADMIN_INITIAL_PASSWORD)`);
  }

  const res = await pool.query(
    `SELECT id, username, email, full_name, role, is_active 
     FROM admin_users 
     WHERE is_active = true 
     ORDER BY role DESC, username ASC;`
  );

  console.log(`\n--- DANH SÁCH ${res.rows.length} TÀI KHOẢN ADMIN ĐANG HOẠT ĐỘNG ---`);
  console.table(res.rows);

  await pool.end();
}

seedAdmins().catch((err) => {
  console.error('Lỗi khởi tạo tài khoản admin:', err);
  process.exit(1);
});
