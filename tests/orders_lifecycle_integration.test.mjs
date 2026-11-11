/**
 * Kiểm thử tích hợp vòng đời đơn / kho / hoa hồng đối tác trên DB RIÊNG "webtsf_review_test":
 * hoàn hàng (processOrderReturn), hủy sau khi đã trừ kho (releaseStock), tự hủy đơn quá hạn giữ chỗ (cleanupExpiredReservations),
 * sự kiện hoa hồng đối tác (processPartnerOrderEvent) và bóc combo (expandComboItems). Các test "Rxx:" phản ánh REVIEW.md.
 * Chạy: npx tsx --test tests/orders_lifecycle_integration.test.mjs
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupReviewTestEnv, lockReviewTestDb } from './helpers/review_test_db.mjs';

setupReviewTestEnv();

const { pool, initDatabase } = await import('@/lib/db');
const inventory = await import('@/lib/inventory');
const { processPartnerOrderEvent } = await import('@/lib/partner/orderEvent');

const STORE = 'TST1';
const PRODUCT = 'prod-test-01';
const VARIANT = 'var_t7';

async function inTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    const out = await fn(client);
    await client.query('COMMIT;');
    return out;
  } catch (e) {
    await client.query('ROLLBACK;').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function baseSeed({ stock = 10, reserved = 0 } = {}) {
  await pool.query(
    `TRUNCATE partner_ledger, order_attributions, partner_profiles, users, combo_items, combos,
              orders, order_items, stock_reservations, inventory_logs, store_inventory, product_variants, products, stores CASCADE;`
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
  await pool.query(
    `INSERT INTO product_variants (id, product_id, name, quantity, price, unit, bottle_multiplier)
     VALUES ($1, $2, '7 chai', 7, 126000, 'lốc', 7);`,
    [VARIANT, PRODUCT]
  );
  await pool.query(
    `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock)
     VALUES ('inv-test-1', $1, $2, $3, $4, 0);`,
    [STORE, PRODUCT, stock, reserved]
  );
}

async function addOrder(id, { status = 'PENDING', deducted = false } = {}) {
  await pool.query(
    `INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, subtotal, total, store_code, status, inventory_deducted)
     VALUES ($1, $2, 'Khách', '0901234567', 'Hồ Chí Minh', 'Quận 1', 'P1', '1 Đường Test, Quận 1', 126000, 156000, $3, $4, $5);`,
    [id, `TSF-${id}`, STORE, status, deducted]
  );
  await pool.query(
    `INSERT INTO order_items (id, order_id, product_id, name, price, quantity, unit)
     VALUES ($1, $2, $3, 'Sữa Test (Lốc 7 chai)', 126000, 1, 'Lốc 7 chai');`,
    [`item-${id}`, id, `${PRODUCT}-${VARIANT}`]
  );
}

async function addReservation(orderId, { status = 'active', qty = 7, expired = false } = {}) {
  await pool.query(
    `INSERT INTO stock_reservations (id, order_id, store_code, product_id, quantity, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, ${expired ? "NOW() - INTERVAL '1 hour'" : "NOW() + INTERVAL '1 day'"});`,
    [`res-${orderId}`, orderId, STORE, PRODUCT, qty, status]
  );
}

const stockOf = async () =>
  Number((await pool.query('SELECT stock_quantity FROM store_inventory WHERE store_code=$1 AND product_id=$2', [STORE, PRODUCT])).rows[0].stock_quantity);

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

after(async () => {
  await releaseDbLock();
  await pool.end();
});

describe('hoàn hàng (processOrderReturn) nhập lại kho', () => {
  // Đơn hoàn tất, đã trừ 7 chai lúc xác nhận: tồn 10 -> 3
  async function seedDeductedOrder() {
    await baseSeed({ stock: 3, reserved: 0 });
    await addOrder('ordR', { status: 'COMPLETED', deducted: true });
    await addReservation('ordR', { status: 'confirmed', qty: 7 });
  }
  const doReturn = () =>
    inTx((c) => inventory.processOrderReturn('ordR', c, { disposition: 'restocked', reason: 'Khách từ chối', actor: 'tester' }));

  test('cấu hình quy cách không đổi: nhập lại đúng 7 chai (tồn 3 thành 10)', async () => {
    await seedDeductedOrder();
    const res = await doReturn();
    assert.equal(res.restoredBottles, 7);
    assert.equal(await stockOf(), 10);
    const o = (await pool.query("SELECT status, inventory_deducted, return_disposition FROM orders WHERE id='ordR'")).rows[0];
    assert.deepEqual(o, { status: 'CANCELLED', inventory_deducted: false, return_disposition: 'restocked' });
  });

  test('đơn cũ không có reservation: vẫn nhập lại được bằng cách bóc dòng hàng (đường dự phòng)', async () => {
    await baseSeed({ stock: 3, reserved: 0 });
    await addOrder('ordR', { status: 'COMPLETED', deducted: true });
    const res = await doReturn();
    assert.equal(res.restoredBottles, 7);
    assert.equal(await stockOf(), 10);
  });

  test('hoàn hàng xong: reservation đã confirmed chuyển sang released, không dùng lại được', async () => {
    await seedDeductedOrder();
    await doReturn();
    const st = (await pool.query("SELECT status FROM stock_reservations WHERE order_id = 'ordR'")).rows.map((r) => r.status);
    assert.deepEqual(st, ['released']);
  });

  test('hàng hỏng (damaged_spoilage): không cộng tồn kho', async () => {
    await seedDeductedOrder();
    await inTx((c) => inventory.processOrderReturn('ordR', c, { disposition: 'damaged_spoilage', reason: 'Hỏng', actor: 'tester' }));
    assert.equal(await stockOf(), 3);
  });

  test('R17: admin đổi số chai của quy cách sau khi đơn đã trừ kho: hoàn hàng vẫn chỉ nhập lại đúng số chai đã trừ (7)', async () => {
    await seedDeductedOrder();
    await pool.query('UPDATE product_variants SET quantity = 10, bottle_multiplier = 10 WHERE id = $1', [VARIANT]);
    await doReturn();
    assert.equal(await stockOf(), 10, 'tồn phải về 10 (3 + 7 chai đã trừ), không phải theo số chai hiện tại của quy cách');
  });

  test('R17: quy cách đã bị xóa sau khi đơn đã trừ kho: vẫn xử lý hoàn hàng được theo số chai đã trừ', async () => {
    await seedDeductedOrder();
    await pool.query('DELETE FROM product_variants WHERE id = $1', [VARIANT]);
    await pool.query("UPDATE order_items SET product_id = 'prod-test-01-var_t7'"); // mã giữ nguyên trong dòng hàng
    await doReturn();
    assert.equal(await stockOf(), 10);
  });
});

describe('hủy đơn đã trừ kho (releaseStock)', () => {
  async function confirmedOrder() {
    await baseSeed({ stock: 10, reserved: 7 });
    await addOrder('ordC');
    await addReservation('ordC', { status: 'active', qty: 7 });
    await inTx((c) => inventory.confirmStock('ordC', STORE, c, 'tester'));
  }

  test('xác nhận trừ 7 chai, hủy thì hoàn lại đủ 7 chai và đơn thành CANCELLED', async () => {
    await confirmedOrder();
    assert.equal(await stockOf(), 3);
    const res = await inTx((c) => inventory.releaseStock('ordC', c, 'Khách hủy', 'tester'));
    assert.equal(res.action, 'restored_stock');
    assert.equal(await stockOf(), 10);
    assert.equal((await pool.query("SELECT status FROM orders WHERE id='ordC'")).rows[0].status, 'CANCELLED');
  });

  test('R21: hoàn lại tồn kho khi hủy đơn đã trừ kho phải có dòng nhật ký tồn kho (như lúc trừ kho)', async () => {
    await confirmedOrder();
    await inTx((c) => inventory.releaseStock('ordC', c, 'Khách hủy', 'tester'));
    const logs = await pool.query(
      "SELECT change_type, old_stock, new_stock FROM inventory_logs WHERE order_id = 'ordC' ORDER BY created_at"
    );
    const restored = logs.rows.filter((l) => Number(l.new_stock) > Number(l.old_stock));
    assert.ok(restored.length >= 1, `nhật ký của đơn: ${JSON.stringify(logs.rows)}`);
  });
});

describe('tự hủy đơn quá hạn giữ chỗ (cleanupExpiredReservations) và hoa hồng đối tác', () => {
  async function seedPartner({ ledgerStatus, balance }) {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name) VALUES ('u1', 'ctv@example.com', 'x', 'Đối tác');`
    );
    await pool.query(
      `INSERT INTO partner_profiles (id, user_id, partner_code, phone, full_name, current_balance)
       VALUES ('pp1', 'u1', 'CTV1', '0911111111', 'Đối tác', $1);`,
      [balance]
    );
    await pool.query(
      `INSERT INTO order_attributions (id, order_id, partner_id, referral_code, snapshot_commission_rate, eligible_order_amount, estimated_commission, status)
       VALUES ('attr1', 'ordP', 'pp1', 'CTV1', 10, 126000, 12600, $1);`,
      [ledgerStatus]
    );
    await pool.query(
      `INSERT INTO partner_ledger (id, partner_id, order_id, entry_type, amount, direction, status)
       VALUES ('led1', 'pp1', 'ordP', 'COMMISSION', 12600, 'CREDIT', $1);`,
      [ledgerStatus]
    );
  }

  test('đơn PENDING quá hạn: nhả giữ chỗ và chuyển đơn sang CANCELLED', async () => {
    await baseSeed({ stock: 10, reserved: 7 });
    await addOrder('ordP');
    await addReservation('ordP', { qty: 7, expired: true });
    const res = await inventory.cleanupExpiredReservations();
    assert.equal(res.releasedReservationsCount, 1);
    assert.equal(res.cancelledOrdersCount, 1);
    assert.equal((await pool.query("SELECT status FROM orders WHERE id='ordP'")).rows[0].status, 'CANCELLED');
    assert.equal(Number((await pool.query('SELECT reserved FROM store_inventory')).rows[0].reserved), 0);
  });

  test('R18: đơn của đối tác bị tự hủy vì quá hạn thì hoa hồng ước tính phải chuyển sang VOID (không còn tính vào thu nhập ước tính)', async () => {
    await baseSeed({ stock: 10, reserved: 7 });
    await addOrder('ordP');
    await addReservation('ordP', { qty: 7, expired: true });
    await seedPartner({ ledgerStatus: 'ESTIMATED', balance: 0 });
    await inventory.cleanupExpiredReservations();
    assert.equal((await pool.query("SELECT status FROM orders WHERE id='ordP'")).rows[0].status, 'CANCELLED');
    const led = (await pool.query("SELECT status FROM partner_ledger WHERE id='led1'")).rows[0].status;
    assert.equal(led, 'VOID', `đơn đã hủy nhưng sổ cái hoa hồng đang là ${led}`);
  });

  test('đơn đối tác tự hủy vì quá hạn: attribution cũng VOID và số dư ví không đổi', async () => {
    await baseSeed({ stock: 10, reserved: 7 });
    await addOrder('ordP');
    await addReservation('ordP', { qty: 7, expired: true });
    await seedPartner({ ledgerStatus: 'ESTIMATED', balance: 0 });
    await inventory.cleanupExpiredReservations();
    assert.equal((await pool.query("SELECT status FROM order_attributions WHERE id='attr1'")).rows[0].status, 'VOID');
    assert.equal(Number((await pool.query("SELECT current_balance FROM partner_profiles WHERE id='pp1'")).rows[0].current_balance), 0);
    assert.equal((await pool.query("SELECT count(*)::int c FROM partner_ledger WHERE entry_type='CLAWBACK'")).rows[0].c, 0);
  });

  test('hủy tay đơn đối tác (đối chứng): hoa hồng ước tính chuyển VOID', async () => {
    await baseSeed({ stock: 10, reserved: 7 });
    await addOrder('ordP');
    await addReservation('ordP', { qty: 7 });
    await seedPartner({ ledgerStatus: 'ESTIMATED', balance: 0 });
    await inTx((c) => inventory.releaseStock('ordP', c, 'Khách hủy', 'tester'));
    assert.equal((await pool.query("SELECT status FROM partner_ledger WHERE id='led1'")).rows[0].status, 'VOID');
  });

  test('sự kiện hoàn đơn đầu tiên với hoa hồng đã xác nhận: tạo 1 bút toán thu hồi và trừ ví 1 lần', async () => {
    await baseSeed();
    await addOrder('ordP', { status: 'COMPLETED' });
    await seedPartner({ ledgerStatus: 'CONFIRMED', balance: 12600 });
    await processPartnerOrderEvent('ordP', 'ORDER_RETURNED', { actor: 'tester', note: 'Hoàn' });
    const n = (await pool.query("SELECT count(*)::int c FROM partner_ledger WHERE entry_type='CLAWBACK'")).rows[0].c;
    assert.equal(n, 1);
    assert.equal(Number((await pool.query("SELECT current_balance FROM partner_profiles WHERE id='pp1'")).rows[0].current_balance), 0);
  });

  test('R19: gọi lại sự kiện hoàn đơn lần hai không được thu hồi hoa hồng lần nữa (idempotent như comment mô tả)', async () => {
    await baseSeed();
    await addOrder('ordP', { status: 'COMPLETED' });
    await seedPartner({ ledgerStatus: 'CONFIRMED', balance: 12600 });
    await processPartnerOrderEvent('ordP', 'ORDER_RETURNED', { actor: 'tester', note: 'Hoàn' });
    await processPartnerOrderEvent('ordP', 'ORDER_RETURNED', { actor: 'tester', note: 'Hoàn' });
    const n = (await pool.query("SELECT count(*)::int c FROM partner_ledger WHERE entry_type='CLAWBACK'")).rows[0].c;
    const bal = Number((await pool.query("SELECT current_balance FROM partner_profiles WHERE id='pp1'")).rows[0].current_balance);
    assert.equal(n, 1, `số bút toán thu hồi = ${n}`);
    assert.equal(bal, 0, `số dư ví = ${bal}`);
  });
});

describe('bóc combo cố định từ DB (expandComboItems)', () => {
  async function seedCombo(items) {
    await baseSeed();
    await pool.query(
      `INSERT INTO combos (id, slug, name, original_price, sale_price) VALUES ('combo_t1', 'combo-t1', 'Combo test', 100000, 90000);`
    );
    let i = 0;
    for (const it of items) {
      await pool.query(`INSERT INTO combo_items (id, combo_id, product_id, quantity) VALUES ($1, 'combo_t1', $2, $3);`, [
        `ci${++i}`,
        it.productId,
        it.quantity,
      ]);
    }
  }

  test('combo hợp lệ: bóc ra đúng số chai theo số lượng dòng', async () => {
    await seedCombo([{ productId: PRODUCT, quantity: 3 }]);
    const { expandedBottles, comboSnapshots } = await inventory.expandComboItems([{ productId: 'combo_t1', quantity: 2 }]);
    assert.deepEqual(
      expandedBottles.map((b) => [b.productId, b.bottleQuantity, b.originalItemIndex]),
      [[PRODUCT, 6, 0]]
    );
    assert.equal(comboSnapshots[0].length, 1);
  });

  test('sản phẩm lẻ không nhận dạng được: bị từ chối (đối chứng cho chính sách "không lọt kho")', async () => {
    await baseSeed();
    await assert.rejects(inventory.expandComboItems([{ productId: 'khong-ton-tai', quantity: 1 }]), /INVENTORY_RESOLVE_FAILED/);
  });

  test('R20: thành phần của combo không nhận dạng được phải bị từ chối như sản phẩm lẻ, không được bỏ qua im lặng', async () => {
    await seedCombo([
      { productId: PRODUCT, quantity: 3 },
      { productId: 'san-pham-da-xoa', quantity: 2 },
    ]);
    await assert.rejects(inventory.expandComboItems([{ productId: 'combo_t1', quantity: 1 }]), /INVENTORY_RESOLVE_FAILED/);
  });
});
