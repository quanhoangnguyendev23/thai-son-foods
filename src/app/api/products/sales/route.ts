import { NextResponse } from 'next/server';
import { getMonthlySales, isSafeItemId } from '@/lib/product-stats';

export const dynamic = 'force-dynamic';

// GET /api/products/sales?itemId=...&itemType=product|combo → số lượng đã đặt trong 30 ngày qua
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId') || '';
    const itemType = searchParams.get('itemType') === 'combo' ? 'combo' : 'product';

    if (!isSafeItemId(itemId)) {
      return NextResponse.json({ success: false, error: 'itemId không hợp lệ' }, { status: 400 });
    }

    const count = await getMonthlySales(itemId, itemType);
    return NextResponse.json(
      { success: true, count },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (error) {
    console.error('Error fetching monthly sales:', error);
    return NextResponse.json({ success: false, error: 'Không thể lấy số liệu bán hàng' }, { status: 500 });
  }
}
