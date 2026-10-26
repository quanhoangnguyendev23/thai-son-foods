/**
 * GO-LIVE: POST /api/orders không tin dữ liệu sản phẩm/mã đơn từ trình duyệt + email escape HTML.
 *
 * (a) body.orderCode chứa thẻ HTML → bị bỏ qua, server tự sinh mã TSF-xxxx.
 * (b) Tên/đơn vị/giá dòng hàng do trình duyệt gửi bị thay bằng dữ liệu DB.
 * (c) productId "var_prod-sb-01_sb-15chai" + name "x" → định giá & giữ kho đúng prod-sb-01 (không khớp mờ theo tên);
 *     productId không tồn tại → 400 (không phải 500).
 * (d) 3 template email escape mọi giá trị động.
 * (f) Ảnh dòng hàng lấy từ DB (không nhận URL ngoài/javascript: từ trình duyệt).
 * (g) Trần 1.000 chai/đơn tính theo số chai thật (bottleQuantity) → 400.
 * (e) Mọi quy cách (productId dạng giỏ hàng gửi: "<id>-<variantId>"): giá server = giá quy cách hiển thị,
 *     số chai giữ chỗ = số chai của đơn. Kèm kiểm tra hồi quy /api/inventory/check.
 *
 * Tự tạo dữ liệu (tiền tố QA_TEST_) và tự dọn (trả lại reserved). Chỉ chạy trên DB local (assertSafeTestEnvironment).
 * Chạy: BASE_URL=http://localhost:3000 node --env-file=.env tests/golive_order_tamper_test.mjs
 */
import pg from 'pg';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { assertSafeTestEnvironment } from './helpers/safe_test_env.mjs';

assertSafeTestEnvironment();

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const createdOrderIds = [];
const createdOrderCodes = [];
let failures = 0;
let skipped = 0;

function check(cond, label, extra) {
  if (cond) console.log(`  ✅ ${label}`);
  else {
    failures++;
    console.error(`  ❌ ${label}`, extra ?? '');
  }
}

// Đầu số hợp lệ theo COD_VALIDATION.PHONE_REGEX: 09[0-46-9] + 7 chữ số
function uniquePhone() {
  const third = [0, 1, 2, 3, 4, 6, 7, 8, 9][crypto.randomInt(0, 9)];
  return `09${third}${crypto.randomInt(1000000, 9999999)}`;
}

/** fetch tôn trọng giới hạn 60 req/phút của middleware: gặp 429 thì chờ Retry-After rồi thử lại */
async function apiFetch(url, init) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    const waitSec = Math.min(65, Number(res.headers.get('retry-after')) || 30);
    console.log(`  … bị giới hạn tốc độ, chờ ${waitSec}s`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
  return fetch(url, init);
}

/** Chi nhánh TP.HCM có đủ tồn bán được cho `bottles` chai của sản phẩm canonical */
async function pickStore(canonicalId, bottles) {
  const r = await pool.query(
    `SELECT s.code, s.latitude, s.longitude,
            si.stock_quantity - COALESCE(si.reserved, 0) - COALESCE(si.safety_stock, 0) AS sellable
     FROM store_inventory si JOIN stores s ON s.code = si.store_code
     WHERE si.product_id = $1 AND s.is_active = true AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
       AND (s.province ILIKE '%Hồ Chí Minh%' OR s.province ILIKE '%HCM%')
     ORDER BY sellable DESC LIMIT 1;`,
    [canonicalId]
  );
  const row = r.rows[0];
  if (!row || Number(row.sellable) < bottles) return null;
  return {
    storeCode: row.code,
    lat: Number((Number(row.latitude) + 0.001).toFixed(6)),
    lng: Number((Number(row.longitude) + 0.001).toFixed(6)),
  };
}

