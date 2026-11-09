import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope, NO_STORE_SCOPE } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

/** Phí ship sửa tay tối đa (đồng): chặn gõ nhầm thêm số 0 */
const MAX_MANUAL_SHIPPING_FEE = 500_000;

/**
 * "Đã gọi xác nhận" cho đơn đặt khi bản đồ lỗi (orders.location_check = 'needs_call').
 * - Nhân viên gọi khách xác nhận vị trí, có thể sửa phí ship (tổng tiền đổi theo).
 * - Đặt location_check = 'call_confirmed'; chỉ sau bước này đơn mới được chuyển sang Đang giao / Hoàn tất.
 * - Idempotent: đơn đã xác nhận rồi thì trả về như cũ, không ghi lại.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (session.mustChangePassword) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản bắt buộc phải đổi mật khẩu lần đầu trước khi tiếp tục thao tác.', code: 'MUST_CHANGE_PASSWORD' },
        { status: 403 }
      );
    }
    if (!hasPermission(session, 'orders.update_status_all') && !hasPermission(session, 'orders.update_status_own_store')) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền cập nhật đơn hàng.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const storeScope = getStoreScope(session);
    if (storeScope === NO_STORE_SCOPE) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản nhân viên chưa được gán chi nhánh.', code: 'NO_STORE_ASSIGNED' },
        { status: 403 }
      );
    }

    const { id } = await props.params;
    const body = await request.json().catch(() => ({}));
    let newFee: number | null = null;
    if (body.shippingFee !== undefined && body.shippingFee !== null && body.shippingFee !== '') {
      const n = Number(body.shippingFee);
      if (!Number.isInteger(n) || n < 0 || n > MAX_MANUAL_SHIPPING_FEE) {
        return NextResponse.json(
          { success: false, error: `Phí ship phải là số nguyên từ 0 đến ${MAX_MANUAL_SHIPPING_FEE.toLocaleString('vi-VN')}đ.` },
          { status: 400 }
        );
      }
      newFee = n;
    }

    const client = await pool.connect();
    let before: Record<string, unknown> | null = null;
    let after: Record<string, unknown> | null = null;
    try {
      await client.query('BEGIN;');
      const res = await client.query(
        `SELECT id, order_code, status, store_code, location_check, shipping_fee, total FROM orders WHERE id = $1 FOR UPDATE;`,
        [id]
      );
      if (!res.rows.length) {
        await client.query('ROLLBACK;');
        return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng' }, { status: 404 });
      }
      const o = res.rows[0];
      if (storeScope && o.store_code && o.store_code !== storeScope) {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          { success: false, error: `Bạn không có quyền sửa đơn hàng thuộc chi nhánh ${o.store_code}.`, code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
      if (o.location_check === 'call_confirmed') {
        await client.query('ROLLBACK;');
        return NextResponse.json({ success: true, alreadyConfirmed: true, order: o });
      }
      if (o.location_check !== 'needs_call') {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          { success: false, error: 'Đơn này không cần gọi xác nhận vị trí.', code: 'NOT_NEEDS_CALL' },
          { status: 409 }
        );
      }
      if (o.status === 'CANCELLED' || o.status === 'COMPLETED') {
        await client.query('ROLLBACK;');
        return NextResponse.json({ success: false, error: 'Đơn đã kết thúc, không xác nhận được.', code: 'ORDER_CLOSED' }, { status: 409 });
      }
      const oldFee = Number(o.shipping_fee) || 0;
      const fee = newFee === null ? oldFee : newFee;
      const total = Math.max(0, (Number(o.total) || 0) - oldFee + fee);
      const upd = await client.query(
        `UPDATE orders SET location_check = 'call_confirmed', shipping_fee = $2, total = $3
          WHERE id = $1
          RETURNING id, order_code, status, store_code, location_check, shipping_fee, total;`,
        [id, fee, total]
      );
      await client.query('COMMIT;');
      before = { location_check: o.location_check, shipping_fee: oldFee, total: Number(o.total) || 0 };
      after = { location_check: 'call_confirmed', shipping_fee: fee, total };
      // Đã COMMIT: lỗi ghi nhật ký không được làm hỏng kết quả
      await writeAuditLog({
        adminId: session.userId || session.id,
        adminUsername: session.username,
        role: session.role,
        action: 'ORDER_LOCATION_CALL_CONFIRM',
        entityType: 'ORDER',
        entityId: id,
        storeCode: o.store_code,
        beforeJson: before,
        afterJson: after,
      }).catch((e: unknown) => console.error('[Admin confirm-location] audit failed:', e));
      return NextResponse.json({ success: true, order: upd.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK;').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Admin confirm-location] error:', error);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(error, 'Không xác nhận được vị trí, vui lòng thử lại.') },
      { status: 500 }
    );
  }
}
