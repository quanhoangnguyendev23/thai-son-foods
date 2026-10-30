import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!hasPermission(session, 'payouts.view')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem danh sách yêu cầu rút tiền.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const partnerId = searchParams.get('partnerId');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    let sql = `
      SELECT 
        pr.*,
        pp.partner_code,
        pp.full_name AS partner_name,
        pp.phone AS partner_phone,
        pp.email AS partner_email,
        pp.partner_type,
        pp.current_balance AS current_partner_balance
      FROM payout_requests pr
      JOIN partner_profiles pp ON pr.partner_id = pp.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status !== 'ALL') {
      params.push(status);
      sql += ` AND pr.status = $${params.length}`;
    }

    if (partnerId) {
      params.push(partnerId);
      sql += ` AND pr.partner_id = $${params.length}`;
    }

    sql += ` ORDER BY pr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    const res = await query(sql, params);

    // Thống kê nhanh theo trạng thái
    const statsRes = await query(`
      SELECT 
        COUNT(*) AS total_requests,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) AS pending_amount,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid_count
      FROM payout_requests;
    `);

    return NextResponse.json({
      success: true,
      data: res.rows,
      stats: statsRes.rows[0],
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('[AdminPayouts] Error fetching payouts:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
