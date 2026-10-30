import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { isOptionalSafeUrl, isSafeUrl } from '@/lib/content-validation';
import { getAdminSession } from '@/lib/auth';
import { resolveUploadedFile } from '@/lib/content-validation';
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

// GET: Lấy tất cả banner cho admin
export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'content.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý nội dung banner.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }
    const { searchParams } = new URL(request.url);
    const placement = searchParams.get('placement');

    let sql = `SELECT * FROM banners WHERE 1=1`;
    const params: any[] = [];

    if (placement) {
      params.push(placement);
      sql += ` AND placement = $${params.length}`;
    }

    sql += ` ORDER BY placement ASC, sort_order ASC, created_at ASC;`;

    const res = await query(sql, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error fetching admin banners:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// POST: Tạo mới banner
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'content.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý nội dung banner.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      subtitle,
      tag,
      image,
      mobile_image,
      alt,
      link,
      placement = 'hero',
      sort_order = 0,
      is_active = true,
    } = body;

    if (!image) {
      return NextResponse.json({ success: false, error: 'Hình ảnh banner là bắt buộc' }, { status: 400 });
    }

    if (!isSafeUrl(image) || !isOptionalSafeUrl(mobile_image) || !isOptionalSafeUrl(link)) {
      return NextResponse.json(
        { success: false, error: 'Ảnh và liên kết banner phải là đường dẫn nội bộ ("/...") hoặc địa chỉ http(s) hợp lệ.' },
        { status: 400 }
      );
    }
    if (typeof placement !== 'string' || !/^[a-z0-9_-]{1,30}$/i.test(placement)) {
      return NextResponse.json({ success: false, error: 'Vị trí hiển thị banner không hợp lệ.' }, { status: 400 });
    }

    const id = `ban_${Date.now()}`;
    const baseSlug = title ? slugify(title) : `banner-${Date.now()}`;
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    const res = await query(
      `INSERT INTO banners (
        id, slug, title, subtitle, tag, image, mobile_image, alt, link, placement, sort_order, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;`,
      [
        id,
        slug,
        title || null,
        subtitle || null,
        tag || null,
        image,
        mobile_image || null,
        alt || title || 'Thái Sơn Foods',
        link || null,
        placement,
        parseInt(sort_order, 10) || 0,
        Boolean(is_active),
      ]
    );

    const created = res.rows[0];
    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'BANNER_CREATE',
      entityType: 'BANNER',
      entityId: id,
      afterJson: created,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error('Error creating banner:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật banner
export async function PUT(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'content.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý nội dung banner.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      title,
      subtitle,
      tag,
      image,
      mobile_image,
      alt,
      link,
      placement,
      sort_order,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID banner' }, { status: 400 });
    }

    if (
      (image !== undefined && !isSafeUrl(image)) ||
      !isOptionalSafeUrl(mobile_image) ||
      !isOptionalSafeUrl(link)
    ) {
      return NextResponse.json(
        { success: false, error: 'Ảnh và liên kết banner phải là đường dẫn nội bộ ("/...") hoặc địa chỉ http(s) hợp lệ.' },
        { status: 400 }
      );
    }
    if (placement !== undefined && (typeof placement !== 'string' || !/^[a-z0-9_-]{1,30}$/i.test(placement))) {
      return NextResponse.json({ success: false, error: 'Vị trí hiển thị banner không hợp lệ.' }, { status: 400 });
    }
    if (sort_order !== undefined && !Number.isInteger(Number(sort_order))) {
      return NextResponse.json({ success: false, error: 'Thứ tự hiển thị phải là số nguyên.' }, { status: 400 });
    }

    const check = await query(`SELECT * FROM banners WHERE id = $1;`, [id]);
    const beforeBanner = check.rows[0] || null;

    const updates: string[] = [];
    const params: any[] = [id];

    if (title !== undefined) {
      params.push(title);
      updates.push(`title = $${params.length}`);
    }
    if (subtitle !== undefined) {
      params.push(subtitle);
      updates.push(`subtitle = $${params.length}`);
    }
    if (tag !== undefined) {
      params.push(tag);
      updates.push(`tag = $${params.length}`);
    }
    if (image !== undefined) {
      params.push(image);
      updates.push(`image = $${params.length}`);
    }
    if (mobile_image !== undefined) {
      params.push(mobile_image);
      updates.push(`mobile_image = $${params.length}`);
    }
    if (alt !== undefined) {
      params.push(alt);
      updates.push(`alt = $${params.length}`);
    }
    if (link !== undefined) {
      params.push(link);
      updates.push(`link = $${params.length}`);
    }
    if (placement !== undefined) {
      params.push(placement);
      updates.push(`placement = $${params.length}`);
    }
    if (sort_order !== undefined) {
      params.push(parseInt(sort_order, 10));
      updates.push(`sort_order = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(Boolean(is_active));
      updates.push(`is_active = $${params.length}`);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const res = await query(
      `UPDATE banners SET ${updates.join(', ')} WHERE id = $1 RETURNING *;`,
      params
    );

    const updated = res.rows[0];
    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'BANNER_UPDATE',
      entityType: 'BANNER',
      entityId: id,
      beforeJson: beforeBanner,
      afterJson: updated,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating banner:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: Xóa banner
export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'content.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý nội dung banner.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID banner' }, { status: 400 });
    }

    const check = await query(`SELECT * FROM banners WHERE id = $1;`, [id]);
    const beforeBanner = check.rows[0] || null;

    if (check.rows.length > 0) {
      const imgUrl = check.rows[0].image;
      const absPath = resolveUploadedFile(imgUrl);
      if (imgUrl && absPath) {
        try {
          if (fs.existsSync(absPath)) {
            await fs.promises.unlink(absPath);
          }
        } catch (e) {
          console.warn('Could not delete banner file:', e);
        }
      }
    }

    await query(`DELETE FROM banners WHERE id = $1;`, [id]);

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'BANNER_DELETE',
      entityType: 'BANNER',
      entityId: id,
      beforeJson: beforeBanner,
    });

    return NextResponse.json({ success: true, message: 'Đã xóa banner thành công' });
  } catch (error: any) {
    console.error('Error deleting banner:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
