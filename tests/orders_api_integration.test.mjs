/**
 * Kiểm thử tích hợp: POST /api/orders (src/app/api/orders/route.ts) chạy trên DB RIÊNG "webtsf_review_test".
 * Gọi thẳng hàm POST của route (Request thật, SQL thật, giao dịch thật); không đụng server cổng 3000 và không đụng DB staging.
 * Chỉ thay `after()` của Next bằng hàm rỗng vì nó chỉ chạy được trong phạm vi request của máy chủ Next
 * (phần việc chạy sau phản hồi: báo Telegram, kiểm tra địa chỉ). Telegram/Zalo/email bị tắt trong tests/helpers/review_test_db.mjs.
 *
 * Tạo DB một lần:  psql -U postgres -c "CREATE DATABASE webtsf_review_test"   (schema tự dựng khi chạy)
 * Chạy: npx tsx --test tests/orders_api_integration.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { setupReviewTestEnv, REVIEW_TEST_DB } from './helpers/review_test_db.mjs';

const { dbName } = setupReviewTestEnv();
assert.equal(dbName, REVIEW_TEST_DB);

const requireCjs = createRequire(import.meta.url);
requireCjs('next/server').after = () => {};

// Không gọi dịch vụ đường đi OSRM ngoài internet: getRoadDistanceAndDuration tự rơi về công thức nội suy khi fetch lỗi
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || String(input);
  if (url.includes('project-osrm.org')) return Promise.reject(new Error('OSRM bị chặn trong test'));
  return realFetch(input, init);
};

const { pool, initDatabase } = await import('@/lib/db');
const { POST } = await import('@/app/api/orders/route');

const STORE = {
  code: 'TST1',
  name: 'Cửa hàng test',
  address: '12 Đường Test, Quận 1, TP. Hồ Chí Minh',
};
const PRODUCT_ID = 'prod-test-01';
const VARIANT_ID = 'var_t7';
const CART_PRODUCT_ID = `${PRODUCT_ID}-${VARIANT_ID}`;
const PACK_PRICE = 126000; // 7 chai x 18.000

// Đầu số hợp lệ theo COD_VALIDATION.PHONE_REGEX: 09[0-46-9] + 7 chữ số
function uniqueDigits() {
  return `09${[0, 1, 2, 3, 4, 6, 7, 8, 9][crypto.randomInt(0, 9)]}${crypto.randomInt(1000000, 9999999)}`;
}

function orderBody(overrides = {}) {
  return {
    fullName: 'Khách Test',
    phone: uniqueDigits(),
    province: 'Hồ Chí Minh',
    district: 'Quận 1',
    ward: 'Phường Bến Nghé',
    address: '1 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    paymentMethod: 'cod',
    shippingFee: 30000,
    // Ghim bản đồ do khách xác nhận, cách cửa hàng khoảng 0,4 km: đơn mới được nhận, phí chỉ gồm phí cơ bản 30.000đ
    latitude: 10.7805,
    longitude: 106.7005,
    locationConfirmed: true,
    locationConfirmedBy: 'USER_MAP_PIN',
    storeCode: STORE.code,
    items: [{ productId: CART_PRODUCT_ID, name: 'x', price: 1, quantity: 1, unit: 'Lốc' }],
    ...overrides,
  };
}

async function postOrder(body) {
  const res = await POST(
    new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* phản hồi không phải JSON */
  }
  return { status: res.status, json };
}

async function orderRow(orderId) {
  const r = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  return r.rows[0];
}

before(async () => {
  await initDatabase();
  // initDatabase() không tạo bảng inventory_logs (chỉ scripts/migrate_inventory_phase4.mjs tạo): chép đúng câu lệnh đó vào DB test
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id VARCHAR(100) PRIMARY KEY,
      store_code VARCHAR(50) NOT NULL,
      product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      old_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      old_reserved INTEGER NOT NULL DEFAULT 0,
      new_reserved INTEGER NOT NULL DEFAULT 0,
      change_type VARCHAR(50) NOT NULL,
      order_id VARCHAR(50),
      actor VARCHAR(100) NOT NULL,
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // DB riêng cho test: xóa sạch dữ liệu mẫu trước mỗi lần chạy (helper đã chặn mọi DB khác)
  await pool.query(
    'TRUNCATE orders, order_items, stock_reservations, inventory_logs, store_inventory, product_variants, products, stores CASCADE;'
  );
  await pool.query(
    `INSERT INTO stores (id, code, name, address, province, district, latitude, longitude, is_active)
     VALUES ('st-test-1', $1, $2, $3, 'Hồ Chí Minh', 'Quận 1', 10.7769, 106.7009, true);`,
    [STORE.code, STORE.name, STORE.address]
  );
  await pool.query(
    `INSERT INTO products (id, slug, name, sku, price, unit, thumbnail, is_active)
     VALUES ($1, 'sua-test', 'Sữa Test', 'TS', 18000, '1 chai', '/images/test.jpg', true);`,
    [PRODUCT_ID]
  );
  await pool.query(
    `INSERT INTO product_variants (id, product_id, name, quantity, price, unit, bottle_multiplier)
     VALUES ($1, $2, '7 chai', 7, $3, 'lốc', 7);`,
    [VARIANT_ID, PRODUCT_ID, PACK_PRICE]
  );
  await pool.query(
    `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
     VALUES ('inv-test-1', $1, $2, 5000, 0, 0);`,
    [STORE.code, PRODUCT_ID]
  );
});

after(async () => {
  await pool.end();
});

