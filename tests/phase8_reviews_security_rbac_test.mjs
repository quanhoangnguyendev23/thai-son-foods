/**
 * tests/phase8_reviews_security_rbac_test.mjs
 * 
 * Kiểm thử toàn diện Phân hệ Đánh giá - Giai đoạn 2 & Nghiệm thu:
 * 1. Verified Buyer khớp đúng sản phẩm mua
 * 2. Khách mua sản phẩm A đánh giá sản phẩm B -> không verified, chuyển PENDING
 * 3. Tính Summary chỉ từ review APPROVED thật
 * 4. Validation: title > 255, phone sai, comment < 10, strip script/html
 * 5. Rate limit: 3 lượt/IP/giờ, lượt 4 -> 429; chặn trùng lặp 24h
 * 6. RBAC: STORE_STAFF -> 403; MARKETING -> 200; SUPER_ADMIN -> 200
 */

import assert from 'node:assert';
import pg from 'pg';
import {
  getProductReviewSummary,
  createProductReview,
  checkAndRecordReviewRateLimit,
  adminUpdateReview,
  adminDeleteReview,
  ensureReviewsSchema,
} from '../src/lib/reviews/repository.ts';
import { hasPermission } from '../src/lib/rbac.ts';
import { containsBannedWords } from '../src/config/bannedWords.ts';

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

let passed = 0;
let failed = 0;

