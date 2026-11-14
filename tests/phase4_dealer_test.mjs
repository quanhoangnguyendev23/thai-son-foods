import pg from 'pg';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from '../scripts/db-guard.mjs';

// F-02: mật khẩu tài khoản test / secret đọc từ biến môi trường, không viết cứng trong Git
// (đặt trong .env local, xem docs/golive/F-02-SECRET-PRODUCTION.md)
function requireSecretEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Thiếu biến môi trường ${name}. Đặt trong .env local (xem docs/golive/F-02-SECRET-PRODUCTION.md).`);
    process.exit(1);
  }
  return value;
}

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

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU TEST PHASE 4: DEALER SUBSYSTEM & WHOLESALE COMMERCE');
  console.log('====================================================\n');

  const runId = Date.now().toString().slice(-4);
  const partnerPhone = `091${Date.now().toString().slice(-7)}`;
  const partnerEmail = `dealer_${runId}@thaisonfoods.vn`;

  try {
    // -----------------------------------------------------------------
    // 1. SETUP: TẠO CTV & ĐĂNG NHẬP ADMIN
    // -----------------------------------------------------------------
    console.log('--- 1. Tạo CTV test và Admin session ---');
    const uRes = await queryDb(
      `INSERT INTO users (id, full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4, 'dummy_hash')
       RETURNING id;`,
      [`usr_p4_${runId}`, `Đối tác Đại lý ${runId}`, partnerEmail, partnerPhone]
    );
    const userId = uRes.rows[0].id;

    const partnerCode = `TSF-CTV-P4-${runId}`;
    const pRes = await queryDb(
      `INSERT INTO partner_profiles (
        id, user_id, partner_code, partner_type, full_name, phone, email,
        lifecycle_status, current_balance, total_commission_earned
       ) VALUES ($1, $2, $3, 'CTV', $4, $5, $6, 'ACTIVE', 500000, 500000)
       RETURNING id;`,
      [`part_p4_${runId}`, userId, partnerCode, `Đối tác Đại lý ${runId}`, partnerPhone, partnerEmail]
    );
    const partnerId = pRes.rows[0].id;

    const { signUserToken } = await import('../src/lib/auth.js');
    const partnerToken = await signUserToken({
      id: userId,
      email: partnerEmail,
      fullName: `Đối tác Đại lý ${runId}`,
      phone: partnerPhone,
    });

    const adminLogin = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ identifier: 'admin', password: requireSecretEnv('TEST_ADMIN_PASSWORD') }),
    });
    const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';
    assert(adminLogin.status === 200 && adminCookie.length > 0, 'Đăng nhập Admin thành công');

    // -----------------------------------------------------------------
    // 2. CTV GỬI YÊU CẦU NÂNG CẤP ĐẠI LÝ
    // -----------------------------------------------------------------
    console.log('\n--- 2. CTV gửi yêu cầu nâng cấp Đại lý ---');
    const upgradeReqRes = await fetch(`${BASE_URL}/api/partner/upgrade-dealer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
    });
    const upgradeReqData = await upgradeReqRes.json();
    assert(upgradeReqRes.status === 200, 'Gửi yêu cầu nâng cấp thành công');
    assert(upgradeReqData.success === true, 'Response báo success = true');

    // Kiểm tra trạng thái hồ sơ chuyển sang UNDER_REVIEW
    const pCheck1 = await queryDb(`SELECT lifecycle_status FROM partner_profiles WHERE id = $1;`, [partnerId]);
    assert(pCheck1.rows[0]?.lifecycle_status === 'UNDER_REVIEW', 'Trạng thái đối tác là UNDER_REVIEW chờ duyệt');

    // -----------------------------------------------------------------
    // 3. ADMIN DUYỆT NÂNG CẤP LÊN ĐẠI LÝ (UPGRADE_DEALER)
    // -----------------------------------------------------------------
    console.log('\n--- 3. Admin phê duyệt nâng cấp Đại lý (UPGRADE_DEALER) ---');
    const adminUpgradeRes = await fetch(`${BASE_URL}/api/admin/partners/${partnerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: BASE_URL,
      },
      body: JSON.stringify({
        action: 'UPGRADE_DEALER',
        tierId: 'tier_silver', // Gán hạng Đại lý Bạc (Chiết khấu 20%)
      }),
    });
    const adminUpgradeData = await adminUpgradeRes.json();
    assert(adminUpgradeRes.status === 200, 'Admin nâng cấp thành công');
    assert(adminUpgradeData.success === true, 'Response upgrade thành công');

    // Kiểm tra DB: partner_type = 'DEALER', tier_id = 'tier_silver', status = 'ACTIVE'
    const pCheck2 = await queryDb(`SELECT partner_type, tier_id, lifecycle_status FROM partner_profiles WHERE id = $1;`, [partnerId]);
    assert(pCheck2.rows[0]?.partner_type === 'DEALER', 'partner_type chuyển thành DEALER');
    assert(pCheck2.rows[0]?.tier_id === 'tier_silver', 'tier_id được gán là tier_silver');
    assert(pCheck2.rows[0]?.lifecycle_status === 'ACTIVE', 'lifecycle_status quay lại ACTIVE');

    // -----------------------------------------------------------------
    // 4. KIỂM TRA BẢNG GIÁ SỈ ĐẠI LÝ (/api/dealer/products)
    // -----------------------------------------------------------------
    console.log('\n--- 4. Lấy bảng giá sỉ Đại lý ---');
    const productsRes = await fetch(`${BASE_URL}/api/dealer/products`, {
      headers: {
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
    });
    const productsData = await productsRes.json();
    if (!productsData.success) {
      console.error('productsData error:', productsRes.status, productsData);
    }
    assert(productsRes.status === 200, 'Lấy danh sách giá sỉ thành công');
    assert(productsData.dealer.tier.code === 'TIER_2', 'Đúng hạng Đại lý Bạc (TIER_2)');
    assert(productsData.dealer.tier.discountRate === 20, 'Tỷ lệ chiết khấu đúng 20%');
    assert(productsData.products.length > 0, 'Trả về danh sách sản phẩm giá sỉ');

    const firstProduct = productsData.products[0];
    const expectedWholesale = Math.round(firstProduct.retailPrice * 0.8);
    assert(firstProduct.wholesalePrice === expectedWholesale, `Giá sỉ tính đúng 80% (${firstProduct.wholesalePrice} ₫ vs gốc ${firstProduct.retailPrice} ₫)`);

    // -----------------------------------------------------------------
    // 5. ĐẶT ĐƠN HÀNG SỈ ĐẠI LÝ
    // -----------------------------------------------------------------
    console.log('\n--- 5. Đặt đơn hàng sỉ Đại lý ---');
    // Đảm bảo chi nhánh NH có đủ tồn kho 100 chai
    await queryDb(
      `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved)
       VALUES ($1, 'NH', $2, 200, 0)
       ON CONFLICT (store_code, product_id) DO UPDATE SET stock_quantity = 500, reserved = 0;`,
      [`inv_dl_${firstProduct.id}`, firstProduct.id]
    );

    // Thử đặt dưới 50 chai -> Bị từ chối
    const smallOrderRes = await fetch(`${BASE_URL}/api/dealer/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({
        storeCode: 'NH',
        items: [{ productId: firstProduct.id, quantity: 20 }],
      }),
    });
    const smallOrderData = await smallOrderRes.json();
    assert(smallOrderRes.status === 400, 'Đặt dưới 50 chai bị từ chối 400');
    assert(smallOrderData.code === 'BELOW_MIN_DEALER_QUANTITY', 'Mã lỗi đúng là BELOW_MIN_DEALER_QUANTITY');

    // Đặt đúng số lượng sỉ (60 chai)
    const bulkOrderRes = await fetch(`${BASE_URL}/api/dealer/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${partnerToken}`,
        Cookie: `tsf_user_session=${partnerToken}`,
      },
      body: JSON.stringify({
        storeCode: 'NH',
        items: [{ productId: firstProduct.id, quantity: 60 }],
      }),
    });
    const bulkOrderData = await bulkOrderRes.json();
    if (!bulkOrderData.success) {
      console.error('bulkOrder error:', bulkOrderRes.status, bulkOrderData);
    }
    assert(bulkOrderRes.status === 200, 'Tạo đơn sỉ 60 chai thành công');
    assert(bulkOrderData.paymentStatus === 'PENDING_REVIEW', 'Trạng thái thanh toán là PENDING_REVIEW (chờ khớp lệnh bank transfer)');
    assert(bulkOrderData.paymentMethod === 'bank_transfer', 'Phương thức thanh toán là bank_transfer');
    assert(bulkOrderData.bankTransferInfo !== undefined, 'Có hướng dẫn chuyển khoản ngân hàng');

    const dealerOrderId = bulkOrderData.orderId;

    // Kiểm tra DB đơn hàng
    const ordCheck = await queryDb(`SELECT order_channel, payment_status, dealer_tier_snapshot, total FROM orders WHERE id = $1;`, [dealerOrderId]);
    assert(ordCheck.rows[0]?.order_channel === 'DEALER_PURCHASE', 'order_channel là DEALER_PURCHASE');
    assert(ordCheck.rows[0]?.dealer_tier_snapshot === 'TIER_2', 'Ghi snapshot dealer_tier_snapshot là TIER_2');
    assert(ordCheck.rows[0]?.payment_status === 'PENDING_REVIEW', 'payment_status là PENDING_REVIEW');

    // -----------------------------------------------------------------
    // 6. KẾ TOÁN XÁC NHẬN CHUYỂN KHOẢN (CONFIRM PAYMENT)
    // -----------------------------------------------------------------
    console.log('\n--- 6. Kế toán xác nhận thanh toán chuyển khoản ---');
    const bankTxnRef = `VCB-DEALER-${Date.now().toString().slice(-6)}`;
    const confirmPayRes = await fetch(`${BASE_URL}/api/admin/orders/${dealerOrderId}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: BASE_URL,
      },
      body: JSON.stringify({ paymentReference: bankTxnRef }),
    });
    const confirmPayData = await confirmPayRes.json();
    if (!confirmPayData.success) {
      console.error('confirmPayData error:', confirmPayRes.status, confirmPayData);
    }
    assert(confirmPayRes.status === 200, 'Xác nhận thanh toán thành công');
    assert(confirmPayData.order.payment_status === 'PAID', 'Trạng thái thanh toán chuyển sang PAID');
    assert(confirmPayData.order.payment_reference === bankTxnRef, 'Lưu đúng mã đối soát ngân hàng');

    // -----------------------------------------------------------------
    // 7. KIỂM TRA AUDIT LOG
    // -----------------------------------------------------------------
    console.log('\n--- 7. Kiểm tra Audit Log ---');
    const auditRes = await queryDb(
      `SELECT * FROM audit_logs WHERE entity_type = 'ORDER' AND entity_id = $1 AND action = 'ORDER_PAYMENT_CONFIRM';`,
      [dealerOrderId]
    );
    assert(auditRes.rows.length >= 1, 'Ghi nhận audit log xác nhận thanh toán sỉ');

    console.log('\n====================================================');
    console.log(`🎉 HOÀN THÀNH TEST SUITE PHASE 4: ${passed} PASS, ${failed} FAIL`);
    console.log('====================================================');
  } catch (err) {
    console.error('❌ LỖI TRONG TEST RUNNER PHASE 4:', err);
    failed++;
  } finally {
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhase4Tests();
