import pg from 'pg';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from '../scripts/db-guard.mjs';

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

const { Pool } = pg;
const BASE_URL = 'http://localhost:3000';
const DB_URL =
  requireDatabaseUrl();

const pool = new Pool({ connectionString: DB_URL });

async function queryDb(sql, params = []) {
  return pool.query(sql, params);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU TEST PHASE 2: CTV ORDER ATTRIBUTION & LEDGER');
  console.log('====================================================\n');

  const runId = Date.now().toString().slice(-4);
  const partnerPhone = `091${Date.now().toString().slice(-7)}`;
  const partnerEmail = `ctv_${runId}@thaisonfoods.vn`;
  let partnerId = '';
  let partnerCode = '';
  let partnerToken = '';
  let signedCookie = '';

  try {
    // -----------------------------------------------------------------
    // 1. SETUP: TẠO ĐỐI TÁC CTV ACTIVE ĐỂ TEST
    // -----------------------------------------------------------------
    console.log('--- 1. Tạo đối tác CTV và kích hoạt ACTIVE ---');
    const uRes = await queryDb(
      `INSERT INTO users (id, full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4, 'dummy_hash_for_test')
       RETURNING id;`,
      [`usr_p2_${runId}`, `Đối tác Test ${runId}`, partnerEmail, partnerPhone]
    );
    const userId = uRes.rows[0].id;

    partnerCode = `TSF-CTV-${runId}X`;
    const pRes = await queryDb(
      `INSERT INTO partner_profiles (
        id, user_id, partner_code, partner_type, full_name, phone, email,
        lifecycle_status, current_balance, total_commission_earned
       ) VALUES ($1, $2, $3, 'CTV', $4, $5, $6, 'ACTIVE', 0, 0)
       RETURNING id, partner_code;`,
      [`part_p2_${runId}`, userId, partnerCode, `Đối tác Test ${runId}`, partnerPhone, partnerEmail]
    );
    partnerId = pRes.rows[0].id;

    // Ký JWT session cho user liên kết partner
    const { signUserToken } = await import('../src/lib/auth.js');
    partnerToken = await signUserToken({
      id: userId,
      email: partnerEmail,
      fullName: `Đối tác Test ${runId}`,
      phone: partnerPhone,
    });

    assert(Boolean(partnerId && partnerToken), 'Tạo đối tác CTV test thành công');

    // -----------------------------------------------------------------
    // 2. REFERRAL CLICK & COOKIE KÝ
    // -----------------------------------------------------------------
    console.log('\n--- 2. Kiểm tra Click giới thiệu & Cookie ký ---');
    const clickRes = await fetch(`${BASE_URL}/api/partner/click?ref=${partnerCode}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 TestBrowser',
      },
      redirect: 'manual',
    });

    const clickText = await clickRes.text();
    if (clickRes.status !== 200 && clickRes.status !== 302) {
      console.error('click failed:', clickRes.status, clickText);
    }
    assert(clickRes.status === 302 || clickRes.status === 200, 'Click referral redirect thành công');
    const setCookieHeader = clickRes.headers.get('set-cookie') || (clickRes.headers.getSetCookie ? clickRes.headers.getSetCookie().join('; ') : '');
    assert(Boolean(setCookieHeader && setCookieHeader.includes('tsf_partner_ref=')), 'Trả về signed cookie tsf_partner_ref');

    // Trích xuất signed cookie
    const cookieMatch = setCookieHeader ? setCookieHeader.match(/tsf_partner_ref=([^;]+)/) : null;
    signedCookie = cookieMatch ? cookieMatch[1] : '';

    // Kiểm tra DB referral_clicks
    const clickDb = await queryDb(`SELECT * FROM referral_clicks WHERE partner_id = $1;`, [partnerId]);
    assert(clickDb.rows.length >= 1, 'Ghi nhận bản ghi referral_clicks thành công');

    // -----------------------------------------------------------------
    // 3. ĐẶT ĐƠN HÀNG CÓ ATTRIBUTION (LAST-CLICK COOKIE)
    // -----------------------------------------------------------------
    console.log('\n--- 3. Đặt đơn hàng với cookie giới thiệu ---');
    // Chuẩn bị tồn kho cho sản phẩm test
    const prodRes = await queryDb(`SELECT id, name, price FROM products LIMIT 1;`);
    const testProd = prodRes.rows[0];

    // Đảm bảo chi nhánh NH có tồn kho
    await queryDb(
      `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved)
       VALUES ($1, 'NH', $2, 100, 0)
       ON CONFLICT (store_code, product_id) DO UPDATE SET stock_quantity = 100;`,
      [`inv_p2_${testProd.id}`, testProd.id]
    );

    const customerPhone = `098${Date.now().toString().slice(-7)}`;
    const orderPayload = {
      fullName: 'Khách hàng giới thiệu 1',
      phone: customerPhone,
      email: 'khachhang1@gmail.com',
      address: '123 Đường Nguyễn Trãi, Quận 1',
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Thành',
      paymentMethod: 'cod',
      storeCode: 'NH',
      items: [
        {
          productId: testProd.id,
          name: testProd.name,
          price: testProd.price,
          quantity: 2,
        },
      ],
    };

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tsf_partner_ref=${signedCookie}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderRes.json();
    assert(orderData.success === true, `Đặt hàng thành công: ${orderData.orderCode}`);

    const orderId1 = orderData.orderId;

    // Kiểm tra order_channel trên bảng orders
    const ordCheck = await queryDb(`SELECT order_channel FROM orders WHERE id = $1;`, [orderId1]);
    assert(ordCheck.rows[0]?.order_channel === 'PARTNER_REFERRAL', 'Order channel được ghi là PARTNER_REFERRAL');

    // Kiểm tra order_attributions
    const attrCheck = await queryDb(`SELECT * FROM order_attributions WHERE order_id = $1;`, [orderId1]);
    assert(attrCheck.rows.length === 1, 'Tạo bản ghi order_attributions');
    const attr1 = attrCheck.rows[0];
    assert(attr1.partner_id === partnerId, 'order_attributions gắn đúng partner_id');
    assert(attr1.status === 'ESTIMATED', 'Trạng thái attribution ban đầu là ESTIMATED');
    assert(attr1.is_self_referral === false, 'is_self_referral là false');
    assert(attr1.estimated_commission > 0, `Hoa hồng ước tính > 0 (${attr1.estimated_commission} ₫)`);

    // Kiểm tra partner_ledger
    const ledCheck = await queryDb(`SELECT * FROM partner_ledger WHERE order_id = $1;`, [orderId1]);
    assert(ledCheck.rows.length === 1, 'Tạo bản ghi partner_ledger');
    const led1 = ledCheck.rows[0];
    assert(led1.status === 'ESTIMATED', 'Trạng thái dòng sổ cái ban đầu là ESTIMATED');
    assert(led1.direction === 'CREDIT', 'Dòng sổ cái ghi CREDIT');
    assert(Number(led1.amount) === Number(attr1.estimated_commission), 'Số tiền sổ cái khớp hoa hồng dự kiến');

    // -----------------------------------------------------------------
    // 4. CHỐNG TỰ MUA (ANTI SELF-REFERRAL)
    // -----------------------------------------------------------------
    console.log('\n--- 4. Kiểm tra Chống tự mua (Anti Self-Referral) ---');
    const selfOrderPayload = {
      fullName: 'Chính CTV Đặt Hàng',
      phone: partnerPhone, // Trùng số điện thoại CTV
      email: partnerEmail, // Trùng email CTV
      address: '456 Đường Lê Lợi, Quận 1',
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Thành',
      paymentMethod: 'cod',
      storeCode: 'NH',
      items: [
        {
          productId: testProd.id,
          name: testProd.name,
          price: testProd.price,
          quantity: 1,
        },
      ],
    };

    const selfOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tsf_partner_ref=${signedCookie}`,
      },
      body: JSON.stringify(selfOrderPayload),
    });

    const selfOrderData = await selfOrderRes.json();
    if (!selfOrderData.success) {
      console.error('selfOrderData error:', selfOrderData);
    }
    assert(selfOrderData.success === true, 'Đơn tự mua vẫn cho phép tạo thành công (không chặn khách)');

    const selfOrderId = selfOrderData.orderId;
    const selfAttrCheck = await queryDb(`SELECT * FROM order_attributions WHERE order_id = $1;`, [selfOrderId]);
    assert(selfAttrCheck.rows.length === 1, 'order_attributions được tạo cho đơn tự mua');
    const selfAttr = selfAttrCheck.rows[0];
    assert(selfAttr.is_self_referral === true, 'Phát hiện tự mua: is_self_referral = true');
    assert(selfAttr.status === 'FLAGGED', 'Trạng thái attribution bị chuyển thành FLAGGED');
    assert(Number(selfAttr.estimated_commission) === 0, 'Hoa hồng cho đơn tự mua = 0');

    // Kiểm tra KHÔNG tạo dòng ledger cho đơn tự mua
    const selfLedCheck = await queryDb(`SELECT * FROM partner_ledger WHERE order_id = $1;`, [selfOrderId]);
    assert(selfLedCheck.rows.length === 0, 'Không tạo dòng sổ cái cho đơn tự mua bị gắn cờ');

    // -----------------------------------------------------------------
    // 5. TRANSACTION ROLLBACK KHI THIẾU TỒN KHO
    // -----------------------------------------------------------------
    console.log('\n--- 5. Kiểm tra Transaction Rollback khi thiếu kho ---');
    const outOfStockPayload = {
      fullName: 'Khách mua vượt kho',
      phone: '0979998888',
      email: 'vuotkho@gmail.com',
      address: '999 Đường X, Quận 1',
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Thành',
      paymentMethod: 'cod',
      storeCode: 'NH',
      items: [
        {
          productId: testProd.id,
          name: testProd.name,
          price: testProd.price,
          quantity: 99999, // Vượt quá tồn kho
        },
      ],
    };

    const failOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tsf_partner_ref=${signedCookie}`,
      },
      body: JSON.stringify(outOfStockPayload),
    });

    assert(failOrderRes.status === 400 || failOrderRes.status === 409, 'Bị chặn vì thiếu tồn kho');
    // Kiểm tra không có attribution nào rác được tạo trong DB
    const leftoverAttr = await queryDb(
      `SELECT * FROM order_attributions WHERE eligible_order_amount >= 99999 * $1;`,
      [testProd.price]
    );
    assert(leftoverAttr.rows.length === 0, 'Không còn bản ghi attribution rác khi transaction rollback');

    // -----------------------------------------------------------------
    // 6. CHUYỂN TRẠNG THÁI: COMPLETED + COD RECONCILED → CONFIRMED
    // -----------------------------------------------------------------
    console.log('\n--- 6. Hoàn thành đơn & Đối soát COD → Hoa hồng CONFIRMED ---');
    const { processPartnerOrderEvent } = await import('../src/lib/partner/orderEvent.js');

    // Chuyển trạng thái đơn sang COMPLETED
    await queryDb(`UPDATE orders SET status = 'COMPLETED' WHERE id = $1;`, [orderId1]);
    await processPartnerOrderEvent(orderId1, 'ORDER_COMPLETED', { actor: 'test_admin' });

    // Đối soát COD thành công
    await queryDb(
      `UPDATE orders SET cod_reconciled = true, cod_reconciled_at = CURRENT_TIMESTAMP WHERE id = $1;`,
      [orderId1]
    );
    const reconcileResult = await processPartnerOrderEvent(orderId1, 'COD_RECONCILED', {
      actor: 'test_admin',
      reconciledAmount: 100000,
    });

    assert(reconcileResult.processed === true, 'Đã xử lý sự kiện COD_RECONCILED');
    assert(reconcileResult.action === 'commission_confirmed', 'Hành động là commission_confirmed');

    // Kiểm tra dòng sổ cái sau khi đối soát
    const ledAfterConf = await queryDb(`SELECT * FROM partner_ledger WHERE order_id = $1;`, [orderId1]);
    const confLed = ledAfterConf.rows[0];
    assert(confLed.status === 'CONFIRMED', 'Trạng thái dòng sổ cái chuyển sang CONFIRMED');
    assert(confLed.available_at !== null, `available_at đã được thiết lập: ${confLed.available_at}`);

    // Kiểm tra số dư ví đối tác
    const pAfterConf = await queryDb(`SELECT current_balance, total_commission_earned FROM partner_profiles WHERE id = $1;`, [partnerId]);
    assert(Number(pAfterConf.rows[0].current_balance) === Number(attr1.estimated_commission), 'current_balance tăng bằng hoa hồng được duyệt');

    // -----------------------------------------------------------------
    // 7. AVAILABLE_AT: TÍNH TOÁN DYNAMIC AVAILABLE KHI HẾT THỜI GIAN GIỮ
    // -----------------------------------------------------------------
    console.log('\n--- 7. Kiểm tra Dynamic AVAILABLE khi hết hạn giữ (Holding Days) ---');
    // Cập nhật available_at lùi về quá khứ (1 giờ trước)
    await queryDb(
      `UPDATE partner_ledger SET available_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = $1;`,
      [confLed.id]
    );

    // Gọi API GET /api/partner/ledger
    const ledgerApiRes = await fetch(`${BASE_URL}/api/partner/ledger`, {
      headers: {
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
    });

    const rawText = await ledgerApiRes.text();
    console.log('ledger status:', ledgerApiRes.status, 'text snippet:', rawText.slice(0, 300));
    const ledgerApiData = JSON.parse(rawText);
    assert(ledgerApiData.success === true, 'Lấy danh sách sổ cái thành công');
    assert(ledgerApiData.entries[0].effective_status === 'AVAILABLE', 'effective_status tự động thành AVAILABLE khi now >= available_at');
    assert(ledgerApiData.balances.available === Number(attr1.estimated_commission), 'Số dư available tính đúng');

    // -----------------------------------------------------------------
    // 8. ĐƠN HOÀN TRẢ (ORDER_RETURNED) SAU AVAILABLE → CLAWBACK
    // -----------------------------------------------------------------
    console.log('\n--- 8. Xử lý Đơn hoàn trả (Return) sau khi AVAILABLE → CLAWBACK ---');
    const clawbackResult = await processPartnerOrderEvent(orderId1, 'ORDER_RETURNED', {
      actor: 'test_admin',
      note: 'Khách hàng trả hàng sau khi nhận',
    });

    assert(clawbackResult.processed === true, 'Xử lý sự kiện hoàn đơn thành công');
    assert(clawbackResult.action === 'commission_clawback_created', 'Tạo bút toán đối ứng CLAWBACK');

    // Kiểm tra DB có dòng CLAWBACK ghi DEBIT âm
    const clawbackLed = await queryDb(
      `SELECT * FROM partner_ledger WHERE order_id = $1 AND entry_type = 'CLAWBACK';`,
      [orderId1]
    );
    assert(clawbackLed.rows.length === 1, 'Tạo bản ghi CLAWBACK trong sổ cái');
    assert(Number(clawbackLed.rows[0].amount) < 0, `Số tiền CLAWBACK là số âm: ${clawbackLed.rows[0].amount}`);
    assert(clawbackLed.rows[0].direction === 'DEBIT', 'Hướng bút toán là DEBIT');

    // Kiểm tra ví đối tác bị trừ về 0
    const pAfterClaw = await queryDb(`SELECT current_balance FROM partner_profiles WHERE id = $1;`, [partnerId]);
    assert(Number(pAfterClaw.rows[0].current_balance) === 0, 'current_balance bị trừ trở lại 0 sau clawback');

    // -----------------------------------------------------------------
    // 9. HỦY ĐƠN KHI ĐANG ESTIMATED → VOID (KHÔNG SINH TIỀN, KHÔNG CLAWBACK)
    // -----------------------------------------------------------------
    console.log('\n--- 9. Hủy đơn khi đang ESTIMATED → VOID ---');
    // Tạo đơn mới thứ 2
    const orderRes2 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tsf_partner_ref=${signedCookie}`,
      },
      body: JSON.stringify({
        ...orderPayload,
        fullName: 'Khách hàng đơn 2',
        phone: `096${Date.now().toString().slice(-7)}`,
      }),
    });
    const orderData2 = await orderRes2.json();
    const orderId2 = orderData2.orderId;

    // Hủy đơn ngay khi đang ESTIMATED
    const cancelResult = await processPartnerOrderEvent(orderId2, 'ORDER_CANCELLED', {
      actor: 'test_admin',
      note: 'Khách đổi ý hủy đơn',
    });

    assert(cancelResult.processed === true, 'Xử lý sự kiện hủy đơn thành công');
    assert(cancelResult.action === 'commission_voided', 'Hành động là commission_voided');

    const led2Check = await queryDb(`SELECT status FROM partner_ledger WHERE order_id = $1;`, [orderId2]);
    assert(led2Check.rows[0]?.status === 'VOID', 'Trạng thái ledger được cập nhật thành VOID');

    // -----------------------------------------------------------------
    // 10. KIỂM TRA CÁC API PARTNER (ORDERS, STATS)
    // -----------------------------------------------------------------
    console.log('\n--- 10. Kiểm tra API Partner: /api/partner/orders & /api/partner/stats ---');
    // GET /api/partner/orders
    const ordersApiRes = await fetch(`${BASE_URL}/api/partner/orders`, {
      headers: {
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
    });
    const ordersApiData = await ordersApiRes.json();
    if (!ordersApiData.success) {
      console.error('ordersApiData error:', ordersApiData);
    }
    assert(ordersApiData.success === true, 'Gọi /api/partner/orders thành công');
    assert(ordersApiData.orders.length >= 2, 'Trả về danh sách các đơn đã giới thiệu');
    assert(ordersApiData.orders[0].customer_name.includes('***'), 'Tên khách hàng được che bảo mật (masked)');

    // GET /api/partner/stats
    const statsApiRes = await fetch(`${BASE_URL}/api/partner/stats`, {
      headers: {
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
    });
    const statsApiData = await statsApiRes.json();
    if (!statsApiData.success) {
      console.error('statsApiData error:', statsApiData);
    }
    assert(statsApiData.success === true, 'Gọi /api/partner/stats thành công');
    assert(statsApiData.stats.clicks >= 1, `Đo lường số clicks: ${statsApiData.stats.clicks}`);
    assert(statsApiData.stats.total_orders >= 2, `Đo lường số orders: ${statsApiData.stats.total_orders}`);
    assert(statsApiData.dealer_progress !== undefined, 'Trả về tiến độ nâng cấp Đại lý');
    assert(statsApiData.dealer_progress.target_revenue === 20000000, 'Mục tiêu doanh số lên đại lý là 20.000.000 ₫');

    console.log('\n====================================================');
    console.log(`🎉 HOÀN THÀNH TEST SUITE PHASE 2: ${passed} PASS, ${failed} FAIL`);
    console.log('====================================================');
  } catch (err) {
    console.error('❌ LỖI KHÔNG MONG MUỐN TRONG TEST RUNNER:', err);
    failed++;
  } finally {
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhase2Tests();
