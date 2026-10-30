import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import {
  expandComboItems,
  reserveStock,
  releaseStock,
  logInventoryChange,
  getAvailability,
  InsufficientStockError,
} from '@/lib/inventory';
import { INVENTORY_CONFIG } from '@/config/inventory';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export interface TransferOrderParams {
  orderId: string;
  targetStoreCode: string;
  actor: {
    id?: string;
    username: string;
    role?: string;
  };
}

export interface TransferOrderResult {
  success: boolean;
  statusCode: number;
  message?: string;
  error?: string;
  order?: any;
  insufficientItems?: any[];
}

export async function executeOrderTransfer(
  params: TransferOrderParams,
  clientOverride?: any
): Promise<TransferOrderResult> {
  const { orderId, targetStoreCode, actor } = params;

  if (!orderId || !targetStoreCode) {
    return {
      success: false,
      statusCode: 400,
      error: 'Thiếu mã đơn hàng (orderId) hoặc mã chi nhánh đích (targetStoreCode)',
    };
  }

  const client = clientOverride || (await pool.connect());
  const shouldRelease = !clientOverride;

  try {
    await client.query('BEGIN;');

    // 1. Khóa và lấy thông tin đơn hàng hiện tại
    const orderRes = await client.query(
      `SELECT id, order_code, status, store_code, store_address, inventory_deducted, note
       FROM orders
       WHERE id = $1
       FOR UPDATE;`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK;');
      return { success: false, statusCode: 404, error: 'Không tìm thấy đơn hàng' };
    }

    const order = orderRes.rows[0];
    const currentStoreCode = order.store_code || 'NH';

    if (currentStoreCode === targetStoreCode) {
      await client.query('ROLLBACK;');
      return {
        success: false,
        statusCode: 400,
        error: 'Đơn hàng đã thuộc chi nhánh này, không cần chuyển.',
      };
    }

    // Chỉ cho phép chuyển chi nhánh khi đơn chưa CONFIRMED (đang PENDING)
    if (order.status !== 'PENDING') {
      await client.query('ROLLBACK;');
      return {
        success: false,
        statusCode: 400,
        error: `Chỉ có thể chuyển chi nhánh cho đơn hàng đang ở trạng thái Chờ xác nhận (PENDING). Đơn này đang là ${order.status}.`,
      };
    }

    // 2. Lấy danh sách món trong đơn hàng
    const itemsRes = await client.query(
      `SELECT product_id AS "productId", name, quantity, unit, price FROM order_items WHERE order_id = $1;`,
      [orderId]
    );
    if (itemsRes.rows.length === 0) {
      await client.query('ROLLBACK;');
      return { success: false, statusCode: 400, error: 'Đơn hàng không có sản phẩm' };
    }

    // 3. Bóc combo các món
    const { expandedBottles } = await expandComboItems(itemsRes.rows, client);

    // 4. Kiểm tra xem chi nhánh đích có đủ hàng không
    const availability = await getAvailability(targetStoreCode, itemsRes.rows, client);
    if (!availability.isAvailable) {
      await client.query('ROLLBACK;');
      const missingBottlesList = (availability.insufficientItems || [])
        .map((b) => `${b.productName} (cần ${b.requested}, khả dụng ${b.available})`)
        .join(', ');
      const errorMsg = missingBottlesList
        ? `Chi nhánh đích (${targetStoreCode}) không đủ hàng cho các món: ${missingBottlesList}.`
        : `Chi nhánh đích (${targetStoreCode}) không đủ hàng cho các món trong đơn này.`;
      return {
        success: false,
        statusCode: 409,
        error: errorMsg,
        insufficientItems: availability.insufficientItems,
      };
    }

    // 5. Nhả reservation tại chi nhánh cũ (không hủy đơn, updateOrderStatus = false)
    await releaseStock(
      orderId,
      client,
      `Chuyển đơn từ kho ${currentStoreCode} sang kho ${targetStoreCode}`,
      actor.username,
      false
    );

    // 6. Tạo reservation tại chi nhánh mới
    await reserveStock(targetStoreCode, orderId, expandedBottles, client, INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS);

    // 7. Lấy địa chỉ của chi nhánh đích
    const storeRes = await client.query(
      `SELECT name, address FROM stores WHERE code = $1;`,
      [targetStoreCode]
    );
    const newStoreName = storeRes.rows[0]?.name || targetStoreCode;
    const newStoreAddress = storeRes.rows[0]?.address || null;

    // 8. Cập nhật đơn hàng (giữ nguyên trạng thái PENDING)
    const transferNote = `[Chuyển chi nhánh: từ ${currentStoreCode} sang ${newStoreName} bởi ${actor.username} lúc ${new Date().toLocaleString('vi-VN')}]`;
    const updatedOrderRes = await client.query(
      `UPDATE orders
       SET store_code = $1,
           store_address = $2,
           status = 'PENDING',
           note = CASE WHEN note IS NULL OR note = '' THEN $3 ELSE note || ' ' || $3 END
       WHERE id = $4
       RETURNING *;`,
      [targetStoreCode, newStoreAddress, transferNote, orderId]
    );

    // 9. Ghi log chuyển chi nhánh cho từng mặt hàng (kho cũ và kho mới)
    for (const b of expandedBottles) {
      // Log kho chuyển đi
      await logInventoryChange(client, {
        storeCode: currentStoreCode,
        productId: b.productId,
        oldStock: 0,
        newStock: 0,
        changeType: 'order_transferred_out',
        orderId,
        actor: actor.username,
        note: `Chuyển đơn ${order.order_code} sang kho ${targetStoreCode} (${b.bottleQuantity} chai)`,
      });

      // Log kho tiếp nhận
      await logInventoryChange(client, {
        storeCode: targetStoreCode,
        productId: b.productId,
        oldStock: 0,
        newStock: 0,
        changeType: 'order_transferred_in',
        orderId,
        actor: actor.username,
        note: `Tiếp nhận chuyển đơn ${order.order_code} từ kho ${currentStoreCode} sang ${targetStoreCode} (${b.bottleQuantity} chai)`,
      });
    }

    await client.query('COMMIT;');

    if (actor.id) {
      await writeAuditLog({
        adminId: actor.id,
        adminUsername: actor.username,
        role: actor.role || 'ADMIN',
        action: 'ORDER_TRANSFER_STORE',
        entityType: 'ORDER',
        entityId: orderId,
        storeCode: targetStoreCode,
        beforeJson: {
          store_code: currentStoreCode,
          order_code: order.order_code,
        },
        afterJson: {
          store_code: targetStoreCode,
          store_name: newStoreName,
          order_code: order.order_code,
        },
      });
    }

    return {
      success: true,
      statusCode: 200,
      message: `Đã chuyển đơn hàng ${order.order_code} sang chi nhánh ${newStoreName} thành công!`,
      order: updatedOrderRes.rows[0],
    };
  } catch (txErr: any) {
    try {
      await client.query('ROLLBACK;');
    } catch {
      // ignore rollback err
    }
    if (txErr instanceof InsufficientStockError) {
      const missingBottlesList = (txErr.insufficientItems || [])
        .map((b) => `${b.productName} (cần ${b.requested}, khả dụng ${b.available})`)
        .join(', ');
      return {
        success: false,
        statusCode: 409,
        error: missingBottlesList
          ? `Tồn kho chi nhánh đích không đủ cho: ${missingBottlesList}`
          : txErr.message,
        insufficientItems: txErr.insufficientItems,
      };
    }
    throw txErr;
  } finally {
    if (shouldRelease) {
      client.release();
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị' }, { status: 401 });
    }

    // CHỈ SUPER_ADMIN mới có quyền chuyển đơn hàng giữa các chi nhánh
    if (!hasPermission(session, 'orders.transfer')) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên có quyền chuyển đơn mới có thể chuyển đơn sang chi nhánh khác.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { orderId, targetStoreCode } = body;

    const result = await executeOrderTransfer({
      orderId,
      targetStoreCode,
      actor: {
        id: session.id,
        username: session.username,
        role: session.role,
      },
    });

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        error: result.error,
        order: result.order,
        insufficientItems: result.insufficientItems,
      },
      { status: result.statusCode }
    );
  } catch (error: any) {
    console.error('Error transferring order store:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
