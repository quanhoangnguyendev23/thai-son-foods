import { Pool } from 'pg';

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

async function setup() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: dbPasswordFromEnv(),
    database: 'WebTSF',
  });

  console.log('--- KHỞI TẠO BẢNG CỬA HÀNG VÀ CỘT STORE_CODE CHO ĐƠN HÀNG ---');

  // 1. Create stores table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id VARCHAR(50) PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      province VARCHAR(100) DEFAULT 'Hồ Chí Minh',
      district VARCHAR(100),
      ward VARCHAR(100),
      map_url VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Đã tạo bảng stores');

  // 2. Add columns to orders table
  await pool.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_code VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_address TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT false;
  `);
  console.log('✅ Đã thêm store_code, store_address, inventory_deducted vào orders');

  // 3. Seed default 5 stores
  const initialStores = [
    {
      id: 'store_adminCH1',
      code: 'adminCH1',
      name: 'Chi nhánh 1 (Tân Phú)',
      address: '472 - 474 Lê Trọng Tấn, P. Tây Thạnh, Q. Tân Phú, TP. HCM',
      phone: '02871000472',
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      map_url: 'https://www.google.com/maps/search/?api=1&query=472+L%C3%AA+Tr%E1%BB%8Dng+T%E1%BA%A5n+T%C3%A2y+Th%E1%BA%A1nh+T%C3%A2n+Ph%C3%BA',
    },
    {
      id: 'store_adminCH2',
      code: 'adminCH2',
      name: 'Chi nhánh 2 (Quận 3)',
      address: '45 Võ Văn Tần, P. Võ Thị Sáu, Q.3, TP. HCM',
      phone: '02871000473',
      province: 'Hồ Chí Minh',
      district: 'Quận 3',
      ward: 'Võ Thị Sáu',
      map_url: 'https://www.google.com/maps/search/?api=1&query=45+V%C3%B5+V%C4%83n+T%E1%BA%A7n+Qu%E1%BA%ADn+3',
    },
    {
      id: 'store_adminCH3',
      code: 'adminCH3',
      name: 'Chi nhánh 3 (Bình Thạnh)',
      address: '82 Phan Đăng Lưu, P.5, Q. Bình Thạnh, TP. HCM',
      phone: '02871000474',
      province: 'Hồ Chí Minh',
      district: 'Bình Thạnh',
      ward: 'Phường 5',
      map_url: 'https://www.google.com/maps/search/?api=1&query=82+Phan+%C4%90%C4%83ng+L%C6%B0u+B%C3%ACnh+Th%E1%BA%A1nh',
    },
    {
      id: 'store_adminCH4',
      code: 'adminCH4',
      name: 'Chi nhánh 4 (Tân Bình)',
      address: '19 Hoàng Hoa Thám, P.13, Q. Tân Bình, TP. HCM',
      phone: '02871000475',
      province: 'Hồ Chí Minh',
      district: 'Tân Bình',
      ward: 'Phường 13',
      map_url: 'https://www.google.com/maps/search/?api=1&query=19+Ho%C3%A0ng+Hoa+Th%C3%A1m+T%C3%A2n+B%C3%ACnh',
    },
    {
      id: 'store_adminCH5',
      code: 'adminCH5',
      name: 'Chi nhánh 5 (TP. Thủ Đức)',
      address: '210 Võ Văn Ngân, P. Bình Thọ, TP. Thủ Đức, TP. HCM',
      phone: '02871000476',
      province: 'Hồ Chí Minh',
      district: 'TP. Thủ Đức',
      ward: 'Bình Thọ',
      map_url: 'https://www.google.com/maps/search/?api=1&query=210+V%C3%B5+V%C4%83n+Ng%C3%A2n+Th%E1%BB%A7+%C4%90%E1%BB%A9c',
    },
  ];

  for (const s of initialStores) {
    await pool.query(
      `INSERT INTO stores (id, code, name, address, phone, province, district, ward, map_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (code) DO UPDATE
       SET address = EXCLUDED.address,
           phone = EXCLUDED.phone,
           province = EXCLUDED.province,
           district = EXCLUDED.district,
           ward = EXCLUDED.ward,
           map_url = EXCLUDED.map_url;`,
      [s.id, s.code, s.name, s.address, s.phone, s.province, s.district, s.ward, s.map_url]
    );
  }
  console.log('✅ Đã nạp thông tin 5 cửa hàng mặc định');

  // Verify
  const storeRes = await pool.query('SELECT code, name, address, phone, district FROM stores;');
  console.log('Danh sách cửa hàng trong CSDL:', storeRes.rows);

  await pool.end();
}

setup().catch(console.error);
