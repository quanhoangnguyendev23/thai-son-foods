import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import {
  WEEKLY_DELIVERY_MAX_COUNT,
  isWeeklyDeliveryItemType,
  listItemWeeklyDelivery,
  setItemWeeklyCount,
  type WeeklyDeliveryItemType,
} from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

/** Số chai giao mỗi tuần riêng cho từng sản phẩm / combo (admin nhập tay) */

const VIEW_PERM = { product: 'products.view', combo: 'combos.view' } as const;
const MANAGE_PERM = { product: 'products.manage', combo: 'combos.manage' } as const;
const MAX_ITEMS_PER_SAVE = 500;

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const itemType = new URL(request.url).searchParams.get('itemType');
  if (!isWeeklyDeliveryItemType(itemType)) {
    return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }
  if (!hasPermission(session, VIEW_PERM[itemType])) {
    return NextResponse.json({ success: false, error: 'Bạn không có quyền xem mục này.', code: 'FORBIDDEN' }, { status: 403 });
  }
  return NextResponse.json({ success: true, data: { itemType, counts: await listItemWeeklyDelivery(itemType) } });
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { itemType?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }
  const itemType = body.itemType;
  if (!isWeeklyDeliveryItemType(itemType) || !Array.isArray(body.items) || body.items.length > MAX_ITEMS_PER_SAVE) {
    return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }
  if (!hasPermission(session, MANAGE_PERM[itemType])) {
    return NextResponse.json({ success: false, error: 'Bạn không có quyền sửa mục này.', code: 'FORBIDDEN' }, { status: 403 });
  }

  // Mỗi phần tử: { itemId, count } — count là số nguyên ≥ 0, hoặc null để quay về số mặc định
  const changes: { itemId: string; count: number | null }[] = [];
  for (const raw of body.items as unknown[]) {
    const it = raw as { itemId?: unknown; count?: unknown };
    const itemId = typeof it?.itemId === 'string' ? it.itemId.trim() : '';
    const count = it?.count;
    const validCount =
      count === null || (typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= WEEKLY_DELIVERY_MAX_COUNT);
    if (!itemId || itemId.length > 100 || !validCount) {
      return NextResponse.json(
        { success: false, error: 'Số chai phải là số nguyên từ 0 đến 100.000.000 (để trống = dùng số mặc định).' },
        { status: 400 }
      );
    }
    changes.push({ itemId, count: count as number | null });
  }

  try {
    const before = await listItemWeeklyDelivery(itemType as WeeklyDeliveryItemType);
    for (const c of changes) {
      await setItemWeeklyCount(itemType, c.itemId, c.count, session.username);
    }
    const after = await listItemWeeklyDelivery(itemType);

    if (changes.length > 0) {
      await writeAuditLog({
        adminId: session.id,
        adminUsername: session.username,
        role: session.role,
        action: 'SITE_SETTING_UPDATE',
        entityType: 'SITE_SETTING',
        entityId: `weekly_delivery_${itemType}`,
        beforeJson: Object.fromEntries(changes.map((c) => [c.itemId, before[c.itemId] ?? null])),
        afterJson: Object.fromEntries(changes.map((c) => [c.itemId, after[c.itemId] ?? null])),
      });
    }

    return NextResponse.json({ success: true, data: { itemType, counts: after } });
  } catch (error) {
    console.error('Error updating item weekly delivery:', error);
    return NextResponse.json({ success: false, error: 'Không lưu được số chai. Vui lòng thử lại.' }, { status: 500 });
  }
}
