import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPartnerSession } from '@/lib/partner/auth';
import { PARTNER_CONFIG } from '@/config/partner';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getPartnerSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 1. Lấy thông tin đối tác & tier hiện tại
    const partnerRes = await query(
      `SELECT pp.*, dt.tier_name, dt.discount_rate, dt.credit_limit
       FROM partner_profiles pp
       LEFT JOIN dealer_tiers dt ON pp.tier_id = dt.id
       WHERE pp.id = $1
       LIMIT 1;`,
      [session.id]
    );

    if (partnerRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hồ sơ đối tác' }, { status: 404 });
    }

    const partner = partnerRes.rows[0];

    // 2. Thống kê đơn hàng và doanh số tích lũy
    const ordersStatsRes = await query(
      `SELECT 
        COUNT(DISTINCT oa.id) AS total_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'COMPLETED' THEN oa.id END) AS completed_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'CANCELLED' THEN oa.id END) AS cancelled_orders,
        COUNT(DISTINCT CASE WHEN o.status NOT IN ('COMPLETED', 'CANCELLED') THEN oa.id END) AS pending_orders,
        COALESCE(SUM(oa.eligible_order_amount), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN oa.eligible_order_amount ELSE 0 END), 0) AS completed_revenue
       FROM order_attributions oa
       JOIN orders o ON oa.order_id = o.id
       WHERE oa.partner_id = $1 AND oa.is_self_referral = false;`,
      [session.id]
    );

    const orderStats = ordersStatsRes.rows[0] || {};
    const totalOrders = parseInt(orderStats.total_orders || '0', 10);
    const completedOrders = parseInt(orderStats.completed_orders || '0', 10);
    const completedRevenue = parseInt(orderStats.completed_revenue || '0', 10);

    // 3. Tính toán số dư từ sổ cái
    const now = new Date();
    const ledgerRes = await query(
      `SELECT status, amount, available_at, direction, entry_type
       FROM partner_ledger
       WHERE partner_id = $1;`,
      [session.id]
    );

    let estimatedIncome = 0;
    let confirmedWaitingIncome = 0;
    let availableIncome = 0;
    let paidIncome = 0;
    let clawbackIncome = 0;

    for (const row of ledgerRes.rows) {
      const amt = Number(row.amount) || 0;
      let effStatus = row.status;

      if (row.status === 'CONFIRMED' && row.available_at && now >= new Date(row.available_at)) {
        effStatus = 'AVAILABLE';
      }

      if (effStatus === 'ESTIMATED') {
        estimatedIncome += amt;
      } else if (effStatus === 'CONFIRMED') {
        confirmedWaitingIncome += amt;
      } else if (effStatus === 'AVAILABLE') {
        availableIncome += amt;
      } else if (effStatus === 'PAID') {
        paidIncome += Math.abs(amt);
      } else if (effStatus === 'CLAWBACK') {
        clawbackIncome += Math.abs(amt);
        availableIncome += amt;
      }
    }

    // 4. Đo lường tiến độ nâng cấp Đại lý
    const targetRevenue = PARTNER_CONFIG.DEALER_UPGRADE.MIN_MONTHLY_REVENUE;
    const targetOrders = PARTNER_CONFIG.DEALER_UPGRADE.MIN_MONTHLY_ORDERS;

    const revenueProgress = Math.min(100, Math.round((completedRevenue / targetRevenue) * 100));
    const ordersProgress = Math.min(100, Math.round((completedOrders / targetOrders) * 100));

    const isEligibleForDealer = (completedRevenue >= targetRevenue) || (completedOrders >= targetOrders);
    const isDealer = partner.partner_type === 'DEALER';

    // 5. Thống kê click
    const clickCountRes = await query(
      `SELECT COUNT(*) AS total_clicks FROM referral_clicks WHERE partner_id = $1;`,
      [session.id]
    );
    const totalClicks = parseInt(clickCountRes.rows[0]?.total_clicks || '0', 10);

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        partner_code: partner.partner_code,
        full_name: partner.full_name,
        partner_type: partner.partner_type,
        lifecycle_status: partner.lifecycle_status,
        has_id_card: Boolean(partner.id_card_number),
        tier: partner.tier_name ? {
          name: partner.tier_name,
          discount_rate: partner.discount_rate,
          credit_limit: partner.credit_limit,
        } : null,
      },
      stats: {
        clicks: totalClicks,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        cancelled_orders: parseInt(orderStats.cancelled_orders || '0', 10),
        pending_orders: parseInt(orderStats.pending_orders || '0', 10),
        total_revenue: parseInt(orderStats.total_revenue || '0', 10),
        completed_revenue: completedRevenue,
        conversion_rate: totalClicks > 0 ? ((completedOrders / totalClicks) * 100).toFixed(2) + '%' : '0%',
      },
      financials: {
        estimated: estimatedIncome,
        confirmed_waiting: confirmedWaitingIncome,
        available: Math.max(0, availableIncome),
        raw_available: availableIncome,
        paid: paidIncome,
        clawback: clawbackIncome,
        total_earned: Number(partner.total_commission_earned) || 0,
      },
      dealer_progress: {
        is_dealer: isDealer,
        is_eligible: isEligibleForDealer,
        can_request_upgrade: isEligibleForDealer && !isDealer && partner.lifecycle_status === 'ACTIVE',
        target_revenue: targetRevenue,
        current_revenue: completedRevenue,
        revenue_percent: revenueProgress,
        target_orders: targetOrders,
        current_orders: completedOrders,
        orders_percent: ordersProgress,
      },
    });
  } catch (error: any) {
    console.error('[PartnerStats] Error calculating stats:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
