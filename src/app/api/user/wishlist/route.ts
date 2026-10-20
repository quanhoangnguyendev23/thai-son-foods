import { NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { getUserSession } from '@/lib/auth';
import { isSafeItemId } from '@/lib/product-stats';

export const dynamic = 'force-dynamic';

const MAX_WISHLIST_ITEMS = 200;

function parseItemType(value: unknown): 'product' | 'combo' | null {
  return value === 'product' || value === 'combo' ? value : null;
}

async function requireUserId() {
  const session = await getUserSession();
  return session && session.id ? String(session.id) : null;
}

// GET /api/user/wishlist                          → danh sách yêu thích của tài khoản
// GET /api/user/wishlist?itemType=..&itemId=..    → { saved: boolean } cho một mục
export async function GET(request: Request) {
  try {
    await initDatabase();
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemType = parseItemType(searchParams.get('itemType'));
    const itemId = searchParams.get('itemId');

    if (itemType && isSafeItemId(itemId)) {
      const res = await query(
        'SELECT 1 FROM wishlists WHERE user_id = $1 AND item_type = $2 AND item_id = $3 LIMIT 1;',
        [userId, itemType, itemId]
      );
      return NextResponse.json({ success: true, saved: res.rows.length > 0 });
    }

    const res = await query(
      'SELECT item_type, item_id, created_at FROM wishlists WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2;',
      [userId, MAX_WISHLIST_ITEMS]
    );
    return NextResponse.json({
      success: true,
      items: res.rows.map((r) => ({ itemType: r.item_type, itemId: r.item_id, createdAt: r.created_at })),
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return NextResponse.json({ success: false, error: 'Không thể tải danh sách yêu thích' }, { status: 500 });
  }
}

// POST /api/user/wishlist { itemType, itemId } → thêm vào yêu thích
export async function POST(request: Request) {
  try {
    await initDatabase();
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const itemType = parseItemType((body as any).itemType);
    const itemId = (body as any).itemId;
    if (!itemType || !isSafeItemId(itemId)) {
      return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const countRes = await query('SELECT COUNT(*)::int AS total FROM wishlists WHERE user_id = $1;', [userId]);
    if (Number(countRes.rows[0]?.total || 0) >= MAX_WISHLIST_ITEMS) {
      return NextResponse.json(
        { success: false, error: `Danh sách yêu thích tối đa ${MAX_WISHLIST_ITEMS} mục` },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO wishlists (user_id, item_type, item_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_type, item_id) DO NOTHING;`,
      [userId, itemType, itemId]
    );
    return NextResponse.json({ success: true, saved: true });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return NextResponse.json({ success: false, error: 'Không thể lưu vào yêu thích' }, { status: 500 });
  }
}

// DELETE /api/user/wishlist?itemType=..&itemId=.. → bỏ khỏi yêu thích
export async function DELETE(request: Request) {
  try {
    await initDatabase();
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemType = parseItemType(searchParams.get('itemType'));
    const itemId = searchParams.get('itemId');
    if (!itemType || !isSafeItemId(itemId)) {
      return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    await query('DELETE FROM wishlists WHERE user_id = $1 AND item_type = $2 AND item_id = $3;', [
      userId,
      itemType,
      itemId,
    ]);
    return NextResponse.json({ success: true, saved: false });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return NextResponse.json({ success: false, error: 'Không thể bỏ khỏi yêu thích' }, { status: 500 });
  }
}
