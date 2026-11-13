import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { ENABLE_DAILY_DEALS } from '@/config/features';
import {
  DAILY_DEALS_KEY,
  WEEKLY_DELIVERY_KEY,
  getSiteSetting,
  getWeeklyDelivery,
  parseWeeklyDelivery,
  setSiteSetting,
} from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

/** Trạng thái công tắc "Deal trong ngày" cho trang admin (tab Combo) */
async function readDailyDeals() {
  const row = await getSiteSetting(DAILY_DEALS_KEY);
  return {
    key: DAILY_DEALS_KEY,
    enabled: row?.value === true,
    // Cờ tổng trong code (src/config/features.ts): false → công tắc admin không có tác dụng
    masterEnabled: ENABLE_DAILY_DEALS,
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

/** Dòng "Hơn ... chai được giao mỗi tuần" (trang chi tiết combo) */
async function readWeeklyDelivery() {
  return { key: WEEKLY_DELIVERY_KEY, ...(await getWeeklyDelivery()) };
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!hasPermission(session, 'combos.view')) {
    return NextResponse.json({ success: false, error: 'Bạn không có quyền xem cài đặt gói.', code: 'FORBIDDEN' }, { status: 403 });
  }
  // ?key=weekly_delivery_line → dòng số chai giao mỗi tuần; không có key → công tắc Deal trong ngày (như cũ)
  const key = new URL(request.url).searchParams.get('key');
  if (key === WEEKLY_DELIVERY_KEY) {
    return NextResponse.json({ success: true, data: await readWeeklyDelivery() });
  }
  return NextResponse.json({ success: true, data: await readDailyDeals() });
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!hasPermission(session, 'combos.manage')) {
    return NextResponse.json({ success: false, error: 'Bạn không có quyền đổi cài đặt gói.', code: 'FORBIDDEN' }, { status: 403 });
  }

  let body: { key?: unknown; enabled?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  if (body.key === WEEKLY_DELIVERY_KEY) {
    const parsed = parseWeeklyDelivery(body.value);
    if ('error' in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    try {
      const before = await readWeeklyDelivery();
      await setSiteSetting(WEEKLY_DELIVERY_KEY, parsed.value, session.username);
      const after = await readWeeklyDelivery();
      await writeAuditLog({
        adminId: session.id,
        adminUsername: session.username,
        role: session.role,
        action: 'SITE_SETTING_UPDATE',
        entityType: 'SITE_SETTING',
        entityId: WEEKLY_DELIVERY_KEY,
        beforeJson: { count: before.count, textVi: before.textVi, textEn: before.textEn },
        afterJson: { count: after.count, textVi: after.textVi, textEn: after.textEn },
      });
      return NextResponse.json({ success: true, data: after });
    } catch (error) {
      console.error('Error updating weekly delivery line:', error);
      return NextResponse.json({ success: false, error: 'Không lưu được cài đặt. Vui lòng thử lại.' }, { status: 500 });
    }
  }
  // Chỉ nhận đúng khoá Deal trong ngày và giá trị true/false
  if (body.key !== DAILY_DEALS_KEY || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  try {
    const before = await readDailyDeals();
    await setSiteSetting(DAILY_DEALS_KEY, body.enabled, session.username);
    const after = await readDailyDeals();

    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'SITE_SETTING_UPDATE',
      entityType: 'SITE_SETTING',
      entityId: DAILY_DEALS_KEY,
      beforeJson: { key: DAILY_DEALS_KEY, enabled: before.enabled },
      afterJson: { key: DAILY_DEALS_KEY, enabled: after.enabled },
    });

    return NextResponse.json({ success: true, data: after });
  } catch (error) {
    console.error('Error updating site setting:', error);
    return NextResponse.json({ success: false, error: 'Không lưu được cài đặt. Vui lòng thử lại.' }, { status: 500 });
  }
}
