import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
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
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || dbPasswordFromEnv(),
  database: process.env.DB_NAME || 'WebTSF_staging',
});

async function runAudit() {
  console.log('=== PHASE 0 AUDIT ===');

  // a) Có chai nào store_inventory.stock_quantity < 0 hoặc stock_quantity < reserved không? Liệt kê.
  console.log('\n--- a) store_inventory.stock_quantity < 0 hoặc stock_quantity < reserved ---');
  const resA = await pool.query(`
    SELECT si.store_code, si.product_id, p.name as product_name, si.stock_quantity, si.reserved
    FROM store_inventory si
    LEFT JOIN products p ON si.product_id = p.id
    WHERE si.stock_quantity < 0 OR si.stock_quantity < si.reserved;
  `);
  console.log(`Số dòng vi phạm: ${resA.rows.length}`);
  console.table(resA.rows);

  // b) Với mỗi (store, product): so reserved với SUM(quantity) của stock_reservations status='active'. Liệt kê chỗ lệch.
  console.log('\n--- b) So sánh reserved vs SUM(active reservations) ---');
  const resB = await pool.query(`
    WITH active_res AS (
      SELECT store_code, product_id, SUM(quantity) as active_reserved_sum
      FROM stock_reservations
      WHERE status = 'active'
      GROUP BY store_code, product_id
    )
    SELECT 
      si.store_code,
      si.product_id,
      p.name as product_name,
      si.reserved as inventory_reserved,
      COALESCE(ar.active_reserved_sum, 0) as active_res_sum,
      (si.reserved - COALESCE(ar.active_reserved_sum, 0)) as diff
    FROM store_inventory si
    LEFT JOIN active_res ar ON si.store_code = ar.store_code AND si.product_id = ar.product_id
    LEFT JOIN products p ON si.product_id = p.id
    WHERE si.reserved != COALESCE(ar.active_reserved_sum, 0)
    ORDER BY ABS(si.reserved - COALESCE(ar.active_reserved_sum, 0)) DESC;
  `);
  console.log(`Số cặp (store, product) bị lệch reserved: ${resB.rows.length}`);
  console.table(resB.rows);

  // c) Với mỗi (store, product): so stock_quantity hiện tại với chuỗi inventory_logs (new_stock cuối cùng, và tổng biến động). Liệt kê chỗ lệch.
  console.log('\n--- c) So sánh stock_quantity vs inventory_logs ---');
  // First, let's see schema of inventory_logs
  const logCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'inventory_logs'
  `);
  console.log('Columns of inventory_logs:', logCols.rows.map(r => r.column_name).join(', '));

  // Query latest log and delta sum
  const resC = await pool.query(`
    WITH latest_logs AS (
      SELECT DISTINCT ON (store_code, product_id)
        store_code,
        product_id,
        new_stock,
        (new_stock - old_stock) as change_amount,
        created_at
      FROM inventory_logs
      ORDER BY store_code, product_id, created_at DESC, id DESC
    ),
    sum_logs AS (
      SELECT store_code, product_id, SUM(new_stock - old_stock) as total_change, COUNT(*) as log_count
      FROM inventory_logs
      GROUP BY store_code, product_id
    )
    SELECT 
      si.store_code,
      si.product_id,
      p.name as product_name,
      si.stock_quantity as current_stock,
      ll.new_stock as latest_log_new_stock,
      (si.stock_quantity - ll.new_stock) as diff_vs_latest_log,
      sl.total_change,
      sl.log_count
    FROM store_inventory si
    LEFT JOIN latest_logs ll ON si.store_code = ll.store_code AND si.product_id = ll.product_id
    LEFT JOIN sum_logs sl ON si.store_code = sl.store_code AND si.product_id = sl.product_id
    LEFT JOIN products p ON si.product_id = p.id
    WHERE ll.new_stock IS NOT NULL AND si.stock_quantity != ll.new_stock
    ORDER BY si.store_code, si.product_id;
  `);
  console.log(`Số cặp (store, product) lệch giữa stock_quantity và new_stock cuối cùng trong log: ${resC.rows.length}`);
  console.table(resC.rows.slice(0, 30));

  // Also check if there are store_inventory rows without any logs
  const resC_noLogs = await pool.query(`
    SELECT COUNT(*) FROM store_inventory si
    WHERE NOT EXISTS (
      SELECT 1 FROM inventory_logs il 
      WHERE il.store_code = si.store_code AND il.product_id = si.product_id
    );
  `);
  console.log(`Số dòng store_inventory chưa từng có log: ${resC_noLogs.rows[0].count}`);

  // h) 44 đơn COMPLETED có inventory_deducted=false
  console.log('\n--- h) 44 đơn COMPLETED có inventory_deducted=false ---');
  const orderCols = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'orders'
  `);
  console.log('Columns of orders:', orderCols.rows.map(r => r.column_name).join(', '));

  const resFalse = await pool.query(`SELECT count(*) FROM orders WHERE status = 'COMPLETED' AND inventory_deducted = false;`);
  const resNull = await pool.query(`SELECT count(*) FROM orders WHERE status = 'COMPLETED' AND inventory_deducted IS NULL;`);
  console.log(`Số đơn COMPLETED có inventory_deducted = false: ${resFalse.rows[0].count}`);
  console.log(`Số đơn COMPLETED có inventory_deducted IS NULL: ${resNull.rows[0].count}`);

  const resH = await pool.query(`
    SELECT order_code, full_name, phone, total, store_code, created_at
    FROM orders
    WHERE status = 'COMPLETED' AND inventory_deducted = false
    ORDER BY created_at ASC;
  `);
  console.log(`\nDanh sách chi tiết ${resH.rows.length} đơn có inventory_deducted = false:`);
  
  resH.rows.forEach((r, idx) => {
    const isTestCode = /test/i.test(r.order_code || '') || /test/i.test(r.full_name || '');
    const isPhoneTest = !r.phone || /^000|^123|test/i.test(r.phone) || r.phone.length < 9;
    const isZeroAmount = Number(r.total) === 0;
    const isReal = !isTestCode && !isPhoneTest && !isZeroAmount;
    const dateStr = new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19);
    console.log(`${idx + 1}. [${r.order_code}] | ${r.full_name || 'N/A'} | SĐT: ${r.phone} | ${Number(r.total).toLocaleString('vi-VN')} đ | Kho: ${r.store_code || 'null (trước 28/09)'} | ${dateStr} => ${isReal ? 'KHÔNG PHẢI TEST (ĐƠN THẬT)' : 'ĐƠN TEST'}`);
  });

  await pool.end();
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
