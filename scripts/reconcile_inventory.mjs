/**
 * reconcile_inventory.mjs
 * 
 * Script đối chiếu sổ cái tồn kho:
 * So sánh giá trị hiện tại trong store_inventory với tổng biến động từ inventory_logs
 * để phát hiện sai lệch (drift).
 * 
 * Hoàn toàn READ-ONLY.
 * 
 * Cách chạy:
 *   node scripts/reconcile_inventory.mjs
 */

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

const DB_URL = requireDatabaseUrl();
const pool = new pg.Pool({ connectionString: DB_URL });

async function main() {
  const client = await pool.connect();

  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   ĐỐI CHIẾU SỔ CÁI TỒN KHO (RECONCILIATION)            ║');
    console.log('║   Script read-only, không sửa dữ liệu                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // 1. Lấy tồn kho hiện tại từ store_inventory
    const currentInv = await client.query(`
      SELECT si.store_code, si.product_id, si.stock_quantity, si.reserved,
             p.name AS product_name
      FROM store_inventory si
      JOIN products p ON p.id = si.product_id
      ORDER BY si.store_code, si.product_id
    `);

    console.log(`📦 Tổng bản ghi store_inventory: ${currentInv.rows.length}`);

    // 2. Lấy tổng biến động từ inventory_logs cho mỗi (store_code, product_id)
    const logSummary = await client.query(`
      SELECT store_code, product_id,
             COUNT(*) AS log_count,
             MIN(created_at) AS first_log,
             MAX(created_at) AS last_log
      FROM inventory_logs
      GROUP BY store_code, product_id
      ORDER BY store_code, product_id
    `);

    console.log(`📋 Tổng nhóm (store, product) có log: ${logSummary.rows.length}`);
    console.log('');

    // 3. Kiểm tra từng bản ghi store_inventory
    console.log('══════════════════════════════════════════════════════════════');
    console.log('KIỂM TRA CHUỖI LOG:');
    console.log('══════════════════════════════════════════════════════════════');

    let driftCount = 0;
    let noLogCount = 0;
    let okCount = 0;
    const driftDetails = [];

    for (const row of currentInv.rows) {
      const { store_code, product_id, stock_quantity, reserved, product_name } = row;

      // Lấy tất cả log entries cho (store, product) theo thời gian
      const logs = await client.query(`
        SELECT old_stock, new_stock, old_reserved, new_reserved, change_type, order_id, actor, created_at
        FROM inventory_logs
        WHERE store_code = $1 AND product_id = $2
        ORDER BY created_at ASC
      `, [store_code, product_id]);

      if (logs.rows.length === 0) {
        noLogCount++;
        continue;
      }

      // Lấy log cuối cùng — giá trị new_stock và new_reserved phải khớp hiện tại
      const lastLog = logs.rows[logs.rows.length - 1];
      const lastLogStock = Number(lastLog.new_stock);
      const lastLogReserved = Number(lastLog.new_reserved);
      const currentStock = Number(stock_quantity);
      const currentReserved = Number(reserved);

      // Kiểm tra tính liên tục của chuỗi log (old_stock[n+1] phải = new_stock[n])
      let chainBroken = false;
      let chainBreakAt = -1;
      for (let i = 1; i < logs.rows.length; i++) {
        const prev = logs.rows[i - 1];
        const curr = logs.rows[i];
        // Chỉ kiểm tra stock (reserved có thể thay đổi bởi nhiều nguồn đồng thời)
        if (Number(curr.old_stock) !== Number(prev.new_stock)) {
          // Cho phép sai lệch nhỏ do concurrent operations
          const diff = Math.abs(Number(curr.old_stock) - Number(prev.new_stock));
          if (diff > 0) {
            chainBroken = true;
            chainBreakAt = i;
            break;
          }
        }
      }

      // Kiểm tra drift: log cuối vs thực tế
      const stockDrift = currentStock - lastLogStock;
      const reservedDrift = currentReserved - lastLogReserved;

      if (stockDrift !== 0 || reservedDrift !== 0 || chainBroken) {
        driftCount++;
        driftDetails.push({
          storeCode: store_code,
          productId: product_id,
          productName: product_name,
          currentStock,
          lastLogStock,
          stockDrift,
          currentReserved,
          lastLogReserved,
          reservedDrift,
          logCount: logs.rows.length,
          chainBroken,
          chainBreakAt,
        });
      } else {
        okCount++;
      }
    }

    // 4. In kết quả
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('KẾT QUẢ ĐỐI CHIẾU:');
    console.log('══════════════════════════════════════════════════════════════');
    console.log(`  ✅ Khớp đúng:              ${okCount}`);
    console.log(`  ⚠️  Không có log:           ${noLogCount}`);
    console.log(`  ❌ Sai lệch (drift):       ${driftCount}`);
    console.log('');

    if (driftDetails.length > 0) {
      console.log('CHI TIẾT SAI LỆCH:');
      console.log('──────────────────────────────────────────────────────────────');
      for (const d of driftDetails) {
        console.log(`  🔴 ${d.storeCode} / ${d.productId} (${d.productName})`);
        console.log(`     Stock:    hiện tại=${d.currentStock}, log cuối=${d.lastLogStock}, drift=${d.stockDrift > 0 ? '+' : ''}${d.stockDrift}`);
        console.log(`     Reserved: hiện tại=${d.currentReserved}, log cuối=${d.lastLogReserved}, drift=${d.reservedDrift > 0 ? '+' : ''}${d.reservedDrift}`);
        console.log(`     Số log entries: ${d.logCount}`);
        if (d.chainBroken) {
          console.log(`     ⚠️ Chuỗi log bị đứt tại entry #${d.chainBreakAt}`);
        }
        console.log('');
      }
    }

    // 5. Kiểm tra reservations vs store_inventory.reserved
    console.log('══════════════════════════════════════════════════════════════');
    console.log('ĐỐI CHIẾU RESERVATION vs STORE_INVENTORY.RESERVED:');
    console.log('══════════════════════════════════════════════════════════════');

    const reservationSum = await client.query(`
      SELECT store_code, product_id, SUM(quantity) AS total_reserved
      FROM stock_reservations
      WHERE status = 'active'
      GROUP BY store_code, product_id
      ORDER BY store_code, product_id
    `);

    let resDriftCount = 0;
    for (const r of reservationSum.rows) {
      const inv = await client.query(
        'SELECT reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2',
        [r.store_code, r.product_id]
      );
      const actualReserved = Number(inv.rows[0]?.reserved) || 0;
      const expectedReserved = Number(r.total_reserved) || 0;

      if (actualReserved !== expectedReserved) {
        resDriftCount++;
        console.log(`  ❌ ${r.store_code}/${r.product_id}: store_inventory.reserved=${actualReserved}, SUM(active reservations)=${expectedReserved}`);
      }
    }

    // Check for store_inventory.reserved > 0 but no active reservations
    const orphanReserved = await client.query(`
      SELECT si.store_code, si.product_id, si.reserved, p.name AS product_name
      FROM store_inventory si
      JOIN products p ON p.id = si.product_id
      WHERE si.reserved > 0
        AND NOT EXISTS (
          SELECT 1 FROM stock_reservations sr
          WHERE sr.store_code = si.store_code
            AND sr.product_id = si.product_id
            AND sr.status = 'active'
        )
    `);

    if (orphanReserved.rows.length > 0) {
      console.log('');
      console.log('  ⚠️ store_inventory có reserved > 0 nhưng không có active reservation:');
      for (const o of orphanReserved.rows) {
        resDriftCount++;
        console.log(`     - ${o.store_code}/${o.product_id} (${o.product_name}): reserved=${o.reserved}`);
      }
    }

    if (resDriftCount === 0) {
      console.log('  ✅ Tất cả khớp đúng!');
    }

    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('                ĐỐI CHIẾU HOÀN TẤT                          ');
    console.log('══════════════════════════════════════════════════════════════');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('❌ Lỗi:', err); pool.end(); process.exit(1); });
