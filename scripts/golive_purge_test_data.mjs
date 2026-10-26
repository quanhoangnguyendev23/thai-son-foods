/**
 * GO-LIVE (P0-6): Dọn dữ liệu test, đánh giá giả và dữ liệu của các chức năng đang tắt trước khi mở bán.
 *
 * Mặc định --dry-run: chỉ ĐẾM số dòng sẽ xoá/sửa theo từng bảng (cho cả 2 lựa chọn đơn hàng và đánh giá),
 * không ghi gì vào CSDL. Chuỗi kết nối chỉ nhận qua dòng lệnh, không ghi vào file.
 *
 * --apply (chạy trong 1 transaction, lỗi thì rollback toàn bộ) BẮT BUỘC kèm:
 *   --orders test|all        test = chỉ đơn test (tên/email/mã chứa test/qa/example, SĐT test, đơn của khách test)
 *                            all  = TOÀN BỘ đơn tạo trước --before (mặc định: thời điểm chạy)
 *   --reviews delete|hide    đánh giá giả (is_verified_buyer = true nhưng không gắn đơn):
 *                            delete = xoá; hide = bỏ nhãn "Đã mua hàng" và đặt status = 'HIDDEN' (web chỉ hiện APPROVED)
 *   --confirm-db <tên_db>    đúng tên CSDL đang kết nối
 *   --i-have-backup          xác nhận đã có bản sao lưu (pg_dump) ngay trước khi chạy
 * Tuỳ chọn: --purge-disabled-features  XOÁ TOÀN BỘ dữ liệu Đối tác / Rút tiền / Giao định kỳ / Hội viên (các chức năng
 *           đang tắt). Mặc định TẮT (giữ nguyên) vì chưa xác nhận đó đều là dữ liệu test. Lưu ý: hồ sơ đối tác gắn với
 *           khách test vẫn tự xoá theo khách (khoá ngoại ON DELETE CASCADE).
 *
 * Sau khi dọn: tính lại store_inventory.reserved từ stock_reservations còn active và kiểm tra dòng mồ côi.
 *
 * Chạy:
 *   node scripts/golive_purge_test_data.mjs --db "<DATABASE_URL>"
 *   node scripts/golive_purge_test_data.mjs --db "<DATABASE_URL>" --apply --orders test --reviews hide --confirm-db <tên_db> --i-have-backup
 */
import pg from 'pg';

function parseArgs(argv) {
  const args = { apply: false, db: null, orders: null, reviews: null, confirmDb: null, backup: false, purgeFeature: false, before: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [k, inline] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    const val = () => (inline !== undefined ? inline : argv[++i]);
    if (k === '--apply') args.apply = true;
    else if (k === '--dry-run') args.apply = false;
    else if (k === '--db') args.db = val();
    else if (k === '--orders') args.orders = val();
    else if (k === '--reviews') args.reviews = val();
    else if (k === '--confirm-db') args.confirmDb = val();
    else if (k === '--before') args.before = val();
    else if (k === '--i-have-backup') args.backup = true;
    else if (k === '--purge-disabled-features') args.purgeFeature = true;
  }
  return args;
}

const TEST_TEXT = `(test|example|\\mqa[_ \\-]|^qa$|thử nghiệm|tester)`;

// Đơn test: mã/tên/email chứa test, qa, example; SĐT test đã biết; đơn của khách test
const TEST_ORDER_WHERE = `(
     o.id LIKE 'ord_sample_%' OR o.id LIKE 'QA_TEST_%' OR o.id LIKE 'ord_race_%'
  OR o.order_code ILIKE '%TEST%'
  OR o.full_name ~* '${TEST_TEXT}'
  OR COALESCE(o.email, '') ~* '${TEST_TEXT}'
  OR o.phone IN ('0901234567', '0900000001', '0900100001', '0900000999')
  OR o.phone LIKE '0900000%' OR o.phone LIKE '0900100%'
  OR o.user_id IN (SELECT id FROM _purge_users)
)`;

