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

const pool = new pg.Pool({
  connectionString: requireDatabaseUrl()
});

// Regex cũ ban đầu trong src/lib/inventory.ts
function oldRegexMultiplier(rawId, unit, name) {
  const combined = `${rawId} ${unit || ''} ${name || ''}`.toLowerCase();
  const match = combined.match(/(\d+)\s*(chai|bottle)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }
  const variantMatch = combined.match(/[-_](\d+)chai/);
  if (variantMatch) {
    const num = parseInt(variantMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return 1; // Fallback cũ
}

export async function migrateUp() {
  const client = await pool.connect();
  try {
    console.log('================================================================');
    console.log('MIGRATION UP: THÊM CỘT bottle_multiplier NOT NULL VÀO product_variants');
    console.log('================================================================');

    await client.query('BEGIN');

    // 1. Thêm cột bottle_multiplier nếu chưa có (tạm thời DEFAULT 1)
    await client.query(`
      ALTER TABLE product_variants 
      ADD COLUMN IF NOT EXISTS bottle_multiplier INTEGER DEFAULT 1;
    `);
    console.log('-> Đã tạo cột bottle_multiplier.');

    // 2. Lấy 43 biến thể hiện có
    const res = await client.query(`
      SELECT id, product_id, name, quantity, unit, volume 
      FROM product_variants 
      ORDER BY product_id, id;
    `);
    console.log(`-> Tìm thấy ${res.rows.length} biến thể trong Database.\n`);

    const tableReport = [];
    let discrepanciesCount = 0;

    for (const v of res.rows) {
      // Hệ số mới lấy từ quantity của biến thể (hoặc phân tích quy cách nếu quantity rỗng)
      const newMultiplier = Number(v.quantity) || 1;
      const oldMultiplier = oldRegexMultiplier(v.id, v.unit, v.name);
      const isMismatch = newMultiplier !== oldMultiplier;

      if (isMismatch) discrepanciesCount++;

      // Backfill vào DB
      await client.query(
        `UPDATE product_variants SET bottle_multiplier = $1 WHERE id = $2;`,
        [newMultiplier, v.id]
      );

      tableReport.push({
        'Variant ID': v.id,
        'Product': v.product_id,
        'Tên / Quy cách': v.name.length > 25 ? v.name.slice(0, 22) + '...' : v.name,
        'Unit': v.unit || '',
        'Qty DB': v.quantity,
        'Regex Cũ': oldMultiplier,
        'Hệ Số Mới': newMultiplier,
        'Trạng Thái': isMismatch ? '⚠️ LỆCH' : '✓ Khớp'
      });
    }

    // 3. Đặt điều kiện NOT NULL
    await client.query(`
      ALTER TABLE product_variants 
      ALTER COLUMN bottle_multiplier SET NOT NULL;
    `);
    console.log('-> Đã áp dụng ràng buộc NOT NULL cho bottle_multiplier.');

    await client.query('COMMIT');
    console.log('-> Giao dịch MIGRATION UP đã COMMIT thành công!\n');

    // IN BẢNG BÁO CÁO TỪNG BIẾN THỂ
    console.log('BẢNG SO SÁNH HỆ SỐ TỒN KHO TỪNG BIẾN THỂ (43 BIẾN THỂ DB):');
    console.table(tableReport);

    console.log(`\nTổng số biến thể: ${res.rows.length}`);
    console.log(`Số biến thể lệch giữa Regex cũ vs Hệ số mới: ${discrepanciesCount}`);

    // LIỆT KÊ 3 BIẾN THỂ THIẾU CỦA PROD-SS-01 (ĐỂ NGƯỜI DÙNG QUYẾT ĐỊNH, KHÔNG TỰ THÊM)
    console.log('\n================================================================');
    console.log('DANH SÁCH 3 BIẾN THỂ THIẾU CỦA prod-ss-01 (sua-hat-sen-lotus)');
    console.log('(Chỉ liệt kê để Quý Khách quyết định, hệ thống KHÔNG tự ý thêm vào DB)');
    console.log('================================================================');
    const missingSS01 = [
      {
        id: 'ss-5chai',
        product_id: 'prod-ss-01',
        name: 'Sữa Hạt Sen Lotus Yoo nấu từ hạt sen tươi thanh mát, chai 568ml',
        quantity: 5,
        price: 155000,
        unit: '1 chai',
        volume: '5 x 568ml',
        expected_multiplier: 5,
        note: 'Có trong src/data/products.ts nhưng chưa seed vào bảng product_variants'
      },
      {
        id: 'ss-7chai',
        product_id: 'prod-ss-01',
        name: 'Sữa Hạt Sen Lotus Yoo nấu từ hạt sen tươi thanh mát, chai 568ml',
        quantity: 7,
        price: 217000,
        unit: '1 chai',
        volume: '7 x 568ml',
        expected_multiplier: 7,
        note: 'Có trong src/data/products.ts nhưng chưa seed vào bảng product_variants'
      },
      {
        id: 'ss-10chai',
        product_id: 'prod-ss-01',
        name: 'Sữa Hạt Sen Lotus Yoo nấu từ hạt sen tươi thanh mát, chai 568ml',
        quantity: 10,
        price: 310000,
        unit: '1 chai',
        volume: '10 x 568ml',
        expected_multiplier: 10,
        note: 'Có trong src/data/products.ts nhưng chưa seed vào bảng product_variants'
      }
    ];
    console.table(missingSS01);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi Migration Up:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function migrateDown() {
  const client = await pool.connect();
  try {
    console.log('================================================================');
    console.log('MIGRATION DOWN (ROLLBACK): XÓA CỘT bottle_multiplier');
    console.log('================================================================');
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE product_variants 
      DROP COLUMN IF EXISTS bottle_multiplier;
    `);
    await client.query('COMMIT');
    console.log('-> Đã Rollback thành công cột bottle_multiplier.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi Migration Down:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Chạy lệnh CLI
const action = process.argv[2] || 'up';
if (action === 'down') {
  migrateDown().then(() => pool.end());
} else {
  migrateUp().then(() => pool.end());
}
