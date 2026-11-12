import pg from 'pg';
import { products } from '../src/data/products.js';

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

function extractBottleMultiplier(rawId, unit, name) {
  const combined = `${rawId} ${unit || ''} ${name || ''}`.toLowerCase();

  // Bắt mẫu "X chai"
  const match = combined.match(/(\d+)\s*(chai|bottle)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Bắt mẫu variant suffix như "-7chai", "-10chai", "-12chai", "-15chai", "-24chai"
  const variantMatch = combined.match(/[-_](\d+)chai/);
  if (variantMatch) {
    const num = parseInt(variantMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return 1;
}

async function main() {
  const client = await pool.connect();

  console.log('================================================================');
  console.log('KIỂM TRA BIẾN THỂ TRONG DATABASE (product_variants)');
  console.log('================================================================');
  const dbRes = await client.query(`
    SELECT pv.id, pv.product_id, pv.name, pv.quantity, pv.unit, pv.volume, pv.price, p.name as product_name
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    ORDER BY pv.product_id, pv.quantity;
  `);

  console.log(`Tổng số biến thể trong DB: ${dbRes.rows.length}`);
  const dbFailures = [];

  for (const v of dbRes.rows) {
    const regex1 = extractBottleMultiplier(v.id, v.unit, v.name);
    // Lưu ý: khi khách add vào giỏ, cart item có thể có name = v.name hoặc product_name + (v.name)
    const expected = v.quantity;
    const isPass = regex1 === expected;
    if (!isPass) {
      dbFailures.push({
        source: 'DB',
        id: v.id,
        productId: v.product_id,
        name: v.name,
        unit: v.unit,
        expected,
        regexResult: regex1
      });
    }
  }

  console.log('================================================================');
  console.log('KIỂM TRA BIẾN THỂ TRONG MÃ NGUỒN (src/data/products.ts)');
  console.log('================================================================');
  const codeFailures = [];
  let totalCodeVariants = 0;

  for (const p of products) {
    if (p.variants && Array.isArray(p.variants)) {
      for (const v of p.variants) {
        totalCodeVariants++;
        const regex1 = extractBottleMultiplier(v.id, v.unit, v.name);
        const expected = v.quantity;
        const isPass = regex1 === expected;
        if (!isPass) {
          codeFailures.push({
            source: 'CODE',
            productId: p.id,
            variantId: v.id,
            variantName: v.name,
            unit: v.unit,
            expected,
            regexResult: regex1
          });
        }
      }
    }
  }
  console.log(`Tổng số biến thể trong Code: ${totalCodeVariants}`);

  console.log('\n--- KẾT QUẢ KIỂM TRA DATABASE ---');
  if (dbFailures.length === 0) {
    console.log('✓ 100% biến thể trong DB match đúng với Regex khi truyền (id, unit, name)');
  } else {
    console.log(`❌ Có ${dbFailures.length} biến thể trong DB bị lỗi:`);
    console.table(dbFailures);
  }

  console.log('\n--- KẾT QUẢ KIỂM TRA CODE STATIC (src/data/products.ts) ---');
  if (codeFailures.length === 0) {
    console.log('✓ 100% biến thể trong Code match đúng với Regex khi truyền (id, unit, name)');
  } else {
    console.log(`❌ Có ${codeFailures.length} biến thể trong Code bị lỗi:`);
    console.table(codeFailures);
  }

  // Bây giờ kiểm tra các trường hợp thực tế khi dữ liệu truyền vào hàm:
  // Ví dụ: Khi người dùng truyền itemId là variantId, nhưng unit là "lốc", name không chứa chữ "chai", hoặc chỉ truyền productId
  console.log('\n================================================================');
  console.log('KIỂM TRA CÁC EDGE CASES CỦA EXTRACTBOTTLEMULTIPLIER');
  console.log('================================================================');
  
  const edgeCases = [
    { desc: 'Chỉ truyền ID không có đuôi chai', id: 'var_prod-01', unit: 'lốc', name: 'Lốc 7 lon', expected: 7 },
    { desc: 'Tên ghi "7 chai" nhưng unit là "lốc"', id: 'var_prod-01_v1', unit: 'lốc', name: '7 chai', expected: 7 },
    { desc: 'Tên sản phẩm đầy đủ không có số lượng, unit là "lốc"', id: 'var_prod-01', unit: 'lốc', name: 'Sữa Hạt Sen Lotus Yoo', expected: 5 },
    { desc: 'Tên ghi "Lốc 5" (không có chữ chai)', id: 'ss-loc5', unit: 'lốc', name: 'Lốc 5', expected: 5 },
    { desc: 'Tên ghi "Thùng 24" (không có chữ chai)', id: 'mac-thung24', unit: 'thùng', name: 'Thùng 24 lon', expected: 24 },
    { desc: 'Variant SS-01 trong products.ts (id="ss-5chai", name="Sữa Hạt Sen Lotus Yoo... chai 568ml", unit="1 chai")', id: 'ss-5chai', unit: '1 chai', name: 'Sữa Hạt Sen Lotus Yoo nấu từ hạt sen tươi, thức uống dinh dưỡng thơm bùi thanh mát, tiện lợi uống liền, chai 568ml, đạt chuẩn HACCP.', expected: 5 },
    { desc: 'Variant SS-01 7 chai (id="ss-7chai", name="... chai 568ml", unit="1 chai")', id: 'ss-7chai', unit: '1 chai', name: 'Sữa Hạt Sen Lotus Yoo nấu từ hạt sen tươi, thức uống dinh dưỡng thơm bùi thanh mát, tiện lợi uống liền, chai 568ml, đạt chuẩn HACCP.', expected: 7 },
    { desc: 'Variant SS-01 10 chai (id="ss-10chai", name="... chai 568ml", unit="1 chai")', id: 'ss-10chai', unit: '1 chai', name: 'Sữa Hạt Sen Lotus Yoo nấu từ hạt sen tươi, thức uống dinh dưỡng thơm bùi thanh mát, tiện lợi uống liền, chai 568ml, đạt chuẩn HACCP.', expected: 10 },
  ];

  const edgeResults = edgeCases.map(tc => {
    const res = extractBottleMultiplier(tc.id, tc.unit, tc.name);
    return {
      testCase: tc.desc,
      id: tc.id,
      unit: tc.unit,
      expected: tc.expected,
      regexResult: res,
      status: res === tc.expected ? 'PASS' : 'FAIL_FALLBACK_1'
    };
  });
  console.table(edgeResults);

  client.release();
  await pool.end();
}

main().catch(console.error);