const tableExists = async (c, t) => (await c.query(`SELECT to_regclass($1) AS r;`, [`public.${t}`])).rows[0].r !== null;
const count = async (c, sql, params = []) => Number((await c.query(sql, params)).rows[0]?.n || 0);

/** Tạo bảng tạm _purge_users / _purge_orders / _purge_reviews theo lựa chọn */
async function buildSets(c, ordersMode, before) {
  await c.query(`DROP TABLE IF EXISTS _purge_users, _purge_orders, _purge_reviews;`);
  await c.query(
    `CREATE TEMP TABLE _purge_users AS
     SELECT id FROM users WHERE email ~* '${TEST_TEXT}' OR full_name ~* '${TEST_TEXT}';`
  );
  if (ordersMode === 'all') {
    await c.query(`CREATE TEMP TABLE _purge_orders AS SELECT o.id, o.order_code FROM orders o WHERE o.created_at < $1::timestamptz;`, [before]);
  } else {
    await c.query(`CREATE TEMP TABLE _purge_orders AS SELECT o.id, o.order_code FROM orders o WHERE ${TEST_ORDER_WHERE};`);
  }
  await c.query(
    `CREATE TEMP TABLE _purge_reviews AS
     SELECT id FROM product_reviews WHERE (is_verified_buyer = true AND order_id IS NULL);`
  );
}

async function plan(c, opts) {
  const rows = [];
  const add = (bang, viec, n) => rows.push({ bang, viec, so_dong: n });

  add('orders', `XOÁ (${opts.orders})`, await count(c, `SELECT count(*) n FROM _purge_orders;`));
  add('order_items', 'XOÁ theo đơn', await count(c, `SELECT count(*) n FROM order_items WHERE order_id IN (SELECT id FROM _purge_orders);`));
  add('stock_reservations', 'XOÁ theo đơn (nhả reserved)', await count(c, `SELECT count(*) n FROM stock_reservations WHERE order_id IN (SELECT id FROM _purge_orders);`));
  add('inventory_logs', 'XOÁ log gắn đơn', await count(c, `SELECT count(*) n FROM inventory_logs WHERE order_id IN (SELECT id FROM _purge_orders);`));
  add('email_logs', 'XOÁ theo mã đơn / email test', await count(c,
    `SELECT count(*) n FROM email_logs WHERE order_code IN (SELECT order_code FROM _purge_orders) OR recipient ~* '${TEST_TEXT}';`));
  add('users', 'XOÁ khách test', await count(c, `SELECT count(*) n FROM _purge_users;`));
  add('product_reviews', `${opts.reviews === 'delete' ? 'XOÁ' : 'ẨN + bỏ nhãn "Đã mua"'} (đánh giá giả)`, await count(c, `SELECT count(*) n FROM _purge_reviews;`));
  add('product_reviews', 'XOÁ đánh giá của khách test / đơn bị xoá', await count(c,
    `SELECT count(*) n FROM product_reviews WHERE id NOT IN (SELECT id FROM _purge_reviews)
       AND (user_id IN (SELECT id FROM _purge_users) OR order_id IN (SELECT id FROM _purge_orders));`));
  for (const t of ['wishlists', 'product_views']) {
    if (await tableExists(c, t)) add(t, 'XOÁ của khách test', await count(c, `SELECT count(*) n FROM ${t} WHERE user_id IN (SELECT id FROM _purge_users);`));
  }
  add('partner_profiles', 'tự XOÁ theo khách test (khoá ngoại)', await count(c,
    `SELECT count(*) n FROM partner_profiles WHERE user_id IN (SELECT id FROM _purge_users);`));
  return rows;
}

const FEATURE_TABLES = ['order_attributions', 'partner_ledger', 'payout_requests', 'referral_clicks', 'partner_documents', 'partner_profiles',
  'subscription_schedules', 'subscription_items', 'subscriptions', 'user_memberships', 'loyalty_point_ledger'];

