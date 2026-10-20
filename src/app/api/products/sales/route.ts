import { NextResponse } from 'next/server';
import { getTotalSold, isSafeItemId } from '@/lib/product-stats';

export const dynamic = 'force-dynamic';

// GET /api/products/sales?itemId=...&itemType=product|combo → tổng số lượng đã bán (kênh ngoài website + đơn trên web)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId') || '';
    const itemType = searchParams.get('itemType') === 'combo' ? 'combo' : 'product';
    const slug = searchParams.get('slug') || undefined;

    if (!isSafeItemId(itemId)) {
      return NextResponse.json({ success: false, error: 'itemId không hợp lệ' }, { status: 400 });
    }

    const count = await getTotalSold(itemId, itemType, slug);
    return NextResponse.json(
      { success: true, count },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (error) {
    console.error('Error fetching monthly sales:', error);
    return NextResponse.json({ success: false, error: 'Không thể lấy số liệu bán hàng' }, { status: 500 });
  }
}
