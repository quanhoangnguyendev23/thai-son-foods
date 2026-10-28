import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { syncInventoryFromSheet } from '@/lib/inventorySheet';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';
// Đọc Google Sheet có thể mất vài giây: nới thời gian chạy tối đa trên Vercel (mặc định Hobby chỉ 10 giây)
export const maxDuration = 30;

/**
 * Đọc lại tồn kho từ Google Sheet theo lịch (gọi từ dịch vụ hẹn giờ bên ngoài, ví dụ mỗi 15-30 phút).
 * Bảo vệ bằng header Authorization: Bearer <CRON_SECRET> (giống /api/cron/cleanup-reservations).
 * Nếu không gọi route này, web vẫn tự đọc lại khi có người xem tồn kho sau mỗi chu kỳ (mặc định 15 phút).
 */
export async function GET(request: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      console.error('[Cron Security] CRON_SECRET is not configured in environment variables.');
      return NextResponse.json(
        { success: false, error: 'Lỗi cấu hình hệ thống: Biến môi trường CRON_SECRET chưa được thiết lập.' },
        { status: 500 }
      );
    }

    const authBuffer = Buffer.from(request.headers.get('authorization') || '');
    const expectedBuffer = Buffer.from(`Bearer ${expectedSecret}`);
    if (authBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(authBuffer, expectedBuffer)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Header Authorization không hợp lệ.' }, { status: 401 });
    }

    const result = await syncInventoryFromSheet({ actor: 'cron' });
    const timestamp = new Date().toISOString();
    if (!result.ok) {
      console.error(`[Cron SyncInventory] ${timestamp} | Lỗi: ${result.error}`);
      return NextResponse.json({ success: false, timestamp, error: result.error }, { status: 502 });
    }
    console.log(`[Cron SyncInventory] ${timestamp} | changed=${result.summary?.changedRows ?? 0} skipped=${result.skipped ?? '-'}`);
    return NextResponse.json({ success: true, timestamp, skipped: result.skipped ?? null, summary: result.summary ?? null });
  } catch (error: any) {
    console.error('[Cron SyncInventory] Error:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

export const POST = GET;
