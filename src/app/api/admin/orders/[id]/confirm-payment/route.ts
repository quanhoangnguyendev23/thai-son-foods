import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope, NO_STORE_SCOPE } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

/**
 * Xác nhận đã nhận tiền CHUYỂN KHOẢN cho đơn hàng.
 * - Idempotent: gọi lại với cùng mã giao dịch không ghi chú trùng; khác mã giao dịch → 409.
 * - Không áp dụng cho đơn COD (đối soát COD dùng /api/admin/orders/reconcile) và đơn đã hủy.
 * - Đơn Chờ xử lý → Đã xác nhận KÈM trừ/chuyển tồn kho (cùng cơ chế confirmStock như đổi trạng thái thủ công).
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (session.mustChangePassword) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản bắt buộc phải đổi mật khẩu lần đầu trước khi tiếp tục thao tác.', code: 'MUST_CHANGE_PASSWORD' },
        { status: 403 }
      );
    }

    if (!hasPermission(session, 'cod.reconcile') && !hasPermission(session, 'orders.update_status_all')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xác nhận thanh toán đơn hàng.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const storeScope = getStoreScope(session);
    if (storeScope === NO_STORE_SCOPE) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản nhân viên chưa được gán chi nhánh.', code: 'NO_STORE_ASSIGNED' },
        { status: 403 }
      );
    }

    const { id } = await props.params;
    const body = await request.json();
    const paymentRef = (body.paymentReference || body.payment_reference || body.bankReference || '').toString().trim();
    if (!paymentRef) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập mã giao dịch ngân hàng (payment reference).' },
        { status: 400 }
      );
    }
    if (paymentRef.length > 100 || !/^[\p{L}\p{N}._\-\/ ]+$/u.test(paymentRef)) {
      return NextResponse.json(
        { success: false, error: 'Mã giao dịch không hợp lệ (tối đa 100 ký tự, chỉ gồm chữ, số, khoảng trắng và . _ - /).' },
        { status: 400 }
      );
    }

    let currentOrder: any;
    let updatedOrder: any;
    let deductedNow = false;
    let alreadyPaid = false;

    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      const orderRes = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE;`, [id]);
      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK;');
        return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng' }, { status: 404 });
      }
      currentOrder = orderRes.rows[0];

      if (storeScope && currentOrder.store_code !== storeScope) {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          { success: false, error: 'Bạn không có quyền xác nhận thanh toán đơn của chi nhánh khác.', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      if (currentOrder.status === 'CANCELLED') {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          { success: false, error: 'Đơn hàng đã hủy, không thể xác nhận thanh toán.', code: 'ORDER_CANCELLED' },
          { status: 409 }
        );
      }
      if (String(currentOrder.payment_method || '').toLowerCase() === 'cod') {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          { success: false, error: 'Đơn thanh toán khi nhận hàng (COD) được đối soát ở mục Đối soát COD, không xác nhận bằng chuyển khoản.', code: 'ORDER_IS_COD' },
          { status: 409 }
        );
      }

      if (currentOrder.payment_status === 'PAID') {
        if (currentOrder.payment_reference && currentOrder.payment_reference !== paymentRef) {
          await client.query('ROLLBACK;');
          return NextResponse.json(
            {
              success: false,
              error: `Đơn đã được xác nhận thanh toán với mã giao dịch "${currentOrder.payment_reference}".`,
              code: 'ALREADY_PAID',
            },
            { status: 409 }
          );
        }
        alreadyPaid = true;
        updatedOrder = currentOrder;
        await client.query('ROLLBACK;');
      } else {
        // Chờ xử lý → Đã xác nhận: trừ kho cùng giao dịch (không bỏ qua bước giữ/trừ tồn kho)
        const willConfirm = currentOrder.status === 'PENDING';
        if (willConfirm) {
          const targetStore = currentOrder.store_code || storeScope || 'NH';
          const { confirmStock } = await import('@/lib/inventory');
          const confirmRes = await confirmStock(id, targetStore, client, session.username, {
            allowOversellClamped: Boolean(body.allowOversell),
          });
          deductedNow = !confirmRes.alreadyConfirmed;
        }

        const updateRes = await client.query(
          `UPDATE orders
           SET payment_status = 'PAID',
               payment_reference = $1::text,
               payment_reconciled_at = CURRENT_TIMESTAMP,
               payment_reconciled_by = $2,
               status = CASE WHEN status = 'PENDING' THEN 'CONFIRMED' ELSE status END,
               note = CASE WHEN COALESCE(note, '') = '' THEN '' ELSE note || ' ' END || '[Đã khớp lệnh chuyển khoản: ' || $1::text || ']'
           WHERE id = $3
           RETURNING *;`,
          [paymentRef, session.username, id]
        );
        updatedOrder = updateRes.rows[0];

        // Đồng bộ trạng thái thanh toán sang sổ cái hoa hồng đối tác (cùng transaction)
        try {
          const { processPartnerOrderEvent } = await import('@/lib/partner/orderEvent');
          await processPartnerOrderEvent(id, 'PAYMENT_RECONCILED', {
            client,
            actor: session.username,
            note: `Đã xác nhận thanh toán chuyển khoản: ${paymentRef}`,
          });
        } catch (partnerErr) {
          console.error('[ConfirmPayment] Error updating partner order event:', partnerErr);
        }

        await client.query('COMMIT;');
      }
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }

    if (alreadyPaid) {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        message: `Đơn ${updatedOrder.order_code} đã được xác nhận thanh toán trước đó.`,
        order: updatedOrder,
      });
    }

    await writeAuditLog({
      adminId: session.userId || session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'ORDER_PAYMENT_CONFIRM',
      entityType: 'ORDER',
      entityId: id,
      storeCode: updatedOrder.store_code,
      beforeJson: {
        payment_status: currentOrder.payment_status,
        payment_reference: currentOrder.payment_reference,
        status: currentOrder.status,
      },
      afterJson: {
        payment_status: updatedOrder.payment_status,
        payment_reference: updatedOrder.payment_reference,
        status: updatedOrder.status,
        inventory_deducted_now: deductedNow,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xác nhận thanh toán chuyển khoản thành công cho đơn ${updatedOrder.order_code}!`,
      deducted: deductedNow,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('[ConfirmPayment] Error confirming order payment:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi hệ thống') }, { status: 500 });
  }
}
