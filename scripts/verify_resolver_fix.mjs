/**
 * verify_resolver_fix.mjs
 * 
 * Kiểm tra nhanh: resolver mới có nhận dạng đúng các product_id đã bị lọt không?
 * Chạy trực tiếp qua tsx để dùng import TS.
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

// Replicate the FULL NEW resolver logic (including variant table lookups)
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

async function resolveProductCanonicalNEW(rawId, nameHint, client) {
  if (!rawId && !nameHint) return null;
  const rawClean = (rawId || '').toLowerCase().trim();

  // 1. Alias
  if (PRODUCT_ALIAS_MAP[rawClean]) {
    const res = await client.query('SELECT id, name, price FROM products WHERE id = $1 LIMIT 1', [PRODUCT_ALIAS_MAP[rawClean]]);
    if (res.rows.length > 0) return res.rows[0];
  }

  // 2. Suffix strip (original)
  const baseSuffixClean = rawClean.split('-standard')[0].replace(/-[a-z0-9]+chai.*$/i, '');
  if (PRODUCT_ALIAS_MAP[baseSuffixClean]) {
    const res = await client.query('SELECT id, name, price FROM products WHERE id = $1 LIMIT 1', [PRODUCT_ALIAS_MAP[baseSuffixClean]]);
    if (res.rows.length > 0) return res.rows[0];
  }

  // 3. Direct products query
  const resDirect = await client.query(
    'SELECT id, name, price FROM products WHERE id = $1 OR slug = $1 OR sku ILIKE $1 OR name ILIKE $2 LIMIT 1',
    [rawClean, `%${nameHint || rawClean}%`]
  );
  if (resDirect.rows.length > 0) return resDirect.rows[0];

  // 3.5 Embedded variant ID
  const embeddedVarMatch = rawClean.match(/var_[a-z0-9_-]+/i);
  if (embeddedVarMatch) {
    const varRes = await client.query(
      'SELECT pv.product_id AS id, p.name, p.price FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = $1 LIMIT 1',
      [embeddedVarMatch[0]]
    );
    if (varRes.rows.length > 0) return varRes.rows[0];
  }

  // 4. Exact variant lookup
  const pvRes = await client.query(
    'SELECT pv.product_id AS id, p.name, p.price FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = $1 LIMIT 1',
    [rawClean]
  );
  if (pvRes.rows.length > 0) return pvRes.rows[0];

  // 5. Progressive suffix stripping
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

async function main() {
  const client = await pool.connect();

  // Danh sách product_id đã thất bại trong audit
  const testCases = [
    { rawId: 'sua-gao-lut-ohsawa-var_prod-sl-01_sl-5chai', name: 'Sữa Gạo Lứt Ohsawa (5 chai)', expectedParent: 'prod-sl-01' },
    { rawId: 'sua-gao-lut-ohsawa-var_prod-sl-01_sl-10chai', name: 'Sữa Gạo Lứt Ohsawa (10 chai)', expectedParent: 'prod-sl-01' },
    { rawId: 'sua-bap-nep-sb-24chai', name: 'Sữa Bắp Nếp (24 chai)', expectedParent: 'prod-sb-01' },
    { rawId: 'tra-sua-ciao-tsa-24chai', name: 'Trà Sữa Ciao (24 chai)', expectedParent: 'prod-tsa-01' },
    { rawId: 'tao-do-hat-chia-td-24chai', name: 'Táo Đỏ Hạt Chia (24 chai)', expectedParent: 'prod-td-01' },
    { rawId: 'tra-xanh-go-txg-24chai', name: 'Trà Xanh GO (24 chai)', expectedParent: 'prod-txg-01' },
    { rawId: 'sam-la-han-hoa-cuc-lh-24chai', name: 'Sâm La Hán Hoa Cúc (24 chai)', expectedParent: 'prod-lh-01' },
    { rawId: 'sua-hat-sen-lotus-ss-5chai', name: 'Sữa Hạt Sen Lotus (5 chai)', expectedParent: 'prod-ss-01' },
    { rawId: 'p-sam-la-han', name: 'Nước Sâm La Hán Hoa Cúc 330ml', expectedParent: null },
    { rawId: 'prod_1', name: 'Sữa Bắp Nếp Thái Sơn', expectedParent: null },
  ];

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   XÁC MINH RESOLVER MỚI - Test các product_id đã lọt     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = await resolveProductCanonicalNEW(tc.rawId, tc.name, client);
    const resolvedId = result ? result.id : null;
    const ok = resolvedId === tc.expectedParent;

    if (ok) {
      console.log(`  ✅ PASS: "${tc.rawId}" → ${resolvedId || 'null'} (expected: ${tc.expectedParent || 'null'})`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: "${tc.rawId}" → ${resolvedId || 'null'} (expected: ${tc.expectedParent || 'null'})`);
      if (result) console.log(`           Resolved name: "${result.name}"`);
      failed++;
    }
  }

  console.log('');
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(`  Kết quả: ${passed} PASS, ${failed} FAIL / ${testCases.length} test cases`);
  console.log(`══════════════════════════════════════════════════════════════`);

  client.release();
  await pool.end();
}

main().catch(err => { console.error(err); pool.end(); process.exit(1); });