describe('POST /api/orders — nền tảng (kiểm tra bộ dựng test chạy đúng)', () => {
  test('đơn COD hợp lệ: 200, server tự tính giá, giữ chỗ tồn kho 7 chai', async () => {
    const before = await pool.query('SELECT reserved FROM store_inventory WHERE store_code=$1 AND product_id=$2', [STORE.code, PRODUCT_ID]);
    const { status, json } = await postOrder(orderBody());
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.success, true);
    assert.equal(json.subtotal, PACK_PRICE); // giá client gửi (1đ) bị bỏ qua
    assert.equal(json.shippingFee, 30000);
    assert.equal(json.total, PACK_PRICE + 30000);

    const row = await orderRow(json.orderId);
    assert.equal(row.status, 'PENDING');
    assert.equal(row.store_code, STORE.code);
    assert.equal(Number(row.total), PACK_PRICE + 30000);

    const after = await pool.query('SELECT reserved FROM store_inventory WHERE store_code=$1 AND product_id=$2', [STORE.code, PRODUCT_ID]);
    assert.equal(Number(after.rows[0].reserved) - Number(before.rows[0].reserved), 7);
  });

  test('SĐT sai định dạng: 400', async () => {
    const { status } = await postOrder(orderBody({ phone: '12345' }));
    assert.equal(status, 400);
  });

  test('giỏ rỗng: 400', async () => {
    const { status } = await postOrder(orderBody({ items: [] }));
    assert.equal(status, 400);
  });

  test('mã sản phẩm không tồn tại: 400, không tạo đơn', async () => {
    const phone = uniqueDigits();
    const { status } = await postOrder(orderBody({ phone, items: [{ productId: 'khong-co-sp', quantity: 1, price: 1 }] }));
    assert.equal(status, 400);
    const r = await pool.query('SELECT count(*)::int c FROM orders WHERE phone = $1', [phone]);
    assert.equal(r.rows[0].c, 0);
  });

  test('2 đơn liên tiếp cùng SĐT viết liền: đơn thứ hai bị chặn 429 (khoảng cách 5 phút)', async () => {
    const phone = uniqueDigits();
    const first = await postOrder(orderBody({ phone }));
    assert.equal(first.status, 200, JSON.stringify(first.json));
    const second = await postOrder(orderBody({ phone }));
    assert.equal(second.status, 429, JSON.stringify(second.json));
  });
});

describe('Tái hiện lỗi trong REVIEW.md (mong đợi FAIL cho tới khi sửa code)', () => {
  test('R1: SĐT có dấu cách vẫn phải bị chặn 429 khi đặt đơn thứ hai liền sau đơn đầu', async () => {
    const d = uniqueDigits();
    const spaced = `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
    const first = await postOrder(orderBody({ phone: spaced }));
    assert.equal(first.status, 200, JSON.stringify(first.json));
    const second = await postOrder(orderBody({ phone: spaced }));
    assert.equal(second.status, 429, `đơn thứ hai trả ${second.status}: ${JSON.stringify(second.json)}`);
  });

  test('R1: "+84" và "0" là cùng một số, không được lách giới hạn 5 phút', async () => {
    const d = uniqueDigits();
    const first = await postOrder(orderBody({ phone: d }));
    assert.equal(first.status, 200, JSON.stringify(first.json));
    const second = await postOrder(orderBody({ phone: `+84${d.slice(1)}` }));
    assert.equal(second.status, 429, `đơn thứ hai trả ${second.status}: ${JSON.stringify(second.json)}`);
  });

  test('R1: cột orders.phone phải lưu SĐT đã chuẩn hóa (không dấu cách, đầu 0)', async () => {
    const d = uniqueDigits();
    const spaced = `${d.slice(0, 4)} ${d.slice(4, 7)}.${d.slice(7)}`;
    const { status, json } = await postOrder(orderBody({ phone: spaced }));
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal((await orderRow(json.orderId)).phone, d);
  });

  test('R2: 8 request đồng thời cùng một SĐT chỉ được tạo đúng 1 đơn', async () => {
    // Đặt thử 1 đơn SĐT khác để nạp sẵn mô-đun và kết nối DB, tránh việc request đầu chạy chậm làm các request sau vô tình bị chặn đúng
    const warm = await postOrder(orderBody());
    assert.equal(warm.status, 200, JSON.stringify(warm.json));
    // Lỗi đua phụ thuộc thời điểm nên lặp 5 vòng, mỗi vòng một SĐT mới; vòng nào cũng phải ra đúng 1 đơn
    for (let round = 1; round <= 5; round++) {
      const phone = uniqueDigits();
      const results = await Promise.all(Array.from({ length: 8 }, () => postOrder(orderBody({ phone }))));
      const ok = results.filter((r) => r.status === 200).length;
      const rows = await pool.query('SELECT count(*)::int c FROM orders WHERE phone = $1', [phone]);
      assert.equal(
        rows.rows[0].c,
        1,
        `vòng ${round}: trạng thái trả về ${results.map((r) => r.status).join(',')}; đơn đã lưu ${rows.rows[0].c}`
      );
      assert.equal(ok, 1, `vòng ${round}`);
    }
  });

  test('R3: địa chỉ chi nhánh trong đơn phải lấy từ DB, không lấy theo storeAddress do trình duyệt gửi', async () => {
    const { status, json } = await postOrder(orderBody({ storeAddress: 'ĐỊA CHỈ GIẢ DO KHÁCH GỬI' }));
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal((await orderRow(json.orderId)).store_address, STORE.address);
  });
});
