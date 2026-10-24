import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { query } from '@/lib/db';
import { INVENTORY_SHEET_CONFIG, isSheetInventoryMode } from '@/config/inventorySheet';
import {
  getSheetSnapshot,
  getSheetStatus,
  setStopSale,
  syncInventoryFromSheet,
  ensureFreshSheetInventory,
} from '@/lib/inventorySheet';

export const dynamic = 'force-dynamic';
// Đọc Google Sheet có thể mất vài giây: nới thời gian chạy tối đa trên Vercel (mặc định Hobby chỉ 10 giây)
export const maxDuration = 30;

const STORE_CODE_RE = /^[A-Za-z0-9_-]{1,50}$/;

/**
 * GET: Tồn kho theo lô đọc từ Google Sheet cho một cửa hàng (ảnh chụp lần đồng bộ gần nhất).
 * Nhân viên cửa hàng chỉ xem được cửa hàng của mình.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị' }, { status: 401 });
    }
    const canViewAll = hasPermission(session, 'inventory.view_all');
    if (!canViewAll && !hasPermission(session, 'inventory.view_own_store')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem kho hàng.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (!isSheetInventoryMode()) {
      return NextResponse.json({ success: true, mode: 'manual' });
    }

    const { searchParams } = new URL(req.url);
    let storeCode = (searchParams.get('storeCode') || '').trim();
    const scope = getStoreScope(session);
    if (scope) storeCode = scope;
    if (!storeCode) storeCode = 'NH';
    if (!STORE_CODE_RE.test(storeCode)) {
      return NextResponse.json({ success: false, error: 'Mã cửa hàng không hợp lệ.' }, { status: 400 });
    }

    // Mở trang admin cũng kéo dữ liệu mới nếu đã quá chu kỳ
    await ensureFreshSheetInventory();

    const [status, rows] = await Promise.all([getSheetStatus(), getSheetSnapshot(storeCode)]);
    const sheetHasStore = rows.some((r) => r.hasSnapshot);

    return NextResponse.json({
      success: true,
      mode: 'sheet',
      storeCode,
      sheetHasStore,
      status,
      rows,
    });
  } catch (error: any) {
    console.error('[AdminInventorySheet] GET lỗi:', error);
    return NextResponse.json({ success: false, error: 'Không đọc được dữ liệu tồn kho từ sheet.' }, { status: 500 });
  }
}

/**
 * POST { action: 'sync' }                                   : đọc lại sheet ngay (cách nhau tối thiểu 1 phút)
 * POST { action: 'stop_sale', storeCode, productId, stopped, reason? } : bật/tắt "tạm hết hàng"
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị' }, { status: 401 });
    }
    if (!hasPermission(session, 'inventory.update_own_store')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền thao tác kho hàng.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    if (!isSheetInventoryMode()) {
      return NextResponse.json({ success: false, error: 'Tồn kho đang ở chế độ nhập tay.', code: 'NOT_SHEET_MODE' }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'sync') {
      const before = await getSheetStatus();
      const lastAttempt = before.lastAttemptAt ? new Date(before.lastAttemptAt).getTime() : 0;
      const gap = Date.now() - lastAttempt;
      if (lastAttempt && gap < INVENTORY_SHEET_CONFIG.MANUAL_REFRESH_MIN_GAP_MS) {
        const retryAfterSeconds = Math.max(1, Math.ceil((INVENTORY_SHEET_CONFIG.MANUAL_REFRESH_MIN_GAP_MS - gap) / 1000));
        return NextResponse.json(
          {
            success: false,
            error: `Sheet vừa được đọc cách đây ít giây. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
            code: 'TOO_SOON',
            retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      const result = await syncInventoryFromSheet({ actor: session.username });
      const status = await getSheetStatus();

      await writeAuditLog({
        adminId: session.userId,
        adminUsername: session.username,
        role: session.role,
        action: 'INVENTORY_SHEET_SYNC',
        entityType: 'INVENTORY',
        afterJson: result.ok
          ? { changedRows: result.summary?.changedRows ?? 0, mappedRows: result.summary?.mappedRows ?? 0, skipped: result.skipped ?? null }
          : { error: result.error },
      });

      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error, code: 'SYNC_FAILED', status }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        message: result.skipped
          ? 'Một lần đọc khác đang chạy, vui lòng chờ vài giây rồi làm mới.'
          : `Đã đọc lại sheet: ${result.summary?.changedRows ?? 0} dòng thay đổi.`,
        summary: result.summary ?? null,
        status,
      });
    }

    if (action === 'stop_sale') {
      const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
      let storeCode = typeof body.storeCode === 'string' ? body.storeCode.trim() : '';
      const stopped = body.stopped === true;
      const reason = typeof body.reason === 'string' ? body.reason : null;

      const scope = getStoreScope(session);
      if (scope) {
        if (storeCode && storeCode !== scope) {
          return NextResponse.json(
            { success: false, error: 'Bạn chỉ được thao tác kho của cửa hàng mình.', code: 'FORBIDDEN' },
            { status: 403 }
          );
        }
        storeCode = scope;
      }
      if (!storeCode || !STORE_CODE_RE.test(storeCode)) {
        return NextResponse.json({ success: false, error: 'Mã cửa hàng không hợp lệ.' }, { status: 400 });
      }
      if (!Object.values(INVENTORY_SHEET_CONFIG.SP_TO_PRODUCT_ID).includes(productId)) {
        return NextResponse.json({ success: false, error: 'Sản phẩm không thuộc danh sách tồn kho theo sheet.' }, { status: 400 });
      }
      const storeRes = await query('SELECT code FROM stores WHERE code = $1 LIMIT 1;', [storeCode]);
      if (storeRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: `Chi nhánh "${storeCode}" không tồn tại.` }, { status: 400 });
      }
      const prodRes = await query('SELECT id FROM products WHERE id = $1 LIMIT 1;', [productId]);
      if (prodRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Sản phẩm không tồn tại.' }, { status: 404 });
      }

      const result = await setStopSale({ storeCode, productId, stopped, reason, actor: session.username });

      await writeAuditLog({
        adminId: session.userId,
        adminUsername: session.username,
        role: session.role,
        action: stopped ? 'INVENTORY_STOP_SALE' : 'INVENTORY_RESUME_SALE',
        entityType: 'INVENTORY',
        entityId: productId,
        storeCode,
        afterJson: { stopped, reason: reason ? reason.slice(0, 300) : null },
      });

      return NextResponse.json({
        success: true,
        message: stopped ? 'Đã chuyển sang tạm hết hàng.' : 'Đã mở bán lại theo tồn trên sheet.',
        data: { storeCode, productId, stopped, stockQuantity: result.stockQuantity },
      });
    }

    return NextResponse.json({ success: false, error: 'Hành động không hợp lệ.' }, { status: 400 });
  } catch (error: any) {
    console.error('[AdminInventorySheet] POST lỗi:', error);
    return NextResponse.json({ success: false, error: 'Không thực hiện được thao tác. Vui lòng thử lại.' }, { status: 500 });
  }
}
