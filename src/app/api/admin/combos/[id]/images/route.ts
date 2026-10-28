import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { isSafeUrl, resolveUploadedFile } from '@/lib/content-validation';
import { hasPermission } from '@/lib/rbac';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET: Lấy danh sách ảnh của combo
export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'combos.view')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem hình ảnh combo.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { id } = await context.params;

    const comboRes = await query(
      `SELECT id, name, slug, image FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [id]
    );

    if (comboRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy combo' }, { status: 404 });
    }

    const combo = comboRes.rows[0];

    const imagesRes = await query(
      `SELECT id, combo_id, url, alt, sort_order, image_type, is_active, created_at, updated_at
       FROM combo_images
       WHERE combo_id = $1
       ORDER BY sort_order ASC, created_at ASC;`,
      [combo.id]
    );

    return NextResponse.json({
      success: true,
      comboId: combo.id,
      primaryImage: combo.image,
      data: imagesRes.rows,
    });
  } catch (error: any) {
    console.error('Error fetching combo images:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// POST: Thêm một hoặc nhiều ảnh vào combo
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'combos.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý hình ảnh combo.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { id } = await context.params;

    const comboRes = await query(
      `SELECT id, name, slug, image FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [id]
    );

    if (comboRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy combo' }, { status: 404 });
    }

    const combo = comboRes.rows[0];
    const body = await request.json();

    const items = Array.isArray(body.images) ? body.images : [body];
    const insertedRows: any[] = [];

    const maxSortRes = await query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM combo_images WHERE combo_id = $1;`,
      [combo.id]
    );
    let nextSort = parseInt(maxSortRes.rows[0]?.max_sort || '0', 10) + 1;

    // Kiểm tra TẤT CẢ đường dẫn ảnh trước khi ghi để không thêm dở dang
    if (items.some((it: any) => it && it.url && !isSafeUrl(it.url))) {
      return NextResponse.json(
        { success: false, error: 'Đường dẫn ảnh phải là đường dẫn nội bộ ("/...") hoặc địa chỉ http(s) hợp lệ.' },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item.url) continue;
      if (!isSafeUrl(item.url)) {
        return NextResponse.json(
          { success: false, error: 'Đường dẫn ảnh phải là đường dẫn nội bộ ("/...") hoặc địa chỉ http(s) hợp lệ.' },
          { status: 400 }
        );
      }

      const imgId = `cimg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const alt = item.alt || combo.name;
      const sortOrder = item.sortOrder !== undefined ? parseInt(item.sortOrder, 10) : nextSort++;
      const imageType = item.imageType || 'gallery';
      const isActive = item.isActive !== undefined ? Boolean(item.isActive) : true;

      const res = await query(
        `INSERT INTO combo_images (id, combo_id, url, alt, sort_order, image_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *;`,
        [imgId, combo.id, item.url, alt, sortOrder, imageType, isActive]
      );
      insertedRows.push(res.rows[0]);

      if (item.isPrimary || item.isThumbnail) {
        await query(`UPDATE combos SET image = $1 WHERE id = $2;`, [item.url, combo.id]);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã thêm ${insertedRows.length} hình ảnh vào combo`,
      data: insertedRows,
    });
  } catch (error: any) {
    console.error('Error adding combo image:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật thông tin ảnh hoặc sắp xếp lại thứ tự ảnh combo
export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'combos.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý hình ảnh combo.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { id } = await context.params;

    const comboRes = await query(
      `SELECT id, name, slug, image FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [id]
    );

    if (comboRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy combo' }, { status: 404 });
    }

    const combo = comboRes.rows[0];
    const body = await request.json();

    // 1. Trường hợp sắp xếp lại: { order: [{ id, sortOrder }] }
    if (Array.isArray(body.order)) {
      for (const item of body.order) {
        if (item.id && item.sortOrder !== undefined) {
          await query(
            `UPDATE combo_images SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND combo_id = $3;`,
            [parseInt(item.sortOrder, 10), item.id, combo.id]
          );
        }
      }
      return NextResponse.json({ success: true, message: 'Đã cập nhật thứ tự ảnh combo' });
    }

    // 2. Trường hợp cập nhật 1 ảnh: { imageId, alt, sortOrder, isActive, imageType, setAsPrimary }
    const { imageId, alt, sortOrder, isActive, imageType, setAsPrimary } = body;
    if (!imageId) {
      return NextResponse.json({ success: false, error: 'Thiếu imageId cần cập nhật' }, { status: 400 });
    }

    const imgRes = await query(
      `SELECT * FROM combo_images WHERE id = $1 AND combo_id = $2;`,
      [imageId, combo.id]
    );

    if (imgRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hình ảnh này' }, { status: 404 });
    }

    const currentImg = imgRes.rows[0];

    const updates: string[] = [];
    const params: any[] = [imageId, combo.id];

    if (alt !== undefined) {
      params.push(alt);
      updates.push(`alt = $${params.length}`);
    }
    if (sortOrder !== undefined) {
      params.push(parseInt(sortOrder, 10));
      updates.push(`sort_order = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(Boolean(isActive));
      updates.push(`is_active = $${params.length}`);
    }
    if (imageType !== undefined) {
      params.push(imageType);
      updates.push(`image_type = $${params.length}`);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE combo_images SET ${updates.join(', ')} WHERE id = $1 AND combo_id = $2;`,
      params
    );

    if (setAsPrimary) {
      await query(`UPDATE combos SET image = $1 WHERE id = $2;`, [currentImg.url, combo.id]);
    }

    return NextResponse.json({ success: true, message: 'Đã cập nhật ảnh combo thành công' });
  } catch (error: any) {
    console.error('Error updating combo image:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: Xóa ảnh của combo
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'combos.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý hình ảnh combo.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    let imageId = searchParams.get('imageId');

    if (!imageId) {
      const body = await request.json().catch(() => ({}));
      imageId = body.imageId;
    }

    if (!imageId) {
      return NextResponse.json({ success: false, error: 'Thiếu imageId cần xóa' }, { status: 400 });
    }

    const comboRes = await query(
      `SELECT id, name, slug, image FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [id]
    );

    if (comboRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy combo' }, { status: 404 });
    }

    const combo = comboRes.rows[0];

    const imgRes = await query(
      `SELECT * FROM combo_images WHERE id = $1 AND combo_id = $2;`,
      [imageId, combo.id]
    );

    if (imgRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hình ảnh này' }, { status: 404 });
    }

    const img = imgRes.rows[0];

    await query(`DELETE FROM combo_images WHERE id = $1;`, [imageId]);

    const absolutePath = resolveUploadedFile(img.url);
    if (img.url && absolutePath) {
      try {
        if (fs.existsSync(absolutePath)) {
          await fs.promises.unlink(absolutePath);
        }
      } catch (fileErr) {
        console.warn('Could not delete physical uploaded file:', fileErr);
      }
    }

    // Nếu ảnh vừa xóa đang là primary image, lấy ảnh đầu tiên còn lại làm primary
    if (combo.image === img.url) {
      const remaining = await query(
        `SELECT url FROM combo_images WHERE combo_id = $1 ORDER BY sort_order ASC LIMIT 1;`,
        [combo.id]
      );
      const newImg = remaining.rows[0]?.url || '/images/combos/combo-1.jpg';
      await query(`UPDATE combos SET image = $1 WHERE id = $2;`, [newImg, combo.id]);
    }

    return NextResponse.json({ success: true, message: 'Đã xóa ảnh combo thành công' });
  } catch (error: any) {
    console.error('Error deleting combo image:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
