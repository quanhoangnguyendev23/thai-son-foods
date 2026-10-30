import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { getComboStockDetails } from '@/lib/inventory';
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
    const canViewTotal = hasPermission(session, 'inventory.view_total');

    if (!canViewAll && !canViewOwn && !canViewTotal) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem chi tiết tồn kho combo.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const storeCode = searchParams.get('storeCode') || 'NH';
    const comboId = searchParams.get('comboId') || searchParams.get('slug') || '';

    if (!comboId) {
      return NextResponse.json({ success: false, error: 'Thiếu mã combo (comboId hoặc slug)' }, { status: 400 });
    }

    const details = await getComboStockDetails(storeCode, comboId);

    // Kiểm tra các cờ cảnh báo đỏ
    const hasNegativeStock = details.bottles.some((b) => b.stockQuantity < 0);
    const hasStockBelowReserved = details.bottles.some((b) => b.stockQuantity < b.reserved);

    return NextResponse.json({
      success: true,
      data: {
        ...details,
        alerts: {
          hasNegativeStock,
          hasStockBelowReserved,
          warningMessage: hasNegativeStock
            ? 'CẢNH BÁO ĐỎ: Có chai thành phần tồn kho âm!'
            : hasStockBelowReserved
            ? 'CẢNH BÁO ĐỎ: Có chai thành phần tồn kho thực tế nhỏ hơn số lượng đang giữ chỗ!'
            : null,
        },
      },
    });
  } catch (error: any) {
    console.error('[Admin Combo Inventory Details API] Error:', error);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(error, 'Lỗi lấy chi tiết tồn kho combo') },
      { status: 500 }
    );
  }
}
