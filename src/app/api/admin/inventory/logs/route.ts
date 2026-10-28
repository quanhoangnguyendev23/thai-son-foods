import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope } from '@/lib/rbac';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị' }, { status: 401 });
    }

    const canViewAll = hasPermission(session, 'inventory.view_all');
    const canViewOwn = hasPermission(session, 'inventory.view_own_store');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem nhật ký tồn kho.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    let storeCode = searchParams.get('storeCode');
    const productId = searchParams.get('productId');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // Phân quyền: Store Admin chỉ được xem log của kho mình
    const storeScope = getStoreScope(session);
    if (storeScope) {
      storeCode = storeScope;
    }

    let sql = `
      SELECT 
        l.id,
        l.store_code,
        s.name AS store_name,
        l.product_id,
        p.name AS product_name,
        p.thumbnail,
        p.unit,
        l.old_stock,
        l.new_stock,
        l.old_reserved,
        l.new_reserved,
        l.change_type,
        l.order_id,
        l.actor,
        l.note,
        l.created_at
      FROM inventory_logs l
      LEFT JOIN products p ON p.id = l.product_id
      LEFT JOIN stores s ON s.code = l.store_code
      WHERE 1=1
    `;
    const params: any[] = [];

    if (storeCode && storeCode !== 'ALL') {
      params.push(storeCode);
      sql += ` AND l.store_code = $${params.length}`;
    }

    if (productId) {
      params.push(productId);
      sql += ` AND l.product_id = $${params.length}`;
    }

    sql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1};`;
    params.push(limit);

    const res = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: res.rows,
    });
  } catch (error: any) {
    console.error('Error fetching inventory logs:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
