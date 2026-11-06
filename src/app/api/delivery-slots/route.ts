import { NextResponse } from 'next/server';
import { getDeliveryOptions } from '@/lib/deliverySlots';

export const dynamic = 'force-dynamic';

/**
 * GET /api/delivery-slots?eta=30
 * Trả về lựa chọn giao hàng (giao ngay / các khung hẹn) theo giờ Việt Nam. Không giới hạn số đơn mỗi khung.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eta = url.searchParams.get('eta');
  return NextResponse.json(
    { success: true, ...getDeliveryOptions(new Date(), eta) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
