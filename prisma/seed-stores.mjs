/**
 * Seed script: Import 30 store branches from CSV data
 * Run: node prisma/seed-stores.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const pool = new pg.Pool({
  connectionString:
    requireDatabaseUrl(),
});

// 30 store branches from CSV
const stores = [
  {
    code: 'VL',
    name: 'Cửa Hàng Vĩnh Lộc',
    address: '59 Nguyễn Thị Tuôi, xã Vĩnh Lộc, TP.HCM',
    latitude: 10.821102,
    longitude: 106.585043,
    region: 'SG1',
    group_code: 'SG1.1',
    status: 0,
    province: 'Hồ Chí Minh',
    notes: 'trả mặt bằng từ 11/02/25, ngày 01/08/2025, trả mặt bằng 2026',
  },
  {
    code: 'TCH',
    name: 'Cửa Hàng Tân Chánh Hiệp',
    address: '113/33 Đường TCH03, Phường Trung Mỹ Tây, TP.HCM',
    latitude: 10.871807,
    longitude: 106.62651,
    region: 'SG1',
    group_code: 'SG1.1',
    status: 1,
    province: 'Hồ Chí Minh',
    district: 'Quận 12',
    notes: null,
  },
  {
    code: 'TN',
    name: 'Cửa Hàng Tân Nhơn (Gò Vấp)',
    address: '208/28 Lê Đức Thọ, Phường An Nhơn, TP.HCM',
    latitude: 10.83707,
    longitude: 106.68115,
    region: 'SG1',
    group_code: 'SG1.2',
    status: 1,
    province: 'Hồ Chí Minh',
    district: 'Gò Vấp',
    notes: null,
  },
  {
    code: 'THB',
    name: 'Cửa Hàng Tân Bình',
    address: '2C Phổ Quang, P. Tân Sơn Hòa, TP.HCM',
    latitude: 10.803028,
    longitude: 106.667668,
    region: 'SG1',
    group_code: 'SG1.2',
    status: 1,
    province: 'Hồ Chí Minh',
    district: 'Tân Bình',
    notes: null,
  },
  {
    code: 'HHT',
    name: 'Cửa Hàng Nơ Trang Long',
    address: '5/77 Nơ Trang Long, Phường Gia Định, TP.HCM',
    latitude: 10.806149,
    longitude: 106.6937564,
    region: 'SG2',
    group_code: 'SG2.1',
    status: 2,
    province: 'Hồ Chí Minh',
    district: 'Bình Thạnh',
    notes: '28/10/2023, tạm đóng CH',
  },
  {
    code: 'D1',
    name: 'Cửa Hàng Ung Văn Khiêm',
    address: '255 Ung Văn Khiêm, Phường Thạnh Mỹ Tây, TP.HCM',
    latitude: 10.804418,
    longitude: 106.721872,
    region: 'SG2',
    group_code: 'SG2.1',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Bình Thạnh',
    notes: null,
  },
  {
    code: 'CL',
    name: 'Cửa Hàng Cát Lái',
    address: '36 Đường Số 12, Khu Phố 1, Phường Cát Lái, TP.HCM',
    latitude: 10.779116,
    longitude: 106.766131,
    region: 'SG2',
    group_code: 'SG2.1',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Quận 2',
    notes: 'chuyển mới từ tối 14/08/2025, => 12/07/2025 đóng cửa',
  },
  {
    code: 'NTB',
    name: 'Cửa Hàng Nguyễn Thái Bình',
    address: '157 Nguyễn Thái Bình, Phường Sài Gòn, TP.HCM',
    latitude: 10.76809,
    longitude: 106.69854,
    region: 'SG2',
    group_code: 'SG2.2',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Quận 1',
    notes: null,
  },
  {
    code: 'TTH',
    name: 'Cửa Hàng Huỳnh Tấn Phát',
    address: '858 Huỳnh Tấn Phát, Phường Tân Mỹ, TP.HCM',
    latitude: 10.7286801,
    longitude: 106.7323373,
    region: 'SG2',
    group_code: 'SG2.2',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Quận 7',
    notes: null,
  },
  {
    code: 'DN',
    name: 'Cửa Hàng Cư Xá Đồng Tiến',
    address: '2C Cư Xá Đồng Tiến, Phường Diên Hồng, TP.HCM',
    latitude: 10.7702923,
    longitude: 106.6645227,
    region: 'SG3',
    group_code: 'SG3.1',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Quận 10',
    notes: null,
  },
  {
    code: 'NB',
    name: 'Cửa Hàng Cao Lỗ',
    address: '25 Đường 152A Cao Lỗ, P.Chánh Hưng, TP.HCM',
    latitude: 10.737222,
    longitude: 106.674985,
    region: 'SG3',
    group_code: 'SG3.1',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Quận 8',
    notes: null,
  },
  {
    code: 'RD',
    name: 'Cửa Hàng Bình Trị Đông',
    address: '95/44 Chiến Lược, Khu Phố 68, Phường Bình Trị Đông, TP.HCM',
    latitude: 10.759817,
    longitude: 106.618845,
    region: 'SG3',
    group_code: 'SG3.2',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Bình Tân',
    notes: 'khu phố 34',
  },
  {
    code: 'NH',
    name: 'Cửa Hàng Vườn Lài',
    address: '298/4 Vườn Lài, P.Phú Thọ Hòa, TP.HCM',
    latitude: 10.7882898,
    longitude: 106.6251124,
    region: 'SG3',
    group_code: 'SG3.2',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Tân Phú',
    notes: null,
  },
  {
    code: 'TBA',
    name: 'Cửa Hàng Trảng Bàng',
    address: '28B Đường Hai Mươi Hai Tháng Mười Hai, Khu Phố Lộc Du, Phường Trảng Bàng, Tỉnh Tây Ninh',
    latitude: 11.039348,
    longitude: 106.356546,
    region: 'SG4',
    group_code: 'SG4',
    status: 0,
    province: 'Tây Ninh',
    notes: null,
  },
  {
    code: 'XA',
    name: 'Cửa Hàng Củ Chi',
    address: 'Số 1D, Đường 10A, Ấp 2, Xã Tân An Hội, TP.HCM',
    latitude: 10.9712462,
    longitude: 106.4928858,
    region: 'SG4',
    group_code: 'SG4',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Củ Chi',
    notes: null,
  },
  {
    code: 'MP',
    name: 'Cửa Hàng Bến Cát',
    address: 'Đường Ne8, Khu Phố An Hòa, Phường Hòa Lợi, Bình Dương',
    latitude: 11.096264,
    longitude: 106.661671,
    region: 'BD1',
    group_code: 'BD1',
    status: 0,
    province: 'Bình Dương',
    district: 'Bến Cát',
    notes: null,
  },
  {
    code: 'ME',
    name: 'Cửa Hàng Thuận An',
    address: '75/5 Khu Phố 4, Phường An Phú, Thuận An, Bình Dương',
    latitude: 10.95227,
    longitude: 106.72959,
    region: 'BD1',
    group_code: 'BD1',
    status: 0,
    province: 'Bình Dương',
    district: 'Thuận An',
    notes: null,
  },
  {
    code: 'TDM',
    name: 'Cửa Hàng Thủ Dầu Một',
    address: '278 Nguyễn Văn Lộng, P.Chánh Hiệp, Thủ Dầu Một, Bình Dương',
    latitude: 10.991353,
    longitude: 106.644095,
    region: 'BD1',
    group_code: 'BD1',
    status: 0,
    province: 'Bình Dương',
    district: 'Thủ Dầu Một',
    notes: null,
  },
  {
    code: 'TB',
    name: 'Cửa Hàng Tam Bình (Thủ Đức)',
    address: '952/2a Tỉnh Lộ 43, Phường Tam Bình, TP.HCM',
    latitude: 10.882625,
    longitude: 106.729694,
    region: 'BD2',
    group_code: 'BD2.1',
    status: 1,
    province: 'Hồ Chí Minh',
    district: 'Thủ Đức',
    notes: null,
  },
  {
    code: 'BD',
    name: 'Cửa Hàng Dĩ An',
    address: '126 Đường Số 5, Khu Phố Nhị Đồng 1, Phường Dĩ An, Bình Dương',
    latitude: 10.9025924,
    longitude: 106.7600285,
    region: 'BD2',
    group_code: 'BD2.1',
    status: 0,
    province: 'Bình Dương',
    district: 'Dĩ An',
    notes: null,
  },
  {
    code: 'LX',
    name: 'Cửa Hàng Linh Xuân',
    address: '100A, Khu phố 54, Phường Linh Xuân, TP.HCM',
    latitude: 10.861756,
    longitude: 106.755823,
    region: 'BD2',
    group_code: 'BD2.2',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Thủ Đức',
    notes: null,
  },
  {
    code: 'TD',
    name: 'Cửa Hàng Tăng Nhơn Phú',
    address: 'C20/3A Đường 449, P.Tăng Nhơn Phú, TP.HCM',
    latitude: 10.847883,
    longitude: 106.795298,
    region: 'BD2',
    group_code: 'BD2.2',
    status: 0,
    province: 'Hồ Chí Minh',
    district: 'Quận 9',
    notes: null,
  },
  {
    code: 'AMA',
    name: 'Cửa Hàng Tân Hiệp (Biên Hòa)',
    address: '225 Đường 518, P.Tam Hiệp, Biên Hòa, Đồng Nai',
    latitude: 10.960607,
    longitude: 106.870008,
    region: 'DN1',
    group_code: 'DN1',
    status: 0,
    province: 'Đồng Nai',
    district: 'Biên Hòa',
    notes: null,
  },
  {
    code: 'LB',
    name: 'Cửa Hàng Phước Tân',
    address: '20 Nam Cao, Tân Mai, P.Phước Tân, Đồng Nai',
    latitude: 10.873492,
    longitude: 106.908197,
    region: 'DN1',
    group_code: 'DN1',
    status: 0,
    province: 'Đồng Nai',
    district: 'Biên Hòa',
    notes: 'Chuyển mb mới 15/05/2025',
  },
  {
    code: 'LT',
    name: 'Cửa Hàng Long Thành',
    address: 'Tổ 15, KP 3, Ấp An Phước, Long Thành, Đồng Nai',
    latitude: 10.852270,
    longitude: 106.943594,
    region: 'DN2',
    group_code: 'DN2',
    status: 1,
    province: 'Đồng Nai',
    district: 'Long Thành',
    notes: 'trả MB từ ngày 12/05/2025',
  },
  {
    code: 'CM',
    name: 'Cửa Hàng Cầu Xéo',
    address: 'Nhà trọ số 8 - Tổ 35, Đinh Bộ Lĩnh, ấp Cầu Xéo, xã Long Thành, Đồng Nai',
    latitude: 10.775101,
    longitude: 106.956833,
    region: 'DN2',
    group_code: 'DN2',
    status: 0,
    province: 'Đồng Nai',
    district: 'Long Thành',
    notes: 'dời sang mặt bằng mới từ ngày 08/01/2026',
  },
  {
    code: 'TRB',
    name: 'Cửa Hàng Trảng Bom',
    address: '17A Huỳnh Văn Nghệ, KP 4, xã Trảng Bom, Đồng Nai',
    latitude: 10.944366,
    longitude: 107.010477,
    region: 'DN2',
    group_code: 'DN2',
    status: 0,
    province: 'Đồng Nai',
    district: 'Trảng Bom',
    notes: null,
  },
  {
    code: 'CTH',
    name: 'Cửa Hàng Cần Thơ',
    address: '270/8 Trần Vĩnh Kiết, Phường An Bình, Cần Thơ',
    latitude: 10.024142,
    longitude: 105.751664,
    region: 'TINH',
    group_code: 'TINH',
    status: 0,
    province: 'Cần Thơ',
    notes: null,
  },
  {
    code: 'XL',
    name: 'Cửa Hàng Xuân Lộc',
    address: '2346, Ấp Xuân Tâm 6, Xã Xuân Hòa, Đồng Nai',
    latitude: 10.883566,
    longitude: 107.429762,
    region: 'TINH',
    group_code: 'TINH',
    status: 0,
    province: 'Đồng Nai',
    district: 'Xuân Lộc',
    notes: null,
  },
  {
    code: 'VT',
    name: 'Cửa Hàng Vũng Tàu',
    address: '442/1/3B Bình Giã, Khu phố 5, Phường Tam Thắng, TP Vũng Tàu, Bà Rịa - Vũng Tàu',
    latitude: 10.365918,
    longitude: 107.098845,
    region: 'TINH',
    group_code: 'TINH',
    status: 0,
    province: 'Bà Rịa - Vũng Tàu',
    notes: 'MB mới kí từ 01/04/2025 - 01/04/2026',
  },
];

async function seedStores() {
  const client = await pool.connect();
  try {
    console.log('🏪 Seeding 30 store branches...\n');

    // Ensure columns exist
    await client.query(`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS region VARCHAR(50);
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS group_code VARCHAR(50);
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS notes TEXT;
    `);

    let inserted = 0;
    let updated = 0;

    for (const store of stores) {
      const storeId = `store_${store.code}`;
      const isActive = store.status === 1; // Only status=1 is active
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`;

      const sql = `
        INSERT INTO stores (id, code, name, address, phone, province, district, ward, map_url, latitude, longitude, region, group_code, status, notes, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            address = EXCLUDED.address,
            province = EXCLUDED.province,
            district = COALESCE(EXCLUDED.district, stores.district),
            map_url = EXCLUDED.map_url,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            region = EXCLUDED.region,
            group_code = EXCLUDED.group_code,
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            is_active = EXCLUDED.is_active,
            updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS is_insert;
      `;

      const res = await client.query(sql, [
        storeId,
        store.code,
        store.name,
        store.address,
        store.phone || '02871000472',
        store.province || 'Hồ Chí Minh',
        store.district || null,
        store.ward || null,
        mapUrl,
        store.latitude,
        store.longitude,
        store.region,
        store.group_code,
        store.status,
        store.notes || null,
        isActive,
      ]);

      const isInsert = res.rows[0]?.is_insert;
      if (isInsert) {
        inserted++;
      } else {
        updated++;
      }

      const statusLabel = store.status === 1 ? '🟢 Active' : store.status === 2 ? '🟡 Suspended' : '🔴 Closed';
      console.log(`  ${statusLabel}  [${store.code}] ${store.name} — ${store.address.substring(0, 50)}...`);
    }

    console.log(`\n✅ Done! ${inserted} inserted, ${updated} updated.`);

    // Print summary by region
    const regionSummary = await client.query(`
      SELECT 
        region, 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS suspended
      FROM stores
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY region;
    `);

    console.log('\n📊 Summary by Region:');
    console.log('─'.repeat(60));
    console.log('Region     │ Total │ Active │ Closed │ Suspended');
    console.log('─'.repeat(60));
    for (const row of regionSummary.rows) {
      const r = row.region.padEnd(10);
      console.log(`${r} │ ${String(row.total).padStart(5)} │ ${String(row.active).padStart(6)} │ ${String(row.closed).padStart(6)} │ ${String(row.suspended).padStart(9)}`);
    }
    console.log('─'.repeat(60));

  } catch (error) {
    console.error('❌ Error seeding stores:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedStores();
