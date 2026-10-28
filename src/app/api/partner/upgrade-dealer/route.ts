import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPartnerSession } from '@/lib/partner/auth';
import { PARTNER_CONFIG } from '@/config/partner';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getPartnerSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (session.partnerType === 'DEALER') {
      return NextResponse.json(
        { success: false, error: 'Tài khoản của bạn đã là Đại lý chính thức.', code: 'ALREADY_DEALER' },
        { status: 400 }
      );
    }

    if (session.lifecycleStatus !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Chỉ đối tác ở trạng thái ACTIVE mới có thể gửi yêu cầu nâng cấp Đại lý.', code: 'NOT_ACTIVE' },
        { status: 403 }
      );
    }

    // 1. Kiểm tra điều kiện doanh số & số đơn hoàn thành
    const statsRes = await query(
      `SELECT 
        COUNT(DISTINCT oa.id) AS total_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'COMPLETED' THEN oa.id END) AS completed_orders,
        COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN oa.eligible_order_amount ELSE 0 END), 0) AS completed_revenue
       FROM order_attributions oa
       JOIN orders o ON oa.order_id = o.id
       WHERE oa.partner_id = $1 AND oa.is_self_referral = false;`,
      [session.id]
    );

    const stats = statsRes.rows[0] || {};
    const completedOrders = parseInt(stats.completed_orders || '0', 10);
    const completedRevenue = parseInt(stats.completed_revenue || '0', 10);

    const minRevenue = PARTNER_CONFIG.DEALER_UPGRADE.MIN_MONTHLY_REVENUE;
    const minOrders = PARTNER_CONFIG.DEALER_UPGRADE.MIN_MONTHLY_ORDERS;

    const isEligible = (completedRevenue >= minRevenue) || (completedOrders >= minOrders);

    // 2. Cập nhật trạng thái đối tác sang UNDER_REVIEW để Admin phê duyệt
    await query(
      `UPDATE partner_profiles
       SET lifecycle_status = 'UNDER_REVIEW',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [session.id]
    );

    return NextResponse.json({
      success: true,
      isEligible,
      currentStats: {
        completedRevenue,
        targetRevenue: minRevenue,
        completedOrders,
        targetOrders: minOrders,
      },
      message: isEligible
        ? 'Bạn đã đạt đủ tiêu chuẩn và yêu cầu nâng cấp Đại lý đã được gửi tới Ban quản trị phê duyệt!'
        : 'Yêu cầu nâng cấp Đại lý đã được gửi tới Ban quản trị để xem xét đặc cách.',
    });
  } catch (error: any) {
    console.error('[UpgradeDealer] Error processing upgrade request:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi hệ thống') }, { status: 500 });
  }
}
