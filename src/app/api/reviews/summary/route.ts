import { NextRequest, NextResponse } from 'next/server';
import { getProductReviewSummary, getProductRatingMap } from '@/lib/reviews/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Nhiều sản phẩm một lượt (thẻ ở dải sản phẩm): ?ids=a,b,c → { mã: { average, count } }
    const idsParam = searchParams.get('ids');
    if (idsParam !== null) {
      const ids = idsParam.split(',').map((s) => s.trim().slice(0, 100)).filter(Boolean).slice(0, 60);
      const data = await getProductRatingMap(ids);
      return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
    }

    const productId = searchParams.get('productId') || searchParams.get('slug') || '';

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã sản phẩm (productId)' },
        { status: 400 }
      );
    }

    const summary = await getProductReviewSummary(productId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error in GET /api/reviews/summary:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi tải tóm tắt đánh giá: ' + (error?.message || 'Lỗi hệ thống') },
      { status: 500 }
    );
  }
}
