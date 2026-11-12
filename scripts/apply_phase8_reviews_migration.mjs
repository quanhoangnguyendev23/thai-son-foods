import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

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

const { Pool } = pg;

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : { connectionString: requireDatabaseUrl() }
);

const SAMPLE_REVIEWS = [
  {
    id: 'rev_sb_01',
    product_id: 'sua-bap-nep-thai-son',
    customer_name: 'Nguyễn Thu Hà',
    customer_phone: '0903123456',
    variant_info: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Vị bắp nếp béo thơm tự nhiên, cả nhà mình ai cũng mê',
    comment: 'Sữa bắp rất thơm, độ ngọt dịu vừa phải không bị gắt như các loại khác ngoài thị trường. Giao hàng đến nơi chai vẫn còn lạnh buốt, con nhỏ nhà mình sáng nào trước khi đi học cũng uống hết một chai. Sẽ tiếp tục ủng hộ Thái Sơn Foods lâu dài!',
    is_verified_buyer: true,
    helpful_count: 24,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    admin_reply: 'Dạ Thái Sơn Foods xin cảm ơn chị Thu Hà và gia đình đã tin dùng Sữa Bắp Nếp Tươi ạ! Chúc bé luôn khỏe mạnh và học giỏi!',
    admin_replied_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_sb_02',
    product_id: 'sua-bap-nep-thai-son',
    customer_name: 'Trần Hoàng Minh',
    customer_phone: '0934677279',
    variant_info: 'Thùng 24 chai (330ml)',
    rating: 5,
    title: 'Mua cho cả văn phòng công ty uống giờ giải lao',
    comment: 'Đặt nguyên thùng cho anh em công ty bồi dưỡng buổi xế. Uống mát lạnh, vị bắp nếp tự nhiên rất thật, thuần chay nên mấy bạn ăn chay trong team cũng uống được luôn. Đóng gói thùng carton chắc chắn, shipper giao hỏa tốc 1 tiếng là tới.',
    is_verified_buyer: true,
    helpful_count: 18,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_sb_03',
    product_id: 'sua-bap-nep-thai-son',
    customer_name: 'Lê Thị Thanh Mai',
    customer_phone: '0918556677',
    variant_info: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Giao hàng nhanh, chai sữa đọng đá mát lịm',
    comment: 'Chai sữa bắp béo ngậy, bắp tươi xay sánh mịn chứ không loãng. Uống lạnh cảm giác giải nhiệt đã khát vô cùng. Rất hài lòng với dịch vụ giao hàng chu đáo của shop.',
    is_verified_buyer: true,
    helpful_count: 15,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_sb_04',
    product_id: 'sua-bap-nep-thai-son',
    customer_name: 'Phạm Đức Trọng',
    customer_phone: '0977889900',
    variant_info: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Shipper giao xe thùng lạnh cực kỳ chuyên nghiệp',
    comment: 'Ấn tượng nhất là khâu bảo quản, giao tới chai sữa vẫn đọng hơi lạnh buốt tay. Date mới nấu trong ngày, hạn 7 ngày nên rất yên tâm về độ sạch và không hóa chất bảo quản.',
    is_verified_buyer: true,
    helpful_count: 12,
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_sb_05',
    product_id: 'sua-bap-nep-thai-son',
    customer_name: 'Hoàng Yến Nhi',
    customer_phone: '0988112233',
    variant_info: 'Lốc 7 chai (330ml)',
    rating: 4,
    title: 'Vị ngon xuất sắc, hy vọng có thêm dung tích lớn hơn',
    comment: 'Sữa bắp nếp rất hợp khẩu vị của mình, vị béo tự nhiên không bị gắt cổ. Giá hợp lý so với chất lượng. Mong hãng ra thêm dung tích lớn hơn để tiện để tủ lạnh dùng cho cả tuần.',
    is_verified_buyer: true,
    helpful_count: 9,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_sb_06',
    product_id: 'sua-bap-nep-thai-son',
    customer_name: 'Võ Minh Quân',
    customer_phone: '0909445566',
    variant_info: 'Lốc 10 chai (330ml)',
    rating: 5,
    title: 'Sữa dinh dưỡng thuần chay chuẩn vị miền Tây',
    comment: 'Mình tìm kiếm dòng sữa hạt thuần chay không pha bột sữa động vật bấy lâu nay. Thái Sơn Foods làm chuẩn vị bắp tươi thơm lừng, uống xong thấy nhẹ bụng tiêu hóa tốt.',
    is_verified_buyer: true,
    helpful_count: 7,
    created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_shs_01',
    product_id: 'sua-hat-sen-mekong-xanh',
    customer_name: 'Đặng Ngọc Lan',
    customer_phone: '0912334455',
    variant_info: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Sữa hạt sen ngọt thanh mát lành, thơm bùi dễ ngủ',
    comment: 'Hạt sen tươi nấu sánh mịn, vị thanh không ngọt gắt. Buổi tối uống 1 chai hâm ấm ngủ rất ngon. Cả nhà mình đều chuyển sang dùng sữa hạt Thái Sơn thay cho đồ uống có ga.',
    is_verified_buyer: true,
    helpful_count: 21,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_shs_02',
    product_id: 'sua-hat-sen-mekong-xanh',
    customer_name: 'Bùi Anh Tuấn',
    customer_phone: '0938778899',
    variant_info: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Vị sen thơm ngậy đậm đà, đóng gói cẩn thận',
    comment: 'Giao hàng đúng hẹn, chai sạch sẽ tem nhãn rõ ràng. Uống cảm nhận rõ vị hạt sen Đồng Tháp bùi bùi chứ không phải hương liệu tổng hợp.',
    is_verified_buyer: true,
    helpful_count: 14,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_sgl_01',
    product_id: 'sua-gao-lut-mekong-xanh',
    customer_name: 'Trương Mỹ Linh',
    customer_phone: '0945667788',
    variant_info: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Sữa gạo lứt mè đen thơm bùi rất tốt cho vóc dáng',
    comment: 'Mình uống thay thế bữa sáng kết hợp ăn kiêng healthy, vừa no lâu vừa đầy đủ dinh dưỡng. Rất khuyến khích cho các bạn eat clean!',
    is_verified_buyer: true,
    helpful_count: 16,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rev_md_01',
    product_id: 'nha-dam-mu-trom-thai-son',
    customer_name: 'Ngô Quốc Bảo',
    customer_phone: '0966332211',
    variant_info: 'Lốc 7 chai (330ml)',
    rating: 5,
    title: 'Nha đam giòn sần sật, mủ trôm mát gan giải nhiệt đỉnh cao',
    comment: 'Thạch nha đam nhiều, giòn tươi không bị nhớt, vị đường phèn lá dứa thanh mát. Mùa nóng uống chai này tỉnh cả người.',
    is_verified_buyer: true,
    helpful_count: 19,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

async function main() {
  const client = await pool.connect();
  try {
    console.log('--- ÁP DỤNG MIGRATION PHASE 8: HỆ THỐNG ĐÁNH GIÁ SẢN PHẨM ---');
    const sqlPath = path.resolve(process.cwd(), 'scripts/migrations/phase8_reviews_schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    await client.query('BEGIN;');
    await client.query(sqlContent);

    // Chèn dữ liệu mẫu
    for (const rev of SAMPLE_REVIEWS) {
      await client.query(
        `INSERT INTO product_reviews (
          id, product_id, customer_name, customer_phone, variant_info, 
          rating, title, comment, is_verified_buyer, helpful_count, 
          status, admin_reply, admin_replied_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'APPROVED', $11, $12, $13, $13)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          comment = EXCLUDED.comment,
          rating = EXCLUDED.rating,
          helpful_count = EXCLUDED.helpful_count,
          admin_reply = EXCLUDED.admin_reply;`,
        [
          rev.id,
          rev.product_id,
          rev.customer_name,
          rev.customer_phone,
          rev.variant_info,
          rev.rating,
          rev.title,
          rev.comment,
          rev.is_verified_buyer,
          rev.helpful_count,
          rev.admin_reply || null,
          rev.admin_replied_at || null,
          rev.created_at,
        ]
      );
    }

    await client.query('COMMIT;');
    console.log('✓ Áp dụng thành công migration Phase 8 và nạp dữ liệu đánh giá mẫu!');

    const countRes = await client.query('SELECT count(*)::int as count FROM product_reviews;');
    console.log(`Tổng số đánh giá hiện có trong cơ sở dữ liệu: ${countRes.rows[0].count}`);
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Lỗi khi áp dụng migration Phase 8:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
