import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// GET: Danh sách danh mục cùng số lượng sản phẩm
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'categories.view')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem danh mục.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }
    const res = await query(`
      SELECT 
        c.*,
        COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC;
    `);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// POST: Tạo danh mục mới
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'categories.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý danh mục.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const body = await request.json();
    const { name, slug } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Tên danh mục là bắt buộc' }, { status: 400 });
    }

    const catSlug = slug ? slugify(slug) : slugify(name);
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100 || !catSlug) {
      return NextResponse.json({ success: false, error: 'Tên danh mục không hợp lệ (tối đa 100 ký tự).' }, { status: 400 });
    }
    const slugTaken = await query(`SELECT 1 FROM categories WHERE slug = $1 LIMIT 1;`, [catSlug]);
    if (slugTaken.rows.length > 0) {
      return NextResponse.json({ success: false, error: `Đường dẫn "${catSlug}" đã được danh mục khác sử dụng.`, code: 'SLUG_TAKEN' }, { status: 409 });
    }
    const catId = `cat-${catSlug}-${Date.now().toString().slice(-4)}`;

    const res = await query(
      `INSERT INTO categories (id, slug, name)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [catId, catSlug, name]
    );

    const created = res.rows[0];
    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'CATEGORY_CREATE',
      entityType: 'CATEGORY',
      entityId: catId,
      afterJson: created,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật danh mục
export async function PUT(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'categories.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý danh mục.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const body = await request.json();
    const { id, name, slug } = body;

    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'Thiếu ID hoặc Tên danh mục' }, { status: 400 });
    }

    const existingRes = await query(`SELECT * FROM categories WHERE id = $1 LIMIT 1;`, [id]);
    const beforeCategory = existingRes.rows[0] || null;

    const catSlug = slug ? slugify(slug) : slugify(name);
    if (!beforeCategory) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy danh mục' }, { status: 404 });
    }
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100 || !catSlug) {
      return NextResponse.json({ success: false, error: 'Tên danh mục không hợp lệ (tối đa 100 ký tự).' }, { status: 400 });
    }
    const slugTakenByOther = await query(`SELECT 1 FROM categories WHERE slug = $1 AND id <> $2 LIMIT 1;`, [catSlug, id]);
    if (slugTakenByOther.rows.length > 0) {
      return NextResponse.json({ success: false, error: `Đường dẫn "${catSlug}" đã được danh mục khác sử dụng.`, code: 'SLUG_TAKEN' }, { status: 409 });
    }

    const res = await query(
      `UPDATE categories SET name = $2, slug = $3 WHERE id = $1 RETURNING *;`,
      [id, name, catSlug]
    );

    const updated = res.rows[0];
    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'CATEGORY_UPDATE',
      entityType: 'CATEGORY',
      entityId: id,
      beforeJson: beforeCategory,
      afterJson: updated,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating category:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: Xóa danh mục
export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'categories.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý danh mục.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID danh mục' }, { status: 400 });
    }

    const existingRes = await query(`SELECT * FROM categories WHERE id = $1 LIMIT 1;`, [id]);
    const beforeCategory = existingRes.rows[0] || null;

    if (!beforeCategory) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy danh mục' }, { status: 404 });
    }

    // Không xóa danh mục còn sản phẩm: nếu xóa, sản phẩm mất danh mục và biến mất khỏi các mục theo danh mục trên trang chủ
    const inUse = await query(`SELECT COUNT(*)::int AS n FROM products WHERE category_id = $1;`, [id]);
    if ((inUse.rows[0]?.n || 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Danh mục "${beforeCategory.name}" còn ${inUse.rows[0].n} sản phẩm. Hãy chuyển các sản phẩm sang danh mục khác trước khi xóa.`,
          code: 'CATEGORY_IN_USE',
        },
        { status: 409 }
      );
    }
    await query(`DELETE FROM categories WHERE id = $1;`, [id]);

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'CATEGORY_DELETE',
      entityType: 'CATEGORY',
      entityId: id,
      beforeJson: beforeCategory,
    });

    return NextResponse.json({ success: true, message: 'Đã xóa danh mục thành công' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
