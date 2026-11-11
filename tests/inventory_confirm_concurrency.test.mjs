/**
 * Kiểm thử tích hợp: xác nhận đơn trừ kho đồng thời (confirmStock trong src/lib/inventory.ts) trên DB RIÊNG "webtsf_review_test".
 * Dựng tình huống tồn thực tế (10 chai) thấp hơn tổng giữ chỗ (2 đơn x 7 chai), như khi admin vừa sửa tay tồn kho giảm xuống.
 * Chạy: npx tsx --test tests/inventory_confirm_concurrency.test.mjs
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupReviewTestEnv, lockReviewTestDb } from './helpers/review_test_db.mjs';

setupReviewTestEnv();

const { pool, initDatabase } = await import('@/lib/db');
const { confirmStock, InsufficientStockConfirmError } = await import('@/lib/inventory');

const STORE = 'TST1';
const PRODUCT = 'prod-test-01';

async function seed() {
  await pool.query(
    'TRUNCATE orders, order_items, stock_reservations, inventory_logs, store_inventory, product_variants, products, stores CASCADE;'
  );
  await pool.query(
    `INSERT INTO stores (id, code, name, address, province, district, latitude, longitude, is_active)
     VALUES ('st-test-1', $1, 'Cửa hàng test', '12 Đường Test', 'Hồ Chí Minh', 'Quận 1', 10.7769, 106.7009, true);`,
    [STORE]
  );
  await pool.query(
    `INSERT INTO products (id, slug, name, sku, price, unit, thumbnail, is_active)
     VALUES ($1, 'sua-test', 'Sữa Test', 'TS', 18000, '1 chai', '/images/test.jpg', true);`,
    [PRODUCT]
  );
  // Tồn thực tế 10 chai, giữ chỗ 14 chai (2 đơn x 7)
  await pool.query(
    `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
     VALUES ('inv-test-1', $1, $2, 10, 14, 0);`,
    [STORE, PRODUCT]
  );
  for (const id of ['ordA', 'ordB']) {
    await pool.query(
      `INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, subtotal, total, store_code)
       VALUES ($1, $2, 'Khách', '0901234567', 'Hồ Chí Minh', 'Quận 1', 'P1', '1 Đường Test, Quận 1', 126000, 156000, $3);`,
      [id, `TSF-${id}`, STORE]
    );
    await pool.query(
      `INSERT INTO stock_reservations (id, order_id, store_code, product_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, $4, 7, 'active', NOW() + INTERVAL '1 day');`,
      [`res-${id}`, id, STORE, PRODUCT]
    );
  }
}

async function stockRow() {
  const r = await pool.query('SELECT stock_quantity, reserved FROM store_inventory WHERE store_code=$1 AND product_id=$2', [STORE, PRODUCT]);
  return { stock: Number(r.rows[0].stock_quantity), reserved: Number(r.rows[0].reserved) };
}

/** Xác nhận một đơn trong giao dịch riêng, trả về { ok } hoặc { ok:false, error } */
async function confirmInOwnTx(client, orderId) {
  try {
    await client.query('BEGIN;');
    await confirmStock(orderId, STORE, client, 'tester');
    await client.query('COMMIT;');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK;').catch(() => {});
    return { ok: false, error };
  } finally {
    client.release();
  }
}

let releaseDbLock = async () => {};

before(async () => {
  releaseDbLock = await lockReviewTestDb(pool);
  await initDatabase();
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
});

beforeEach(seed);

after(async () => {
  await releaseDbLock();
  await pool.end();
});

describe('confirmStock — tồn thực tế (10) thấp hơn tổng cần xuất (2 đơn x 7 chai)', () => {
  test('tuần tự: đơn thứ hai bị từ chối vì không đủ tồn (kiểm tra hoạt động đúng)', async () => {
    const a = await confirmInOwnTx(await pool.connect(), 'ordA');
    assert.equal(a.ok, true, String(a.error));
    assert.deepEqual(await stockRow(), { stock: 3, reserved: 7 });

    const b = await confirmInOwnTx(await pool.connect(), 'ordB');
    assert.equal(b.ok, false);
    assert.ok(b.error instanceof InsufficientStockConfirmError, String(b.error));
    assert.deepEqual(await stockRow(), { stock: 3, reserved: 7 });
  });

  test('R15: hai admin xác nhận đồng thời: đơn thứ hai cũng phải bị từ chối hoặc bị ghi nhận oversell_clamped', async () => {
    // Giữ khóa dòng tồn kho để cả hai lần xác nhận đều đã ĐỌC tồn (10) trước khi bất kỳ lần nào kịp cập nhật
    const holder = await pool.connect();
    await holder.query('BEGIN;');
    await holder.query('SELECT 1 FROM store_inventory WHERE store_code=$1 AND product_id=$2 FOR UPDATE;', [STORE, PRODUCT]);

    const pA = confirmInOwnTx(await pool.connect(), 'ordA');
    const pB = confirmInOwnTx(await pool.connect(), 'ordB');

    // Chờ tới khi cả hai đang đứng đợi khóa ở câu UPDATE (nghĩa là đã đọc xong tồn kho)
    const deadline = Date.now() + 8000;
    for (;;) {
      const r = await pool.query(
        "SELECT count(*)::int AS c FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE 'UPDATE store_inventory%';"
      );
      if (r.rows[0].c >= 2) break;
      assert.ok(Date.now() < deadline, 'hai lần xác nhận không cùng đứng đợi khóa kịp thời');
      await new Promise((res) => setTimeout(res, 25));
    }
    await holder.query('COMMIT;');
    holder.release();

    const results = await Promise.all([pA, pB]);
    const rejected = results.filter((r) => !r.ok).length;
    const logs = await pool.query("SELECT change_type FROM inventory_logs WHERE change_type IN ('order_confirmed','oversell_clamped') ORDER BY created_at");
    const types = logs.rows.map((r) => r.change_type);
    const flagged = types.includes('oversell_clamped');
    const row = await stockRow();

    assert.ok(
      rejected >= 1 || flagged,
      `cả 2 đơn xác nhận thành công (${types.join(', ')}), tồn thực tế còn ${row.stock} (lẽ ra không thể xuất 14 chai từ 10 chai) mà không có cảnh báo`
    );
  });
});
