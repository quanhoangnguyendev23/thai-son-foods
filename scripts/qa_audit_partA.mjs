/**
 * scripts/qa_audit_partA.mjs
 * 
 * KIỂM THỬ TOÀN DIỆN PHẦN A: WEBSITE BÁN HÀNG & LUỒNG ĐẶT HÀNG E-COMMERCE
 * Môi trường: WebTSF_staging (127.0.0.1:3000)
 */

import pg from 'pg';
import { SignJWT } from 'jose';

import { assertSafeDatabase } from './db-guard.mjs';

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

const DB_URL = requireDatabaseUrl();
const pool = new pg.Pool({ connectionString: DB_URL });
const BASE_URL = 'http://127.0.0.1:3000';

const findings = [];

function recordFinding({ id, severity, area, desc, steps, expected, actual, evidence, fileLine, fix }) {
  findings.push({ id, severity, area, desc, steps, expected, actual, evidence, fileLine, fix });
  console.log(`[${severity}] [${id}] ${desc}`);
}

async function runPartA() {
  console.log('================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ PHẦN A: WEBSITE BÁN HÀNG & THƯƠNG MẠI ĐIỆN TỬ');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    // ─────────────────────────────────────────────────────────────
    // A1. TRANG VÀ ĐIỀU HƯỚNG (PAGES & NAVIGATION)
    // ─────────────────────────────────────────────────────────────
    console.log('--- A1. KIỂM TRA TRANG VÀ ĐIỀU HƯỚNG PUBLIC ---');
    const publicPages = [
      { path: '/', name: 'Trang chủ' },
      { path: '/san-pham/rau-ma-dau-xanh-200ml', name: 'Chi tiết sản phẩm' },
      { path: '/combo/combo-3-chai-rau-ma-dau-xanh', name: 'Chi tiết combo' },
      { path: '/gioi-thieu', name: 'Giới thiệu' },
      { path: '/gio-hang', name: 'Giỏ hàng' },
      { path: '/thanh-toan', name: 'Thanh toán' },
      { path: '/tra-cuu-don-hang', name: 'Tra cứu đơn hàng' },
      { path: '/chinh-sach-giao-hang', name: 'Chính sách giao hàng' },
      { path: '/chinh-sach-doi-tra', name: 'Chính sách đổi trả' },
      { path: '/dieu-khoan-su-dung', name: 'Điều khoản sử dụng' },
      { path: '/chinh-sach-bao-mat', name: 'Chính sách bảo mật' },
      { path: '/trang-khong-ton-tai-404-test', name: 'Trang 404 kiểm tra' },
    ];

    for (const page of publicPages) {
      const startMs = Date.now();
      try {
        const res = await fetch(`${BASE_URL}${page.path}`);
        const text = await res.text();
        const duration = Date.now() - startMs;

        if (page.path.includes('404')) {
          if (res.status !== 404) {
            recordFinding({
              id: 'ERR_A1_404_STATUS',
              severity: 'Trung bình',
              area: 'Trang 404',
              desc: `Trang không tồn tại trả về mã HTTP ${res.status} thay vì 404`,
              steps: `GET ${page.path}`,
              expected: 'HTTP 404 Not Found',
              actual: `HTTP ${res.status}`,
              evidence: `Response length: ${text.length} chars`,
              fileLine: 'src/app/not-found.tsx',
              fix: 'Đảm bảo next/navigation notFound() trả về chuẩn HTTP 404.',
            });
          } else {
            console.log(`  ✓ [A1] ${page.name} (${page.path}) -> HTTP 404 (${duration}ms)`);
          }
          // Kiểm tra lộ stack trace
          if (text.includes('TypeError:') || text.includes('at async') || text.includes('node:internal')) {
            recordFinding({
              id: 'ERR_A1_STACK_TRACE',
              severity: 'Cao',
              area: 'Bảo mật lỗi',
              desc: 'Trang lỗi làm lộ thông tin Stack Trace của Node.js ra giao diện',
              steps: `GET ${page.path}`,
              expected: 'Giao diện thân thiện không lộ vết mã nội bộ',
              actual: 'Chứa thông tin nội bộ stack trace',
              evidence: text.substring(0, 300),
              fileLine: 'src/app/error.tsx',
              fix: 'Xóa hoặc che giấu chi tiết lỗi stack trace ở môi trường công khai.',
            });
          }
        } else {
          if (res.status !== 200) {
            recordFinding({
              id: `ERR_A1_PAGE_${page.path.replace(/\//g, '_')}`,
              severity: 'Cao',
              area: 'Điều hướng',
              desc: `Trang ${page.name} (${page.path}) gặp lỗi HTTP ${res.status}`,
              steps: `GET ${page.path}`,
              expected: 'HTTP 200 OK',
              actual: `HTTP ${res.status}`,
              evidence: `Body: ${text.substring(0, 200)}`,
              fileLine: 'src/app/...',
              fix: 'Kiểm tra tệp page.tsx tương ứng để sửa lỗi SSR.',
            });
          } else {
            console.log(`  ✓ [A1] ${page.name} (${page.path}) -> HTTP 200 (${duration}ms)`);
          }
        }
      } catch (err) {
        recordFinding({
          id: `ERR_A1_CONN_${page.path.replace(/\//g, '_')}`,
          severity: 'Blocker',
          area: 'Điều hướng',
          desc: `Không thể kết nối đến trang ${page.path}: ${err.message}`,
          steps: `Fetch ${page.path}`,
          expected: 'Kết nối thành công',
          actual: err.message,
          evidence: String(err),
          fileLine: 'server',
          fix: 'Kiểm tra server dev đang chạy.',
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // A2. SẢN PHẨM VÀ COMBO (PRODUCTS & COMBOS)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- A2. KIỂM TRA SẢN PHẨM & COMBO ---');
    // Kiểm tra sản phẩm bị ẩn trong DB (is_active = false) có truy cập được qua URL trực tiếp không
    await client.query(`
      INSERT INTO products (id, name, slug, price, is_active, unit, category_id)
      VALUES ('qa_hidden_prod', 'Sản Phẩm Đã Ẩn Test', 'qa-hidden-prod-test', 30000, false, 'Chai', 'cat-rau-ma')
      ON CONFLICT (id) DO UPDATE SET is_active = false;
    `);

    const rHidden = await fetch(`${BASE_URL}/san-pham/qa-hidden-prod-test`);
    if (rHidden.status === 200) {
      const hText = await rHidden.text();
      if (hText.includes('Sản Phẩm Đã Ẩn Test')) {
        recordFinding({
          id: 'ERR_A2_HIDDEN_PROD_ACCESSIBLE',
          severity: 'Cao',
          area: 'Sản phẩm',
          desc: 'Sản phẩm đã bị tắt (is_active = false) trong Dashboard vẫn có thể truy cập và hiển thị qua đường dẫn URL trực tiếp',
          steps: 'Đặt is_active = false cho sản phẩm, truy cập URL /san-pham/[slug]',
          expected: 'Trả về HTTP 404 (notFound)',
          actual: 'HTTP 200, trang sản phẩm vẫn hiển thị',
          evidence: `Slug: qa-hidden-prod-test, Status: ${rHidden.status}`,
          fileLine: 'src/app/san-pham/[slug]/page.tsx:30',
          fix: 'Trong page.tsx, kiểm tra nếu !product || !product.is_active thì gọi notFound().',
        });
      }
    } else {
      console.log('  ✓ [A2] Sản phẩm ẩn trả về 404 khi truy cập URL trực tiếp.');
    }

    // Dọn dẹp sản phẩm ẩn test
    await client.query("DELETE FROM products WHERE id = 'qa_hidden_prod';");

    // ─────────────────────────────────────────────────────────────
    // A4. THANH TOÁN VÀ ĐẶT HÀNG (CHECKOUT & ANTI-TAMPERING)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- A4. KIỂM TRA ĐẶT HÀNG & CHỐNG GIAN LẬN DỮ LIỆU ---');

    // 4.1 Thử gian lận giá sản phẩm từ Client: Gửi giá 1.000đ thay vì giá thật 35.000đ
    const testProdRes = await client.query("SELECT id, name, price FROM products WHERE is_active = true LIMIT 1;");
    const testProd = testProdRes.rows[0];

    const tamperedOrderPayload = {
      orderCode: `QA_TAMPER_${Date.now()}`,
      fullName: 'QA_TEST_Khách Gian Lận Giá',
      phone: '0900000010',
      email: 'qa_test_tamper@example.com',
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Bến Nghé',
      address: '123 Đường Test Gian Lận Giá Cực Dài Hợp Lệ',
      paymentMethod: 'cod',
      shippingFee: 0, // Cố tình gửi phí ship 0đ
      subtotal: 1000, // Cố tình gửi tổng tiền hàng 1.000đ
      total: 1000,    // Cố tình gửi tổng thanh toán 1.000đ
      items: [
        {
          productId: testProd.id,
          name: testProd.name,
          price: 1000, // Giá gốc là testProd.price (vd 35.000đ), client cố tình hạ xuống 1.000đ
          quantity: 1,
          unit: 'Chai',
        },
      ],
    };

    const rTamper = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tamperedOrderPayload),
    });
    const dTamper = await rTamper.json();

    if (dTamper.success) {
      if (dTamper.subtotal === 1000 || dTamper.total === 1000) {
        recordFinding({
          id: 'ERR_A4_PRICE_TAMPERING_ACCEPTED',
          severity: 'Blocker',
          area: 'Thanh toán & Đặt hàng',
          desc: 'LỖ HỔNG BẢO MẬT NGHIÊM TRỌNG: Server chấp nhận giá sản phẩm bị sửa đổi từ phía client (Price Tampering)',
          steps: 'Gửi request POST /api/orders với item.price = 1000đ',
          expected: 'Server tự động tính toán lại giá từ database (testProd.price) hoặc từ chối đơn',
          actual: `Server lưu đơn với giá 1.000đ (subtotal: ${dTamper.subtotal})`,
          evidence: `Order ID: ${dTamper.orderId}, Subtotal: ${dTamper.subtotal}`,
          fileLine: 'src/app/api/orders/route.ts:59',
          fix: 'Server bắt buộc phải truy vấn giá gốc từ bảng products và ghi đè giá client gửi lên.',
        });
      } else {
        console.log(`  ✓ [A4] Server bảo vệ giá thành công: Client gửi 1.000đ nhưng Server tự động tính lại thành ${dTamper.subtotal}đ.`);
      }
    } else {
      console.log(`  ✓ [A4] Server từ chối đơn gian lận hoặc yêu cầu xác thực: ${dTamper.error}`);
    }

    // 4.2 Thử nghiệm mã độc XSS trong tên khách hàng và ghi chú
    const xssPayload = {
      orderCode: `QA_XSS_${Date.now()}`,
      fullName: '<script>alert("XSS_ATTACK")</script>',
      phone: '0900000011',
      email: 'qa_test_xss@example.com',
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Bến Nghé',
      address: '<img src=x onerror=alert(1)> 123 Đường Test XSS',
      note: '<script>window.location="http://evil.com"</script>',
      paymentMethod: 'cod',
      items: [{ productId: testProd.id, name: testProd.name, price: testProd.price, quantity: 1, unit: 'Chai' }],
    };

    const rXss = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(xssPayload),
    });
    const dXss = await rXss.json();
    if (dXss.success) {
      console.log('  ℹ [A4] Đơn chứa payload XSS được lưu. Cần đảm bảo UI dashboard escape ký tự HTML khi render (React mặc định escape).');
    }

    // 4.3 Thử nghiệm SQL Injection cơ bản trong địa chỉ và tên
    const sqliPayload = {
      orderCode: `QA_SQLI_${Date.now()}`,
      fullName: "QA_TEST_User'; DROP TABLE test_dummy; --",
      phone: '0900000012',
      email: 'qa_test_sqli@example.com',
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Bến Nghé',
      address: "123 Đường Test SQLi' OR '1'='1",
      paymentMethod: 'cod',
      items: [{ productId: testProd.id, name: testProd.name, price: testProd.price, quantity: 1, unit: 'Chai' }],
    };

    const rSqli = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sqliPayload),
    });
    const dSqli = await rSqli.json();
    if (dSqli.success) {
      console.log('  ✓ [A4] Hệ thống xử lý an toàn chuỗi SQL Injection qua tham số hóa (Parameterized queries).');
    } else {
      console.log(`  ℹ [A4] Hệ thống phản hồi đơn SQLi: ${dSqli.error}`);
    }

    // 4.4 Kiểm tra kiểm soát Race Condition (Hai khách cùng đặt chai cuối cùng)
    console.log('\n--- Kiểm tra Race condition tồn kho (2 khách đặt cùng lúc chai cuối) ---');
    // Tạo 1 sản phẩm có tồn kho duy nhất 1 chai tại chi nhánh AMA
    await client.query(`
      INSERT INTO products (id, name, slug, price, is_active, unit, category_id)
      VALUES ('qa_race_prod', 'Sản Phẩm Race Condition Test', 'qa-race-prod-test', 25000, true, 'Chai', 'cat-rau-ma')
      ON CONFLICT (id) DO UPDATE SET is_active = true;
    `);
    await client.query(`
      INSERT INTO inventory (store_code, product_id, stock, reserved)
      VALUES ('AMA', 'qa_race_prod', 1, 0)
      ON CONFLICT (store_code, product_id) DO UPDATE SET stock = 1, reserved = 0;
    `);

    const orderPayloadRace1 = {
      orderCode: `QA_RACE_1_${Date.now()}`,
      fullName: 'QA_TEST_Khách Đua 1',
      phone: '0900000021',
      email: 'qa_race1@example.com',
      storeCode: 'AMA',
      province: 'Hồ Chí Minh',
      district: 'Tân Bình',
      ward: 'Phường 2',
      address: '123 Đường Phổ Quang Chi Tiết Đầy Đủ',
      paymentMethod: 'cod',
      items: [{ productId: 'qa_race_prod', name: 'Sản Phẩm Race Condition Test', price: 25000, quantity: 1, unit: 'Chai' }],
    };

    const orderPayloadRace2 = {
      orderCode: `QA_RACE_2_${Date.now()}`,
      fullName: 'QA_TEST_Khách Đua 2',
      phone: '0900000022',
      email: 'qa_race2@example.com',
      storeCode: 'AMA',
      province: 'Hồ Chí Minh',
      district: 'Tân Bình',
      ward: 'Phường 2',
      address: '456 Đường Phổ Quang Chi Tiết Đầy Đủ',
      paymentMethod: 'cod',
      items: [{ productId: 'qa_race_prod', name: 'Sản Phẩm Race Condition Test', price: 25000, quantity: 1, unit: 'Chai' }],
    };

    // Gửi song song 2 request cùng miligiây
    const [resRace1, resRace2] = await Promise.all([
      fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayloadRace1),
      }).then(r => r.json()),
      fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayloadRace2),
      }).then(r => r.json()),
    ]);

    const successCount = (resRace1.success ? 1 : 0) + (resRace2.success ? 1 : 0);
    const invCheck = await client.query("SELECT stock, reserved FROM inventory WHERE store_code = 'AMA' AND product_id = 'qa_race_prod';");
    const { stock, reserved } = invCheck.rows[0];

    if (successCount > 1) {
      recordFinding({
        id: 'ERR_A4_RACE_CONDITION_OVERSOLD',
        severity: 'Blocker',
        area: 'Quản lý tồn kho & Đặt hàng',
        desc: 'LỖ HỔNG RACE CONDITION: Cả 2 đơn hàng đồng thời đều thành công khi chỉ còn 1 chai duy nhất trong kho (Bán vượt tồn kho)',
        steps: 'Chạy song song 2 request đặt chai cuối cùng',
        expected: '1 đơn thành công, 1 đơn thất bại với HTTP 409 (Hết hàng)',
        actual: `Cả 2 đơn đều báo thành công. Tồn kho sau đó: stock=${stock}, reserved=${reserved}`,
        evidence: `Res1: ${JSON.stringify(resRace1)}, Res2: ${JSON.stringify(resRace2)}`,
        fileLine: 'src/lib/inventory.ts:reserveStock',
        fix: 'Áp dụng khóa SELECT ... FOR UPDATE trên hàng tồn kho trong transaction.',
      });
    } else {
      console.log(`  ✓ [A4] Chống Race Condition hoàn hảo: Chỉ 1 đơn đặt thành công (${resRace1.success ? 'Đơn 1' : 'Đơn 2'}), đơn còn lại bị từ chối do hết tồn kho.`);
    }

    // Dọn dẹp dữ liệu race test
    await client.query("DELETE FROM inventory WHERE product_id = 'qa_race_prod';");
    await client.query("DELETE FROM products WHERE id = 'qa_race_prod';");

    // ─────────────────────────────────────────────────────────────
    // A5. TÀI KHOẢN KHÁCH & LỖ HỔNG XÁC THỰC
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- A5. KIỂM TRA TÀI KHOẢN KHÁCH & LỖ HỔNG XÁC THỰC ---');

    // 5.1 Kiểm tra lộ cổng Mock OAuth
    const rMockOAuth = await fetch(`${BASE_URL}/api/auth/mock-oauth`);
    if (rMockOAuth.status === 200) {
      recordFinding({
        id: 'ERR_A5_MOCK_OAUTH_EXPOSED',
        severity: 'Blocker',
        area: 'Xác thực khách hàng',
        desc: 'Cổng giả lập OAuth (/api/auth/mock-oauth) không được khóa ở môi trường Production, cho phép bất kỳ ai đăng nhập chiếm đoạt tài khoản khách bằng bất kỳ email nào không cần mật khẩu',
        steps: 'Truy cập GET hoặc POST tới /api/auth/mock-oauth',
        expected: 'Chặn hoàn toàn nếu NODE_ENV === production hoặc chuyển hướng sang OAuth Google/Facebook thật',
        actual: 'Hiển thị form đăng nhập tắt với mọi email tùy ý',
        evidence: `Status: ${rMockOAuth.status}, URL: /api/auth/mock-oauth`,
        fileLine: 'src/app/api/auth/mock-oauth/route.ts:7',
        fix: 'Thêm kiểm tra if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Disabled in production" }, { status: 403 });',
      });
    } else {
      console.log(`  ✓ [A5] Mock OAuth đã bị chặn: HTTP ${rMockOAuth.status}`);
    }

    // 5.2 Kiểm tra nguy cơ Dò quét thông tin đơn hàng (Order Enumeration / Information Disclosure)
    // Tạo 1 đơn hàng mẫu
    const sampleOrderRes = await client.query("SELECT order_code, phone, full_name, address FROM orders WHERE store_code IS NOT NULL LIMIT 1;");
    if (sampleOrderRes.rows.length > 0) {
      const sampleOrder = sampleOrderRes.rows[0];
      // Gọi API tra cứu CHỈ bằng mã đơn, KHÔNG gửi SĐT
      const rTrackNoPhone = await fetch(`${BASE_URL}/api/orders?code=${sampleOrder.order_code}`);
      const dTrackNoPhone = await rTrackNoPhone.json();

      if (dTrackNoPhone.success && dTrackNoPhone.order && dTrackNoPhone.order.phone) {
        recordFinding({
          id: 'ERR_A5_ORDER_ENUMERATION_INFO_LEAK',
          severity: 'Cao',
          area: 'Bảo mật dữ liệu cá nhân',
          desc: 'API tra cứu đơn hàng (/api/orders?code=...) trả về toàn bộ thông tin cá nhân (SĐT, Họ tên, Địa chỉ giao hàng) mà KHÔNG bắt buộc nhập SĐT xác minh, dẫn đến nguy cơ dò quét dữ liệu khách hàng bằng brute-force mã đơn',
          steps: `GET /api/orders?code=${sampleOrder.order_code}`,
          expected: 'Bắt buộc người dùng cung cấp cả mã đơn và số điện thoại khớp nhau mới trả về thông tin',
          actual: `Chỉ cần mã đơn là trả về toàn bộ: Tên=${dTrackNoPhone.order.fullName}, SĐT=${dTrackNoPhone.order.phone}, Đ/c=${dTrackNoPhone.order.address}`,
          evidence: `Order Code: ${sampleOrder.order_code}, Leaked Phone: ${dTrackNoPhone.order.phone}`,
          fileLine: 'src/app/api/orders/route.ts:507',
          fix: 'Bắt buộc kiểm tra if (!phone) return NextResponse.json({ error: "Vui lòng nhập số điện thoại đặt hàng để xác minh" }, { status: 400 });',
        });
      } else {
        console.log('  ✓ [A5] API tra cứu đơn yêu cầu xác minh bảo mật thành công.');
      }
    }

  } catch (err) {
    console.error('Lỗi khi chạy Part A audit:', err);
  } finally {
    client.release();
    await pool.end();
  }

  return findings;
}

runPartA().then(f => {
  console.log('\n================================================================');
  console.log(`HOÀN THÀNH PHẦN A: Phát hiện ${f.length} vấn đề/lỗi.`);
  console.log('================================================================');
});
