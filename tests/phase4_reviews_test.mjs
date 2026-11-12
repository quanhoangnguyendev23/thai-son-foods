import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
const { Pool } = pg;

import {
  getProductReviews,
  getProductReviewSummary,
  createProductReview,
  voteHelpfulReview,
  adminUpdateReview,
  ensureReviewsSchema
} from '../src/lib/reviews/repository.ts';

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

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : { connectionString: requireDatabaseUrl() }
);

let passedCount = 0;
let failedCount = 0;

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    -> Lỗi: ${err.message}`);
    failedCount++;
  }
}

async function runReviewsSuite() {
  console.log('================================================================');
  console.log('   KIỂM THỬ TÍCH HỢP TOÀN DIỆN: PHÂN HỆ ĐÁNH GIÁ SẢN PHẨM');
  console.log('   (REVIEWS & SOCIAL PROOF SYSTEM - CHUẨN AMAZON / SHOPEE)');
  console.log('================================================================\n');

  const testProductId = 'sua-bap-nep-thai-son';
  const testPhoneVerified = '0988776655';
  const testPhoneUnverified = '0911223344';
  const testOrderId = `ord_test_rev_${Date.now()}`;
  const testOrderItemId = `oi_test_rev_${Date.now()}`;
  let createdReviewId = null;

  try {
    // ── NHÓM 1: CSDL & SCHEMA RESILIENCE ──────────────────────────────
    console.log('--- NHÓM 1: Cấu Trúc CSDL & Tự Động Phục Hồi Schema ---');
    await itAsync('Schema: ensureReviewsSchema tự khởi tạo bảng và index mà không lỗi', async () => {
      await ensureReviewsSchema();
      const checkTables = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name IN ('product_reviews', 'review_helpful_votes')`
      );
      assert.equal(checkTables.rows.length, 2, 'Cả 2 bảng product_reviews và review_helpful_votes phải tồn tại');
    });

    await itAsync('Summary: Tính toán rating và breakdown từ dữ liệu đánh giá thật trong CSDL', async () => {
      const summary = await getProductReviewSummary(testProductId);
      assert.ok(summary, 'Phải trả về summary object');
      assert.ok(typeof summary.totalReviews === 'number', `Tổng số review là số thực: ${summary.totalReviews}`);
      assert.ok(summary.totalReviews >= 0, `Tổng số review >= 0 (thực tế: ${summary.totalReviews})`);
      assert.ok(summary.averageRating >= 0 && summary.averageRating <= 5.0, `Điểm trung bình hợp lệ: ${summary.averageRating}`);
      assert.equal(summary.breakdown.length, 5, 'Phải có đủ 5 cấp sao từ 1 đến 5');
      
      const sumBreakdownCounts = summary.breakdown.reduce((acc, b) => acc + b.count, 0);
      assert.equal(sumBreakdownCounts, summary.totalReviews, 'Tổng số lượng trong breakdown phải bằng totalReviews');
      assert.ok(summary.verifiedReviewsCount <= summary.totalReviews, 'Số lượt verified phải <= tổng số review');
    });

    // ── NHÓM 2: TRUY VẤN & BỘ LỌC ĐÁNH GIÁ ────────────────────────────
    console.log('\n--- NHÓM 2: Truy Vấn & Bộ Lọc Đánh Giá ---');
    await itAsync('Filters: Lấy danh sách reviews mặc định với phân trang', async () => {
      const result = await getProductReviews(testProductId, {
        page: 1,
        limit: 5
      });
      assert.ok(Array.isArray(result.reviews), 'Reviews phải là một mảng');
      assert.ok(result.reviews.length > 0, 'Phải có ít nhất 1 review mẫu');
      assert.ok(result.total >= 1, 'Tổng số review phải >= 1');
    });

    await itAsync('Filters: Lọc theo 5 sao thành công', async () => {
      const result = await getProductReviews(testProductId, {
        rating: 5,
        limit: 10
      });
      assert.ok(result.reviews.length > 0, 'Phải có review 5 sao');
      for (const r of result.reviews) {
        assert.equal(r.rating, 5, 'Tất cả review trả về phải có 5 sao');
      }
    });

    await itAsync('Filters: Lọc theo Đã Mua Hàng (Verified Buyers Only)', async () => {
      const result = await getProductReviews(testProductId, {
        verifiedOnly: true,
        limit: 10
      });
      assert.ok(result.reviews.length > 0, 'Phải có review đã mua hàng');
      for (const r of result.reviews) {
        assert.equal(r.isVerifiedBuyer, true, 'Review phải có cờ isVerifiedBuyer = true');
      }
    });

    // ── NHÓM 3: TẠO ĐÁNH GIÁ & XÁC THỰC ĐƠN HÀNG TỰ ĐỘNG ─────────────
    console.log('\n--- NHÓM 3: Tạo Đánh Giá & Tự Động Xác Thực Đã Mua Hàng ---');
    
    // Tạo 1 đơn hàng COMPLETED giả lập trong bảng orders và order_items
    await pool.query(
      `INSERT INTO orders (id, order_code, full_name, phone, address, province, district, ward, payment_method, status, subtotal, total)
       VALUES ($1, $2, 'Nguyễn Thị Hương Test', $3, '123 Test St', 'Hồ Chí Minh', 'Quận 1', 'Bến Nghé', 'COD', 'COMPLETED', 150000, 150000)
       ON CONFLICT (id) DO NOTHING;`,
      [testOrderId, `CODE_${Date.now()}`, testPhoneVerified]
    );
    await pool.query(
      `INSERT INTO order_items (id, order_id, product_id, name, price, quantity)
       VALUES ($1, $2, $3, 'Sữa bắp nếp Thái Sơn', 25000, 6)
       ON CONFLICT (id) DO NOTHING;`,
      [testOrderItemId, testOrderId, testProductId]
    );

    await itAsync('Create Review: Tự động phát hiện Verified Buyer khi khớp SĐT đơn hàng COMPLETED', async () => {
      const { review, isVerified } = await createProductReview({
        productId: testProductId,
        rating: 5,
        title: 'Sữa bắp nếp nấu tươi uống rất thơm béo tự nhiên!',
        comment: 'Mình đã nhận lốc 6 chai bắp nếp đóng chai lạnh sâu. Thơm mùi hạt tự nhiên, không bị ngọt gắt, cả nhà mình đều thích!',
        customerName: 'Nguyễn Thị Hương Test',
        customerPhone: testPhoneVerified,
        variantInfo: 'Lốc 6 chai 330ml'
      });

      assert.ok(review.id, 'Phải sinh ID cho review mới');
      assert.equal(isVerified, true, 'isVerified trả về phải là true');
      assert.equal(review.isVerifiedBuyer, true, 'Thuộc tính review.isVerifiedBuyer phải là true');
      assert.equal(review.status, 'APPROVED', 'Đánh giá tạo mới có status APPROVED');
      createdReviewId = review.id;
    });

    await itAsync('Create Review: Khách chưa mua hàng gắn cờ is_verified_buyer = false', async () => {
      const { review, isVerified } = await createProductReview({
        productId: testProductId,
        rating: 4,
        title: 'Hỏi về hạn sử dụng sản phẩm',
        comment: 'Sữa hạt này để ngăn mát tủ lạnh được bao nhiêu ngày vậy shop?',
        customerName: 'Trần Khách Vãng Lai',
        customerPhone: testPhoneUnverified,
        variantInfo: 'Chai đơn 330ml'
      });

      assert.ok(review.id, 'Phải tạo thành công review');
      assert.equal(isVerified, false, 'Chưa có đơn hoàn tất thì isVerified = false');
      assert.equal(review.isVerifiedBuyer, false, 'Chưa có đơn hoàn tất thì review.isVerifiedBuyer = false');
    });

    // ── NHÓM 4: BÌNH CHỌN HỮU ÍCH & CHỐNG SPAM VOTE ───────────────────
    console.log('\n--- NHÓM 4: Bình Chọn Hữu Ích (Helpful Vote) & Chống Spam ---');
    await itAsync('Helpful Vote: Bình chọn hữu ích lần đầu thành công', async () => {
      assert.ok(createdReviewId, 'Cần có createdReviewId');
      const testFingerprint = `fp_test_${Date.now()}`;
      
      const voteRes = await voteHelpfulReview(createdReviewId, testFingerprint);
      assert.equal(voteRes.success, true, 'Bình chọn lần đầu phải thành công');
      assert.ok(voteRes.helpfulCount >= 1, 'Số helpfulCount phải tăng');
    });

    await itAsync('Helpful Vote: Chặn bình chọn trùng lặp từ cùng fingerprint', async () => {
      const testFingerprint = `fp_test_duplicate`;
      const firstRes = await voteHelpfulReview(createdReviewId, testFingerprint);
      assert.equal(firstRes.success, true, 'Lần 1 thành công');

      const secondRes = await voteHelpfulReview(createdReviewId, testFingerprint);
      assert.equal(secondRes.success, false, 'Lần 2 phải thất bại');
      assert.equal(secondRes.alreadyVoted, true, 'alreadyVoted phải bằng true');
    });

    // ── NHÓM 5: CSKH PHẢN HỒI & QUẢN TRỊ ADMIN ─────────────────────────
    console.log('\n--- NHÓM 5: Quản Trị CSKH & Phản Hồi Chính Thức ---');
    await itAsync('Admin Reply: CSKH phản hồi chính thức và hiển thị trong đánh giá', async () => {
      const replyContent = 'Dạ Thái Sơn Foods xin cảm ơn chị Hương rất nhiều ạ! Chúc chị và gia đình có trải nghiệm thật tuyệt vời!';
      const updated = await adminUpdateReview(createdReviewId, {
        status: 'APPROVED',
        adminReply: replyContent,
        adminUsername: 'CSKH_TháiSơn'
      });

      assert.equal(updated, true, 'Admin update phải trả về true');

      // Xác minh khi khách hàng xem danh sách
      const list = await getProductReviews(testProductId, {
        limit: 50
      });
      const target = list.reviews.find(r => r.id === createdReviewId);
      assert.ok(target, 'Phải tìm thấy review vừa tạo trong danh sách');
      assert.equal(target.adminReply, replyContent, 'Khách hàng phải thấy được phản hồi CSKH');
      assert.ok(target.adminRepliedAt, 'Phải có thời gian phản hồi');
    });

  } finally {
    // Dọn dẹp dữ liệu test
    if (createdReviewId) {
      await pool.query(`DELETE FROM review_helpful_votes WHERE review_id = $1`, [createdReviewId]);
      await pool.query(`DELETE FROM product_reviews WHERE id = $1`, [createdReviewId]);
    }
    await pool.query(`DELETE FROM product_reviews WHERE customer_phone IN ($1, $2)`, [testPhoneVerified, testPhoneUnverified]);
    await pool.query(`DELETE FROM order_items WHERE id = $1`, [testOrderItemId]);
    await pool.query(`DELETE FROM orders WHERE id = $1`, [testOrderId]);
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ ĐÁNH GIÁ: ${passedCount} PASS, ${failedCount} FAIL`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runReviewsSuite().catch((err) => {
  console.error('LỖI KHÔNG MONG MUỐN KHI CHẠY TEST:', err);
  process.exit(1);
});
