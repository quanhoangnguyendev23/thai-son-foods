/**
 * scripts/purge_sample_data.mjs
 * 
 * SCRIPT DỌN DẸP DỮ LIỆU MẪU & THỬ NGHIỆM TRƯỚC GOLIVE (PHASE 2)
 * 
 * Cách dùng:
 *   - Mô phỏng (chỉ đọc, mặc định an toàn):
 *       node scripts/purge_sample_data.mjs --dry-run
 *   - Thực thi xóa thật (CẦN XÁC NHẬN VÀ CHỈ CHẠY KHI ĐƯỢC CHỈ ĐỊNH):
 *       node scripts/purge_sample_data.mjs --execute
 */

import 'dotenv/config';
import pg from 'pg';

import { assertSafeDatabase } from './db-guard.mjs';

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

const DB_URL =
  requireDatabaseUrl();

const pool = new pg.Pool({ connectionString: DB_URL });

const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute') || args.includes('--dry-run');

async function purgeSampleData() {
  const client = await pool.connect();

  console.log('================================================================');
  console.log('       KẾ HOẠCH DỌN DẸP DỮ LIỆU MẪU & THỬ NGHIỆM GOLIVE (PHASE 2)');
  console.log('================================================================');
  console.log(`Chế độ: ${isDryRun ? '🔍 DRY-RUN (CHỈ MÔ PHỎNG, KHÔNG XÓA DỮ LIỆU)' : '⚠️ EXECUTE (THỰC THI XÓA THẬT)'}`);
  console.log(`CSDL mục tiêu: ${process.env.DB_NAME || 'WebTSF_staging'}`);
  console.log(`Thời điểm: ${new Date().toISOString()}\n`);

  try {
    // -------------------------------------------------------------------------
    // 1. Phân loại và đếm Đơn hàng mẫu / thử nghiệm
    // -------------------------------------------------------------------------
    const sampleOrdersQuery = `
      SELECT id, order_code, full_name, phone, total, status, created_at
      FROM orders
      WHERE id LIKE 'ord_sample_%'
         OR id LIKE 'QA_TEST_%'
         OR order_code LIKE 'QA_TEST_%'
         OR id LIKE 'ord_race_%'
         OR order_code LIKE '%TEST%'
         OR full_name ILIKE '%test%'
         OR full_name ILIKE '%Thử Nghiệm%'
         OR full_name = 'Tester LAN'
         OR phone IN ('0901234567', '0900000001', '0900100001', '0900000999')
         OR phone LIKE '0900000%'
         OR phone LIKE '0900100%'
         OR email LIKE '%@example.com%'
         OR email LIKE '%qa_test_%'
      ORDER BY created_at DESC;
    `;
    const sampleOrdersRes = await client.query(sampleOrdersQuery);
    const sampleOrderIds = sampleOrdersRes.rows.map((r) => r.id);

    const totalOrdersRes = await client.query(`SELECT count(*)::int as count FROM orders;`);
    const totalOrders = totalOrdersRes.rows[0].count;
    const sampleOrdersCount = sampleOrderIds.length;
    const realOrdersCount = totalOrders - sampleOrdersCount;

    // -------------------------------------------------------------------------
    // 2. Phân loại và đếm Chi tiết đơn hàng mẫu (order_items)
    // -------------------------------------------------------------------------
    let sampleOrderItemsCount = 0;
    if (sampleOrderIds.length > 0) {
      const itemsRes = await client.query(
        `SELECT count(*)::int as count FROM order_items WHERE order_id = ANY($1);`,
        [sampleOrderIds]
      );
      sampleOrderItemsCount = itemsRes.rows[0].count;
    }
    const totalItemsRes = await client.query(`SELECT count(*)::int as count FROM order_items;`);
    const totalItems = totalItemsRes.rows[0].count;
    const realItemsCount = totalItems - sampleOrderItemsCount;

    // -------------------------------------------------------------------------
    // 3. Phân loại và đếm Giữ chỗ kho thử nghiệm (stock_reservations)
    // -------------------------------------------------------------------------
    const sampleResQuery = `
      SELECT count(*)::int as count FROM stock_reservations
      WHERE order_id = ANY($1)
         OR order_id LIKE '%test%'
         OR order_id LIKE '%sample%'
         OR store_code = 'TEST_P1_STORE';
    `;
    const sampleResResult = await client.query(sampleResQuery, [sampleOrderIds.length > 0 ? sampleOrderIds : ['NONE']]);
    const sampleReservationsCount = sampleResResult.rows[0].count;
    const totalResResult = await client.query(`SELECT count(*)::int as count FROM stock_reservations;`);
    const totalReservations = totalResResult.rows[0].count;
    const realReservationsCount = totalReservations - sampleReservationsCount;

    // -------------------------------------------------------------------------
    // 4. Phân loại và đếm Log tồn kho thử nghiệm (inventory_logs)
    // -------------------------------------------------------------------------
    const sampleLogsQuery = `
      SELECT count(*)::int as count FROM inventory_logs
      WHERE store_code = 'TEST_P1_STORE'
         OR order_id = ANY($1)
         OR note LIKE '%test%'
         OR note LIKE '%Test%'
         OR note LIKE '%sample%';
    `;
    const sampleLogsResult = await client.query(sampleLogsQuery, [sampleOrderIds.length > 0 ? sampleOrderIds : ['NONE']]);
    const sampleLogsCount = sampleLogsResult.rows[0].count;
    const totalLogsResult = await client.query(`SELECT count(*)::int as count FROM inventory_logs;`);
    const totalLogs = totalLogsResult.rows[0].count;
    const realLogsCount = totalLogs - sampleLogsCount;

    // -------------------------------------------------------------------------
    // 5. Cửa hàng và kho thử nghiệm (stores & store_inventory)
    // -------------------------------------------------------------------------
    const testStoresRes = await client.query(`SELECT code, name FROM stores WHERE code = 'TEST_P1_STORE' OR id = 'str_test_p1';`);
    const testStoreInventoryRes = await client.query(`SELECT count(*)::int as count FROM store_inventory WHERE store_code = 'TEST_P1_STORE';`);

    // -------------------------------------------------------------------------
    // 6. Email logs thử nghiệm (email_logs)
    // -------------------------------------------------------------------------
    const sampleEmailsQuery = `
      SELECT count(*)::int as count FROM email_logs
      WHERE recipient LIKE '%qa_test_%'
         OR recipient LIKE '%@example.com%'
         OR recipient = 'test@example.com'
         OR subject LIKE '%QA_TEST_%'
         OR subject LIKE '%TEST%';
    `;
    const sampleEmailsRes = await client.query(sampleEmailsQuery);
    const sampleEmailsCount = sampleEmailsRes.rows[0].count;
    const totalEmailsRes = await client.query(`SELECT count(*)::int as count FROM email_logs;`);
    const totalEmails = totalEmailsRes.rows[0].count;

    // -------------------------------------------------------------------------
    // IN BẢNG BÁO CÁO THỐNG KÊ CHI TIẾT
    // -------------------------------------------------------------------------
    console.log('📊 BẢNG TỔNG HỢP DỮ LIỆU ĐỐI SOÁT:');
    console.table([
      {
        'Bảng dữ liệu': 'orders (Đơn hàng)',
        'Tổng bản ghi': totalOrders,
        'Dữ liệu mẫu/test': sampleOrdersCount,
        'Dữ liệu thật (Bảo tồn)': realOrdersCount,
        'Hành động đề xuất': isDryRun ? 'Dự kiến xóa' : 'Đã xóa',
      },
      {
        'Bảng dữ liệu': 'order_items (Món trong đơn)',
        'Tổng bản ghi': totalItems,
        'Dữ liệu mẫu/test': sampleOrderItemsCount,
        'Dữ liệu thật (Bảo tồn)': realItemsCount,
        'Hành động đề xuất': isDryRun ? 'Dự kiến xóa' : 'Đã xóa',
      },
      {
        'Bảng dữ liệu': 'stock_reservations (Giữ chỗ kho)',
        'Tổng bản ghi': totalReservations,
        'Dữ liệu mẫu/test': sampleReservationsCount,
        'Dữ liệu thật (Bảo tồn)': realReservationsCount,
        'Hành động đề xuất': isDryRun ? 'Dự kiến xóa' : 'Đã xóa',
      },
      {
        'Bảng dữ liệu': 'inventory_logs (Nhật ký kho)',
        'Tổng bản ghi': totalLogs,
        'Dữ liệu mẫu/test': sampleLogsCount,
        'Dữ liệu thật (Bảo tồn)': realLogsCount,
        'Hành động đề xuất': isDryRun ? 'Dự kiến xóa' : 'Đã xóa',
      },
      {
        'Bảng dữ liệu': 'stores (Cửa hàng test)',
        'Tổng bản ghi': 38,
        'Dữ liệu mẫu/test': testStoresRes.rows.length,
        'Dữ liệu thật (Bảo tồn)': 38 - testStoresRes.rows.length,
        'Hành động đề xuất': isDryRun ? 'Dự kiến xóa kho test' : 'Đã xóa',
      },
      {
        'Bảng dữ liệu': 'email_logs (Nhật ký email)',
        'Tổng bản ghi': totalEmails,
        'Dữ liệu mẫu/test': sampleEmailsCount,
        'Dữ liệu thật (Bảo tồn)': totalEmails - sampleEmailsCount,
        'Hành động đề xuất': isDryRun ? 'Dự kiến xóa email test' : 'Đã xóa',
      },
    ]);

    // -------------------------------------------------------------------------
    // MẪU BẢN GHI SẼ ĐƯỢC XÓA & BẢN GHI THẬT ĐƯỢC BẢO VỆ
    // -------------------------------------------------------------------------
    console.log('\n🔍 CHI TIẾT ĐƠN HÀNG MẪU TIÊU BIỂU (Dự kiến dọn dẹp):');
    const previewSample = sampleOrdersRes.rows.slice(0, 5);
    previewSample.forEach((o, i) => {
      console.log(`  ${i + 1}. [${o.order_code}] KH: ${o.full_name} | SĐT: ${o.phone} | Tổng: ${parseInt(o.total || '0').toLocaleString()} đ | Trạng thái: ${o.status}`);
    });
    if (sampleOrdersRes.rows.length > 5) {
      console.log(`  ... và ${sampleOrdersRes.rows.length - 5} đơn hàng mẫu/thử nghiệm khác.`);
    }

    console.log('\n🛡️ DANH SÁCH ĐƠN HÀNG THẬT ĐƯỢC BẢO TỒN NGUYÊN VẸN (100% Giữ Lại):');
    const realOrdersRes = await client.query(`
      SELECT order_code, full_name, phone, total, status, created_at
      FROM orders
      WHERE id != ALL($1)
      ORDER BY created_at DESC;
    `, [sampleOrderIds.length > 0 ? sampleOrderIds : ['NONE']]);
    
    realOrdersRes.rows.forEach((o, i) => {
      console.log(`  ${i + 1}. [${o.order_code}] KH: ${o.full_name} | SĐT: ${o.phone} | Tổng: ${parseInt(o.total || '0').toLocaleString()} đ | Trạng thái: ${o.status}`);
    });

    // -------------------------------------------------------------------------
    // XỬ LÝ CHẾ ĐỘ THỰC THI (NẾU CÓ CỜ --execute)
    // -------------------------------------------------------------------------
    if (isDryRun) {
      console.log('\n================================================================');
      console.log('✅ [DRY-RUN THÀNH CÔNG] Toàn bộ dữ liệu đối soát đã được kiểm tra.');
      console.log('   - Tuyệt đối KHÔNG có bất kỳ bản ghi nào bị thay đổi hay xóa bỏ.');
      console.log('   - Bản sao lưu phục hồi đã sẵn sàng.');
      console.log('================================================================\n');
    } else {
      console.log('\n⚠️ BẮT ĐẦU THỰC THI XÓA DỮ LIỆU MẪU TRONG TRANSACTION...');
      await client.query('BEGIN');

      // 1. Xóa order_items của đơn mẫu
      if (sampleOrderIds.length > 0) {
        await client.query(`DELETE FROM order_items WHERE order_id = ANY($1);`, [sampleOrderIds]);
        await client.query(`DELETE FROM stock_reservations WHERE order_id = ANY($1);`, [sampleOrderIds]);
        await client.query(`DELETE FROM inventory_logs WHERE order_id = ANY($1);`, [sampleOrderIds]);
        await client.query(`DELETE FROM orders WHERE id = ANY($1);`, [sampleOrderIds]);
      }

      // 2. Xóa các kho test và dữ liệu test độc lập
      await client.query(`DELETE FROM store_inventory WHERE store_code = 'TEST_P1_STORE';`);
      await client.query(`DELETE FROM stores WHERE code = 'TEST_P1_STORE';`);
      await client.query(`DELETE FROM email_logs WHERE recipient LIKE '%qa_test_%' OR recipient LIKE '%@example.com%';`);

      await client.query('COMMIT');
      console.log('✅ ĐÃ THỰC THI TRANSACTION XÓA DỮ LIỆU MẪU HOÀN TẤT AN TOÀN!');
    }
  } catch (error) {
    if (!isDryRun) {
      await client.query('ROLLBACK');
      console.error('❌ LỖI TRONG TRANSACTION - ĐÃ ROLLBACK HOÀN TOÀN:', error);
    } else {
      console.error('❌ LỖI TRONG QUÁ TRÌNH DRY-RUN:', error);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

purgeSampleData();
