import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPartnerSession } from '@/lib/partner/auth';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

function maskName(name: string): string {
  if (!name) return 'Khách hàng';
  const parts = name.trim().split(' ');
  if (parts.length <= 1) return `${name.slice(0, 1)}***`;
  return `${parts[0]} ${parts.slice(1).map(p => `${p.slice(0, 1)}***`).join(' ')}`;
}

export async function GET(request: Request) {
  try {
    const session = await getPartnerSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const status = searchParams.get('status');

    let sql = `
      SELECT 
        oa.id AS attribution_id,
        oa.order_id,
        oa.referral_code,
        oa.attribution_method,
        oa.eligible_order_amount,
        oa.estimated_commission,
        oa.snapshot_commission_rate,
        oa.status AS attribution_status,
        oa.created_at AS attributed_at,
        o.order_code,
        o.full_name AS customer_name,
        o.total AS order_total,
        o.status AS order_status,
        o.payment_method,
        o.cod_reconciled,
        o.created_at AS order_created_at
      FROM order_attributions oa
      JOIN orders o ON oa.order_id = o.id
      WHERE oa.partner_id = $1
    `;
    const params: any[] = [session.id];

    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND oa.status = $${params.length}`;
    }

    sql += ` ORDER BY oa.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    const res = await query(sql, params);

    // Đếm tổng số đơn
    const countRes = await query(
      `SELECT COUNT(*) AS total FROM order_attributions WHERE partner_id = $1;`,
      [session.id]
    );
    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);

    const orders = res.rows.map(row => ({
      ...row,
      customer_name: maskName(row.customer_name),
    }));

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        total: totalCount,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('[PartnerOrders] Error fetching orders:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
