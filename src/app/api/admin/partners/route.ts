import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'partners.view')) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền xem danh sách đối tác', code: 'FORBIDDEN' }, { status: !session ? 401 : 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const partnerType = searchParams.get('type');
    const search = searchParams.get('q');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (status && status !== 'ALL') {
      conditions.push(`p.lifecycle_status = $${pIdx++}`);
      params.push(status);
    }

    if (partnerType && partnerType !== 'ALL') {
      conditions.push(`p.partner_type = $${pIdx++}`);
      params.push(partnerType);
    }

    if (search && search.trim()) {
      conditions.push(`(p.partner_code ILIKE $${pIdx} OR p.full_name ILIKE $${pIdx} OR p.phone ILIKE $${pIdx} OR p.email ILIKE $${pIdx})`);
      params.push(`%${search.trim()}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Đếm tổng số
    const countRes = await query(`SELECT COUNT(*) AS total FROM partner_profiles p ${whereClause};`, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Lấy danh sách kèm tên tier nếu có
    const listRes = await query(
      `SELECT 
        p.id, p.user_id AS "userId", p.partner_code AS "partnerCode", p.partner_type AS "partnerType",
        p.lifecycle_status AS "lifecycleStatus", p.phone, p.full_name AS "fullName", p.email,
        p.id_card_number AS "idCardNumber", p.bank_name AS "bankName",
        p.bank_account_number AS "bankAccountNumber", p.bank_account_name AS "bankAccountName",
        p.referral_count AS "referralCount", p.total_revenue_generated AS "totalRevenueGenerated",
        p.total_commission_earned AS "totalCommissionEarned", p.current_balance AS "currentBalance",
        p.verified_at AS "verifiedAt", p.approved_by AS "approvedBy",
        p.rejection_reason AS "rejectionReason", p.suspension_reason AS "suspensionReason",
        p.created_at AS "createdAt",
        t.tier_name AS "tierName", t.tier_code AS "tierCode", t.discount_rate AS "discountRate"
       FROM partner_profiles p
       LEFT JOIN dealer_tiers t ON p.tier_id = t.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx++};`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      data: listRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin partners:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi lấy danh sách đối tác') }, { status: 500 });
  }
}
