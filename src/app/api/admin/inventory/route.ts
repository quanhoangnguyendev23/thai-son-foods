import { NextRequest, NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { isSheetInventoryMode } from '@/config/inventorySheet';

export const dynamic = 'force-dynamic';

import { ACTIVE_STORES } from '@/data/stores';

// Danh sách các cửa hàng mặc định
const STORE_LIST = ACTIVE_STORES.map((s) => ({
  code: s.code,
  name: s.name,
  address: s.address,
}));

// GET: Lấy tồn kho của cửa hàng
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị' }, { status: 401 });
    }

    const canViewAll = hasPermission(session, 'inventory.view_all');
    const canViewOwn = hasPermission(session, 'inventory.view_own_store');
    const canViewTotal = hasPermission(session, 'inventory.view_total');

    if (!canViewAll && !canViewOwn && !canViewTotal) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập kho hàng.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Trường hợp MARKETING (chỉ có inventory.view_total, không có view_all hay view_own_store)
    if (canViewTotal && !canViewAll && !canViewOwn) {
      const sqlTotal = `
        SELECT 
          p.id AS product_id,
          p.name AS product_name,
          p.sku,
          p.price,
          p.unit,
          p.thumbnail,
          p.is_active,
          c.name AS category_name,
          COALESCE(SUM(si.stock_quantity), 0) AS stock_quantity,
          COALESCE(SUM(si.reserved), 0) AS reserved,
          GREATEST(0, COALESCE(SUM(si.stock_quantity), 0) - COALESCE(SUM(si.reserved), 0) - COALESCE(SUM(si.safety_stock), 0)) AS available_quantity,
          GREATEST(0, COALESCE(SUM(si.stock_quantity), 0) - COALESCE(SUM(si.reserved), 0) - COALESCE(SUM(si.safety_stock), 0)) AS sellable_quantity,
          COALESCE(SUM(si.safety_stock), 0) AS safety_stock
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN store_inventory si ON si.product_id = p.id
        GROUP BY p.id, c.name
        ORDER BY p.id ASC;
      `;
      const resTotal = await query(sqlTotal);
      return NextResponse.json({
        success: true,
        currentStore: 'TOTAL',
        stores: [],
        isSuperAdmin: false,
        isTotalOnly: true,
        data: resTotal.rows,
      });
    }

    const { searchParams } = new URL(req.url);
    let requestedStore = searchParams.get('storeCode');

    // Nếu là STORE_STAFF, chỉ được xem kho của cửa hàng mình
    const storeScope = getStoreScope(session);
    if (storeScope) {
      requestedStore = storeScope;
    } else {
      // Super admin mặc định xem NH (Vườn Lài - Tân Phú) nếu chưa chọn
      if (!requestedStore) {
        requestedStore = 'NH';
      }
    }

    // Tồn kho lấy từ Google Sheet: đọc lại sheet nếu đã quá chu kỳ trước khi trả số cho admin
    const sheetMode = isSheetInventoryMode();
    if (sheetMode) {
      const { ensureFreshSheetInventory } = await import('@/lib/inventorySheet');
      await ensureFreshSheetInventory();
    }

    // Đảm bảo mỗi sản phẩm đều có 1 bản ghi tồn kho riêng cho cửa hàng này (không dùng chung)
    // (chế độ sheet: bản ghi mới bắt đầu từ 0, số thật do sheet quyết định)
    await query(
      `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, updated_by)
       SELECT 'inv_' || $1 || '_' || p.id, $1, p.id, $2::int, $1
       FROM products p
       ON CONFLICT (store_code, product_id) DO NOTHING;`,
      [requestedStore, sheetMode ? 0 : 100]
    );

    const sql = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        p.price,
        p.unit,
        p.thumbnail,
        p.is_active,
        c.name AS category_name,
        COALESCE(si.stock_quantity, 0) AS stock_quantity,
        COALESCE(si.reserved, 0) AS reserved,
        GREATEST(0, COALESCE(si.stock_quantity, 0) - COALESCE(si.reserved, 0) - COALESCE(si.safety_stock, 0)) AS available_quantity,
        GREATEST(0, COALESCE(si.stock_quantity, 0) - COALESCE(si.reserved, 0) - COALESCE(si.safety_stock, 0)) AS sellable_quantity,
        COALESCE(si.safety_stock, 0) AS safety_stock,
        si.updated_at,
        si.updated_by
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN store_inventory si ON si.product_id = p.id AND si.store_code = $1
      ORDER BY p.id ASC;
    `;

    const res = await query(sql, [requestedStore]);

    const storeQuery = await query(
      `SELECT code, name, address, phone, district, province, map_url FROM stores WHERE is_active = true ORDER BY code ASC;`
    );
    const activeStores = storeQuery.rows.length > 0 ? storeQuery.rows : STORE_LIST;

    return NextResponse.json({
      success: true,
      currentStore: requestedStore,
      stores: activeStores,
      isSuperAdmin: hasPermission(session, 'inventory.view_all'),
      data: res.rows,
    });
  } catch (error: any) {
    console.error('Error fetching store inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

const MAX_STOCK_QUANTITY = 1_000_000;
const MAX_BATCH_ITEMS = 200;

/** Tồn kho phải là số nguyên không âm (chuỗi số hoặc số); trả về null nếu không hợp lệ */
function parseStockQuantity(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_STOCK_QUANTITY) return null;
  return n;
}

class InventoryInputError extends Error {
  constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

// PUT: Cập nhật số lượng mặt hàng (1 sản phẩm hoặc nhiều sản phẩm theo mảng).
// Toàn bộ thao tác nằm trong MỘT transaction và khóa dòng tồn kho (SELECT ... FOR UPDATE):
// tránh ghi đè mất lượng trừ kho của đơn vừa xác nhận cùng lúc, và batch không bao giờ cập nhật dở dang.
export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị' }, { status: 401 });
    }

    if (!hasPermission(session, 'inventory.update_own_store')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền cập nhật tồn kho.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Tồn kho lấy từ Google Sheet (chỉ đọc): không cho sửa số lượng trên web, kế toán sửa trực tiếp trong sheet
    if (isSheetInventoryMode()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tồn kho đang lấy từ Google Sheet. Hãy cập nhật số lượng trong sheet, web sẽ tự đọc lại (hoặc bấm "Cập nhật ngay").',
          code: 'SHEET_SOURCE',
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    let storeCode: string = typeof body.storeCode === 'string' ? body.storeCode.trim() : '';
    const { productId, stockQuantity, items } = body;

    // Phân quyền cửa hàng: STAFF chỉ được sửa kho của chính mình
    const storeScope = getStoreScope(session);
    if (storeScope) {
      storeCode = storeScope;
    } else if (!storeCode) {
      storeCode = 'NH';
    }

    // Chuẩn hóa danh sách cần cập nhật (1 sản phẩm lẻ hoặc batch) và kiểm tra đầu vào TRƯỚC khi chạm CSDL
    const isBatch = Array.isArray(items) && items.length > 0;
    const rawList: Array<{ productId: unknown; stockQuantity: unknown }> = isBatch
      ? items
      : [{ productId, stockQuantity }];

    if (rawList.length > MAX_BATCH_ITEMS) {
      return NextResponse.json({ success: false, error: `Mỗi lần chỉ cập nhật tối đa ${MAX_BATCH_ITEMS} mặt hàng.` }, { status: 400 });
    }

    const updates = new Map<string, number>();
    for (const it of rawList) {
      const pId = typeof it?.productId === 'string' ? it.productId.trim() : '';
      if (!pId) {
        return NextResponse.json({ success: false, error: 'Thiếu mã sản phẩm (productId)' }, { status: 400 });
      }
      const qty = parseStockQuantity(it.stockQuantity);
      if (qty === null) {
        return NextResponse.json(
          { success: false, error: `Mã ${pId}: số lượng tồn phải là số nguyên từ 0 đến ${MAX_STOCK_QUANTITY.toLocaleString('vi-VN')}.` },
          { status: 400 }
        );
      }
      if (updates.has(pId)) {
        return NextResponse.json({ success: false, error: `Mã ${pId} bị lặp trong danh sách cập nhật.` }, { status: 400 });
      }
      updates.set(pId, qty);
    }

    const storeRes = await query('SELECT code FROM stores WHERE code = $1 LIMIT 1;', [storeCode]);
    if (storeRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: `Chi nhánh "${storeCode}" không tồn tại.` }, { status: 400 });
    }

    const results: Array<{ productId: string; oldStock: number; newStock: number }> = [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      for (const [pId, qty] of updates) {
        const prodRes = await client.query('SELECT id FROM products WHERE id = $1 LIMIT 1;', [pId]);
        if (prodRes.rows.length === 0) {
          throw new InventoryInputError(`Sản phẩm "${pId}" không tồn tại.`, 404);
        }

        // Khóa dòng tồn kho (nếu đã có) trước khi đọc số cũ
        const prev = await client.query(
          `SELECT stock_quantity, reserved FROM store_inventory WHERE store_code = $1 AND product_id = $2 FOR UPDATE;`,
          [storeCode, pId]
        );
        const oldStock = prev.rows.length > 0 ? Number(prev.rows[0].stock_quantity) || 0 : 0;
        const oldReserved = prev.rows.length > 0 ? Number(prev.rows[0].reserved) || 0 : 0;

        // Chặn nghiêm ngặt không cho giảm tồn xuống dưới số lượng đang giữ chỗ
        if (qty < oldReserved) {
          throw new InventoryInputError(
            `Mã ${pId}: không thể giảm tồn kho (${qty} chai) xuống dưới số lượng đang giữ chỗ (${oldReserved} chai). Hãy xử lý các đơn đang giữ chỗ trước.`,
            400,
            { reserved: oldReserved }
          );
        }

        await client.query(
          `INSERT INTO store_inventory (id, store_code, product_id, stock_quantity, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (store_code, product_id) DO UPDATE
           SET stock_quantity = EXCLUDED.stock_quantity,
               updated_by = EXCLUDED.updated_by,
               updated_at = CURRENT_TIMESTAMP;`,
          [`inv_${storeCode}_${pId}`, storeCode, pId, qty, session.username]
        );

        await client.query(
          `INSERT INTO inventory_logs (
            id, store_code, product_id, old_stock, new_stock, old_reserved, new_reserved, change_type, actor, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual_update', $8, $9);`,
          [
            `invlog_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`,
            storeCode,
            pId,
            oldStock,
            qty,
            oldReserved,
            oldReserved,
            session.username,
            isBatch
              ? `Admin batch update tồn kho từ ${oldStock} -> ${qty} chai`
              : `Admin cập nhật tồn kho thủ công từ ${oldStock} -> ${qty} chai`,
          ]
        );

        // Tồn kho tổng của sản phẩm = TỔNG TỒN KHO CỦA TẤT CẢ CỬA HÀNG
        await client.query(
          `UPDATE products
           SET stock_quantity = (SELECT COALESCE(SUM(stock_quantity), 0) FROM store_inventory WHERE product_id = $1)
           WHERE id = $1;`,
          [pId]
        );

        results.push({ productId: pId, oldStock, newStock: qty });
      }

      await client.query('COMMIT;');
    } catch (txErr) {
      await client.query('ROLLBACK;');
      if (txErr instanceof InventoryInputError) {
        return NextResponse.json({ success: false, error: txErr.message, ...txErr.extra }, { status: txErr.status });
      }
      throw txErr;
    } finally {
      client.release();
    }

    if (isBatch) {
      await writeAuditLog({
        adminId: session.userId,
        adminUsername: session.username,
        role: session.role,
        action: 'INVENTORY_BATCH_UPDATE',
        entityType: 'INVENTORY',
        storeCode,
        afterJson: { storeCode, itemCount: results.length },
      });
    } else {
      const r = results[0];
      await writeAuditLog({
        adminId: session.userId,
        adminUsername: session.username,
        role: session.role,
        action: 'INVENTORY_UPDATE',
        entityType: 'INVENTORY',
        entityId: r.productId,
        storeCode,
        beforeJson: { stock_quantity: r.oldStock },
        afterJson: { stock_quantity: r.newStock },
      });
    }

    const { invalidateGatekeeperCache } = await import('@/lib/inventoryGatekeeper');
    invalidateGatekeeperCache(storeCode);

    if (isBatch) {
      return NextResponse.json({
        success: true,
        message: `Đã cập nhật tồn kho thành công cho ${results.length} mặt hàng tại ${storeCode}!`,
      });
    }
    return NextResponse.json({
      success: true,
      message: `Đã cập nhật số lượng tồn kho thành ${results[0].newStock} chai cho cửa hàng ${storeCode}!`,
      data: { storeCode, productId: results[0].productId, stockQuantity: results[0].newStock },
    });
  } catch (error: any) {
    console.error('Error updating store inventory:', error);
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi cập nhật tồn kho. Vui lòng thử lại sau.' }, { status: 500 });
  }
}
