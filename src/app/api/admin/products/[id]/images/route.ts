import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { isSafeUrl, resolveUploadedFile } from '@/lib/content-validation';
import { hasPermission } from '@/lib/rbac';
import { syncProductToStaticFile } from '@/lib/products-file-sync';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET: Lấy danh sách ảnh của sản phẩm
export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'products.view')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem hình ảnh sản phẩm.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { id } = await context.params;

    // Lấy product để lấy thumbnail
    const prodRes = await query(
      `SELECT id, name, slug, sku, thumbnail FROM products WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [id]
    );

    if (prodRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    const product = prodRes.rows[0];

    const imagesRes = await query(
      `SELECT id, product_id, url, alt, sort_order, image_type, is_active, created_at, updated_at
       FROM product_images
       WHERE product_id = $1
       ORDER BY sort_order ASC, created_at ASC;`,
      [product.id]
    );

    return NextResponse.json({
      success: true,
      productId: product.id,
      thumbnail: product.thumbnail,
      data: imagesRes.rows,
    });
  } catch (error: any) {
    console.error('Error fetching product images:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// POST: Thêm một hoặc nhiều ảnh vào sản phẩm
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'products.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý hình ảnh sản phẩm.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { id } = await context.params;

    const prodRes = await query(
      `SELECT id, name, slug, sku, thumbnail FROM products WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [id]
    );

    if (prodRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    const product = prodRes.rows[0];
    const body = await request.json();

    // Hỗ trợ truyền mảng { images: [...] } hoặc object đơn lẻ { url, alt, ... }
    const items = Array.isArray(body.images) ? body.images : [body];
    const insertedRows: any[] = [];

    // Tìm max sort_order hiện có
    const maxSortRes = await query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM product_images WHERE product_id = $1;`,
      [product.id]
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

      const imgId = `pimg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const alt = item.alt || product.name;
      const sortOrder = item.sortOrder !== undefined ? parseInt(item.sortOrder, 10) : nextSort++;
      const imageType = item.imageType || 'gallery';
      const isActive = item.isActive !== undefined ? Boolean(item.isActive) : true;

      const res = await query(
        `INSERT INTO product_images (id, product_id, url, alt, sort_order, image_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *;`,
        [imgId, product.id, item.url, alt, sortOrder, imageType, isActive]
      );
      insertedRows.push(res.rows[0]);

      // Nếu chỉ định là thumbnail
      if (item.isThumbnail) {
        await query(`UPDATE products SET thumbnail = $1 WHERE id = $2;`, [item.url, product.id]);
        syncProductToStaticFile({ id: product.id, sku: product.sku, slug: product.slug, thumbnail: item.url });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã thêm ${insertedRows.length} hình ảnh vào sản phẩm`,
      data: insertedRows,
    });
  } catch (error: any) {
    console.error('Error adding product image:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật thông tin ảnh hoặc sắp xếp lại thứ tự ảnh
export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'products.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý hình ảnh sản phẩm.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { id } = await context.params;

    const prodRes = await query(
      `SELECT id, name, slug, sku, thumbnail FROM products WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [id]
    );

    if (prodRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    const product = prodRes.rows[0];
    const body = await request.json();

    // 1. Trường hợp sắp xếp lại nhiều ảnh: { order: [{ id, sortOrder }] }
    if (Array.isArray(body.order)) {
      for (const item of body.order) {
        if (item.id && item.sortOrder !== undefined) {
          await query(
            `UPDATE product_images SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND product_id = $3;`,
            [parseInt(item.sortOrder, 10), item.id, product.id]
          );
        }
      }
      return NextResponse.json({ success: true, message: 'Đã cập nhật thứ tự ảnh thành công' });
    }

    // 2. Trường hợp cập nhật 1 ảnh: { imageId, alt, sortOrder, isActive, imageType, setAsThumbnail }
    const { imageId, alt, sortOrder, isActive, imageType, setAsThumbnail } = body;
    if (!imageId) {
      return NextResponse.json({ success: false, error: 'Thiếu imageId cần cập nhật' }, { status: 400 });
    }

    const imgRes = await query(
      `SELECT * FROM product_images WHERE id = $1 AND product_id = $2;`,
      [imageId, product.id]
    );

    if (imgRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hình ảnh này' }, { status: 404 });
    }

    const currentImg = imgRes.rows[0];

    const updates: string[] = [];
    const params: any[] = [imageId, product.id];

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
      `UPDATE product_images SET ${updates.join(', ')} WHERE id = $1 AND product_id = $2;`,
      params
    );

    if (setAsThumbnail) {
      await query(`UPDATE products SET thumbnail = $1 WHERE id = $2;`, [currentImg.url, product.id]);
      syncProductToStaticFile({ id: product.id, sku: product.sku, slug: product.slug, thumbnail: currentImg.url });
    }

    return NextResponse.json({ success: true, message: 'Đã cập nhật ảnh thành công' });
  } catch (error: any) {
    console.error('Error updating product image:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: Xóa ảnh của sản phẩm và dọn dẹp file vật lý nếu thuộc /uploads/
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'products.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý hình ảnh sản phẩm.', code: 'FORBIDDEN' },
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

    const prodRes = await query(
      `SELECT id, name, slug, sku, thumbnail FROM products WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [id]
    );

    if (prodRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    const product = prodRes.rows[0];

    const imgRes = await query(
      `SELECT * FROM product_images WHERE id = $1 AND product_id = $2;`,
      [imageId, product.id]
    );

    if (imgRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy hình ảnh này' }, { status: 404 });
    }

    const img = imgRes.rows[0];

    // Xóa trong DB
    await query(`DELETE FROM product_images WHERE id = $1;`, [imageId]);

    // Xóa file vật lý nếu là file nằm trong /uploads/
    const absolutePath = resolveUploadedFile(img.url);
    if (img.url && absolutePath) {
      try {
        if (fs.existsSync(absolutePath)) {
          await fs.promises.unlink(absolutePath);
          console.log(`[DELETE] Deleted physical file: ${absolutePath}`);
        }
      } catch (fileErr) {
        console.warn('Could not delete physical uploaded file:', fileErr);
      }
    }

    // Nếu ảnh vừa xóa đang là thumbnail, tự động chọn ảnh đầu tiên còn lại làm thumbnail mới
    if (product.thumbnail === img.url) {
      const remaining = await query(
        `SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC LIMIT 1;`,
        [product.id]
      );
      const newThumbnail = remaining.rows[0]?.url || '/images/products/sua-bap-nep.png';
      await query(`UPDATE products SET thumbnail = $1 WHERE id = $2;`, [newThumbnail, product.id]);
      syncProductToStaticFile({ id: product.id, sku: product.sku, slug: product.slug, thumbnail: newThumbnail });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa ảnh thành công' });
  } catch (error: any) {
    console.error('Error deleting product image:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
