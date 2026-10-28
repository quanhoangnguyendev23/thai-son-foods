import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'partners.view')) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền xem thông tin đối tác', code: 'FORBIDDEN' }, { status: !session ? 401 : 403 });
    }

    const { id } = await props.params;

    const partnerRes = await query(
      `SELECT 
        p.id, p.user_id AS "userId", p.partner_code AS "partnerCode", p.partner_type AS "partnerType",
        p.lifecycle_status AS "lifecycleStatus", p.phone, p.full_name AS "fullName", p.email,
        p.id_card_number AS "idCardNumber", p.id_card_issued_date AS "idCardIssuedDate",
        p.id_card_issued_place AS "idCardIssuedPlace", p.tax_code AS "taxCode",
        p.bank_name AS "bankName", p.bank_account_number AS "bankAccountNumber",
        p.bank_account_name AS "bankAccountName", p.bank_branch AS "bankBranch",
        p.tier_id AS "tierId", p.referral_count AS "referralCount",
        p.total_revenue_generated AS "totalRevenueGenerated",
        p.total_commission_earned AS "totalCommissionEarned",
        p.current_balance AS "currentBalance", p.verified_at AS "verifiedAt",
        p.approved_by AS "approvedBy", p.rejection_reason AS "rejectionReason",
        p.suspension_reason AS "suspensionReason", p.created_at AS "createdAt",
        t.tier_name AS "tierName", t.tier_code AS "tierCode", t.discount_rate AS "discountRate"
       FROM partner_profiles p
       LEFT JOIN dealer_tiers t ON p.tier_id = t.id
       WHERE p.id = $1
       LIMIT 1;`,
      [id]
    );

    if (partnerRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đối tác' }, { status: 404 });
    }

    const partner = partnerRes.rows[0];

    // Lấy tài liệu
    const docsRes = await query(
      `SELECT id, document_type AS "documentType", original_filename AS "originalFilename",
              is_verified AS "isVerified", created_at AS "createdAt"
       FROM partner_documents
       WHERE partner_id = $1
       ORDER BY created_at ASC;`,
      [id]
    );

    // Lấy 10 đơn giới thiệu gần nhất
    const ordersRes = await query(
      `SELECT oa.id, oa.order_id AS "orderId", o.order_code AS "orderCode", o.total, o.status AS "orderStatus",
              oa.estimated_commission AS "estimatedCommission", oa.status AS "attributionStatus",
              oa.is_self_referral AS "isSelfReferral", oa.created_at AS "createdAt"
       FROM order_attributions oa
       JOIN orders o ON oa.order_id = o.id
       WHERE oa.partner_id = $1
       ORDER BY oa.created_at DESC
       LIMIT 10;`,
      [id]
    );

    return NextResponse.json({
      success: true,
      partner,
      documents: docsRes.rows,
      recentOrders: ordersRes.rows,
    });
  } catch (error: any) {
    console.error('Error getting partner detail:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi lấy chi tiết đối tác') }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Kiểm tra quyền trước khi tra cứu: tránh để người không có quyền dò xem mã đối tác có tồn tại hay không
    if (
      !hasPermission(session, 'partners.review') &&
      !hasPermission(session, 'partners.suspend') &&
      !hasPermission(session, 'dealer.manage')
    ) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền cập nhật đối tác', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = await props.params;
    const body = await request.json();
    const { action, reason, tierId } = body;

    const partnerRes = await query(`SELECT * FROM partner_profiles WHERE id = $1;`, [id]);
    if (partnerRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đối tác' }, { status: 404 });
    }
    const current = partnerRes.rows[0];

    let newStatus = current.lifecycle_status;
    let newType = current.partner_type;
    let newTierId = current.tier_id;
    let rejectionReason = current.rejection_reason;
    let suspensionReason = current.suspension_reason;
    let approvedBy = current.approved_by;
    let verifiedAt = current.verified_at;

    if (action === 'APPROVE') {
      if (!hasPermission(session, 'partners.review')) {
        return NextResponse.json({ success: false, error: 'Bạn không có quyền phê duyệt đối tác', code: 'FORBIDDEN' }, { status: 403 });
      }
      newStatus = 'ACTIVE';
      approvedBy = session.username;
      verifiedAt = new Date().toISOString();
      rejectionReason = null;
    } else if (action === 'REJECT' || action === 'REQUEST_MORE_INFO') {
      if (!hasPermission(session, 'partners.review')) {
        return NextResponse.json({ success: false, error: 'Bạn không có quyền từ chối đối tác', code: 'FORBIDDEN' }, { status: 403 });
      }
      newStatus = 'REJECTED';
      rejectionReason = reason || 'Hồ sơ chưa đạt yêu cầu, vui lòng kiểm tra lại thông tin.';
    } else if (action === 'SUSPEND') {
      if (!hasPermission(session, 'partners.suspend')) {
        return NextResponse.json({ success: false, error: 'Bạn không có quyền tạm khóa đối tác', code: 'FORBIDDEN' }, { status: 403 });
      }
      newStatus = 'SUSPENDED';
      suspensionReason = reason || 'Tạm khóa do vi phạm chính sách hoặc phát hiện bất thường.';
    } else if (action === 'ACTIVATE') {
      if (!hasPermission(session, 'partners.suspend')) {
        return NextResponse.json({ success: false, error: 'Bạn không có quyền kích hoạt lại đối tác', code: 'FORBIDDEN' }, { status: 403 });
      }
      newStatus = 'ACTIVE';
      suspensionReason = null;
    } else if (action === 'UPGRADE_DEALER') {
      if (!hasPermission(session, 'dealer.manage')) {
        return NextResponse.json({ success: false, error: 'Bạn không có quyền nâng cấp đại lý', code: 'FORBIDDEN' }, { status: 403 });
      }
      newType = 'DEALER';
      newStatus = 'ACTIVE';
      newTierId = tierId || current.tier_id || 'tier_bronze';
    } else {
      return NextResponse.json({ success: false, error: `Hành động không hợp lệ: ${action}` }, { status: 400 });
    }

    // Quy trình trạng thái hợp lệ (tránh bỏ qua bước duyệt hồ sơ):
    //  - APPROVE: hồ sơ đã nộp (SUBMITTED / UNDER_REVIEW / APPROVED) hoặc đang bị từ chối chờ duyệt lại
    //  - REJECT / REQUEST_MORE_INFO: hồ sơ đang chờ xét duyệt; đối tác ACTIVE phải dùng "Tạm khóa"
    //  - SUSPEND: chỉ đối tác ACTIVE; ACTIVATE: chỉ đối tác đang bị SUSPENDED
    //  - UPGRADE_DEALER: đối tác ACTIVE hoặc đang UNDER_REVIEW (khi đối tác tự gửi yêu cầu nâng cấp)
    const allowedFrom: Record<string, string[]> = {
      APPROVE: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      REJECT: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'],
      REQUEST_MORE_INFO: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'],
      SUSPEND: ['ACTIVE'],
      ACTIVATE: ['SUSPENDED'],
      UPGRADE_DEALER: ['ACTIVE', 'UNDER_REVIEW'],
    };
    if (!allowedFrom[action].includes(current.lifecycle_status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Không thể "${action}" khi đối tác đang ở trạng thái ${current.lifecycle_status}.`,
          code: 'INVALID_PARTNER_STATE',
        },
        { status: 409 }
      );
    }
    if (action === 'UPGRADE_DEALER' && tierId !== undefined && tierId !== null && tierId !== '') {
      const tierRes = await query(`SELECT id FROM dealer_tiers WHERE id = $1 LIMIT 1;`, [String(tierId)]);
      if (tierRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Hạng đại lý không tồn tại.' }, { status: 400 });
      }
    }

    // Cập nhật có điều kiện theo trạng thái đã đọc: nếu admin khác vừa đổi trạng thái thì báo xung đột thay vì ghi đè
    const updateRes = await query(
      `UPDATE partner_profiles
       SET lifecycle_status = $1,
           partner_type = $2,
           tier_id = $3,
           rejection_reason = $4,
           suspension_reason = $5,
           approved_by = $6,
           verified_at = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND lifecycle_status = $9;`,
      [newStatus, newType, newTierId, rejectionReason, suspensionReason, approvedBy, verifiedAt, id, current.lifecycle_status]
    );
    if (updateRes.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Trạng thái đối tác vừa được người khác thay đổi. Hãy tải lại và thử lại.', code: 'CONFLICT' },
        { status: 409 }
      );
    }

    await writeAuditLog({
      adminId: session.userId || session.id,
      adminUsername: session.username,
      role: session.role,
      action: `PARTNER_${action}`,
      entityType: 'PARTNER',
      entityId: id,
      beforeJson: { status: current.lifecycle_status, type: current.partner_type },
      afterJson: { status: newStatus, type: newType, reason },
    });

    return NextResponse.json({
      success: true,
      message: `Đã thực hiện hành động ${action} thành công!`,
      partner: {
        id,
        lifecycleStatus: newStatus,
        partnerType: newType,
        tierId: newTierId,
      },
    });
  } catch (error: any) {
    console.error('Error reviewing partner:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi cập nhật đối tác') }, { status: 500 });
  }
}
