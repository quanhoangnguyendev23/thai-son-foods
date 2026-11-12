import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

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
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const DB_URL = requireDatabaseUrl();

const pool = new Pool({ connectionString: DB_URL });

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function recordTest(name, success, details = '') {
  if (success) {
    results.passed++;
    console.log(`  ✅ [PASS] ${name}`);
    if (details) console.log(`     -> ${details}`);
  } else {
    results.failed++;
    console.error(`  ❌ [FAIL] ${name}`);
    if (details) console.error(`     -> Error: ${details}`);
  }
  results.tests.push({ name, success, details });
}

async function runComprehensiveTests() {
  console.log('========================================================================');
  console.log('🚀 BẮT ĐẦU CHƯƠNG TRÌNH KIỂM THỬ TOÀN DIỆN THÁI SƠN FOODS');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`💾 DB Connection: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('========================================================================\n');

  const client = await pool.connect();
  // Tạo runId ngẫu nhiên 4 chữ số
  const runId = Math.floor(1000 + Math.random() * 9000).toString();

  // Tạo số điện thoại duy nhất cho từng test trong lần chạy này để tránh cooldown rate-limit
  const getPhone = (idx) => `098${runId}${idx.toString().padStart(3, '0')}`;

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 0: ĐĂNG NHẬP CÁC TÀI KHOẢN (Super Admin & Store Staff)
    // -------------------------------------------------------------------------
    console.log('🔑 [BƯỚC 0] Đăng nhập xác thực các vai trò (RBAC Tokens)...');

    // 0.1 Super Admin (admin / Admin@123)
    const superLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ identifier: 'admin', password: 'Admin@123' }),
    });
    const superCookie = superLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
    const superData = await superLoginRes.json();
    recordTest('Đăng nhập Super Admin (admin / Admin@123)', superLoginRes.status === 200 && superCookie.length > 0, `User: ${superData.user?.username}, Role: ${superData.user?.role}`);

    // 0.2 Store Staff Chi nhánh AMA (qa_staff_ama / QaTest@2026!Password)
    const amaLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ identifier: 'qa_staff_ama', password: 'QaTest@2026!Password' }),
    });
    const amaCookie = amaLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
    const amaData = await amaLoginRes.json();
    recordTest('Đăng nhập Store Staff AMA (qa_staff_ama)', amaLoginRes.status === 200 && amaCookie.length > 0, `Store: ${amaData.user?.storeCode}, Role: ${amaData.user?.role}`);

    // 0.3 Store Staff Chi nhánh D1 (qa_staff_d1 / QaTest@2026!Password)
    const d1LoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ identifier: 'qa_staff_d1', password: 'QaTest@2026!Password' }),
    });
    const d1Cookie = d1LoginRes.headers.get('set-cookie')?.split(';')[0] || '';
    const d1Data = await d1LoginRes.json();
    recordTest('Đăng nhập Store Staff D1 (qa_staff_d1)', d1LoginRes.status === 200 && d1Cookie.length > 0, `Store: ${d1Data.user?.storeCode}, Role: ${d1Data.user?.role}`);

    // -------------------------------------------------------------------------
    // BƯỚC 1: KIỂM THỬ ĐẶT HÀNG (ORDER PLACEMENT) VÀ LOGIC GIỮ CHỖ KHO (RESERVATION)
    // -------------------------------------------------------------------------
    console.log('\n📦 [BƯỚC 1] Kiểm thử quy trình Đặt Hàng & Giữ Chỗ Tồn Kho (Reservations)...');

    const STORE_TEST = 'AMA';
    const TEST_PROD_ID = 'prod-sb-01'; // Sữa Bắp Nếp

    // 1.1 Chuẩn bị tồn kho tại AMA: 50 chai, 0 reserved
    await client.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock, updated_by)
      VALUES ($1, $2, $3, 50, 0, 0, 'qa_init')
      ON CONFLICT (store_code, product_id)
      DO UPDATE SET stock_quantity = 50, reserved = 0, safety_stock = 0;
    `, [`inv_${STORE_TEST}_${TEST_PROD_ID}`, STORE_TEST, TEST_PROD_ID]);

    // 1.2 Đặt đơn hàng 1 sản phẩm chai lẻ (3 chai)
    const phone1 = getPhone(1);
    const orderPayload1 = {
      fullName: 'Nguyễn Văn Kiểm Thử',
      phone: phone1,
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      address: '472 Lê Trọng Tấn, Phường Tây Thạnh',
      paymentMethod: 'cod',
      storeCode: STORE_TEST,
      items: [
        {
          productId: TEST_PROD_ID,
          name: 'Sữa Bắp Nếp Thái Sơn 330ml',
          price: 15000,
          quantity: 3,
          unit: 'chai 330ml',
        },
      ],
    };

    const orderRes1 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(orderPayload1),
    });
    const orderData1 = await orderRes1.json();
    const orderId1 = orderData1.orderId || orderData1.order?.id;

    recordTest(
      'Đặt hàng thành công đơn lẻ (3 chai Sữa Bắp Nếp)',
      orderRes1.status === 200 && Boolean(orderId1),
      `OrderId: ${orderId1}, Status: ${orderRes1.status}`
    );

    // Kiểm tra DB sau đặt đơn 1:
    const invDb1 = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [STORE_TEST, TEST_PROD_ID]
    );
    const stock1 = Number(invDb1.rows[0]?.stock_quantity);
    const reserved1 = Number(invDb1.rows[0]?.reserved);
    recordTest(
      'Tồn kho AMA sau khi đặt đơn 1: Tồn thực = 50, Đang giữ chỗ = 3',
      stock1 === 50 && reserved1 === 3,
      `Tồn thực: ${stock1}, Đang giữ chỗ: ${reserved1}`
    );

    // 1.3 Kiểm tra Anti-Spam / Rate-limiting (Cùng 1 SĐT đặt tiếp ngay lập tức -> HTTP 429)
    const spamOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({
        ...orderPayload1,
        items: [{ productId: TEST_PROD_ID, name: 'Sữa Bắp Nếp', price: 15000, quantity: 1, unit: 'chai' }],
      }),
    });
    const spamOrderData = await spamOrderRes.json();
    recordTest(
      'Cơ chế chống spam đơn COD: SĐT đặt liên tiếp trong thời gian ngắn bị chặn HTTP 429',
      spamOrderRes.status === 429,
      `Status: ${spamOrderRes.status}, Error: ${spamOrderData.error}`
    );

    // 1.4 Đặt đơn có variant hệ số nhân chai (Lốc 6 chai -> Multiplier = 6)
    const phoneLoc = getPhone(2);
    const orderPayloadLoc = {
      fullName: 'Trần Thị Lốc Sáu',
      phone: phoneLoc,
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      address: '472 Lê Trọng Tấn, Phường Tây Thạnh',
      paymentMethod: 'cod',
      storeCode: STORE_TEST,
      items: [
        {
          productId: `${TEST_PROD_ID}-loc6`,
          name: 'Sữa Bắp Nếp Thái Sơn (Lốc 6 chai)',
          price: 90000,
          quantity: 2, // 2 lốc * 6 chai = 12 chai
          unit: 'lốc 6 chai',
        },
      ],
    };

    const orderResLoc = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(orderPayloadLoc),
    });
    const orderDataLoc = await orderResLoc.json();
    const orderIdLoc = orderDataLoc.orderId || orderDataLoc.order?.id;

    recordTest(
      'Đặt hàng quy cách Lốc 6 chai (2 lốc = 12 chai vật lý)',
      orderResLoc.status === 200 && Boolean(orderIdLoc),
      `OrderId: ${orderIdLoc}, Status: ${orderResLoc.status}`
    );

    const invDbLoc = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [STORE_TEST, TEST_PROD_ID]
    );
    const reservedLoc = Number(invDbLoc.rows[0]?.reserved);
    recordTest(
      'Reserved tăng đúng thêm 12 chai: 3 + 12 = 15 chai',
      reservedLoc === 15,
      `Reserved thực tế: ${reservedLoc}`
    );

    // 1.5 Chống bán lố (Anti-Overselling): Tồn thực = 50, Đang giữ = 15 -> Khả dụng = 35 chai
    // Cố tình đặt 40 chai -> Phải bị từ chối 409 Conflict
    const phoneOver = getPhone(3);
    const overPayload = {
      fullName: 'Khách Đặt Quá Tồn Kho',
      phone: phoneOver,
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      address: '472 Lê Trọng Tấn, Phường Tây Thạnh',
      paymentMethod: 'cod',
      storeCode: STORE_TEST,
      items: [
        {
          productId: TEST_PROD_ID,
          name: 'Sữa Bắp Nếp',
          price: 15000,
          quantity: 40, // 40 > 35 khả dụng
          unit: 'chai',
        },
      ],
    };

    const overRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(overPayload),
    });
    const overData = await overRes.json();
    recordTest(
      'Chặn đơn hàng vượt quá tồn khả dụng (HTTP 409 Conflict)',
      overRes.status === 409 && Array.isArray(overData.insufficientItems) && overData.insufficientItems.length > 0,
      `Status: ${overRes.status}, Error: ${overData.error}`
    );

    // 1.6 Validation chống gian lận COD (Anti-abuse validation)
    // SĐT sai định dạng
    const badPhoneRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({
        fullName: 'Khách SĐT Sai',
        phone: '123456', // Invalid phone
        address: '472 Lê Trọng Tấn, Tây Thạnh, Tân Phú',
        items: [{ productId: TEST_PROD_ID, quantity: 1, price: 15000 }],
      }),
    });
    recordTest(
      'Chặn số điện thoại không hợp lệ (HTTP 400)',
      badPhoneRes.status === 400,
      `Status: ${badPhoneRes.status}`
    );

    // Địa chỉ quá ngắn cho COD (< 10 ký tự)
    const phoneShort = getPhone(4);
    const shortAddrRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({
        fullName: 'Khách Địa Chỉ Ngắn',
        phone: phoneShort,
        address: 'Nhà tôi', // Quá ngắn
        paymentMethod: 'cod',
        items: [{ productId: TEST_PROD_ID, quantity: 1, price: 15000 }],
      }),
    });
    recordTest(
      'Chặn đơn COD có địa chỉ giao hàng quá ngắn (HTTP 400)',
      shortAddrRes.status === 400,
      `Status: ${shortAddrRes.status}`
    );

    // -------------------------------------------------------------------------
    // BƯỚC 2: KIỂM THỬ XÁC NHẬN ĐƠN HÀNG (CONFIRMATION & INVENTORY DEDUCTION)
    // -------------------------------------------------------------------------
    console.log('\n✅ [BƯỚC 2] Kiểm thử Xác Nhận Đơn Hàng & Vòng Đời Trạng Thái (Order Lifecycle)...');

    // 2.1 Admin xác nhận đơn hàng 1 (status: CONFIRMED)
    const confirmRes1 = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({ id: orderId1, status: 'CONFIRMED' }),
    });
    const confirmData1 = await confirmRes1.json();
    recordTest(
      'Super Admin xác nhận đơn hàng 1 (CONFIRMED)',
      confirmRes1.status === 200 && confirmData1.success,
      `Status: ${confirmRes1.status}`
    );

    // Kiểm tra DB sau xác nhận đơn 1:
    // Đơn 1 mua 3 chai. Ban đầu: stock=50, reserved=15.
    // Sau khi confirm đơn 1: stock = 50 - 3 = 47 chai, reserved = 15 - 3 = 12 chai.
    const invDbAfterConfirm1 = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [STORE_TEST, TEST_PROD_ID]
    );
    const stockAfterConfirm = Number(invDbAfterConfirm1.rows[0]?.stock_quantity);
    const resAfterConfirm = Number(invDbAfterConfirm1.rows[0]?.reserved);
    recordTest(
      'Tồn kho AMA sau xác nhận đơn 1: Tồn thực giảm từ 50 -> 47, Đang giữ giảm từ 15 -> 12',
      stockAfterConfirm === 47 && resAfterConfirm === 12,
      `Tồn thực: ${stockAfterConfirm}, Đang giữ chỗ: ${resAfterConfirm}`
    );

    // Kiểm tra trạng thái đơn hàng trong DB: status = CONFIRMED, inventory_deducted = true
    const orderInDb1 = await client.query(
      `SELECT status, inventory_deducted FROM orders WHERE id = $1;`,
      [orderId1]
    );
    recordTest(
      'Bản ghi đơn hàng 1 được cập nhật: status = CONFIRMED, inventory_deducted = true',
      orderInDb1.rows[0]?.status === 'CONFIRMED' && orderInDb1.rows[0]?.inventory_deducted === true,
      `status: ${orderInDb1.rows[0]?.status}, inventory_deducted: ${orderInDb1.rows[0]?.inventory_deducted}`
    );

    // 2.2 Kiểm tra tính lũy đẳng (Idempotency): Gọi lại xác nhận lần 2 -> Không bị trừ tồn kho lần 2!
    const reConfirmRes1 = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({ id: orderId1, status: 'CONFIRMED' }),
    });
    const invDbAfterReConfirm = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [STORE_TEST, TEST_PROD_ID]
    );
    const stockAfterReConfirm = Number(invDbAfterReConfirm.rows[0]?.stock_quantity);
    const resAfterReConfirm = Number(invDbAfterReConfirm.rows[0]?.reserved);
    recordTest(
      'Tính lũy đẳng (Idempotency): Xác nhận lại không làm trừ kho 2 lần (Vẫn giữ 47 chai)',
      stockAfterReConfirm === 47 && resAfterReConfirm === 12,
      `Tồn thực: ${stockAfterReConfirm}, Đang giữ: ${resAfterReConfirm}`
    );

    // 2.3 Chuyển tiếp các trạng thái tiếp theo: PROCESSING -> SHIPPING -> COMPLETED
    const procRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({ id: orderId1, status: 'PROCESSING' }),
    });
    recordTest('Chuyển trạng thái đơn 1 -> PROCESSING', procRes.status === 200);

    const shipRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({ id: orderId1, status: 'SHIPPING' }),
    });
    recordTest('Chuyển trạng thái đơn 1 -> SHIPPING', shipRes.status === 200);

    const compRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({ id: orderId1, status: 'COMPLETED' }),
    });
    recordTest('Chuyển trạng thái đơn 1 -> COMPLETED', compRes.status === 200);

    // 2.4 Hủy đơn khi đang PENDING (đơn lốc 6 chai orderIdLoc đang PENDING với 12 chai reserved)
    const cancelPendingRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({ id: orderIdLoc, status: 'CANCELLED', note: 'QA hủy đơn PENDING' }),
    });
    recordTest('Hủy đơn hàng đang PENDING (đơn Lốc 6 chai)', cancelPendingRes.status === 200);

    // Kiểm tra reserved được nhả về 0 (12 chai đã giữ được giải phóng hoàn toàn)
    const invDbAfterCancelLoc = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [STORE_TEST, TEST_PROD_ID]
    );
    const resAfterCancelLoc = Number(invDbAfterCancelLoc.rows[0]?.reserved);
    recordTest(
      'Reserved sau khi hủy đơn PENDING được nhả về 0 (12 -> 0)',
      resAfterCancelLoc === 0,
      `Reserved thực tế: ${resAfterCancelLoc}`
    );

    // 2.5 Hủy đơn sau khi ĐÃ CONFIRMED / COMPLETED (Hoàn kho - Stock Restoration)
    // Đơn 1 đã trừ 3 chai (stock=47). Khi hủy đơn 1, stock_quantity phải được hoàn lại thành 50!
    const cancelConfirmedRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({ id: orderId1, status: 'CANCELLED', note: 'QA khách hoàn hàng' }),
    });
    recordTest('Hủy đơn hàng đã CONFIRMED / hoàn hàng', cancelConfirmedRes.status === 200);

    const invDbAfterRestored = await client.query(
      `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2;`,
      [STORE_TEST, TEST_PROD_ID]
    );
    const stockRestored = Number(invDbAfterRestored.rows[0]?.stock_quantity);
    recordTest(
      'Tồn thực sau khi hoàn đơn được khôi phục chính xác: 47 + 3 = 50 chai',
      stockRestored === 50,
      `Tồn thực tế: ${stockRestored}`
    );

    // -------------------------------------------------------------------------
    // BƯỚC 3: KIỂM THỬ QUẢN LÝ KHO & NHẬP KHO (INVENTORY & LOTS RECEIVING)
    // -------------------------------------------------------------------------
    console.log('\n🏭 [BƯỚC 3] Kiểm thử Quản Lý Kho & Nhập Kho Theo Lô (FEFO Lots)...');

    // 3.1 Cập nhật tồn kho thủ công (PUT /api/admin/inventory)
    const updateStockRes = await fetch(`${BASE_URL}/api/admin/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({
        storeCode: STORE_TEST,
        productId: TEST_PROD_ID,
        stockQuantity: 80,
      }),
    });
    const updateStockData = await updateStockRes.json();
    recordTest(
      'Cập nhật tồn kho qua API PUT /api/admin/inventory (80 chai)',
      updateStockRes.status === 200 && updateStockData.success,
      `Status: ${updateStockRes.status}`
    );

    // Kiểm tra log ghi nhận manual_update
    const logRes = await client.query(
      `SELECT old_stock, new_stock, change_type, actor FROM inventory_logs WHERE store_code = $1 AND product_id = $2 ORDER BY created_at DESC LIMIT 1;`,
      [STORE_TEST, TEST_PROD_ID]
    );
    recordTest(
      'Ghi nhận inventory_logs: old_stock=50 -> new_stock=80, change_type=manual_update',
      logRes.rows[0]?.new_stock === 80 && logRes.rows[0]?.change_type === 'manual_update',
      `Log: ${JSON.stringify(logRes.rows[0])}`
    );

    // 3.2 Kiểm tra ràng buộc: Không cho phép hạ tồn kho xuống dưới số lượng đang giữ chỗ (reserved)
    // Thiết lập reserved = 20
    await client.query(
      `UPDATE store_inventory SET reserved = 20 WHERE store_code = $1 AND product_id = $2;`,
      [STORE_TEST, TEST_PROD_ID]
    );

    // Thử cập nhật stockQuantity = 10 (< reserved 20) -> Phải bị chặn 400!
    const invalidStockRes = await fetch(`${BASE_URL}/api/admin/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({
        storeCode: STORE_TEST,
        productId: TEST_PROD_ID,
        stockQuantity: 10,
      }),
    });
    const invalidStockData = await invalidStockRes.json();
    recordTest(
      'Chặn giảm tồn kho xuống dưới số đang giữ chỗ (HTTP 400 Bad Request)',
      invalidStockRes.status === 400 && invalidStockData.success === false,
      `Status: ${invalidStockRes.status}, Error: ${invalidStockData.error}`
    );

    // Khôi phục reserved về 0
    await client.query(
      `UPDATE store_inventory SET reserved = 0 WHERE store_code = $1 AND product_id = $2;`,
      [STORE_TEST, TEST_PROD_ID]
    );

    // 3.3 Nhập kho theo lô FEFO (POST /api/admin/inventory/lots)
    const lotCodeNear = `LOT-QA-NEAR-${runId}`;
    const lotCodeFar = `LOT-QA-FAR-${runId}`;

    const mfgDate = new Date().toISOString().split('T')[0];
    const expDateNear = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]; // Hạn sau 3 ngày
    const expDateFar = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]; // Hạn sau 15 ngày

    const createLotRes1 = await fetch(`${BASE_URL}/api/admin/inventory/lots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({
        storeCode: STORE_TEST,
        productId: TEST_PROD_ID,
        lotCode: lotCodeNear,
        manufacturingDate: mfgDate,
        expiryDate: expDateNear,
        quantity: 25,
      }),
    });
    const createLotData1 = await createLotRes1.json();
    recordTest(
      'Nhập lô hàng cận date (HSD 3 ngày, 25 chai)',
      createLotRes1.status === 200 && createLotData1.success,
      `LotCode: ${lotCodeNear}`
    );

    const createLotRes2 = await fetch(`${BASE_URL}/api/admin/inventory/lots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({
        storeCode: STORE_TEST,
        productId: TEST_PROD_ID,
        lotCode: lotCodeFar,
        manufacturingDate: mfgDate,
        expiryDate: expDateFar,
        quantity: 40,
      }),
    });
    const createLotData2 = await createLotRes2.json();
    recordTest(
      'Nhập lô hàng date xa (HSD 15 ngày, 40 chai)',
      createLotRes2.status === 200 && createLotData2.success,
      `LotCode: ${lotCodeFar}`
    );

    // 3.4 Lấy danh sách lô hàng (GET /api/admin/inventory/lots)
    const getLotsRes = await fetch(`${BASE_URL}/api/admin/inventory/lots?storeCode=${STORE_TEST}&productId=${TEST_PROD_ID}`, {
      headers: { Cookie: superCookie },
    });
    const getLotsData = await getLotsRes.json();
    const foundLots = getLotsData.lots || [];
    const nearLotItem = foundLots.find((l) => l.lot_code === lotCodeNear);
    recordTest(
      'API GET /api/admin/inventory/lots tính đúng daysRemaining & expiryStatus',
      getLotsRes.status === 200 && Boolean(nearLotItem) && nearLotItem.expiryStatus === 'NEAR_EXPIRY',
      `Days remaining: ${nearLotItem?.daysRemaining}, Status: ${nearLotItem?.expiryStatus}`
    );

    // -------------------------------------------------------------------------
    // BƯỚC 4: KIỂM THỬ CHUYỂN CHI NHÁNH ĐƠN HÀNG & PHÂN QUYỀN RBAC (ANTI-IDOR)
    // -------------------------------------------------------------------------
    console.log('\n🔄 [BƯỚC 4] Kiểm thử Chuyển Chi Nhánh Đơn Hàng & Phân Quyền Cửa Hàng (RBAC & Anti-IDOR)...');

    // 4.1 Tạo 1 đơn hàng mới ở chi nhánh AMA
    const phoneTrans = getPhone(5);
    const transferOrderPayload = {
      fullName: 'Khách Chuyển Kho',
      phone: phoneTrans,
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      address: '472 Lê Trọng Tấn, Phường Tây Thạnh',
      paymentMethod: 'cod',
      storeCode: 'AMA',
      items: [{ productId: TEST_PROD_ID, name: 'Sữa Bắp Nếp', price: 15000, quantity: 4, unit: 'chai' }],
    };

    const transOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(transferOrderPayload),
    });
    const transOrderData = await transOrderRes.json();
    const transOrderId = transOrderData.orderId || transOrderData.order?.id;
    recordTest('Tạo đơn hàng chờ chuyển chi nhánh (4 chai tại AMA)', transOrderRes.status === 200 && Boolean(transOrderId), `OrderId: ${transOrderId}`);

    // Đảm bảo chi nhánh D1 có tồn kho cho sản phẩm này (50 chai)
    await client.query(`
      INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, reserved, safety_stock, updated_by)
      VALUES ('inv_D1_prod-sb-01', 'D1', 'prod-sb-01', 50, 0, 0, 'qa_init')
      ON CONFLICT (store_code, product_id) DO UPDATE SET stock_quantity = 50, reserved = 0;
    `);

    // 4.2 Super Admin chuyển đơn hàng từ AMA sang D1
    const doTransferRes = await fetch(`${BASE_URL}/api/admin/orders/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: BASE_URL },
      body: JSON.stringify({
        orderId: transOrderId,
        targetStoreCode: 'D1',
      }),
    });
    const doTransferData = await doTransferRes.json();
    recordTest(
      'Super Admin chuyển chi nhánh đơn hàng từ AMA -> D1 thành công',
      doTransferRes.status === 200 && doTransferData.success,
      `Status: ${doTransferRes.status}`
    );

    // Kiểm tra DB sau khi chuyển:
    // Đơn hàng store_code phải là D1
    const checkOrderTrans = await client.query(`SELECT store_code FROM orders WHERE id = $1;`, [transOrderId]);
    recordTest('Đơn hàng trong DB đã đổi store_code sang D1', checkOrderTrans.rows[0]?.store_code === 'D1');

    // Reservation tại kho AMA đã nhả (released), tại D1 là active (4 chai)
    const resvAma = await client.query(
      `SELECT status FROM stock_reservations WHERE order_id = $1 AND store_code = 'AMA';`,
      [transOrderId]
    );
    const resvD1 = await client.query(
      `SELECT status, quantity FROM stock_reservations WHERE order_id = $1 AND store_code = 'D1';`,
      [transOrderId]
    );
    recordTest(
      'Reservation tại AMA chuyển sang released, tại D1 kích hoạt active (4 chai)',
      resvAma.rows[0]?.status === 'released' && resvD1.rows[0]?.status === 'active' && resvD1.rows[0]?.quantity === 4,
      `AMA status: ${resvAma.rows[0]?.status}, D1 status: ${resvD1.rows[0]?.status}`
    );

    // 4.3 Store Staff cố chuyển chi nhánh -> Phải bị 403 Forbidden!
    const staffTransferRes = await fetch(`${BASE_URL}/api/admin/orders/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: amaCookie, Origin: BASE_URL },
      body: JSON.stringify({
        orderId: transOrderId,
        targetStoreCode: 'AMA',
      }),
    });
    recordTest(
      'Store Staff không có quyền chuyển chi nhánh bị chặn HTTP 403 Forbidden',
      staffTransferRes.status === 403,
      `Status: ${staffTransferRes.status}`
    );

    // 4.4 Anti-IDOR: Store Staff AMA cố xem hoặc sửa đơn hàng của chi nhánh D1
    // Đơn hàng transOrderId hiện thuộc D1. Nhân viên AMA gửi request GET /api/admin/orders?id=transOrderId
    const idorGetRes = await fetch(`${BASE_URL}/api/admin/orders?id=${transOrderId}`, {
      headers: { Cookie: amaCookie },
    });
    recordTest(
      'Anti-IDOR: Store Staff AMA cố đọc đơn hàng của D1 bị chặn HTTP 403 Forbidden',
      idorGetRes.status === 403,
      `Status: ${idorGetRes.status}`
    );

    // Nhân viên AMA cố PUT cập nhật trạng thái đơn hàng của D1
    const idorPutRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: amaCookie, Origin: BASE_URL },
      body: JSON.stringify({ id: transOrderId, status: 'CONFIRMED' }),
    });
    recordTest(
      'Anti-IDOR: Store Staff AMA cố cập nhật đơn hàng của D1 bị chặn HTTP 403 Forbidden',
      idorPutRes.status === 403,
      `Status: ${idorPutRes.status}`
    );

    // -------------------------------------------------------------------------
    // BƯỚC 5: KIỂM THỬ ĐÁNH GIÁ SẢN PHẨM (REVIEWS MODULE & MODERATION)
    // -------------------------------------------------------------------------
    console.log('\n⭐ [BƯỚC 5] Kiểm thử Hệ Thống Đánh Giá Sản Phẩm (Reviews & Moderation)...');

    // 5.1 Gửi đánh giá sản phẩm mới (dọn dẹp rate-limits test cũ để test lượt gửi hợp lệ)
    await client.query(`DELETE FROM review_rate_limits WHERE ip_address IN ('127.0.0.1', '::1') OR created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour';`);

    const phoneRev = getPhone(6);
    const reviewPayload = {
      productId: TEST_PROD_ID,
      customerName: 'Nguyễn Văn Đánh Giá',
      customerPhone: phoneRev,
      rating: 5,
      title: `Chất lượng rất tuyệt vời ${runId}`,
      comment: `Sữa bắp nếp rất thơm ngon, chuẩn vị Thái Sơn Foods, date mới tinh! Mã kiểm thử: ${runId}`,
    };

    const postReviewRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(reviewPayload),
    });
    const postReviewData = await postReviewRes.json();
    const reviewId = postReviewData.reviewId || postReviewData.id || postReviewData.data?.id;
    recordTest(
      'Gửi đánh giá sản phẩm thành công',
      postReviewRes.status === 200 && postReviewData.success === true,
      `ReviewId: ${reviewId}, Status: ${postReviewRes.status}`
    );

    // 5.2 Kiểm tra API Admin quản lý reviews (GET /api/admin/reviews)
    const getAdminRevRes = await fetch(`${BASE_URL}/api/admin/reviews`, {
      headers: { Cookie: superCookie },
    });
    const getAdminRevData = await getAdminRevRes.json();
    recordTest(
      'Admin xem danh sách reviews quản trị (GET /api/admin/reviews)',
      getAdminRevRes.status === 200 && (getAdminRevData.success === true || Array.isArray(getAdminRevData.reviews) || Array.isArray(getAdminRevData.data)),
      `Status: ${getAdminRevRes.status}`
    );

    // -------------------------------------------------------------------------
    // BƯỚC 6: KIỂM THỬ ĐỐI TÁC CTV / ĐẠI LÝ (PARTNER ATTRIBUTION & ANTI-FRAUD)
    // -------------------------------------------------------------------------
    console.log('\n🤝 [BƯỚC 6] Kiểm thử Đối Tác CTV / Đại Lý (Referral Tracking & Anti-Fraud)...');

    // 6.1 Tạo một partner profile mẫu trong DB (gắn vào 1 user có sẵn)
    const testPartnerCode = `CTVQA${runId}`;
    const testPartnerPhone = getPhone(7);
    const testPartnerEmail = `ctvqa${runId}@example.com`;

    // Tạo user cho partner (có password_hash hợp lệ)
    const partnerUserId = `usr_part_${runId}`;
    await client.query(`
      INSERT INTO users (id, phone, email, full_name, password_hash, is_active)
      VALUES ($1, $2, $3, 'Đối Tác QA User', 'qa_dummy_hash_123', true)
      ON CONFLICT (email) DO UPDATE SET phone = $2;
    `, [partnerUserId, testPartnerPhone, testPartnerEmail]);

    await client.query(`
      INSERT INTO partner_profiles (id, user_id, partner_code, phone, email, full_name, partner_type, lifecycle_status)
      VALUES ($1, $2, $3, $4, $5, 'Đối Tác QA Test', 'CTV', 'ACTIVE')
      ON CONFLICT (partner_code) DO NOTHING;
    `, [`part_qa_${runId}`, partnerUserId, testPartnerCode, testPartnerPhone, testPartnerEmail]);

    // 6.2 Khách hàng đặt đơn có mã CTV (Referral Code hợp lệ)
    const phoneCustomer = getPhone(8);
    const partnerOrderPayload = {
      fullName: 'Khách Hàng Mua Qua CTV',
      phone: phoneCustomer,
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      address: '472 Lê Trọng Tấn, Phường Tây Thạnh',
      paymentMethod: 'cod',
      storeCode: STORE_TEST,
      referralCode: testPartnerCode,
      items: [{ productId: TEST_PROD_ID, name: 'Sữa Bắp Nếp', price: 20000, quantity: 5, unit: 'chai' }], // 100k
    };

    const pOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(partnerOrderPayload),
    });
    const pOrderData = await pOrderRes.json();
    const pOrderId = pOrderData.orderId || pOrderData.order?.id;
    recordTest('Đặt hàng có mã giới thiệu CTV hợp lệ', pOrderRes.status === 200 && Boolean(pOrderId), `OrderId: ${pOrderId}`);

    // Kiểm tra order_attributions & partner_ledger ghi nhận hoa hồng
    const attrCheck = await client.query(
      `SELECT referral_code, estimated_commission, is_self_referral FROM order_attributions WHERE order_id = $1;`,
      [pOrderId]
    );
    const hasAttr = attrCheck.rows.length > 0;
    const isSelf1 = attrCheck.rows[0]?.is_self_referral;
    const commAmt1 = Number(attrCheck.rows[0]?.estimated_commission);
    recordTest(
      'Ghi nhận attribution CTV: referral_code đúng, is_self_referral=false, hoa hồng > 0',
      hasAttr && isSelf1 === false && commAmt1 > 0,
      `Commission: ${commAmt1}đ, SelfReferral: ${isSelf1}`
    );

    // 6.3 Chống tự mua (Self-Referral Prevention): CTV dùng chính SĐT của mình để đặt đơn
    const selfOrderPayload = {
      fullName: 'Đối Tác Tự Mua Hàng',
      phone: testPartnerPhone, // Trùng SĐT của CTV!
      email: testPartnerEmail,
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      address: '472 Lê Trọng Tấn, Phường Tây Thạnh',
      paymentMethod: 'cod',
      storeCode: STORE_TEST,
      referralCode: testPartnerCode,
      items: [{ productId: TEST_PROD_ID, name: 'Sữa Bắp Nếp', price: 20000, quantity: 5, unit: 'chai' }],
    };

    const selfOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(selfOrderPayload),
    });
    const selfOrderData = await selfOrderRes.json();
    const selfOrderId = selfOrderData.orderId || selfOrderData.order?.id;

    const selfAttrCheck = await client.query(
      `SELECT referral_code, estimated_commission, is_self_referral, status FROM order_attributions WHERE order_id = $1;`,
      [selfOrderId]
    );
    const selfAttr = selfAttrCheck.rows[0];
    recordTest(
      'Chống tự mua (Anti-Self-Referral): Hệ thống phát hiện trùng SĐT/Email, gắn cờ FLAGGED và hoa hồng = 0',
      selfAttr?.is_self_referral === true && Number(selfAttr?.estimated_commission) === 0 && selfAttr?.status === 'FLAGGED',
      `is_self_referral: ${selfAttr?.is_self_referral}, commission: ${selfAttr?.estimated_commission}, status: ${selfAttr?.status}`
    );

    // -------------------------------------------------------------------------
    // BƯỚC 7: KIỂM THỬ BÁO CÁO DOANH THU & GIÁ VỐN (REVENUE, COST & PROFIT)
    // -------------------------------------------------------------------------
    console.log('\n📊 [BƯỚC 7] Kiểm thử Báo Cáo Doanh Thu, Giá Vốn & Lợi Nhuận...');

    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: superCookie },
    });
    const statsData = await statsRes.json();
    recordTest(
      'API Thống kê Tổng quan (GET /api/admin/stats)',
      statsRes.status === 200 && Boolean(statsData.summary),
      `Total orders: ${statsData.summary?.total_orders}, Total revenue: ${statsData.summary?.total_revenue}`
    );

    const reportsRes = await fetch(`${BASE_URL}/api/admin/reports/profit`, {
      headers: { Cookie: superCookie },
    });
    const reportsData = await reportsRes.json();
    recordTest(
      'API Báo cáo Doanh thu, Giá vốn & Lợi nhuận (GET /api/admin/reports/profit)',
      reportsRes.status === 200 && reportsData.success === true,
      `Revenue: ${reportsData.summary?.total_revenue || 0}, Cost: ${reportsData.summary?.total_cost || 0}, Profit: ${reportsData.summary?.gross_profit || 0}`
    );

    // -------------------------------------------------------------------------
    // BƯỚC 8: DỌN DẸP RESERVATION HẾT HẠN (CRON CLEANUP)
    // -------------------------------------------------------------------------
    console.log('\n🧹 [BƯỚC 8] Kiểm thử Cơ Chế Dọn Dẹp Reservation Hết Hạn (Cron Cleanup)...');

    // Tạo 1 reservation giả lập đã hết hạn (expires_at trong quá khứ)
    const expiredOrderId = `ord_expired_${runId}`;
    await client.query(`
      INSERT INTO orders (id, order_code, full_name, phone, province, district, ward, address, status, store_code, subtotal, total)
      VALUES ($1, $2, 'Khách Quá Hạn', $3, 'Hồ Chí Minh', 'Tân Phú', 'Tây Thạnh', '123 Đường Cũ', 'PENDING', $4, 30000, 30000);
    `, [expiredOrderId, `EXP-${runId}`, getPhone(9), STORE_TEST]);

    await client.query(`
      INSERT INTO stock_reservations (id, order_id, store_code, product_id, quantity, status, expires_at)
      VALUES ($1, $2, $3, $4, 5, 'active', CURRENT_TIMESTAMP - INTERVAL '2 hours');
    `, [`res_exp_${runId}`, expiredOrderId, STORE_TEST, TEST_PROD_ID]);

    // Tăng reserved thêm 5
    await client.query(`
      UPDATE store_inventory SET reserved = reserved + 5 WHERE store_code = $1 AND product_id = $2;
    `, [STORE_TEST, TEST_PROD_ID]);

    // Gọi API cron cleanup
    const cronSecret = process.env.CRON_SECRET || 'staging_test_cron_secret_1234567890';
    const cronRes = await fetch(`${BASE_URL}/api/cron/cleanup-reservations`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const cronData = await cronRes.json();
    recordTest(
      'API Dọn dẹp Cron Cleanup chạy thành công',
      cronRes.status === 200 && cronData.success === true,
      `Status: ${cronRes.status}, Released: ${cronData.releasedReservationsCount || 0}`
    );

    // Kiểm tra reservation quá hạn đã chuyển sang expired / released
    const expiredCheck = await client.query(
      `SELECT status FROM stock_reservations WHERE id = $1;`,
      [`res_exp_${runId}`]
    );
    recordTest(
      'Reservation quá hạn được chuyển trạng thái khỏi active',
      expiredCheck.rows[0]?.status !== 'active',
      `Trạng thái sau cleanup: ${expiredCheck.rows[0]?.status}`
    );

    // -------------------------------------------------------------------------
    // DỌN DẸP DỮ LIỆU TEST
    // -------------------------------------------------------------------------
    console.log('\n🧹 Dọn dẹp dữ liệu kiểm thử test...');
    await client.query(`DELETE FROM stock_reservations WHERE order_id LIKE 'ord_%' AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour';`);
    await client.query(`DELETE FROM order_items WHERE order_id LIKE 'ord_%' AND order_id NOT IN (SELECT id FROM orders);`);
    await client.query(`DELETE FROM inventory_lots WHERE lot_code LIKE 'LOT-QA-%';`);
    await client.query(`DELETE FROM partner_profiles WHERE id LIKE 'part_qa_%';`);
    await client.query(`DELETE FROM users WHERE id LIKE 'usr_part_%';`);
    console.log('✅ Đã dọn dẹp các bản ghi test tạm thời.');

  } catch (err) {
    console.error('💥 Lỗi không mong muốn trong quá trình chạy test:', err);
    recordTest('Toàn bộ quy trình kiểm thử hoàn tất không có ngoại lệ nghiêm trọng', false, err.message);
  } finally {
    client.release();
    await pool.end();
  }

  // TỔNG KẾT
  console.log('\n========================================================================');
  console.log('🏁 BÁO CÁO TỔNG KẾT KẾT QUẢ KIỂM THỬ:');
  console.log(`   Tổng số ca kiểm thử: ${results.passed + results.failed}`);
  console.log(`   ✅ Số ca ĐẠT (PASS): ${results.passed}`);
  console.log(`   ❌ Số ca LỖI (FAIL): ${results.failed}`);
  console.log('========================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runComprehensiveTests();
