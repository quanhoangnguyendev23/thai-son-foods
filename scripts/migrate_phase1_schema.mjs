/**
 * migrate_phase1_schema.mjs
 * 
 * Phase 1: Database Restructuring
 * 
 * Thay đổi:
 * 1. Thêm cột `canonical_product_id` + `bottle_multiplier` + `total_bottles` vào `order_items`
 * 2. Thêm cột `items_resolved_count` vào `orders`  
 * 3. Thêm các variant 24-chai bị thiếu vào `product_variants`
 * 4. Backfill dữ liệu cho các đơn hàng hiện có
 * 
 * LƯU Ý: Script này CÓ SỬA DỮ LIỆU. Chạy DRY-RUN trước khi apply.
 * 
 * Cách chạy:
 *   node scripts/migrate_phase1_schema.mjs --dry-run     # Chỉ in ra thay đổi
 *   node scripts/migrate_phase1_schema.mjs --apply        # Thực thi
 */

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

const DB_URL = requireDatabaseUrl();
const pool = new pg.Pool({ connectionString: DB_URL });

const isDryRun = !process.argv.includes('--apply');

// ============================================================
// Replicate resolver logic (NEW version with variant support)
// ============================================================
const PRODUCT_ALIAS_MAP = {
  'sua-bap-nep': 'prod-sb-01', 'sua-bap-nep-thai-son': 'prod-sb-01', 'prod-sb-01': 'prod-sb-01', 'sb-01': 'prod-sb-01',
  'sua-hat-sen-mekong': 'prod-shs-01', 'sua-hat-sen-mekong-xanh': 'prod-shs-01', 'prod-shs-01': 'prod-shs-01', 'shs-01': 'prod-shs-01',
  'sua-gao-lut-mekong': 'prod-sgl-01', 'sua-gao-lut-mekong-xanh': 'prod-sgl-01', 'prod-sgl-01': 'prod-sgl-01', 'sgl-01': 'prod-sgl-01',
  'sam-la-han-hoa-cuc': 'prod-lh-01', 'sam-la-han-hoa-cuc-thai-son': 'prod-lh-01', 'prod-lh-01': 'prod-lh-01', 'lh-01': 'prod-lh-01',
  'tao-do-hat-chia': 'prod-td-01', 'tao-do-hat-chia-thai-son': 'prod-td-01', 'prod-td-01': 'prod-td-01', 'td-01': 'prod-td-01',
  'nha-dam-mu-trom': 'prod-md-01', 'nha-dam-mu-trom-thai-son': 'prod-md-01', 'prod-md-01': 'prod-md-01', 'md-01': 'prod-md-01',
  'tra-sua-go': 'prod-tsg-01', 'prod-tsg-01': 'prod-tsg-01', 'tsg-01': 'prod-tsg-01',
  'tra-xanh-go': 'prod-txg-01', 'prod-txg-01': 'prod-txg-01', 'txg-01': 'prod-txg-01',
  'tra-sua-ciao': 'prod-tsa-01', 'prod-tsa-01': 'prod-tsa-01', 'tsa-01': 'prod-tsa-01',
  'matcha-tra-sua-ciao': 'prod-mac-01', 'prod-mac-01': 'prod-mac-01', 'mac-01': 'prod-mac-01',
  'sua-hat-sen-lotus': 'prod-ss-01', 'sua-hat-sen-lotus-yoo': 'prod-ss-01', 'prod-ss-01': 'prod-ss-01', 'ss-01': 'prod-ss-01',
  'sua-gao-lut-ohsawa': 'prod-sl-01', 'sua-gao-lut-ohsawa-yoo': 'prod-sl-01', 'prod-sl-01': 'prod-sl-01', 'sl-01': 'prod-sl-01',
};

async function resolveProductCanonical(rawId, nameHint, client) {
  if (!rawId && !nameHint) return null;
  const rawClean = (rawId || '').toLowerCase().trim();

  if (PRODUCT_ALIAS_MAP[rawClean]) {
    const res = await client.query('SELECT id, name, price FROM products WHERE id = $1 LIMIT 1', [PRODUCT_ALIAS_MAP[rawClean]]);
    if (res.rows.length > 0) return res.rows[0];
  }

  const baseSuffixClean = rawClean.split('-standard')[0].replace(/-[a-z0-9]+chai.*$/i, '');
  if (PRODUCT_ALIAS_MAP[baseSuffixClean]) {
    const res = await client.query('SELECT id, name, price FROM products WHERE id = $1 LIMIT 1', [PRODUCT_ALIAS_MAP[baseSuffixClean]]);
    if (res.rows.length > 0) return res.rows[0];
  }

  const resDirect = await client.query(
    'SELECT id, name, price FROM products WHERE id = $1 OR slug = $1 OR sku ILIKE $1 OR name ILIKE $2 LIMIT 1',
    [rawClean, `%${nameHint || rawClean}%`]
  );
  if (resDirect.rows.length > 0) return resDirect.rows[0];

  const embeddedVarMatch = rawClean.match(/var_[a-z0-9_-]+/i);
  if (embeddedVarMatch) {
    const varRes = await client.query(
      'SELECT pv.product_id AS id, p.name, p.price FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = $1 LIMIT 1',
      [embeddedVarMatch[0]]
    );
    if (varRes.rows.length > 0) return varRes.rows[0];
  }

  const pvRes = await client.query(
    'SELECT pv.product_id AS id, p.name, p.price FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = $1 LIMIT 1',
    [rawClean]
  );
  if (pvRes.rows.length > 0) return pvRes.rows[0];

  let candidate = rawClean;
  while (candidate.includes('-')) {
    candidate = candidate.replace(/-[^-]+$/, '');
    if (PRODUCT_ALIAS_MAP[candidate]) {
      const res = await client.query('SELECT id, name, price FROM products WHERE id = $1 LIMIT 1', [PRODUCT_ALIAS_MAP[candidate]]);
      if (res.rows.length > 0) return res.rows[0];
    }
  }

  return null;
}

