import { NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { getUserSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initDatabase();
    const session = await getUserSession();

    if (!session || !session.id) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng đăng nhập để xem đơn hàng' },
        { status: 401 }
      );
    }

    // Chỉ lấy đơn gắn với tài khoản (user_id do máy chủ ghi từ phiên lúc đặt hàng).
    // KHÔNG gộp theo email/SĐT: hai trường này khách tự khai khi đăng ký, chưa xác thực → ai cũng khai được SĐT/email
    // của người khác để xem đơn của họ.
    const sql = `
      SELECT 
        o.id,
        o.order_code,
        o.full_name,
        o.phone,
        o.email,
        o.province,
        o.district,
        o.ward,
        o.address,
        o.note,
        o.payment_method,
        o.shipping_fee,
        o.subtotal,
        o.total,
        o.status,
        o.created_at,
        COALESCE(json_agg(
          json_build_object(
            'id', oi.id,
            'productId', oi.product_id,
            'name', oi.name,
            'price', oi.price,
            'quantity', oi.quantity,
            'unit', oi.unit,
            'thumbnail', oi.thumbnail
          )
        ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC;
    `;

    const res = await query(sql, [session.id]);

    return NextResponse.json({
      success: true,
      orders: res.rows,
    });
  } catch (error: any) {
    console.error('Error fetching customer orders:', error);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tải danh sách đơn hàng. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
