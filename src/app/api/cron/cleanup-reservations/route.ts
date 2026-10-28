import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { cleanupExpiredReservations } from '@/lib/inventory';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;

    // 1. Fail-closed: Nếu máy chủ chưa cấu hình CRON_SECRET thì từ chối xử lý và báo lỗi cấu hình 500
    if (!expectedSecret) {
      console.error('[Cron Security] CRON_SECRET is not configured in environment variables.');
      return NextResponse.json(
        {
          success: false,
          error: 'Lỗi cấu hình hệ thống: Biến môi trường CRON_SECRET chưa được thiết lập.',
        },
        { status: 500 }
      );
    }

    // 2. Không nhận secret qua query string. Bắt buộc nhận qua header Authorization: Bearer <CRON_SECRET>
    const authHeader = request.headers.get('authorization') || '';
    const expectedAuthHeader = `Bearer ${expectedSecret}`;

    const authBuffer = Buffer.from(authHeader);
    const expectedBuffer = Buffer.from(expectedAuthHeader);

    // 3. So sánh bằng timingSafeEqual để triệt tiêu timing attack
    if (
      authBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(authBuffer, expectedBuffer)
    ) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Header Authorization không hợp lệ.' },
        { status: 401 }
      );
    }

    const result = await cleanupExpiredReservations();
    const timestamp = new Date().toISOString();
    console.log(`[Cron Cleanup] ${timestamp} | Released: ${result.releasedReservationsCount} reservations | Cancelled: ${result.cancelledOrdersCount} orders`);

    return NextResponse.json({
      success: true,
      timestamp,
      ...result,
    });
  } catch (error: any) {
    console.error('[Cron Cleanup] Error releasing expired reservations:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

export const POST = GET;