function extractBottleMultiplier(rawId, unit, name) {
  const combined = `${rawId} ${unit || ''} ${name || ''}`.toLowerCase();
  const match = combined.match(/(\d+)\s*(chai|bottle)/);
  if (match) { const n = parseInt(match[1], 10); if (!isNaN(n) && n > 0) return n; }
  const variantMatch = combined.match(/[-_](\d+)chai/);
  if (variantMatch) { const n = parseInt(variantMatch[1], 10); if (!isNaN(n) && n > 0) return n; }
  return 1;
}

// ============================================================
// Missing 24-chai variants to add
// ============================================================
const MISSING_VARIANTS_24CHAI = [
  // Thái Sơn 330ml products (price 18000/chai)
  { id: 'var_prod-sb-01_sb-24chai', product_id: 'prod-sb-01', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
  { id: 'var_prod-shs-01_shs-24chai', product_id: 'prod-shs-01', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
  { id: 'var_prod-sgl-01_sgl-24chai', product_id: 'prod-sgl-01', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
  { id: 'var_prod-lh-01_lh-24chai', product_id: 'prod-lh-01', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
  { id: 'var_prod-td-01_td-24chai', product_id: 'prod-td-01', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
  { id: 'var_prod-md-01_md-24chai', product_id: 'prod-md-01', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
  { id: 'var_prod-txg-01_txg-24chai', product_id: 'prod-txg-01', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
  // Trà sữa & Matcha 270ml products (price 20000/chai)
  { id: 'var_prod-tsa-01_tsa-24chai', product_id: 'prod-tsa-01', name: '24 chai', quantity: 24, price: 480000, unit: 'thùng' },
  { id: 'var_prod-mac-01_mac-24chai', product_id: 'prod-mac-01', name: '24 chai', quantity: 24, price: 480000, unit: 'thùng' },
  // Trà sữa GO 330ml (price 18000/chai)
  { id: 'var_prod-tsg-01_tsg-24chai', product_id: 'prod-tsg-01', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
];

// ============================================================
// Main migration
// ============================================================
async function main() {
  const client = await pool.connect();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   PHASE 1: DATABASE RESTRUCTURING                        ║');
  console.log(`║   Mode: ${isDryRun ? 'DRY-RUN (không sửa dữ liệu)' : 'APPLY (sửa dữ liệu thật!)'}                 ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    if (!isDryRun) await client.query('BEGIN;');

    // ── BƯỚC 1: Thêm cột mới vào order_items ──────────────────────
    console.log('── BƯỚC 1: Thêm cột mới vào order_items ──');
    const schemaSQL_items = `
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS canonical_product_id VARCHAR(50);
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS bottle_multiplier INTEGER DEFAULT 1;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_bottles INTEGER DEFAULT 0;
    `;
    console.log('  SQL:', schemaSQL_items.trim().replace(/\n/g, '\n       '));
    if (!isDryRun) await client.query(schemaSQL_items);
    console.log('  ✅ Done\n');

    // ── BƯỚC 2: Thêm cột mới vào orders ──────────────────────────
    console.log('── BƯỚC 2: Thêm cột mới vào orders ──');
    const schemaSQL_orders = `
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_resolved_count INTEGER DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_total_count INTEGER DEFAULT 0;
    `;
    console.log('  SQL:', schemaSQL_orders.trim().replace(/\n/g, '\n       '));
    if (!isDryRun) await client.query(schemaSQL_orders);
    console.log('  ✅ Done\n');

    // ── BƯỚC 3: Thêm 24-chai variants bị thiếu ──────────────────
    console.log('── BƯỚC 3: Thêm 24-chai variants bị thiếu ──');
    for (const v of MISSING_VARIANTS_24CHAI) {
      const exists = await client.query('SELECT id FROM product_variants WHERE id = $1', [v.id]);
      if (exists.rows.length > 0) {
        console.log(`  ⏭️  Đã tồn tại: ${v.id}`);
      } else {
        console.log(`  ➕ Thêm: ${v.id} (${v.name}, ${v.price.toLocaleString('vi-VN')} ₫, ${v.unit})`);
        if (!isDryRun) {
          await client.query(
            'INSERT INTO product_variants (id, product_id, name, quantity, price, unit) VALUES ($1, $2, $3, $4, $5, $6)',
            [v.id, v.product_id, v.name, v.quantity, v.price, v.unit]
          );
        }
      }
    }
    console.log('  ✅ Done\n');

    // ── BƯỚC 4: Backfill canonical_product_id cho order_items ────
    console.log('── BƯỚC 4: Backfill canonical_product_id cho order_items ──');
    const allItems = await client.query(`
      SELECT oi.id, oi.product_id, oi.name, oi.quantity, oi.unit, oi.order_id
      FROM order_items oi
      ORDER BY oi.order_id
    `);

    let backfillCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const orderResolvedMap = new Map(); // orderId -> { resolved, total }

    for (const item of allItems.rows) {
      const rawId = (item.product_id || '').trim();
      
      // Track order totals
      if (!orderResolvedMap.has(item.order_id)) {
        orderResolvedMap.set(item.order_id, { resolved: 0, total: 0 });
      }
      orderResolvedMap.get(item.order_id).total++;

      if (!rawId) {
        failCount++;
        console.log(`  ⚠️  Item ${item.id}: product_id rỗng, bỏ qua`);
        continue;
      }

      // Skip combo items (they resolve differently)
      if (rawId.startsWith('combo-')) {
        skipCount++;
        // Combo items get resolved through expandComboItems, skip backfill
        continue;
      }

      const resolved = await resolveProductCanonical(rawId, item.name, client);
      if (resolved) {
        const multiplier = extractBottleMultiplier(rawId, item.unit, item.name);
        const totalBottles = multiplier * (item.quantity || 1);
        
        console.log(`  ✅ Item ${item.id}: "${rawId}" → ${resolved.id} (×${multiplier} = ${totalBottles} chai)`);
        if (!isDryRun) {
          await client.query(
            'UPDATE order_items SET canonical_product_id = $1, bottle_multiplier = $2, total_bottles = $3 WHERE id = $4',
            [resolved.id, multiplier, totalBottles, item.id]
          );
        }
        backfillCount++;
        orderResolvedMap.get(item.order_id).resolved++;
      } else {
        failCount++;
        console.log(`  ❌ Item ${item.id}: "${rawId}" → KHÔNG RESOLVE ĐƯỢC (name: "${item.name}")`);
      }
    }

    console.log(`\n  Tổng: ${backfillCount} backfilled, ${skipCount} skipped, ${failCount} failed\n`);

    // ── BƯỚC 5: Backfill items_resolved_count cho orders ────────
    console.log('── BƯỚC 5: Backfill items_resolved_count cho orders ──');
    for (const [orderId, counts] of orderResolvedMap.entries()) {
      if (!isDryRun) {
        await client.query(
          'UPDATE orders SET items_resolved_count = $1, items_total_count = $2 WHERE id = $3',
          [counts.resolved, counts.total, orderId]
        );
      }
      if (counts.resolved < counts.total) {
        console.log(`  ⚠️  ${orderId}: ${counts.resolved}/${counts.total} items resolved`);
      }
    }
    console.log(`  ✅ Updated ${orderResolvedMap.size} orders\n`);

    // ── BƯỚC 6: Thêm cột mới vào initDatabase (Prisma schema update) ──
    console.log('── BƯỚC 6: Cập nhật Prisma schema ──');
    console.log('  ℹ️  Prisma schema cần được cập nhật thủ công (xem báo cáo)\n');

    if (!isDryRun) {
      await client.query('COMMIT;');
      console.log('✅ COMMIT - Tất cả thay đổi đã được áp dụng!\n');
    } else {
      console.log('ℹ️  DRY-RUN hoàn tất. Chạy với --apply để thực thi.\n');
    }

    // ── Verification ──────────────────────────────────────────────
    console.log('══════════════════════════════════════════════════════════════');
    console.log('VERIFICATION:');
    console.log('══════════════════════════════════════════════════════════════');
    
    const varCount = await client.query('SELECT COUNT(*) FROM product_variants');
    console.log(`  Tổng variants trong DB: ${varCount.rows[0].count}`);
    
    const v24Count = await client.query("SELECT COUNT(*) FROM product_variants WHERE name = '24 chai'");
    console.log(`  Variants 24-chai: ${v24Count.rows[0].count}`);

    if (!isDryRun) {
      const backfillCheck = await client.query('SELECT COUNT(*) FROM order_items WHERE canonical_product_id IS NOT NULL');
      console.log(`  Order items đã backfill: ${backfillCheck.rows[0].count}`);
      
      const missingCheck = await client.query('SELECT COUNT(*) FROM order_items WHERE canonical_product_id IS NULL AND product_id IS NOT NULL');
      console.log(`  Order items chưa resolve: ${missingCheck.rows[0].count}`);
    }

  } catch (err) {
    if (!isDryRun) await client.query('ROLLBACK;');
    console.error('❌ Lỗi migration:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
