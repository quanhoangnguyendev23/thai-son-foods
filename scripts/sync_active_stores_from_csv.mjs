import 'dotenv/config';
import { Pool } from 'pg';

const ACTIVE_STORES = [
  {
    id: 'store_TCH',
    code: 'TCH',
    name: 'Cửa Hàng TCH - Trung Mỹ Tây',
    address: '113/33 Đường TCH03, Phường Trung Mỹ Tây, TP.HCM',
    phone: '0911812433',
    province: 'Hồ Chí Minh',
    district: 'Quận 12',
    ward: 'Trung Mỹ Tây',
    latitude: 10.871807,
    longitude: 106.62651,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.871807,106.62651',
    region: 'SG1',
    group_code: 'SG1.1',
    notes: null,
  },
  {
    id: 'store_TN',
    code: 'TN',
    name: 'Cửa Hàng TN - An Nhơn',
    address: '208/28 Lê Đức Thọ, Phường An Nhơn, TP.HCM',
    phone: '0911812432',
    province: 'Hồ Chí Minh',
    district: 'Gò Vấp',
    ward: 'An Nhơn',
    latitude: 10.83707,
    longitude: 106.68115,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.83707,106.68115',
    region: 'SG1',
    group_code: 'SG1.2',
    notes: null,
  },
  {
    id: 'store_THB',
    code: 'THB',
    name: 'Cửa Hàng THB - Tân Sơn Hòa',
    address: '2C Phổ Quang, P. Tân Sơn Hòa, TP.HCM',
    phone: '0911812434',
    province: 'Hồ Chí Minh',
    district: 'Tân Bình',
    ward: 'Tân Sơn Hòa',
    latitude: 10.803028,
    longitude: 106.667668,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.803028,106.667668',
    region: 'SG1',
    group_code: 'SG1.2',
    notes: null,
  },
  {
    id: 'store_D1',
    code: 'D1',
    name: 'Cửa Hàng D1 - Thạnh Mỹ Tây',
    address: '255 Ung Văn Khiêm, Phường Thạnh Mỹ Tây, TP.HCM',
    phone: '0911812437',
    province: 'Hồ Chí Minh',
    district: 'Bình Thạnh',
    ward: 'Thạnh Mỹ Tây',
    latitude: 10.804418,
    longitude: 106.721872,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.804418,106.721872',
    region: 'SG2',
    group_code: 'SG2.1',
    notes: null,
  },
  {
    id: 'store_NTB',
    code: 'NTB',
    name: 'Cửa Hàng NTB - Bến Thành',
    address: '157 Nguyễn Thái Bình, Phường Bến Thành, TP.HCM',
    phone: '0911812435',
    province: 'Hồ Chí Minh',
    district: 'Quận 1',
    ward: 'Bến Thành',
    latitude: 10.76809,
    longitude: 106.69854,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.76809,106.69854',
    region: 'SG2',
    group_code: 'SG2.2',
    notes: null,
  },
  {
    id: 'store_TTH',
    code: 'TTH',
    name: 'Cửa Hàng TTH - Tân Mỹ',
    address: '858 Huỳnh Tấn Phát, Phường Tân Mỹ, TP.HCM',
    phone: '0911812417',
    province: 'Hồ Chí Minh',
    district: 'Quận 7',
    ward: 'Tân Mỹ',
    latitude: 10.7286801,
    longitude: 106.7323373,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.7286801,106.7323373',
    region: 'SG2',
    group_code: 'SG2.2',
    notes: null,
  },
  {
    id: 'store_DN',
    code: 'DN',
    name: 'Cửa Hàng DN - Diên Hồng',
    address: '2C Cư Xá Đồng Tiến, Phường Diên Hồng, TP.HCM',
    phone: '0911812428',
    province: 'Hồ Chí Minh',
    district: 'Quận 10',
    ward: 'Diên Hồng',
    latitude: 10.7702923,
    longitude: 106.6645227,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.7702923,106.6645227',
    region: 'SG3',
    group_code: 'SG3.1',
    notes: null,
  },
  {
    id: 'store_NB',
    code: 'NB',
    name: 'Cửa Hàng NB - Chánh Hưng',
    address: '25 Đường 152A Cao Lỗ, P.Chánh Hưng, TP.HCM',
    phone: '0911812482',
    province: 'Hồ Chí Minh',
    district: 'Quận 8',
    ward: 'Chánh Hưng',
    latitude: 10.737222,
    longitude: 106.674985,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.737222,106.674985',
    region: 'SG3',
    group_code: 'SG3.1',
    notes: '29/10/2025 CH NB sẽ dời sang MB mới',
  },
  {
    id: 'store_RD',
    code: 'RD',
    name: 'Cửa Hàng RD - Bình Trị Đông',
    address: '95/44 Chiến Lược, Khu Phố 68, Phường Bình Trị Đông, TP.HCM',
    phone: '0911812418',
    province: 'Hồ Chí Minh',
    district: 'Bình Tân',
    ward: 'Bình Trị Đông',
    latitude: 10.759817,
    longitude: 106.618845,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.759817,106.618845',
    region: 'SG3',
    group_code: 'SG3.2',
    notes: null,
  },
  {
    id: 'store_NH',
    code: 'NH',
    name: 'Cửa Hàng NH - Phú Thọ Hòa',
    address: '298/4 Vườn Lài, P.Phú Thọ Hòa, TP.HCM',
    phone: '0911812425',
    province: 'Hồ Chí Minh',
    district: 'Tân Phú',
    ward: 'Phú Thọ Hòa',
    latitude: 10.7882898,
    longitude: 106.6251124,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.7882898,106.6251124',
    region: 'SG3',
    group_code: 'SG3.2',
    notes: null,
  },
  {
    id: 'store_TBA',
    code: 'TBA',
    name: 'Cửa Hàng TBA - Trảng Bàng',
    address: '28B Đường Hai Mươi Hai Tháng Mười Hai, Khu Phố Lộc Du, Phường Trảng Bàng, Tỉnh Tây Ninh',
    phone: '0836937498',
    province: 'Tây Ninh',
    district: 'Trảng Bàng',
    ward: 'Trảng Bàng',
    latitude: 11.039348,
    longitude: 106.356546,
    map_url: 'https://www.google.com/maps/search/?api=1&query=11.039348,106.356546',
    region: 'SG4',
    group_code: 'SG4',
    notes: '18/9/2025 đổi sang mb mới + đổi tên',
  },
  {
    id: 'store_XA',
    code: 'XA',
    name: 'Cửa Hàng XA - Tân An Hội',
    address: 'Số 1D, Đường 10A, Ấp 1, Xã Tân An Hội, TP.HCM',
    phone: '0911812473',
    province: 'Hồ Chí Minh',
    district: 'Củ Chi',
    ward: 'Tân An Hội',
    latitude: 10.9712462,
    longitude: 106.4928858,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.9712462,106.4928858',
    region: 'SG4',
    group_code: 'SG4',
    notes: null,
  },
  {
    id: 'store_MP',
    code: 'MP',
    name: 'Cửa Hàng MP - Hòa Lợi',
    address: 'Đường Ne8, Khu Phố An Hòa, Phường Hòa Lợi, TP.HCM',
    phone: '0911812411',
    province: 'Hồ Chí Minh',
    district: 'Bến Cát',
    ward: 'Hòa Lợi',
    latitude: 11.096264,
    longitude: 106.661671,
    map_url: 'https://www.google.com/maps/search/?api=1&query=11.096264,106.661671',
    region: 'BD1',
    group_code: 'BD1',
    notes: 'Cách Bưu điện KCN MP3 4km',
  },
  {
    id: 'store_ME',
    code: 'ME',
    name: 'Cửa Hàng ME - An Phú',
    address: '75/5 Khu Phố 4, Phường An Phú, TP.HCM',
    phone: '0911812412',
    province: 'Hồ Chí Minh',
    district: 'Thuận An',
    ward: 'An Phú',
    latitude: 10.95227,
    longitude: 106.72959,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.95227,106.72959',
    region: 'BD1',
    group_code: 'BD1',
    notes: 'Cách Aeon BD 5km',
  },
  {
    id: 'store_TDM',
    code: 'TDM',
    name: 'Cửa Hàng TDM - Chánh Hiệp',
    address: '278 Nguyễn Văn Lộng, P.Chánh Hiệp, TP.HCM',
    phone: '0911812405',
    province: 'Hồ Chí Minh',
    district: 'Thủ Dầu Một',
    ward: 'Chánh Hiệp',
    latitude: 10.991353,
    longitude: 106.644095,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.991353,106.644095',
    region: 'BD1',
    group_code: 'BD1',
    notes: 'Cách KDL Đại Nam 6km',
  },
  {
    id: 'store_TB',
    code: 'TB',
    name: 'Cửa Hàng TB - Tam Bình',
    address: '952/2a Tỉnh Lộ 43, Phường Tam Bình, TP.HCM',
    phone: '0911812407',
    province: 'Hồ Chí Minh',
    district: 'TP. Thủ Đức',
    ward: 'Tam Bình',
    latitude: 10.882625,
    longitude: 106.729694,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.882625,106.729694',
    region: 'BD2',
    group_code: 'BD2.1',
    notes: 'Cách cầu vượt Gò Dưa 1.5km',
  },
  {
    id: 'store_BD',
    code: 'BD',
    name: 'Cửa Hàng BD - Dĩ An',
    address: '126 Đường Số 5, Khu Phố Nhị Đồng 1, Phường Dĩ An, TP.HCM',
    phone: '0911812414',
    province: 'Hồ Chí Minh',
    district: 'Dĩ An',
    ward: 'Dĩ An',
    latitude: 10.9025924,
    longitude: 106.7600285,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.9025924,106.7600285',
    region: 'BD2',
    group_code: 'BD2.1',
    notes: null,
  },
  {
    id: 'store_LX',
    code: 'LX',
    name: 'Cửa Hàng LX - Linh Xuân',
    address: '100A, Khu phố 54, Phường Linh Xuân, TP.HCM',
    phone: '0911812413',
    province: 'Hồ Chí Minh',
    district: 'TP. Thủ Đức',
    ward: 'Linh Xuân',
    latitude: 10.861756,
    longitude: 106.755823,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.861756,106.755823',
    region: 'BD2',
    group_code: 'BD2.2',
    notes: 'Từ đầu đường số 9 vô 200m',
  },
  {
    id: 'store_TD',
    code: 'TD',
    name: 'Cửa Hàng TD - Tăng Nhơn Phú',
    address: 'C20/3A Đường 449, P.Tăng Nhơn Phú, TP.HCM',
    phone: '0911812404',
    province: 'Hồ Chí Minh',
    district: 'Quận 9',
    ward: 'Tăng Nhơn Phú',
    latitude: 10.847883,
    longitude: 106.795298,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.847883,106.795298',
    region: 'BD2',
    group_code: 'BD2.2',
    notes: 'Cách ngã tư Bình Thái 1km',
  },
  {
    id: 'store_AMA',
    code: 'AMA',
    name: 'Cửa Hàng AMA - Tam Hiệp',
    address: '225 Đường 518, P.Tam Hiệp, Đồng Nai',
    phone: '0836937504',
    province: 'Đồng Nai',
    district: 'Biên Hòa',
    ward: 'Tam Hiệp',
    latitude: 10.960607,
    longitude: 106.870008,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.960607,106.870008',
    region: 'DN1',
    group_code: 'DN1',
    notes: 'Cách BV ĐK ĐN 1.5km',
  },
  {
    id: 'store_LB',
    code: 'LB',
    name: 'Cửa Hàng LB - Phước Tân',
    address: '20 Nam Cao, Tân Mai, P.Phước Tân, Đồng Nai',
    phone: '0836937503',
    province: 'Đồng Nai',
    district: 'Biên Hòa',
    ward: 'Phước Tân',
    latitude: 10.872470009227596,
    longitude: 106.9064783841573,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.872470009227596,106.9064783841573',
    region: 'DN1',
    group_code: 'DN1',
    notes: 'Cách cổng 11 4km, chợ Tân Mai 300m (Gộp LT và LB)',
  },
  {
    id: 'store_CM',
    code: 'CM',
    name: 'Cửa Hàng CM - Long Thành',
    address: 'Nhà trọ số 8 - Tổ 35, Đinh Bộ Lĩnh, ấp Cầu Xéo, xã Long Thành, Đồng Nai',
    phone: '0911812559',
    province: 'Đồng Nai',
    district: 'Long Thành',
    ward: 'Long Thành',
    latitude: 10.775101,
    longitude: 106.956833,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.775101,106.956833',
    region: 'DN2',
    group_code: 'DN2',
    notes: 'dời sang mặt bằng mới từ ngày 08/01/2026',
  },
  {
    id: 'store_TRB',
    code: 'TRB',
    name: 'Cửa Hàng TRB - Trảng Bom',
    address: '17A Huỳnh Văn Nghệ, KP 4, xã Trảng Bom, Đồng Nai',
    phone: '0846937524',
    province: 'Đồng Nai',
    district: 'Trảng Bom',
    ward: 'Trảng Bom',
    latitude: 10.944366,
    longitude: 107.010477,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.944366,107.010477',
    region: 'DN2',
    group_code: 'DN2',
    notes: 'Cách Bưu điện huyện TRB 800m',
  },
  {
    id: 'store_CTH',
    code: 'CTH',
    name: 'Cửa Hàng CTH - An Bình',
    address: '270/8 Trần Vĩnh Kiết, Phường An Bình, Cần Thơ',
    phone: '0836937481',
    province: 'Cần Thơ',
    district: 'Ninh Kiều',
    ward: 'An Bình',
    latitude: 10.024142,
    longitude: 105.751664,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.024142,105.751664',
    region: 'TINH',
    group_code: 'TINH',
    notes: null,
  },
  {
    id: 'store_XL',
    code: 'XL',
    name: 'Cửa Hàng XL - Xuân Hòa',
    address: '2346, Ấp Xuân Tâm 6, Xã Xuân Hòa, Đồng Nai',
    phone: '0911812439',
    province: 'Đồng Nai',
    district: 'Xuân Lộc',
    ward: 'Xuân Hòa',
    latitude: 10.883566,
    longitude: 107.429762,
    map_url: 'https://www.google.com/maps/search/?api=1&query=10.883566,107.429762',
    region: 'TINH',
    group_code: 'TINH',
    notes: null,
  },
];

