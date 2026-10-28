import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { createOrUpdateInventoryLot } from '@/lib/partner/fefo';
import { isSheetInventoryMode } from '@/config/inventorySheet';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// GET: Danh sách lô hàng (kèm hạn dùng). Nhân viên cửa hàng chỉ xem lô của chi nhánh mình.
export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const canViewAll = hasPermission(session, 'inventory.view_all');
    if (!canViewAll && !hasPermission(session, 'inventory.view_own_store')) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền xem lô hàng', code: 'FORBIDDEN' }, { status: 403 });
    }

    const storeScope = getStoreScope(session);
    const { searchParams } = new URL(request.url);
    const storeCode = searchParams.get('storeCode');
    const productId = searchParams.get('productId');

    let sql = `
      SELECT
        il.*,
        p.name AS product_name,
        p.thumbnail AS product_thumbnail,
        (il.stock_quantity - il.reserved_quantity) AS available_quantity,
        (il.expiry_date - CURRENT_DATE) AS days_remaining
      FROM inventory_lots il
      JOIN products p ON il.product_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (storeScope) {
      // Ép phạm vi chi nhánh từ phiên đăng nhập, bỏ qua storeCode do client gửi
      params.push(storeScope);
      sql += ` AND il.store_code = $${params.length}`;
    } else if (storeCode && storeCode !== 'ALL') {
      params.push(storeCode);
      sql += ` AND il.store_code = $${params.length}`;
    }
    if (productId) {
      params.push(productId);
      sql += ` AND il.product_id = $${params.length}`;
    }
    sql += ` ORDER BY il.expiry_date ASC, il.manufacturing_date ASC;`;

    const res = await query(sql, params);

    const lots = res.rows.map((lot) => {
      const daysRemaining = Number(lot.days_remaining) || 0;
      let expiryStatus = 'NORMAL';
      if (daysRemaining < 0) {
        expiryStatus = 'EXPIRED';
      } else if (daysRemaining <= 2) {
        expiryStatus = 'CRITICAL';
      } else if (daysRemaining <= 5) {
        expiryStatus = 'NEAR_EXPIRY';
      }

      return {
        ...lot,
        daysRemaining,
        expiryStatus,
      };
    });

    return NextResponse.json({ success: true, lots });
  } catch (error: any) {
    console.error('[AdminLots] Error fetching lots:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi hệ thống') }, { status: 500 });
  }
}

// POST: Nhập lô hàng mới. Nhân viên cửa hàng chỉ được nhập cho chi nhánh của mình.
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const canUpdateAll = hasPermission(session, 'inventory.view_all') && hasPermission(session, 'inventory.update_own_store');
    if (!hasPermission(session, 'inventory.update_own_store') && !hasPermission(session, 'dealer.manage')) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền nhập lô hàng mới', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Tồn kho lấy từ Google Sheet: lô hàng do sheet quyết định, không nhập tay trên web
    if (isSheetInventoryMode()) {
      return NextResponse.json(
        { success: false, error: 'Lô hàng đang lấy từ Google Sheet (theo ngày sản xuất/hạn dùng ở hai hàng đầu). Hãy cập nhật trong sheet.', code: 'SHEET_SOURCE' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { productId, lotCode, manufacturingDate, expiryDate } = body;
    let storeCode: string = typeof body.storeCode === 'string' ? body.storeCode.trim() : '';

    const storeScope = getStoreScope(session);
    if (storeScope) {
      if (storeCode && storeCode !== storeScope) {
        return NextResponse.json(
          { success: false, error: 'Bạn chỉ được nhập lô hàng cho chi nhánh của mình.', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
      storeCode = storeScope;
    } else if (!canUpdateAll && !hasPermission(session, 'dealer.manage')) {
      return NextResponse.json({ success: false, error: 'Bạn không có quyền nhập lô cho chi nhánh này', code: 'FORBIDDEN' }, { status: 403 });
    }

    const cleanLotCode = typeof lotCode === 'string' ? lotCode.trim() : '';
    const quantity = Math.round(Number(body.quantity));

    if (!storeCode || !productId || !cleanLotCode || !manufacturingDate || !expiryDate) {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp đầy đủ thông tin lô hàng.' }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 1_000_000) {
      return NextResponse.json({ success: false, error: 'Số lượng phải là số nguyên từ 1 đến 1.000.000.' }, { status: 400 });
    }
    if (cleanLotCode.length > 100) {
      return NextResponse.json({ success: false, error: 'Mã lô tối đa 100 ký tự.' }, { status: 400 });
    }
    if (!isValidDate(manufacturingDate) || !isValidDate(expiryDate)) {
      return NextResponse.json({ success: false, error: 'Ngày sản xuất / hạn dùng không hợp lệ (định dạng YYYY-MM-DD).' }, { status: 400 });
    }
    if (expiryDate <= manufacturingDate) {
      return NextResponse.json({ success: false, error: 'Hạn sử dụng phải sau ngày sản xuất.' }, { status: 400 });
    }

    const storeRes = await query('SELECT code FROM stores WHERE code = $1 LIMIT 1;', [storeCode]);
    if (storeRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: `Chi nhánh "${storeCode}" không tồn tại.` }, { status: 400 });
    }
    const productRes = await query('SELECT id FROM products WHERE id = $1 LIMIT 1;', [productId]);
    if (productRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Sản phẩm không tồn tại.' }, { status: 400 });
    }

    // Cùng mã lô nhưng khác ngày → báo lỗi thay vì lặng lẽ cộng dồn vào lô cũ với hạn dùng sai
    const existing = await query(
      `SELECT manufacturing_date::text AS manufacturing_date, expiry_date::text AS expiry_date
       FROM inventory_lots WHERE store_code = $1 AND product_id = $2 AND lot_code = $3 LIMIT 1;`,
      [storeCode, productId, cleanLotCode]
    );
    if (existing.rows.length > 0) {
      const lot = existing.rows[0];
      if (lot.manufacturing_date !== manufacturingDate || lot.expiry_date !== expiryDate) {
        return NextResponse.json(
          {
            success: false,
            error: `Mã lô "${cleanLotCode}" đã tồn tại với NSX ${lot.manufacturing_date} / HSD ${lot.expiry_date}. Hãy dùng mã lô khác hoặc nhập đúng ngày của lô cũ để cộng thêm số lượng.`,
            code: 'LOT_DATE_MISMATCH',
          },
          { status: 409 }
        );
      }
    }

    const result = await createOrUpdateInventoryLot({
      storeCode,
      productId,
      lotCode: cleanLotCode,
      manufacturingDate,
      expiryDate,
      quantity,
    });

    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'INVENTORY_LOT_CREATE',
      entityType: 'INVENTORY_LOT',
      entityId: result.id,
      storeCode,
      afterJson: { productId, lotCode: cleanLotCode, manufacturingDate, expiryDate, quantity },
    });

    return NextResponse.json({
      success: true,
      message: `Đã nhập lô hàng ${cleanLotCode} thành công!`,
      lot: result,
    });
  } catch (error: any) {
    console.error('[AdminLots] Error creating lot:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi hệ thống') }, { status: 500 });
  }
}
