/**
 * Quét MỘT LẦN địa chỉ đã lưu (users) và đơn 30 ngày gần nhất (orders) bằng hàm kiểm tra phường mới.
 * Chỉ ĐẾM và báo số bản ghi lệch, KHÔNG sửa gì. Chỉ dùng dữ liệu nội bộ (không gọi Nominatim hàng loạt):
 * phường/quận tại tọa độ suy theo tâm phường/quận gần nhất trong dữ liệu, rồi so như ở backend (tính cả tên cũ / mới,
 * ngưỡng khoảng cách theo cỡ phường).
 * Chạy: npx tsx scripts/scan_address_mismatch.mjs
 * Production (chỉ đọc): đặt PROD_SCAN_DATABASE_URL (tài khoản chỉ đọc) trong biến môi trường rồi chạy
 *   npx tsx scripts/scan_address_mismatch.mjs --prod
 * Chế độ --prod KHÔNG đọc .env / .env.local, mở phiên READ ONLY và chỉ in số đếm (không in dữ liệu khách).
 */
import fs from 'node:fs';
import pg from 'pg';
import { checkOrderLocation } from '@/lib/address/orderLocationCheck';
import { resolveAdminFromProvider } from '@/lib/address/admin';
import { hasRealCoords } from '@/lib/address/normalize';

const prod = process.argv.includes('--prod');
const env = {};
for (const f of prod ? [] : ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
const connectionString = prod ? process.env.PROD_SCAN_DATABASE_URL : process.env.DATABASE_URL || env.DATABASE_URL;
if (!connectionString) {
  console.error(prod ? 'Thiếu biến môi trường PROD_SCAN_DATABASE_URL' : 'Thiếu DATABASE_URL');
  process.exit(1);
}
const client = new pg.Client({ connectionString, ssl: prod && !/sslmode=disable/.test(connectionString) ? { rejectUnauthorized: false } : undefined });
await client.connect();
// Mọi câu lệnh trong phiên này chỉ được đọc (ghi sẽ bị Postgres từ chối)
await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');

// Bộ tra nội bộ: chỉ suy quận cũ theo tọa độ (không tên phường) → so quận + khoảng cách theo cỡ phường
const internalResolver = async (at) => {
  const r = resolveAdminFromProvider({ lat: at.lat, lng: at.lng });
  return r.district ? { district: r.district } : null;
};

async function scan(label, sql) {
  // DB cũ chưa có cột tọa độ: chỉ đếm số bản ghi, coi như thiếu tọa độ hết
  const table = /FROM (\w+)/.exec(sql)[1];
  const hasCoords = (
    await client.query(
      "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = $1 AND column_name IN ('latitude', 'longitude')",
      [table]
    )
  ).rows[0].n === 2;
  if (!hasCoords) {
    const n = (await client.query(sql.replace(/^SELECT .*? FROM/, 'SELECT count(*)::int AS n FROM'))).rows[0].n;
    console.log(`${label}: ${n} bản ghi, bảng ${table} CHƯA CÓ cột tọa độ (DB cũ) → thiếu tọa độ ${n}, (0,0) 0, lệch: không kiểm được`);
    return;
  }
  const rows = (await client.query(sql)).rows;
  const counts = {};
  for (const row of rows) {
    if (row.latitude === null || row.longitude === null) {
      counts.null_coords = (counts.null_coords || 0) + 1;
      continue;
    }
    if (Number(row.latitude) === 0 && Number(row.longitude) === 0) {
      counts.zero_zero = (counts.zero_zero || 0) + 1;
      continue;
    }
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!hasRealCoords(lat, lng) || !row.ward) {
      counts.no_location = (counts.no_location || 0) + 1;
      continue;
    }
    const r = await checkOrderLocation({ ward: row.ward, district: row.district }, { lat, lng }, internalResolver);
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  const flagged = (counts.ward_mismatch || 0) + (counts.district_mismatch || 0) + (counts.far_from_area || 0);
  console.log(`${label}: ${rows.length} bản ghi, LỆCH ${flagged}, thiếu tọa độ (NULL) ${counts.null_coords || 0}, (0,0) ${counts.zero_zero || 0}`, JSON.stringify(counts));
}

try {
  await scan('Địa chỉ đã lưu (users)', `SELECT ward, district, latitude, longitude FROM users WHERE COALESCE(TRIM(address), '') <> ''`);
  await scan('Đơn 30 ngày gần nhất (orders)', `SELECT ward, district, latitude, longitude FROM orders WHERE created_at >= NOW() - INTERVAL '30 days'`);
} finally {
  await client.end();
}