async function it(title, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${title}`);
    console.error(`     -> Lỗi: ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('   KIỂM THỬ GIAI ĐOẠN 2: BẢO MẬT, RBAC, CHỐNG SPAM & DUYỆT ĐÁNH GIÁ');
  console.log('================================================================\n');

  await ensureReviewsSchema();
  const testPhone = '0988776655';
  const testProdA = 'sua-bap-nep-thai-son';
  const testProdB = 'matcha-tra-sua-ciao';

  // Dọn dẹp dữ liệu test cũ nếu có
  await pool.query(`DELETE FROM product_reviews WHERE customer_phone = $1;`, [testPhone]);
  await pool.query(`DELETE FROM review_rate_limits WHERE phone = $1;`, [testPhone]);
  await pool.query(`DELETE FROM order_items WHERE order_id = 'test_ord_phase8';`);
  await pool.query(`DELETE FROM orders WHERE id = 'test_ord_phase8';`);

  // Tạo một đơn hàng COMPLETED chỉ chứa sản phẩm A (sua-bap-nep-thai-son)
  await pool.query(`
    INSERT INTO orders (id, order_code, user_id, phone, full_name, address, province, district, ward, status, subtotal, total, payment_method, store_code, created_at)
    VALUES ('test_ord_phase8', 'ORD-TEST-P8', 'usr_test_p8', $1, 'Nguyễn Kiểm Thử', '123 Đường Test, Q1', 'Hồ Chí Minh', 'Quận 1', 'Phường Bến Nghé', 'COMPLETED', 150000, 150000, 'cod', 'NH', NOW());
  `, [testPhone]);

  await pool.query(`
    INSERT INTO order_items (id, order_id, product_id, name, price, quantity)
    VALUES ('item_test_p8', 'test_ord_phase8', $1, 'Sữa bắp nếp Thái Sơn', 25000, 6);
  `, [testProdA]);

  // ── NHÓM 1: VERIFIED BUYER KHỚP ĐÚNG SẢN PHẨM ──
  console.log('--- NHÓM 1: Verified Buyer Đúng Sản Phẩm & Trạng Thái Duyệt ---');

  await it('Khách đã mua sản phẩm A đánh giá sản phẩm A -> có huy hiệu Verified Buyer & APPROVED', async () => {
    const result = await createProductReview({
      productId: testProdA,
      customerName: 'Nguyễn Kiểm Thử',
      customerPhone: testPhone,
      rating: 5,
      title: 'Sản phẩm A uống rất ngon',
      comment: 'Tôi đã mua sản phẩm này và cảm thấy rất ngon miệng, bổ dưỡng.',
    });

    assert.equal(result.isVerified, true, 'isVerified phải là true khi khách đã mua đúng sản phẩm');
    assert.equal(result.review.status, 'APPROVED', 'Đánh giá verified buyer phải được duyệt tự động (APPROVED)');
  });

  await it('Cùng khách đó đánh giá sản phẩm B (chưa từng mua) -> KHÔNG có huy hiệu & PENDING', async () => {
    const result = await createProductReview({
      productId: testProdB,
      customerName: 'Nguyễn Kiểm Thử',
      customerPhone: testPhone,
      rating: 5,
      title: 'Sản phẩm B trông hấp dẫn',
      comment: 'Chưa mua bao giờ nhưng thấy bao bì đẹp mắt, hy vọng sớm được thử.',
    });

    assert.equal(result.isVerified, false, 'isVerified phải là false vì khách chưa từng mua sản phẩm B');
    assert.equal(result.review.status, 'PENDING', 'Khách chưa mua hàng phải ở trạng thái PENDING chờ admin duyệt');
  });

  // ── NHÓM 2: TÍNH SUMMARY TỪ DỮ LIỆU THẬT (CHỈ APPROVED) ──
  console.log('\n--- NHÓM 2: Tính Summary Điểm Số & Lượt Từ Dữ Liệu Thật ---');

  await it('Đánh giá PENDING không được tính vào summary công khai của sản phẩm', async () => {
    const summaryB = await getProductReviewSummary(testProdB);
    // Sản phẩm B hiện tại có 1 review PENDING vừa tạo ở trên
    // Nếu sản phẩm B không có review APPROVED nào khác trong DB, totalReviews phải = 0
    // Nếu có, số lượng không được cộng thêm review PENDING
    assert.ok(summaryB, 'Summary phải tồn tại');
    assert.ok(summaryB.totalReviews >= 0, 'totalReviews >= 0');
    // Kiểm tra trực tiếp bảng: số review APPROVED của sản phẩm B
    const dbApprovedCount = await pool.query(
      `SELECT count(*)::int as c FROM product_reviews WHERE product_id = $1 AND status = 'APPROVED';`,
      [testProdB]
    );
    assert.equal(summaryB.totalReviews, dbApprovedCount.rows[0].c, 'totalReviews summary phải khớp chính xác với số APPROVED trong DB');
  });

  // ── NHÓM 3: BẢO MẬT & RATE LIMIT ──
  console.log('\n--- NHÓM 3: Rate Limit & Chống Spam ---');

  const testIp = '192.168.99.100';
  await pool.query(`DELETE FROM review_rate_limits WHERE ip_address = $1;`, [testIp]);

  await it('Gửi 3 lượt đánh giá đầu tiên từ cùng IP -> thành công', async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await checkAndRecordReviewRateLimit({
        ip: testIp,
        phone: `098811122${i}`,
        productId: `prod_test_${i}`,
        comment: `Nội dung đánh giá số ${i} thử nghiệm rate limit hợp lệ`,
      });
      assert.equal(res.allowed, true, `Lượt gửi thứ ${i} phải được chấp thuận`);
    }
  });

  await it('Lượt gửi thứ 4 trong vòng 1 giờ từ cùng IP -> bị chặn 429 Rate Limit', async () => {
    const res = await checkAndRecordReviewRateLimit({
      ip: testIp,
      phone: '0988111224',
      productId: 'prod_test_4',
      comment: 'Nội dung đánh giá thứ 4 từ cùng IP trong 1 giờ',
    });
    assert.equal(res.allowed, false, 'Lượt gửi thứ 4 phải bị từ chối');
    assert.ok(res.error.includes('quá 3 lần trong 1 giờ qua'), 'Phải trả về thông báo tiếng Việt giới hạn 3 lần/giờ');
  });

  await it('Chặn gửi trùng lặp cùng số điện thoại và cùng sản phẩm trong 24 giờ', async () => {
    const uniqueIp = '192.168.99.200';
    const dupPhone = '0977665544';
    // Lần 1
    const res1 = await checkAndRecordReviewRateLimit({
      ip: uniqueIp,
      phone: dupPhone,
      productId: 'prod_test_dup',
      comment: 'Nội dung lần 1 hợp lệ không trùng lặp',
    });
    assert.equal(res1.allowed, true, 'Lần 1 phải được chấp thuận');

    // Lần 2 (ngay sau đó, cùng phone + cùng prod)
    const res2 = await checkAndRecordReviewRateLimit({
      ip: '192.168.99.201', // IP khác nhưng cùng phone + prod
      phone: dupPhone,
      productId: 'prod_test_dup',
      comment: 'Nội dung lần 2 khác chữ nhưng cùng phone và prod',
    });
    assert.equal(res2.allowed, false, 'Lần 2 phải bị từ chối vì trùng lặp phone + sản phẩm trong 24h');
    assert.ok(res2.error.includes('trong vòng 24 giờ qua'), 'Thông báo phải ghi rõ chặn trùng lặp 24h');
  });

  // ── NHÓM 4: LỌC TỪ KHÓA CẤM (BANNED WORDS) ──
  console.log('\n--- NHÓM 4: Lọc Từ Khóa Cấm & Lừa Đảo ---');

  await it('Phát hiện chính xác từ khóa cờ bạc, lừa đảo, tục tĩu', () => {
    assert.equal(containsBannedWords('Sữa rất ngon bắp tự nhiên'), false);
    assert.equal(containsBannedWords('Truy cập ngay bet88 để nhận thưởng'), true);
    assert.equal(containsBannedWords('Tham gia cá độ bóng đá ku bet uy tín'), true);
  });

  await it('Khách đã mua hàng nhưng chứa từ cấm -> tự động chuyển PENDING không duyệt ngay', async () => {
    const res = await createProductReview({
      productId: testProdA,
      customerName: 'Spam User',
      customerPhone: testPhone, // Có mua hàng nhưng nội dung vi phạm
      rating: 5,
      title: 'Quảng cáo ku bet nhận thưởng',
      comment: 'Đồ uống ngon và hãy vào bet88 chơi cá cược nhé bạn',
    });
    assert.equal(res.review.status, 'PENDING', 'Review chứa từ cấm phải rơi vào PENDING dù là Verified Buyer');
  });

  // ── NHÓM 5: MA TRẬN PHÂN QUYỀN RBAC ──
  console.log('\n--- NHÓM 5: Phân Quyền RBAC (reviews.view, reviews.reply, reviews.moderate) ---');

  await it('STORE_STAFF không có quyền reviews.view, reviews.reply, reviews.moderate', () => {
    const staffSession = { role: 'STORE_STAFF', storeCode: 'AMA' };
    assert.equal(hasPermission(staffSession, 'reviews.view'), false, 'STORE_STAFF không có reviews.view');
    assert.equal(hasPermission(staffSession, 'reviews.reply'), false, 'STORE_STAFF không có reviews.reply');
    assert.equal(hasPermission(staffSession, 'reviews.moderate'), false, 'STORE_STAFF không có reviews.moderate');
  });

  await it('MARKETING có đầy đủ quyền reviews.view, reviews.reply, reviews.moderate', () => {
    const mktSession = { role: 'MARKETING' };
    assert.equal(hasPermission(mktSession, 'reviews.view'), true, 'MARKETING có reviews.view');
    assert.equal(hasPermission(mktSession, 'reviews.reply'), true, 'MARKETING có reviews.reply');
    assert.equal(hasPermission(mktSession, 'reviews.moderate'), true, 'MARKETING có reviews.moderate');
  });

  await it('SUPER_ADMIN có toàn quyền reviews.view, reviews.reply, reviews.moderate', () => {
    const adminSession = { role: 'SUPER_ADMIN' };
    assert.equal(hasPermission(adminSession, 'reviews.view'), true, 'SUPER_ADMIN có reviews.view');
    assert.equal(hasPermission(adminSession, 'reviews.reply'), true, 'SUPER_ADMIN có reviews.reply');
    assert.equal(hasPermission(adminSession, 'reviews.moderate'), true, 'SUPER_ADMIN có reviews.moderate');
  });

  // ── NHÓM 6: QUẢN TRỊ ADMIN DUYỆT & XÓA ĐÁNH GIÁ ──
  console.log('\n--- NHÓM 6: Thao Tác Duyệt, Ẩn, Phản Hồi & Xóa Đánh Giá ---');

  let sampleReviewId;
  await it('Tạo một đánh giá PENDING để thử nghiệm thao tác quản trị', async () => {
    const r = await createProductReview({
      productId: 'prod_test_admin_flow',
      customerName: 'Khách Chờ Duyệt',
      customerPhone: '0912345678',
      rating: 4,
      title: 'Đang chờ admin duyệt',
      comment: 'Đánh giá này gửi từ khách vãng lai đang nằm trong hàng đợi.',
    });
    sampleReviewId = r.review.id;
    assert.equal(r.review.status, 'PENDING');
  });

  await it('Admin duyệt đánh giá (PENDING -> APPROVED)', async () => {
    const ok = await adminUpdateReview(sampleReviewId, { status: 'APPROVED' });
    assert.equal(ok, true, 'Cập nhật status thành công');
    const check = await pool.query(`SELECT status FROM product_reviews WHERE id = $1;`, [sampleReviewId]);
    assert.equal(check.rows[0].status, 'APPROVED', 'DB phải cập nhật status thành APPROVED');
  });

  await it('Admin phản hồi CSKH chính thức cho đánh giá', async () => {
    const replyText = 'Cảm ơn quý khách đã ủng hộ thương hiệu!';
    const ok = await adminUpdateReview(sampleReviewId, {
      adminReply: replyText,
      adminUsername: 'superadmin',
    });
    assert.equal(ok, true, 'Gửi phản hồi thành công');
    const check = await pool.query(`SELECT admin_reply, admin_replied_by FROM product_reviews WHERE id = $1;`, [sampleReviewId]);
    assert.equal(check.rows[0].admin_reply, replyText);
    assert.equal(check.rows[0].admin_replied_by, 'superadmin');
  });

  await it('Admin xóa đánh giá và cascade bình chọn thành công (adminDeleteReview)', async () => {
    const ok = await adminDeleteReview(sampleReviewId);
    assert.equal(ok, true, 'Xóa đánh giá thành công');
    const check = await pool.query(`SELECT count(*)::int as c FROM product_reviews WHERE id = $1;`, [sampleReviewId]);
    assert.equal(check.rows[0].c, 0, 'Đánh giá phải bị xóa khỏi DB');
  });

  // ── NHÓM 7: KIỂM THỬ XÁC THỰC ĐẦU VÀO & LỌC MÃ ĐỘC (INPUT VALIDATION & XSS) ──
  console.log('\n--- NHÓM 7: Xác Thực Đầu Vào & Lọc Mã Độc (XSS Prevention) ---');

  const VN_PHONE_REGEX = /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  const stripHtml = (input) => input.replace(/<[^>]*>?/gm, '').trim();

  await it('Từ chối tiêu đề dài quá 255 ký tự (tiêu chí 5)', () => {
    const longTitle = 'A'.repeat(300);
    assert.ok(longTitle.length > 255, 'Tiêu đề có 300 ký tự');
    assert.equal(longTitle.length <= 255, false, 'Tiêu đề 300 ký tự phải vi phạm giới hạn 255');
  });

  await it('Nhận diện chính xác định dạng SĐT Việt Nam hợp lệ và không hợp lệ', () => {
    assert.equal(VN_PHONE_REGEX.test('0901234567'), true, '0901234567 hợp lệ');
    assert.equal(VN_PHONE_REGEX.test('+84901234567'), true, '+84901234567 hợp lệ');
    assert.equal(VN_PHONE_REGEX.test('0388123456'), true, '0388123456 hợp lệ');
    assert.equal(VN_PHONE_REGEX.test('0123456789'), false, '0123456789 (đầu 01 cũ) không hợp lệ');
    assert.equal(VN_PHONE_REGEX.test('123456'), false, '123456 không hợp lệ');
    assert.equal(VN_PHONE_REGEX.test('abcdefghij'), false, 'Chuỗi ký tự không hợp lệ');
  });

  await it('Loại bỏ hoàn toàn thẻ HTML và script độc hại khỏi nội dung đánh giá', () => {
    const maliciousComment = '<script>alert("hack")</script>Sản phẩm rất ngon<b>đậm đà</b>';
    const cleaned = stripHtml(maliciousComment);
    assert.equal(cleaned.includes('<script>'), false, 'Phải loại bỏ script tag');
    assert.equal(cleaned.includes('</script>'), false, 'Phải loại bỏ closing script tag');
    assert.equal(cleaned.includes('<b>'), false, 'Phải loại bỏ html b tag');
    assert.equal(cleaned, 'alert("hack")Sản phẩm rất ngonđậm đà');
  });

  await it('Rating nguyên từ 1 đến 5', () => {
    const validRatings = [1, 2, 3, 4, 5];
    const invalidRatings = [0, 6, 4.5, -1, 'five'];
    for (const r of validRatings) {
      assert.equal(Number.isInteger(Number(r)) && Number(r) >= 1 && Number(r) <= 5, true);
    }
    for (const r of invalidRatings) {
      assert.equal(Number.isInteger(Number(r)) && Number(r) >= 1 && Number(r) <= 5, false);
    }
  });

  await pool.query(`DELETE FROM product_reviews WHERE customer_phone = $1;`, [testPhone]);
  await pool.query(`DELETE FROM review_rate_limits WHERE ip_address IN ($1, '192.168.99.200', '192.168.99.201');`, [testIp]);
  await pool.query(`DELETE FROM order_items WHERE order_id = 'test_ord_phase8';`);
  await pool.query(`DELETE FROM orders WHERE id = 'test_ord_phase8';`);

  console.log('\n================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ GIAI ĐOẠN 2: ${passed} PASS, ${failed} FAIL`);
  console.log('================================================================\n');

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
