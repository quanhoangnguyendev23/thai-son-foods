/**
 * audit_orders_inventory.mjs
 * 
 * Script kiểm toán read-only: Quét toàn bộ đơn hàng để phát hiện lỗ hổng trừ kho.
 * 
 * Mục đích:
 * 1. Tìm tất cả đơn hàng có `inventory_deducted = true` (nhãn "Đã trừ kho")
 * 2. Với mỗi đơn, kiểm tra từng order_item xem product_id có resolve được không
 * 3. Liệt kê các đơn có item bị "rớt" (resolveProductCanonical trả null)
 * 4. Tổng hợp báo cáo: bao nhiêu đơn bị ảnh hưởng, bao nhiêu chai bị lọt kho
 * 
 * LƯU Ý: Script này HOÀN TOÀN READ-ONLY, không sửa bất kỳ dữ liệu nào.
 * 
 * Cách chạy:
 *   node scripts/audit_orders_inventory.mjs
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

// ============================================================
// Replicate PRODUCT_ALIAS_MAP from src/lib/inventory.ts
// ============================================================
const PRODUCT_ALIAS_MAP = {
  'sua-bap-nep': 'prod-sb-01',
  'sua-bap-nep-thai-son': 'prod-sb-01',
  'prod-sb-01': 'prod-sb-01',
  'sb-01': 'prod-sb-01',

  'sua-hat-sen-mekong': 'prod-shs-01',
  'sua-hat-sen-mekong-xanh': 'prod-shs-01',
  'prod-shs-01': 'prod-shs-01',
  'shs-01': 'prod-shs-01',

  'sua-gao-lut-mekong': 'prod-sgl-01',
  'sua-gao-lut-mekong-xanh': 'prod-sgl-01',
  'prod-sgl-01': 'prod-sgl-01',
  'sgl-01': 'prod-sgl-01',

  'sam-la-han-hoa-cuc': 'prod-lh-01',
  'sam-la-han-hoa-cuc-thai-son': 'prod-lh-01',
  'prod-lh-01': 'prod-lh-01',
  'lh-01': 'prod-lh-01',

  'tao-do-hat-chia': 'prod-td-01',
  'tao-do-hat-chia-thai-son': 'prod-td-01',
  'prod-td-01': 'prod-td-01',
  'td-01': 'prod-td-01',

  'nha-dam-mu-trom': 'prod-md-01',
  'nha-dam-mu-trom-thai-son': 'prod-md-01',
  'prod-md-01': 'prod-md-01',
  'md-01': 'prod-md-01',

  'tra-sua-go': 'prod-tsg-01',
  'prod-tsg-01': 'prod-tsg-01',
  'tsg-01': 'prod-tsg-01',

  'tra-xanh-go': 'prod-txg-01',
  'prod-txg-01': 'prod-txg-01',
  'txg-01': 'prod-txg-01',

  'tra-sua-ciao': 'prod-tsa-01',
  'prod-tsa-01': 'prod-tsa-01',
  'tsa-01': 'prod-tsa-01',

  'matcha-tra-sua-ciao': 'prod-mac-01',
  'prod-mac-01': 'prod-mac-01',
  'mac-01': 'prod-mac-01',

  'sua-hat-sen-lotus': 'prod-ss-01',
  'sua-hat-sen-lotus-yoo': 'prod-ss-01',
  'prod-ss-01': 'prod-ss-01',
  'ss-01': 'prod-ss-01',

  'sua-gao-lut-ohsawa': 'prod-sl-01',
  'sua-gao-lut-ohsawa-yoo': 'prod-sl-01',
  'prod-sl-01': 'prod-sl-01',
  'sl-01': 'prod-sl-01',
};

// ============================================================
// Replicate resolveProductCanonical logic (READ-ONLY)
// ============================================================
async function resolveProductCanonical(rawId, nameHint, client) {
  if (!rawId && !nameHint) return null;

  const rawClean = (rawId || '').toLowerCase().trim();

  // 1. Kiểm tra alias tĩnh
  if (PRODUCT_ALIAS_MAP[rawClean]) {
    const canonicalId = PRODUCT_ALIAS_MAP[rawClean];
    const res = await client.query(
      'SELECT id, name, price FROM products WHERE id = $1 LIMIT 1',
      [canonicalId]
    );
    if (res.rows.length > 0) return res.rows[0];
  }

  // 2. Tách variant suffix
  const baseSuffixClean = rawClean.split('-standard')[0].replace(/-[a-z0-9]+chai.*$/i, '');
  if (PRODUCT_ALIAS_MAP[baseSuffixClean]) {
    const canonicalId = PRODUCT_ALIAS_MAP[baseSuffixClean];
    const res = await client.query(
      'SELECT id, name, price FROM products WHERE id = $1 LIMIT 1',
      [canonicalId]
    );
    if (res.rows.length > 0) return res.rows[0];
  }

  // 3. Tìm trực tiếp trong bảng products
  const resDirect = await client.query(
    `SELECT id, name, price FROM products
     WHERE id = $1 OR slug = $1 OR sku ILIKE $1 OR name ILIKE $2
     LIMIT 1`,
    [rawClean, `%${nameHint || rawClean}%`]
  );
  if (resDirect.rows.length > 0) return resDirect.rows[0];

  return null;
}

// ============================================================
// Replicate extractBottleMultiplier logic
// ============================================================
function extractBottleMultiplier(rawId, unit, name) {
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

  return 1;
}

// ============================================================
// Main audit
// ============================================================
async function main() {
  const client = await pool.connect();

  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   KIỂM TOÁN TỒN KHO - PHÁT HIỆN LỖ HỔNG RESOLVER       ║');
    console.log('║   Script read-only, không sửa dữ liệu                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // 1. Lấy tất cả đơn hàng (mọi trạng thái)
    const ordersRes = await client.query(`
      SELECT id, order_code, status, store_code, inventory_deducted, full_name, total, created_at
      FROM orders
      ORDER BY created_at DESC
    `);

    console.log(`📦 Tổng số đơn hàng: ${ordersRes.rows.length}`);
    console.log('');

    // 2. Tải danh sách variant từ DB để đối chiếu
    const variantsRes = await client.query('SELECT id, product_id, name, quantity, unit FROM product_variants');
    const variantMap = new Map();
    for (const v of variantsRes.rows) {
      variantMap.set(v.id, v);
      variantMap.set(v.id.toLowerCase(), v);
    }
    console.log(`🔧 Đã tải ${variantsRes.rows.length} variant từ DB`);
    console.log('');

    // Stats
    let totalOrders = ordersRes.rows.length;
    let leakedOrders = 0;
    let totalLeakedItems = 0;
    let totalLeakedBottles = 0;
    let totalLeakedRevenue = 0;
    const leakedOrderDetails = [];

    // 3. Duyệt từng đơn
    for (const order of ordersRes.rows) {
      const itemsRes = await client.query(
        'SELECT id, product_id, name, quantity, price, unit, combo_snapshot FROM order_items WHERE order_id = $1',
        [order.id]
      );

      const leakedItems = [];

      for (const item of itemsRes.rows) {
        const rawId = (item.product_id || '').trim();
        if (!rawId) continue;

        // Bỏ qua combo (kiểm tra riêng)
        if (rawId.startsWith('combo-')) continue;

        // Thử resolve theo logic hiện tại
        const resolved = await resolveProductCanonical(rawId, item.name, client);

        if (!resolved) {
          // Resolver thất bại! Kiểm tra xem có phải variant không
          const variant = variantMap.get(rawId) || variantMap.get(rawId.toLowerCase());
          const multiplier = extractBottleMultiplier(rawId, item.unit, item.name);
          const estimatedBottles = multiplier * (item.quantity || 1);

          leakedItems.push({
            orderItemId: item.id,
            productId: rawId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            unit: item.unit,
            multiplier,
            estimatedBottles,
            isKnownVariant: !!variant,
            variantInfo: variant ? {
              parentProductId: variant.product_id,
              variantName: variant.name,
              variantQuantity: variant.quantity,
            } : null,
            estimatedLeakedRevenue: item.price * item.quantity,
          });
        }
      }

      if (leakedItems.length > 0) {
        leakedOrders++;
        const orderLeakedBottles = leakedItems.reduce((sum, li) => sum + li.estimatedBottles, 0);
        const orderLeakedRevenue = leakedItems.reduce((sum, li) => sum + li.estimatedLeakedRevenue, 0);

        totalLeakedItems += leakedItems.length;
        totalLeakedBottles += orderLeakedBottles;
        totalLeakedRevenue += orderLeakedRevenue;

        leakedOrderDetails.push({
          orderCode: order.order_code,
          orderId: order.id,
          status: order.status,
          inventoryDeducted: order.inventory_deducted,
          storeCode: order.store_code,
          customerName: order.full_name,
          orderTotal: order.total,
          createdAt: order.created_at,
          leakedItemCount: leakedItems.length,
          totalItemCount: itemsRes.rows.length,
          leakedBottles: orderLeakedBottles,
          leakedRevenue: orderLeakedRevenue,
          leakedItems,
        });
      }
    }

    // 4. In báo cáo
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('                    BÁO CÁO KIỂM TOÁN                       ');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`📊 TỔNG QUAN:`);
    console.log(`   Tổng đơn hàng:               ${totalOrders}`);
    console.log(`   Đơn bị lỗ hổng resolver:     ${leakedOrders} (${((leakedOrders / Math.max(1, totalOrders)) * 100).toFixed(1)}%)`);
    console.log(`   Tổng dòng item bị bỏ sót:    ${totalLeakedItems}`);
    console.log(`   Tổng chai bị lọt kho:        ${totalLeakedBottles}`);
    console.log(`   Doanh thu liên quan:          ${totalLeakedRevenue.toLocaleString('vi-VN')} ₫`);
    console.log('');

    if (leakedOrderDetails.length > 0) {
      console.log('──────────────────────────────────────────────────────────────');
      console.log('CHI TIẾT TỪNG ĐƠN BỊ ẢNH HƯỞNG:');
      console.log('──────────────────────────────────────────────────────────────');

      for (const detail of leakedOrderDetails) {
        console.log('');
        console.log(`  🔴 Đơn: ${detail.orderCode}`);
        console.log(`     Trạng thái: ${detail.status} | Đã trừ kho: ${detail.inventoryDeducted ? 'CÓ ⚠️' : 'KHÔNG'}`);
        console.log(`     Chi nhánh: ${detail.storeCode || 'N/A'}`);
        console.log(`     Khách: ${detail.customerName}`);
        console.log(`     Tổng đơn: ${detail.orderTotal?.toLocaleString('vi-VN')} ₫`);
        console.log(`     Ngày tạo: ${detail.createdAt}`);
        console.log(`     Dòng item: ${detail.leakedItemCount}/${detail.totalItemCount} bị lọt`);
        console.log(`     Chai lọt kho: ${detail.leakedBottles}`);
        console.log(`     Doanh thu liên quan: ${detail.leakedRevenue.toLocaleString('vi-VN')} ₫`);
        console.log('');

        for (const li of detail.leakedItems) {
          console.log(`     ├─ product_id: "${li.productId}"`);
          console.log(`     │  name: "${li.name}"`);
          console.log(`     │  qty: ${li.quantity} × hệ_số: ${li.multiplier} = ${li.estimatedBottles} chai`);
          console.log(`     │  price: ${li.price?.toLocaleString('vi-VN')} ₫`);
          if (li.isKnownVariant) {
            console.log(`     │  ✅ LÀ VARIANT TRONG DB → parent: ${li.variantInfo.parentProductId}`);
            console.log(`     │     Variant name: "${li.variantInfo.variantName}" (${li.variantInfo.variantQuantity} chai)`);
          } else {
            console.log(`     │  ❌ KHÔNG TÌM THẤY TRONG DB (variant/product)`);
          }
          console.log(`     │`);
        }
      }

      // 5. Phân loại theo mức độ nghiêm trọng
      console.log('');
      console.log('══════════════════════════════════════════════════════════════');
      console.log('PHÂN LOẠI MỨC ĐỘ NGHIÊM TRỌNG:');
      console.log('══════════════════════════════════════════════════════════════');

      const critical = leakedOrderDetails.filter(d => d.inventoryDeducted && ['CONFIRMED', 'SHIPPING', 'DELIVERED'].includes(d.status));
      const warning = leakedOrderDetails.filter(d => d.inventoryDeducted && ['PENDING'].includes(d.status));
      const info = leakedOrderDetails.filter(d => !d.inventoryDeducted);
      const cancelled = leakedOrderDetails.filter(d => d.status === 'CANCELLED');

      console.log('');
      console.log(`  🔴 NGHIÊM TRỌNG (Đã trừ kho + Đang xử lý/Giao/Đã giao): ${critical.length} đơn`);
      for (const c of critical) {
        console.log(`     - ${c.orderCode}: ${c.status}, ${c.leakedBottles} chai lọt, ${c.leakedRevenue.toLocaleString('vi-VN')} ₫`);
      }

      console.log(`  🟡 CẢNH BÁO (Đã trừ kho + Đang chờ): ${warning.length} đơn`);
      for (const w of warning) {
        console.log(`     - ${w.orderCode}: ${w.status}, ${w.leakedBottles} chai lọt, ${w.leakedRevenue.toLocaleString('vi-VN')} ₫`);
      }

      console.log(`  🟢 THÔNG TIN (Chưa trừ kho): ${info.length} đơn`);
      for (const i of info) {
        console.log(`     - ${i.orderCode}: ${i.status}, ${i.leakedBottles} chai lọt (chưa trừ kho)`);
      }

      console.log(`  ⚪ ĐÃ HỦY: ${cancelled.length} đơn`);
      for (const c of cancelled) {
        console.log(`     - ${c.orderCode}: ${c.leakedBottles} chai (đơn đã hủy, không ảnh hưởng)`);
      }

      // 6. Thống kê chi nhánh reservation
      console.log('');
      console.log('══════════════════════════════════════════════════════════════');
      console.log('KIỂM TRA RESERVATION vs THỰC TẾ:');
      console.log('══════════════════════════════════════════════════════════════');

      for (const detail of leakedOrderDetails) {
        const resRes = await client.query(
          'SELECT product_id, quantity, status FROM stock_reservations WHERE order_id = $1',
          [detail.orderId]
        );
        const logRes = await client.query(
          'SELECT product_id, old_stock, new_stock, old_reserved, new_reserved, change_type FROM inventory_logs WHERE order_id = $1',
          [detail.orderId]
        );

        console.log('');
        console.log(`  📋 Đơn ${detail.orderCode}:`);
        console.log(`     Reservations trong DB: ${resRes.rows.length}`);
        for (const r of resRes.rows) {
          console.log(`       - ${r.product_id}: ${r.quantity} chai (${r.status})`);
        }
        console.log(`     Inventory logs: ${logRes.rows.length}`);
        for (const l of logRes.rows) {
          console.log(`       - ${l.product_id}: stock ${l.old_stock}→${l.new_stock}, reserved ${l.old_reserved}→${l.new_reserved} (${l.change_type})`);
        }

        // So sánh: Liệt kê item nào CÓ reservation vs item nào KHÔNG
        const reservedProductIds = new Set(resRes.rows.map(r => r.product_id));
        const leakedProductIds = detail.leakedItems.map(li => {
          if (li.isKnownVariant) return li.variantInfo.parentProductId;
          return li.productId;
        });

        const missingReservations = leakedProductIds.filter(pid => !reservedProductIds.has(pid));
        if (missingReservations.length > 0) {
          console.log(`     ⚠️ Sản phẩm BỊ LỌT (không có reservation): ${missingReservations.join(', ')}`);
        }
      }
    } else {
      console.log('✅ Không phát hiện đơn hàng nào bị lỗ hổng resolver!');
    }

    // 7. Kiểm tra thêm: Đơn chưa có reservation nào
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('ĐƠN HÀNG KHÔNG CÓ BẤT KỲ RESERVATION NÀO:');
    console.log('══════════════════════════════════════════════════════════════');

    const noResOrders = await client.query(`
      SELECT o.id, o.order_code, o.status, o.inventory_deducted, o.store_code, o.full_name, o.total, o.created_at,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count,
             (SELECT COUNT(*) FROM stock_reservations WHERE order_id = o.id) AS reservation_count
      FROM orders o
      WHERE NOT EXISTS (SELECT 1 FROM stock_reservations WHERE order_id = o.id)
        AND o.status NOT IN ('CANCELLED')
      ORDER BY o.created_at DESC
    `);

    if (noResOrders.rows.length > 0) {
      console.log(`  ⚠️ ${noResOrders.rows.length} đơn không có reservation nào:`);
      for (const o of noResOrders.rows) {
        console.log(`     - ${o.order_code}: ${o.status}, ${o.item_count} items, deducted=${o.inventory_deducted}, ${o.full_name}`);
      }
    } else {
      console.log('  ✅ Tất cả đơn đều có reservation.');
    }

    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('                KIỂM TOÁN HOÀN TẤT                          ');
    console.log('══════════════════════════════════════════════════════════════');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Lỗi kiểm toán:', err);
  pool.end();
  process.exit(1);
});
