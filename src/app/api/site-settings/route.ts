import { NextResponse } from 'next/server';
import { getItemWeeklyCount, getWeeklyDelivery, isWeeklyDeliveryItemType } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

/**
 * Cài đặt công khai cho trang khách (chỉ đọc, không cần đăng nhập).
 * Dòng "Hơn ... chai được Thái Sơn Foods giao mỗi tuần" ở trang chi tiết sản phẩm và combo:
 * ?itemType=product|combo&itemId=... → số riêng của món đó (nếu admin đã nhập), không thì số mặc định.
 * count = 0 → trang ẩn dòng này.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const itemType = params.get('itemType');
  const itemId = (params.get('itemId') || '').slice(0, 100);

  const { count: defaultCount, textVi, textEn } = await getWeeklyDelivery();
  const own = isWeeklyDeliveryItemType(itemType) && itemId ? await getItemWeeklyCount(itemType, itemId) : null;

  return NextResponse.json(
    { success: true, data: { weeklyDelivery: { count: own ?? defaultCount, textVi, textEn } } },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  );
}
