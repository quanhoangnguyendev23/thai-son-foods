import fetch from 'node-fetch';
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

const BASE_URL = 'http://localhost:3000';
const DB_URL = requireDatabaseUrl();
const pool = new pg.Pool({ connectionString: DB_URL });

async function audit() {
  const auditReport = {
    sitemap: [],
    clientTests: [],
    securityTests: [],
    logicTests: [],
    seoTests: [],
  };

  console.log('--- 1. CRAWL SITEMAP & PUBLIC ROUTES ---');
  const publicRoutes = [
    '/',
    '/san-pham',
    '/san-pham/sua-bap-nep-thai-son',
    '/gio-hang',
    '/thanh-toan',
    '/tra-cuu-don-hang',
    '/gioi-thieu',
    '/lien-he',
    '/tin-tuc',
    '/chinh-sach-doi-tra',
    '/chinh-sach-giao-hang',
    '/chinh-sach-bao-mat',
    '/dieu-khoan-su-dung',
    '/doi-tac',
    '/dang-ky-doi-tac',
    '/tai-khoan',
    '/admin',
    '/admin/login',
    '/khong-ton-tai-404-check',
  ];

  for (const path of publicRoutes) {
    try {
      const res = await fetch(`${BASE_URL}${path}`);
      const text = await res.text();
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Không có title';
      auditReport.sitemap.push({
        path,
        status: res.status,
        title,
        contentLength: text.length,
        has404Text: text.includes('404') || text.includes('Không tìm thấy') || text.includes('not found'),
      });
      console.log(`Path: ${path} | Status: ${res.status} | Title: ${title}`);
    } catch (err) {
      auditReport.sitemap.push({ path, status: 'ERROR', error: err.message });
      console.log(`Path: ${path} | ERROR: ${err.message}`);
    }
  }

  console.log('\n--- 2. TEST TÌM KIẾM SẢN PHẨM ---');
  const searchQueries = [
    'sữa bắp',
    'sua bap',
    'SỮA BẮP',
    '  sữa   bắp  ',
    'nem chua', // Không có kết quả
    '<script>alert(1)</script>',
    "' OR 1=1 --",
  ];

  for (const q of searchQueries) {
    try {
      const res = await fetch(`${BASE_URL}/api/products?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : (data.data?.length || 0);
      auditReport.clientTests.push({
        type: 'search',
        query: q,
        status: res.status,
        resultCount: count,
      });
      console.log(`Search: "${q}" -> Status: ${res.status}, Count: ${count}`);
    } catch (err) {
      console.log(`Search error for "${q}":`, err.message);
    }
  }

  console.log('\n--- 3. TEST SECURITY: TAMPERING GIÁ & PHÍ SHIP KHI CHECKOUT ---');
  try {
    const tamperPayload = {
      fullName: 'TEST_Hacker Client Tamper',
      phone: '0909999991',
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      address: '472 Lê Trọng Tấn, Tây Thạnh',
      paymentMethod: 'cod',
      storeCode: 'NH',
      subtotal: 100, // Cố tình sửa giá tổng còn 100đ
      total: 100,    // Cố tình sửa giá tổng còn 100đ
      shippingFee: 0,
      items: [
        {
          productId: 'prod-sb-01',
          name: 'Sữa Bắp Nếp Thái Sơn 330ml',
          price: 1, // Cố tình sửa đơn giá về 1đ
          quantity: 2,
          unit: 'chai',
        },
      ],
    };

    const tamperRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(tamperPayload),
    });
    const tamperData = await tamperRes.json();
    console.log('Tamper order result status:', tamperRes.status);

    if (tamperRes.status === 200 && tamperData.orderId) {
      // Kiểm tra DB xem giá lưu trong DB là bao nhiêu
      const checkDb = await pool.query('SELECT subtotal, total, shipping_fee FROM orders WHERE id = $1', [tamperData.orderId]);
      const checkItems = await pool.query('SELECT price FROM order_items WHERE order_id = $1', [tamperData.orderId]);
      const row = checkDb.rows[0];
      const itemRow = checkItems.rows[0];
      console.log(`Tamper check in DB: Subtotal=${row.subtotal}, Total=${row.total}, ItemPrice=${itemRow.price}`);
      auditReport.securityTests.push({
        test: 'Price Tampering Prevention',
        clientSentPrice: 1,
        serverSavedPrice: itemRow.price,
        clientSentTotal: 100,
        serverSavedTotal: row.total,
        isTamperProtected: Number(row.subtotal) > 100 && Number(itemRow.price) > 1,
      });

      // Dọn dẹp
      await pool.query('DELETE FROM stock_reservations WHERE order_id = $1', [tamperData.orderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [tamperData.orderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [tamperData.orderId]);
    }
  } catch (err) {
    console.error('Tamper test error:', err);
  }

  console.log('\n--- 4. TEST SECURITY: SQL INJECTION VÀO CÁC FORM & APIS ---');
  const sqliPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE test; --",
    "1 UNION SELECT 1,2,3,4,5--",
  ];

  for (const sqli of sqliPayloads) {
    // 4.1 SQLi qua API orders tracking
    const trackRes = await fetch(`${BASE_URL}/api/orders?code=${encodeURIComponent(sqli)}`);
    const trackData = await trackRes.json().catch(() => ({}));
    console.log(`Tracking with SQLi "${sqli}": Status ${trackRes.status}`);

    // 4.2 SQLi qua Login identifier
    const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ identifier: sqli, password: 'password123' }),
    });
    const loginData = await loginRes.json().catch(() => ({}));
    console.log(`Login with SQLi "${sqli}": Status ${loginRes.status}, error: ${loginData.error}`);

    auditReport.securityTests.push({
      test: 'SQL Injection attempt',
      payload: sqli,
      trackingStatus: trackRes.status,
      loginStatus: loginRes.status,
      loginBypassed: loginRes.status === 200,
    });
  }

  console.log('\n--- 5. TEST SECURITY: XSS INJECTION TRONG ĐẶT HÀNG & REVIEWS ---');
  const xssString = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
  try {
    const xssOrderPayload = {
      fullName: xssString,
      phone: '0909999992',
      province: 'Hồ Chí Minh',
      district: 'Tân Phú',
      ward: 'Tây Thạnh',
      address: `472 Lê Trọng Tấn ${xssString}`,
      note: xssString,
      paymentMethod: 'cod',
      storeCode: 'NH',
      items: [{ productId: 'prod-sb-01', name: 'Sữa Bắp Nếp', price: 15000, quantity: 1, unit: 'chai' }],
    };

    const xssOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify(xssOrderPayload),
    });
    const xssOrderData = await xssOrderRes.json();
    console.log('XSS Order status:', xssOrderRes.status);

    if (xssOrderRes.status === 200 && xssOrderData.orderId) {
      const checkXss = await pool.query('SELECT full_name, address, note FROM orders WHERE id = $1', [xssOrderData.orderId]);
      console.log('Saved in DB:', checkXss.rows[0]);
      auditReport.securityTests.push({
        test: 'Stored XSS in Order Form',
        orderId: xssOrderData.orderId,
        savedValues: checkXss.rows[0],
      });

      // Dọn dẹp
      await pool.query('DELETE FROM stock_reservations WHERE order_id = $1', [xssOrderData.orderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [xssOrderData.orderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [xssOrderData.orderId]);
    }
  } catch (err) {
    console.error('XSS test error:', err);
  }

  console.log('\n--- 6. TEST SEO, HEADERS & SECURITY HEADERS ---');
  try {
    const homeRes = await fetch(BASE_URL);
    const headers = Object.fromEntries(homeRes.headers.entries());
    console.log('Security Headers on Home:');
    console.log(' - X-Content-Type-Options:', headers['x-content-type-options'] || 'THIẾU');
    console.log(' - X-Frame-Options:', headers['x-frame-options'] || 'THIẾU');
    console.log(' - Content-Security-Policy:', headers['content-security-policy'] || 'THIẾU');
    console.log(' - Strict-Transport-Security:', headers['strict-transport-security'] || 'THIẾU (HTTP localhost)');
    console.log(' - X-Powered-By:', headers['x-powered-by'] || 'Ẩn tốt');

    const html = await homeRes.text();
    const hasCanonical = html.includes('rel="canonical"');
    const hasOgTitle = html.includes('property="og:title"');
    const hasOgImage = html.includes('property="og:image"');
    const hasMetaDesc = html.includes('name="description"');
    const hasJsonLd = html.includes('application/ld+json');

    auditReport.seoTests.push({
      hasCanonical,
      hasOgTitle,
      hasOgImage,
      hasMetaDesc,
      hasJsonLd,
      securityHeaders: {
        xContentTypeOptions: headers['x-content-type-options'] || null,
        xFrameOptions: headers['x-frame-options'] || null,
        csp: headers['content-security-policy'] || null,
        xPoweredBy: headers['x-powered-by'] || null,
      },
    });
    console.log(`SEO tags: MetaDesc=${hasMetaDesc}, OgTitle=${hasOgTitle}, OgImage=${hasOgImage}, Canonical=${hasCanonical}, JsonLd=${hasJsonLd}`);
  } catch (err) {
    console.error('SEO test error:', err);
  }

  console.log('\n--- 7. KIỂM TRA ĐẶC THÙ UPLOAD ẢNH & STATIC ASSETS TRÊN VERCEL ---');
  try {
    // Kiểm tra cấu hình upload ảnh
    const uploadApiRes = await fetch(`${BASE_URL}/api/admin/upload`, {
      method: 'POST',
    });
    console.log('POST /api/admin/upload status without auth:', uploadApiRes.status);
    auditReport.securityTests.push({
      test: 'Unauthenticated Image Upload Check',
      status: uploadApiRes.status,
      blocked: uploadApiRes.status === 401 || uploadApiRes.status === 403,
    });
  } catch (err) {
    console.log('Upload check:', err.message);
  }

  await pool.end();
  return auditReport;
}

audit().then((r) => {
  console.log('\n✅ HOÀN TẤT THU THẬP DỮ LIỆU AUDIT.');
}).catch(console.error);