function orderBody({ store, items, extra = {} }) {
  return {
    fullName: 'QA_TEST Khách',
    phone: uniquePhone(),
    email: '',
    province: 'Thành phố Hồ Chí Minh',
    district: 'QA_TEST Quận',
    ward: 'QA_TEST Phường',
    address: 'QA_TEST địa chỉ kiểm thử giả mạo dữ liệu',
    paymentMethod: 'cod',
    storeCode: store.storeCode,
    latitude: store.lat,
    longitude: store.lng,
    items,
    ...extra,
  };
}

async function postOrder(body) {
  const res = await apiFetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (json?.orderId) createdOrderIds.push(json.orderId);
  if (json?.orderCode) createdOrderCodes.push(json.orderCode);
  return { status: res.status, json };
}

async function inventoryCheck(storeCode, productId) {
  const res = await apiFetch(`${BASE_URL}/api/inventory/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ storeCode, items: [{ productId, quantity: 1 }] }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function orderDetail(orderId) {
  const o = await pool.query(`SELECT order_code, subtotal FROM orders WHERE id = $1;`, [orderId]);
  const items = await pool.query(
    `SELECT product_id, name, unit, price, quantity, thumbnail, canonical_product_id, bottle_multiplier, total_bottles FROM order_items WHERE order_id = $1;`,
    [orderId]
  );
  const res = await pool.query(
    `SELECT product_id, SUM(quantity)::int AS qty FROM stock_reservations WHERE order_id = $1 GROUP BY product_id;`,
    [orderId]
  );
  return { order: o.rows[0], items: items.rows, reservations: res.rows };
}

async function cleanup() {
  try {
    const o = await pool.query(`SELECT id, order_code FROM orders WHERE id = ANY($1) OR order_code = ANY($2);`, [createdOrderIds, createdOrderCodes]);
    const ids = o.rows.map((r) => r.id);
    const codes = o.rows.map((r) => r.order_code);
    if (ids.length) {
      // Trả lại số chai đang giữ chỗ (store_inventory.reserved) trước khi xóa reservation
      const active = await pool.query(
        `SELECT store_code, product_id, SUM(quantity)::int AS qty FROM stock_reservations
         WHERE order_id = ANY($1) AND status = 'active' GROUP BY store_code, product_id;`,
        [ids]
      );
      for (const r of active.rows) {
        await pool.query(
          `UPDATE store_inventory SET reserved = GREATEST(0, reserved - $1) WHERE store_code = $2 AND product_id = $3;`,
          [r.qty, r.store_code, r.product_id]
        );
      }
      await pool.query(`DELETE FROM inventory_logs WHERE order_id = ANY($1);`, [ids]).catch(() => {});
      await pool.query(`DELETE FROM stock_reservations WHERE order_id = ANY($1);`, [ids]).catch(() => {});
      await pool.query(`DELETE FROM order_items WHERE order_id = ANY($1);`, [ids]).catch(() => {});
      await pool.query(`DELETE FROM orders WHERE id = ANY($1);`, [ids]);
      await pool.query(`DELETE FROM email_logs WHERE order_code = ANY($1);`, [codes]).catch(() => {});
    }
    console.log(`🧹 Đã dọn ${ids.length} đơn QA_TEST_ và trả lại tồn giữ chỗ`);
  } catch (err) {
    console.error('⚠️ Lỗi dọn dữ liệu:', err.message);
  }
}

async function main() {
  console.log(`🧪 GO-LIVE: chống giả mạo dữ liệu đơn hàng (${BASE_URL})`);

  const prodRes = await pool.query(`SELECT id, name FROM products;`);
  const dbProductName = Object.fromEntries(prodRes.rows.map((r) => [r.id, r.name]));
  const variantRes = await pool.query(`SELECT id, product_id, name, unit, price, quantity FROM product_variants;`);
  const dbVariant = Object.fromEntries(variantRes.rows.map((r) => [r.id, r]));

  // Danh mục hiển thị (giá quy cách khách nhìn thấy)
  const apiRes = await apiFetch(`${BASE_URL}/api/products`);
  const apiJson = await apiRes.json();
  const catalog = Array.isArray(apiJson.data) ? apiJson.data : [];
  check(catalog.length > 0, `Đọc được danh mục /api/products (${catalog.length} sản phẩm)`);

  // ── (a) + (b) ──
  console.log('\n[a+b] orderCode chứa HTML + tên/đơn vị/giá dòng hàng giả');
  const sb7 = dbVariant['var_prod-sb-01_sb-7chai'];
  const storeAB = await pickStore('prod-sb-01', 7);
  if (!sb7 || !storeAB) {
    skipped++;
    console.warn('  ⏭️ SKIP: thiếu quy cách var_prod-sb-01_sb-7chai hoặc chi nhánh đủ tồn');
  } else {
    const evil = '<img src=x onerror=alert(1)>';
    const r = await postOrder(
      orderBody({
        store: storeAB,
        items: [{ productId: 'sua-bap-nep-var_prod-sb-01_sb-7chai', name: `${evil}Hàng FAKE miễn phí`, unit: `${evil}FAKE`, price: 1, quantity: 1, thumbnail: 'javascript:alert(1)//https://evil.example/x.png' }],
        extra: { orderCode: evil, order_code: evil },
      })
    );
    check(r.status === 200 && r.json.success, 'Đơn tạo được', r);
    check(/^TSF-\d+$/.test(r.json.orderCode || ''), `Mã đơn do server sinh (${r.json.orderCode})`);
    if (r.json.orderId) {
      const d = await orderDetail(r.json.orderId);
      check(d.order?.order_code === r.json.orderCode && !d.order.order_code.includes('<'), 'orders.order_code trong DB = mã server trả về, không chứa HTML', d.order);
      const it = d.items[0];
      const expectedName = `${dbProductName['prod-sb-01']} (Lốc 7 chai)`;
      check(it?.name === expectedName, 'order_items.name lấy từ DB (tên SP + quy cách)', it?.name);
      check(it?.unit === 'Lốc 7 chai', 'order_items.unit lấy từ DB', it?.unit);
      check(Number(it?.price) === Number(sb7.price), `order_items.price = giá quy cách DB (${sb7.price})`, it?.price);
      const thumb = (await pool.query(`SELECT thumbnail FROM products WHERE id = 'prod-sb-01';`)).rows[0]?.thumbnail || null;
      check(it?.thumbnail === thumb, `(f) order_items.thumbnail lấy từ DB (${thumb})`, it?.thumbnail);
    }
  }

  // ── (c) ──
  console.log('\n[c] productId "var_prod-sb-01_sb-15chai" + name "x" (từng bị định giá theo prod-ss-01)');
  const sb15 = dbVariant['var_prod-sb-01_sb-15chai'];
  const storeC = await pickStore('prod-sb-01', 15);
  if (!sb15 || !storeC) {
    skipped++;
    console.warn('  ⏭️ SKIP: thiếu quy cách 15 chai hoặc chi nhánh đủ tồn');
  } else {
    const r = await postOrder(orderBody({ store: storeC, items: [{ productId: 'var_prod-sb-01_sb-15chai', name: 'x', price: 1, quantity: 1 }] }));
    check(r.status === 200 && r.json.success, 'Đơn tạo được', r);
    if (r.json.orderId) {
      const d = await orderDetail(r.json.orderId);
      check(d.items[0]?.canonical_product_id === 'prod-sb-01', 'canonical_product_id = prod-sb-01', d.items[0]);
      check(Number(d.items[0]?.price) === Number(sb15.price), `Giá = giá quy cách 15 chai (${sb15.price})`, d.items[0]?.price);
      const resSb = d.reservations.find((x) => x.product_id === 'prod-sb-01');
      check(resSb?.qty === 15, 'Giữ chỗ 15 chai prod-sb-01', d.reservations);
      check(!d.reservations.some((x) => x.product_id === 'prod-ss-01'), 'KHÔNG giữ chỗ prod-ss-01', d.reservations);
    }
  }

  console.log('\n[c2] productId không tồn tại → 400');
  {
    const store = storeC || storeAB || { storeCode: 'NH', lat: 10.73, lng: 106.7 };
    const r = await postOrder(orderBody({ store, items: [{ productId: 'QA_TEST_khong-ton-tai', name: 'Sữa Bắp', price: 1, quantity: 1 }] }));
    check(r.status === 400 && r.json.success === false && /nhận dạng/i.test(r.json.error || ''), 'Trả 400 với thông báo rõ ràng', r);
  }

  console.log('\n[g] Trần 1.000 chai/đơn: 67 thùng 15 chai = 1.005 chai → 400');
  {
    const store = storeC || storeAB || { storeCode: 'NH', lat: 10.73, lng: 106.7 };
    const r = await postOrder(orderBody({ store, items: [{ productId: 'sua-bap-nep-var_prod-sb-01_sb-15chai', name: 'x', price: 1, quantity: 67 }] }));
    check(r.status === 400 && r.json.success === false && /1\.005 chai/.test(r.json.error || ''), 'Bị chặn 400 với số chai thật 1.005', r);
  }

  console.log('\n[h] COD tối đa 10.000.000đ tính theo tổng server: 38 thùng 15 chai (~10,26tr) + total: 1 → 400');
  {
    const store = storeC || storeAB || { storeCode: 'NH', lat: 10.73, lng: 106.7 };
    const r = await postOrder(
      orderBody({ store, items: [{ productId: 'sua-bap-nep-var_prod-sb-01_sb-15chai', name: 'x', price: 1, quantity: 38 }], extra: { subtotal: 1, total: 1, shippingFee: 0 } })
    );
    check(r.status === 400 && r.json.success === false && /COD không được vượt quá/.test(r.json.error || '') && r.json.maxValue === 10000000, 'Bị chặn 400 dù body.total = 1', r);
  }

  console.log('\n[i] paymentMethod lạ → 400; "COD" viết hoa vẫn đặt được');
  {
    const store = storeAB || storeC || { storeCode: 'NH', lat: 10.73, lng: 106.7 };
    const item = { productId: 'sua-bap-nep-var_prod-sb-01_sb-7chai', quantity: 1 };
    for (const pm of ['bank_transfer', 'free', '']) {
      const r = await postOrder(orderBody({ store, items: [item], extra: { paymentMethod: pm || { evil: true } } }));
      check(r.status === 400 && r.json.success === false && /Phương thức thanh toán/.test(r.json.error || ''), `paymentMethod ${JSON.stringify(pm || { evil: true })} → 400`, r);
    }
    const shortAddr = await postOrder(orderBody({ store, items: [item], extra: { address: 'abc' } }));
    check(shortAddr.status === 400 && /Địa chỉ giao hàng quá ngắn/.test(shortAddr.json.error || ''), 'V2 địa chỉ quá ngắn vẫn bị chặn 400 như cũ', shortAddr);
    if (storeAB) {
      const ok = await postOrder(orderBody({ store, items: [item], extra: { paymentMethod: 'COD' } }));
      check(ok.status === 200 && ok.json.success, 'Đơn COD bình thường vẫn thành công', ok);
    }
  }

  // ── (d) ──
  console.log('\n[d] Email templates escape HTML');
  {
    const jiti = createJiti(import.meta.url, { alias: { '@': path.join(ROOT, 'src') } });
    const t = await jiti.import(path.join(ROOT, 'src/lib/email/templates.ts'));
    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const order = {
      orderCode: `TSF-1${evil}`,
      fullName: `Khách ${evil}`,
      phone: `090${evil}`,
      address: `Đường ${evil}`,
      ward: `P ${evil}`,
      district: `Q ${evil}`,
      province: `HCM ${evil}`,
      note: `Ghi chú ${evil}`,
      storeAddress: `Kho ${evil}`,
      shippingFee: 0,
      subtotal: 100,
      total: 100,
      items: [{ name: `SP ${evil}`, unit: `Lốc ${evil}`, price: 100, quantity: 1 }],
    };
    const outputs = {
      confirmation: t.renderOrderConfirmationEmail(order).html,
      shipping: t.renderOrderShippingEmail(order, { shipperName: `Shipper ${evil}`, shipperPhone: `09${evil}`, storeAddress: `Kho ${evil}` }).html,
      completed: t.renderOrderCompletedEmail(order).html,
    };
    for (const [name, html] of Object.entries(outputs)) {
      const raw = html.includes('<script>alert(1)') || html.includes('<img src=x onerror');
      check(!raw && html.includes('&lt;script&gt;'), `Template ${name}: không còn thẻ chèn thô, đã escape`);
    }
  }

  // ── (e) ──
  console.log('\n[e] Mọi quy cách: giá server = giá hiển thị, số chai giữ chỗ = số chai trong đơn');
  for (const p of catalog) {
    for (const v of p.variants || []) {
      const db = dbVariant[v.id];
      const productId = `${p.id}-${v.id}`;
      if (!db) {
        failures++;
        console.error(`  ❌ ${productId}: quy cách không có trong product_variants`);
        continue;
      }
      const bottles = Number(db.quantity);
      const store = await pickStore(db.product_id, bottles);
      if (!store) {
        skipped++;
        console.warn(`  ⏭️ SKIP ${productId}: không chi nhánh nào đủ ${bottles} chai`);
        continue;
      }
      const inv = await inventoryCheck(store.storeCode, productId);
      check(inv.status === 200 && inv.json.success && inv.json.maxQuantity >= 1, `${productId}: /api/inventory/check vẫn hoạt động (max ${inv.json.maxQuantity})`, inv);

      const r = await postOrder(orderBody({ store, items: [{ productId, name: 'QA_TEST tên giả', unit: 'QA_TEST', price: 1, quantity: 1 }] }));
      if (r.status === 409) {
        skipped++;
        console.warn(`  ⏭️ SKIP ${productId}: hết tồn khi đặt (409)`);
        continue;
      }
      if (!(r.status === 200 && r.json.success && r.json.orderId)) {
        failures++;
        console.error(`  ❌ ${productId}: đặt đơn lỗi`, r);
        continue;
      }
      const d = await orderDetail(r.json.orderId);
      const it = d.items[0];
      const reserved = d.reservations.find((x) => x.product_id === db.product_id)?.qty;
      const ok =
        Number(it.price) === Number(v.price) &&
        Number(d.order.subtotal) === Number(v.price) &&
        it.canonical_product_id === db.product_id &&
        Number(it.total_bottles) === bottles &&
        reserved === bottles &&
        d.reservations.length === 1;
      check(ok, `${productId}: giá ${it.price}/${v.price}, chai giữ chỗ ${reserved}/${bottles}`, { item: it, reservations: d.reservations });
    }
  }

  // Hồi quy: mã sản phẩm trong combo_items và combo DB vẫn kiểm tra tồn được
  console.log('\n[hồi quy] /api/inventory/check cho mã trong combo_items và combo DB');
  const refs = await pool.query(`SELECT DISTINCT product_id FROM combo_items;`);
  for (const { product_id } of refs.rows) {
    const r = await inventoryCheck('MP', product_id);
    check(r.status === 200 && r.json.success, `combo_items "${product_id}" → success`, r);
  }
  const combos = await pool.query(`SELECT id FROM combos;`);
  for (const { id } of combos.rows) {
    const r = await inventoryCheck('MP', id);
    check(r.status === 200 && r.json.success, `combo "${id}" → success (max ${r.json.maxQuantity})`, r);
  }
}

try {
  await main();
} catch (err) {
  failures++;
  console.error('❌ Lỗi test:', err);
} finally {
  await cleanup();
  await pool.end();
}

console.log(failures === 0 ? `\n🎉 PASS${skipped ? ` (bỏ qua ${skipped})` : ''}` : `\n💥 FAIL (${failures})${skipped ? `, bỏ qua ${skipped}` : ''}`);
process.exit(failures === 0 ? 0 : 1);
