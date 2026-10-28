import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPartnerSession } from '@/lib/partner/auth';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập đối tác', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Lấy kèm danh sách tài liệu đã upload
    const docsRes = await query(
      `SELECT id, document_type AS "documentType", original_filename AS "originalFilename",
              is_verified AS "isVerified", created_at AS "createdAt"
       FROM partner_documents
       WHERE partner_id = $1
       ORDER BY created_at ASC;`,
      [session.partner.id]
    );

    return NextResponse.json({
      success: true,
      partner: session.partner,
      documents: docsRes.rows,
    });
  } catch (error: any) {
    console.error('Error fetching partner profile:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi lấy thông tin đối tác') }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getPartnerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập đối tác', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const {
      idCardNumber,
      idCardIssuedDate,
      idCardIssuedPlace,
      taxCode,
      bankName,
      bankAccountNumber,
      bankAccountName,
      bankBranch,
    } = body;

    const partnerId = session.partner.id;

    // 1. Kiểm tra duplicate CCCD
    if (idCardNumber && idCardNumber.trim()) {
      const cleanIdCard = idCardNumber.trim();
      const dupIdCard = await query(
        `SELECT id FROM partner_profiles WHERE id_card_number = $1 AND id != $2 LIMIT 1;`,
        [cleanIdCard, partnerId]
      );
      if (dupIdCard.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Số CCCD/CMND này đã được sử dụng cho một tài khoản đối tác khác.' },
          { status: 400 }
        );
      }
    }

    // 2. Kiểm tra duplicate Tài khoản ngân hàng
    if (bankAccountNumber && bankAccountNumber.trim()) {
      const cleanBankAcc = bankAccountNumber.trim();
      const dupBank = await query(
        `SELECT id FROM partner_profiles WHERE bank_account_number = $1 AND id != $2 LIMIT 1;`,
        [cleanBankAcc, partnerId]
      );
      if (dupBank.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Số tài khoản ngân hàng này đã được liên kết với một đối tác khác.' },
          { status: 400 }
        );
      }
    }

    // 3. Chuyển trạng thái sang SUBMITTED nếu đang là LITE hoặc REJECTED và đã có đủ CCCD & Bank
    let targetStatus = session.partner.lifecycleStatus;
    const isStage2Complete = Boolean(
      (idCardNumber || session.partner.idCardNumber) &&
      (bankName || session.partner.bankName) &&
      (bankAccountNumber || session.partner.bankAccountNumber) &&
      (bankAccountName || session.partner.bankAccountName)
    );

    if (isStage2Complete && (targetStatus === 'LITE' || targetStatus === 'REJECTED')) {
      targetStatus = 'SUBMITTED';
    }

    await query(
      `UPDATE partner_profiles
       SET id_card_number = COALESCE($1, id_card_number),
           id_card_issued_date = COALESCE($2, id_card_issued_date),
           id_card_issued_place = COALESCE($3, id_card_issued_place),
           tax_code = COALESCE($4, tax_code),
           bank_name = COALESCE($5, bank_name),
           bank_account_number = COALESCE($6, bank_account_number),
           bank_account_name = COALESCE($7, bank_account_name),
           bank_branch = COALESCE($8, bank_branch),
           lifecycle_status = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10;`,
      [
        idCardNumber?.trim() || null,
        idCardIssuedDate || null,
        idCardIssuedPlace?.trim() || null,
        taxCode?.trim() || null,
        bankName?.trim() || null,
        bankAccountNumber?.trim() || null,
        bankAccountName?.trim().toUpperCase() || null,
        bankBranch?.trim() || null,
        targetStatus,
        partnerId,
      ]
    );

    await writeAuditLog({
      action: 'PARTNER_PROFILE_UPDATE',
      entityType: 'PARTNER',
      entityId: partnerId,
      afterJson: { targetStatus, bankName, idCardNumber: idCardNumber ? '***' + idCardNumber.slice(-4) : null },
    });

    return NextResponse.json({
      success: true,
      message: 'Cập nhật thông tin hồ sơ thành công!',
      lifecycleStatus: targetStatus,
    });
  } catch (error: any) {
    console.error('Error updating partner profile:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi cập nhật hồ sơ') }, { status: 500 });
  }
}
