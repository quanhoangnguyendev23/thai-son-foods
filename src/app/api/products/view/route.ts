import { NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { isSafeItemId } from '@/lib/product-stats';

export const dynamic = 'force-dynamic';

const SESSION_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const MAX_VIEWS_PER_SESSION_PER_DAY = 100;

// POST /api/products/view  { productId, sessionId } — ghi nhận lượt xem ẩn danh (không lưu thông tin cá nhân)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { productId, sessionId } = body as { productId?: unknown; sessionId?: unknown };

    if (!isSafeItemId(productId) || typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
      return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    await initDatabase();
    // Mỗi phiên + sản phẩm chỉ 1 dòng/ngày; giới hạn số dòng/ngày để tránh làm đầy bảng
    await query(
      `INSERT INTO product_views (session_id, product_id)
       SELECT $1::varchar, $2::varchar
        WHERE (SELECT COUNT(*) FROM product_views WHERE session_id = $1::varchar AND viewed_on = CURRENT_DATE) < $3::int
       ON CONFLICT (session_id, product_id, viewed_on) DO NOTHING`,
      [sessionId, productId, MAX_VIEWS_PER_SESSION_PER_DAY]
    );

    // Dọn dữ liệu cũ (> 90 ngày) thỉnh thoảng
    if (Math.random() < 0.01) {
      await query(`DELETE FROM product_views WHERE viewed_on < CURRENT_DATE - 90`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording product view:', error);
    return NextResponse.json({ success: false, error: 'Không thể ghi nhận lượt xem' }, { status: 500 });
  }
}