/** Dữ liệu của các chức năng đang tắt — chỉ xoá khi có --purge-disabled-features */
async function featurePlan(c, purge) {
  const rows = [];
  for (const t of FEATURE_TABLES) {
    if (await tableExists(c, t)) {
      rows.push({ bang: t, viec: purge ? 'XOÁ toàn bộ' : 'GIỮ (mặc định)', so_dong: await count(c, `SELECT count(*) n FROM ${t};`) });
    }
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.db) {
    console.error('Thiếu --db "<DATABASE_URL>".');
    process.exit(2);
  }
  let dbName, host;
  try {
    const u = new URL(args.db);
    dbName = decodeURIComponent(u.pathname.replace(/^\//, ''));
    host = u.hostname;
  } catch {
    console.error('DATABASE_URL không hợp lệ.');
    process.exit(2);
  }
  const before = args.before || new Date().toISOString();
  if (args.apply) {
    const errs = [];
    if (!['test', 'all'].includes(args.orders)) errs.push('--orders test|all');
    if (!['delete', 'hide'].includes(args.reviews)) errs.push('--reviews delete|hide');
    if (args.confirmDb !== dbName) errs.push(`--confirm-db ${dbName}`);
    if (!args.backup) errs.push('--i-have-backup (sao lưu bằng pg_dump trước)');
    if (errs.length) {
      console.error(`Từ chối --apply, thiếu: ${errs.join(', ')}`);
      process.exit(2);
    }
  }

  console.log(`🧹 ${args.apply ? 'APPLY' : 'DRY-RUN'} trên CSDL "${dbName}" @ ${host}`);
  const pool = new pg.Pool({ connectionString: args.db });
  const c = await pool.connect();
  try {
    if (!args.apply) {
      // Dry-run: in kế hoạch cho cả 2 lựa chọn để người dùng quyết định
      const totals = await c.query(`SELECT (SELECT count(*) FROM orders) o, (SELECT count(*) FROM users) u, (SELECT count(*) FROM product_reviews) r;`);
      console.log(`Hiện có: ${totals.rows[0].o} đơn, ${totals.rows[0].u} khách, ${totals.rows[0].r} đánh giá.`);
      for (const mode of ['test', 'all']) {
        await c.query('BEGIN');
        await buildSets(c, mode, before);
        console.log(`\n── Lựa chọn --orders ${mode}${mode === 'all' ? ` (đơn tạo trước ${before})` : ''} ──`);
        console.table(await plan(c, { orders: mode, reviews: 'delete|hide' }));
        if (mode === 'test') {
          const sample = await c.query(
            `SELECT o.order_code, o.full_name, o.status, o.created_at::date AS ngay FROM orders o JOIN _purge_orders p ON p.id = o.id ORDER BY o.created_at DESC LIMIT 8;`
          );
          console.log('Ví dụ đơn test sẽ xoá:');
          console.table(sample.rows);
          const keep = await c.query(
            `SELECT count(*) n, COALESCE(sum(total),0) tong, min(created_at)::date tu, max(created_at)::date den FROM orders WHERE id NOT IN (SELECT id FROM _purge_orders);`
          );
          console.log(`Đơn GIỮ LẠI với --orders test: ${keep.rows[0].n} đơn, tổng ${Number(keep.rows[0].tong).toLocaleString('vi-VN')}đ (${keep.rows[0].tu} → ${keep.rows[0].den})`);
          const users = await c.query(`SELECT u.email, u.full_name FROM users u JOIN _purge_users p ON p.id = u.id ORDER BY u.email LIMIT 20;`);
          console.log('Khách test sẽ xoá:');
          console.table(users.rows);
        }
        await c.query('ROLLBACK');
      }
      console.log(
        `\n── Dữ liệu chức năng đang tắt (Đối tác, Rút tiền, Giao định kỳ, Hội viên) — ${args.purgeFeature ? 'SẼ XOÁ (--purge-disabled-features)' : 'mặc định GIỮ, chỉ xoá khi thêm --purge-disabled-features'} ──`
      );
      console.table(await featurePlan(c, args.purgeFeature));
      console.log('\n(DRY-RUN) Không ghi gì vào CSDL.');
      return;
    }

    await c.query('BEGIN');
    try {
      await buildSets(c, args.orders, before);
      console.table(await plan(c, args));
      console.table(await featurePlan(c, args.purgeFeature));

      const del = async (sql, params) => (await c.query(sql, params)).rowCount;
      const done = {};
      done.email_logs = await del(`DELETE FROM email_logs WHERE order_code IN (SELECT order_code FROM _purge_orders) OR recipient ~* '${TEST_TEXT}';`);
      done.inventory_logs = await del(`DELETE FROM inventory_logs WHERE order_id IN (SELECT id FROM _purge_orders);`);
      done.stock_reservations = await del(`DELETE FROM stock_reservations WHERE order_id IN (SELECT id FROM _purge_orders);`);
      if (args.purgeFeature) {
        for (const t of FEATURE_TABLES) {
          if (await tableExists(c, t)) done[t] = await del(`DELETE FROM ${t};`);
        }
      }
      done.order_items = await del(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM _purge_orders);`);
      done.orders = await del(`DELETE FROM orders WHERE id IN (SELECT id FROM _purge_orders);`);

      if (args.reviews === 'delete') {
        done.reviews_fake = await del(`DELETE FROM product_reviews WHERE id IN (SELECT id FROM _purge_reviews);`);
      } else {
        done.reviews_fake_hidden = await del(
          `UPDATE product_reviews SET is_verified_buyer = false, status = 'HIDDEN', updated_at = NOW() WHERE id IN (SELECT id FROM _purge_reviews);`
        );
      }
      done.reviews_test = await del(
        `DELETE FROM product_reviews WHERE id NOT IN (SELECT id FROM _purge_reviews)
           AND (user_id IN (SELECT id FROM _purge_users) OR order_id IN (SELECT id FROM _purge_orders));`
      );
      for (const t of ['wishlists', 'product_views']) {
        if (await tableExists(c, t)) done[t] = await del(`DELETE FROM ${t} WHERE user_id IN (SELECT id FROM _purge_users);`);
      }
      // Khách test còn gắn ở đơn thật (không xoá đơn) → bỏ liên kết trước khi xoá khách
      await c.query(`UPDATE orders SET user_id = NULL WHERE user_id IN (SELECT id FROM _purge_users);`);
      done.users = await del(`DELETE FROM users WHERE id IN (SELECT id FROM _purge_users);`);

      // Tính lại reserved từ các giữ chỗ còn active
      done.store_inventory_reserved_fixed = await del(
        `UPDATE store_inventory si SET reserved = COALESCE(a.qty, 0)
         FROM (SELECT si2.store_code, si2.product_id,
                      (SELECT SUM(sr.quantity) FROM stock_reservations sr
                        WHERE sr.status = 'active' AND sr.store_code = si2.store_code AND sr.product_id = si2.product_id)::int AS qty
               FROM store_inventory si2) a
         WHERE si.store_code = a.store_code AND si.product_id = a.product_id AND si.reserved IS DISTINCT FROM COALESCE(a.qty, 0);`
      );

      const orphans = {
        order_items: await count(c, `SELECT count(*) n FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL;`),
        stock_reservations: await count(c, `SELECT count(*) n FROM stock_reservations sr LEFT JOIN orders o ON o.id = sr.order_id WHERE o.id IS NULL;`),
        reviews_without_user: await count(c, `SELECT count(*) n FROM product_reviews r WHERE r.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id);`),
      };
      if (orphans.order_items || orphans.stock_reservations) {
        throw new Error(`Còn dòng mồ côi sau khi dọn: ${JSON.stringify(orphans)}`);
      }
      await c.query('COMMIT');
      console.log('\n✅ Đã dọn:', done);
      console.log('Kiểm tra mồ côi:', orphans);
    } catch (err) {
      await c.query('ROLLBACK');
      throw err;
    }
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi (đã rollback):', err.message);
  process.exit(1);
});