const WAREHOUSES = [
  {
    id: 'store_XBD',
    code: 'XBD',
    name: 'Xưởng Bình Dương (Kho Tổng)',
    address: '6/8 Khu Phố Đồng An 3, Phường Bình Hòa, Thị Xã Thuận An, Tỉnh Bình Dương',
    phone: '02871000472',
    province: 'Bình Dương',
    district: 'Thuận An',
    ward: 'Bình Hòa',
    latitude: 10.90554,
    longitude: 106.72946,
    map_url: 'https://www.google.com/maps/search/?api=1&query=6%2F8+Khu+Ph%E1%BB%91+%C4%90%E1%BB%93ng+An+3+B%C3%ACnh+H%C3%B2a+Thu%E1%BA%ADn+An',
    region: 'KHO',
    group_code: 'KHO',
    notes: 'Kho xưởng sản xuất',
    status: 2,
    is_active: false,
  },
  {
    id: 'store_XBC',
    code: 'XBC',
    name: 'Xưởng Bình Chánh (Kho Tổng)',
    address: 'Số 10, Đường số 14, Ấp 5, Xã Phong Phú, Huyện Bình Chánh, TP. HCM',
    phone: '02871000472',
    province: 'Hồ Chí Minh',
    district: 'Bình Chánh',
    ward: 'Phong Phú',
    latitude: 10.725792,
    longitude: 106.648624,
    map_url: 'https://www.google.com/maps/search/?api=1&query=S%E1%BB%91+10+%C4%90%C6%B0%E1%BB%9Dng+s%E1%BB%91+14+%E1%BA%A4p+5+Phong+Ph%C3%BA+B%C3%ACnh+Ch%C3%A1nh',
    region: 'KHO',
    group_code: 'KHO',
    notes: 'Kho xưởng sản xuất',
    status: 2,
    is_active: false,
  },
  {
    id: 'store_TAT',
    code: 'TAT',
    name: 'Xưởng Tóc Tiên (Kho Tổng)',
    address: 'Ấp 6, Tóc Tiên, TX. Phú Mỹ, Bà Rịa - Vũng Tàu',
    phone: '02871000472',
    province: 'Bà Rịa - Vũng Tàu',
    district: 'Phú Mỹ',
    ward: 'Tóc Tiên',
    latitude: 10.5512,
    longitude: 107.1352,
    map_url: 'https://www.google.com/maps/search/?api=1&query=%E1%BA%A4p+6+T%C3%B3c+Ti%C3%AAn+Ph%C3%BA+M%E1%BB%B9+B%C3%A0+R%E1%BB%8Ba+V%C5%A9ng+T%C3%A0u',
    region: 'KHO',
    group_code: 'KHO',
    notes: 'Kho xưởng sản xuất',
    status: 2,
    is_active: false,
  },
];

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Tsf@123@localhost:5432/WebTSF',
  });

  console.log('🔄 BẮT ĐẦU ĐỒNG BỘ 25 CỬA HÀNG ĐANG HOẠT ĐỘNG VÀO DATABASE WebTSF...\n');

  // 1. Vô hiệu hóa các cửa hàng test/dummy (adminCH1 -> adminCH5) và các cửa hàng đã đóng
  const dummyCodes = ['adminCH1', 'adminCH2', 'adminCH3', 'adminCH4', 'adminCH5'];
  const closedCodes = ['VL', 'HHT', 'CL', 'VT', 'LT'];

  console.log('1. Vô hiệu hóa các chi nhánh test và chi nhánh đã đóng...');
  await pool.query(
    `UPDATE stores SET is_active = false, status = 0, updated_at = CURRENT_TIMESTAMP WHERE code = ANY($1);`,
    [dummyCodes]
  );
  await pool.query(
    `UPDATE stores SET is_active = false, status = 0, updated_at = CURRENT_TIMESTAMP WHERE code = ANY($1);`,
    [closedCodes]
  );
  console.log(`   Đã vô hiệu hóa: ${dummyCodes.join(', ')} và ${closedCodes.join(', ')}`);

  // 2. Upsert 25 Cửa Hàng Bán Lẻ Đang Hoạt Động
  await pool.query(`
    ALTER TABLE stores ADD COLUMN IF NOT EXISTS address_new TEXT;
    ALTER TABLE stores ADD COLUMN IF NOT EXISTS area_label VARCHAR(100);
  `);
  console.log('\n2. Upsert 25 Cửa Hàng Bán Lẻ Đang Hoạt Động...');
  for (const s of ACTIVE_STORES) {
    await pool.query(
      `INSERT INTO stores (
        id, code, name, address, address_new, area_label, phone, province, district, ward, 
        latitude, longitude, map_url, region, group_code, notes, 
        status, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $15, $16, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 1, true, CURRENT_TIMESTAMP)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        address_new = EXCLUDED.address_new,
        area_label = EXCLUDED.area_label,
        phone = EXCLUDED.phone,
        province = EXCLUDED.province,
        district = EXCLUDED.district,
        ward = EXCLUDED.ward,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        map_url = EXCLUDED.map_url,
        region = EXCLUDED.region,
        group_code = EXCLUDED.group_code,
        notes = EXCLUDED.notes,
        status = 1,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP;`,
      [
        s.id, s.code, s.name, s.address, s.phone, s.province, s.district, s.ward,
        s.latitude, s.longitude, s.map_url, s.region, s.group_code, s.notes,
        s.address, s.ward,
      ]
    );
    console.log(`   ✅ [${s.code}] ${s.name} - SĐT: ${s.phone} - Tọa độ: ${s.latitude}, ${s.longitude}`);
  }

  // 3. Upsert 3 Kho Tổng / Xưởng Sản Xuất
  console.log('\n3. Upsert 3 Kho Tổng / Xưởng Sản Xuất...');
  for (const w of WAREHOUSES) {
    await pool.query(
      `INSERT INTO stores (
        id, code, name, address, phone, province, district, ward, 
        latitude, longitude, map_url, region, group_code, notes, 
        status, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        province = EXCLUDED.province,
        district = EXCLUDED.district,
        ward = EXCLUDED.ward,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        map_url = EXCLUDED.map_url,
        region = EXCLUDED.region,
        group_code = EXCLUDED.group_code,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP;`,
      [
        w.id, w.code, w.name, w.address, w.phone, w.province, w.district, w.ward,
        w.latitude, w.longitude, w.map_url, w.region, w.group_code, w.notes,
        w.status, w.is_active,
      ]
    );
    console.log(`   🏭 [${w.code}] ${w.name}`);
  }

  // 4. Khởi tạo Tồn kho (store_inventory) cho toàn bộ 25 cửa hàng đang hoạt động
  console.log('\n4. Khởi tạo Tồn kho (store_inventory) cho 25 cửa hàng x 12 sản phẩm...');
  const prodRes = await pool.query('SELECT id, name FROM products WHERE is_active = true ORDER BY id ASC;');
  const activeProducts = prodRes.rows;
  console.log(`   Tìm thấy ${activeProducts.length} sản phẩm đang kinh doanh.`);

  let insertedCount = 0;
  for (const store of ACTIVE_STORES) {
    for (const prod of activeProducts) {
      const invId = `inv_${store.code}_${prod.id}`;
      // Nếu đã có tồn kho rồi thì giữ nguyên, nếu chưa có thì khởi tạo 100 chai
      const res = await pool.query(
        `INSERT INTO store_inventory (
          id, store_code, product_id, stock_quantity, reserved, safety_stock, updated_by, updated_at
        ) VALUES ($1, $2, $3, 100, 0, 0, 'system_sync', CURRENT_TIMESTAMP)
        ON CONFLICT (store_code, product_id) DO NOTHING;`,
        [invId, store.code, prod.id]
      );
      if (res.rowCount > 0) insertedCount++;
    }
  }
  console.log(`   Đã khởi tạo ${insertedCount} bản ghi tồn kho mới.`);

  // 5. Kiểm tra và in báo cáo kết quả
  const countRes = await pool.query(`
    SELECT 
      count(*) FILTER (WHERE is_active = true) as active_count,
      count(*) FILTER (WHERE is_active = false) as inactive_count,
      count(*) as total_count
    FROM stores;
  `);
  console.log('\n--- TỔNG KẾT BẢNG STORES ---');
  console.log(`Số chi nhánh đang hoạt động (is_active = true): ${countRes.rows[0].active_count} (Mục tiêu: 25)`);
  console.log(`Số chi nhánh không hoạt động / kho / test: ${countRes.rows[0].inactive_count}`);
  console.log(`Tổng số cửa hàng trong DB: ${countRes.rows[0].total_count}`);

  const activeStoresList = await pool.query(`
    SELECT code, name, phone, district, province, is_active, status 
    FROM stores 
    WHERE is_active = true 
    ORDER BY code ASC;
  `);
  console.log('\n--- DANH SÁCH 25 CỬA HÀNG ĐANG HOẠT ĐỘNG ---');
  console.table(activeStoresList.rows);

  const invSummary = await pool.query(`
    SELECT store_code, count(*) as products_count, sum(stock_quantity) as total_stock
    FROM store_inventory
    WHERE store_code = ANY($1)
    GROUP BY store_code
    ORDER BY store_code ASC;
  `, [ACTIVE_STORES.map(s => s.code)]);
  console.log(`\n--- TỒN KHO CỦA ${invSummary.rows.length} CHI NHÁNH HOẠT ĐỘNG ---`);
  console.table(invSummary.rows);

  await pool.end();
  console.log('\n🎉 ĐỒNG BỘ DỮ LIỆU CỬA HÀNG VÀ TỒN KHO THÀNH CÔNG RỰC RỠ!');
}

run().catch((err) => {
  console.error('Lỗi khi đồng bộ cửa hàng:', err);
  process.exit(1);
});
