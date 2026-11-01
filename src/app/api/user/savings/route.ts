import { NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { getUserSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/user/savings → Túi tiết kiệm: tổng tiền khách đã tiết kiệm qua các đơn của tài khoản.
// Tiết kiệm của một dòng hàng = (giá gốc lúc đặt - giá bán) * số lượng. Đơn đã hủy không được tính.
// Đơn đặt trước khi có cột original_price (NULL) được coi là không có tiết kiệm.
export async function GET() {
  try {
    await initDatabase();
    const session = await getUserSession();
    if (!session || !session.id) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const res = await query(
      `SELECT o.id, o.order_code, o.status, o.created_at, o.total,
              COALESCE(SUM(GREATEST(COALESCE(oi.original_price, oi.price) - oi.price, 0) * oi.quantity), 0)::BIGINT AS saved
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
        WHERE o.user_id = $1 AND o.status <> 'CANCELLED'
        GROUP BY o.id
        ORDER BY o.created_at DESC;`,
      [String(session.id)]
    );

    const orders = res.rows.map((r: any) => ({
      id: r.id,
      orderCode: r.order_code,
      status: r.status,
      createdAt: r.created_at,
      total: Number(r.total) || 0,
      saved: Number(r.saved) || 0,
    }));
    const totalSaved = orders.reduce((sum, o) => sum + o.saved, 0);

    return NextResponse.json({
      success: true,
      totalSaved,
      orderCount: orders.length,
      savedOrderCount: orders.filter((o) => o.saved > 0).length,
      orders: orders.filter((o) => o.saved > 0),
    });
  } catch (error) {
    console.error('[Savings] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Không tải được Túi tiết kiệm. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
