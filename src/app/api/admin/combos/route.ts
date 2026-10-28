import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { resolveProductCanonical } from '@/lib/inventory';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

type ComboItemInput = { product_id: string; quantity: number; unit: string };

/** Kiểm tra danh sách món: sản phẩm tồn tại, số lượng nguyên dương, không lặp. Trả về lỗi tiếng Việt hoặc danh sách đã chuẩn hóa. */
async function parseComboItems(items: unknown): Promise<{ error: string } | { list: ComboItemInput[] }> {
  const list: ComboItemInput[] = [];
  if (!Array.isArray(items)) return { list };
  const seen = new Set<string>();
  for (const it of items) {
    const pid = it && it.product_id ? String(it.product_id) : '';
    const qty = Number(it?.quantity || 1);
    if (!pid || !Number.isInteger(qty) || qty < 1 || qty > 1000) {
      return { error: 'Mỗi món trong combo cần mã sản phẩm và số lượng nguyên từ 1 đến 1.000.' };
    }
    if (seen.has(pid)) return { error: `Sản phẩm ${pid} bị lặp trong combo.` };
    seen.add(pid);
    list.push({ product_id: pid, quantity: qty, unit: it.unit ? String(it.unit) : 'chai' });
  }
  // Món combo có thể lưu bằng mã danh mục tĩnh (vd. "sua-bap-nep") hoặc mã trong bảng products ("prod-sb-01"):
  // chấp nhận cả hai bằng cách quy đổi qua resolveProductCanonical (cùng cơ chế khi xuất kho theo combo).
  const canonicalSeen = new Map<string, string>();
  for (const x of list) {
    const canonical = await resolveProductCanonical(x.product_id);
    if (!canonical) return { error: `Sản phẩm không tồn tại: ${x.product_id}` };
    const dupOf = canonicalSeen.get(canonical.id);
    if (dupOf) return { error: `Sản phẩm ${x.product_id} bị lặp trong combo (trùng với ${dupOf}).` };
    canonicalSeen.set(canonical.id, x.product_id);
  }
  return { list };
}

/** Giá bán/giá gốc: số nguyên hợp lệ, giá gốc không thấp hơn giá bán; % giảm do máy chủ tự tính. */
function checkComboPrices(sale: number, original: number): { error: string } | { discountPct: number } {
  if (!Number.isInteger(sale) || sale < 1 || sale > 100_000_000) {
    return { error: 'Giá bán combo phải là số nguyên từ 1 đến 100.000.000 đồng.' };
  }
  if (!Number.isInteger(original) || original < sale) {
    return { error: 'Giá gốc phải là số nguyên và không thấp hơn giá bán.' };
  }
  return { discountPct: original > sale ? Math.round((1 - sale / original) * 100) : 0 };
}

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

// GET: Lấy danh sách tất cả combo (lọc bỏ cost_price nếu không có quyền)
export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!hasPermission(session, 'combos.view')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem danh sách combo.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const canViewCostPrice = hasPermission(session, 'cost_price.view');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const filter = searchParams.get('filter') || 'ALL'; // ALL, ACTIVE, INACTIVE, FEATURED, BEST_SELLER

    let sql = `
      SELECT 
        c.*,
        COALESCE((
          SELECT json_agg(
            json_build_object('id', ci.id, 'product_id', ci.product_id, 'quantity', ci.quantity, 'unit', ci.unit)
          ) FROM combo_items ci WHERE ci.combo_id = c.id
        ), '[]') AS items,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', cimg.id,
              'url', cimg.url,
              'alt', cimg.alt,
              'sortOrder', cimg.sort_order,
              'sort_order', cimg.sort_order,
              'imageType', cimg.image_type,
              'image_type', cimg.image_type,
              'isActive', cimg.is_active,
              'is_active', cimg.is_active
            )
            ORDER BY cimg.sort_order ASC, cimg.created_at ASC
          ) FROM combo_images cimg WHERE cimg.combo_id = c.id
        ), '[]') AS images
      FROM combos c
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(c.name) LIKE $${params.length} OR LOWER(COALESCE(c.description, '')) LIKE $${params.length})`;
    }

    if (filter === 'ACTIVE') {
      sql += ` AND c.is_active = true`;
    } else if (filter === 'INACTIVE') {
      sql += ` AND c.is_active = false`;
    } else if (filter === 'FEATURED') {
      sql += ` AND c.is_featured = true`;
    } else if (filter === 'BEST_SELLER') {
      sql += ` AND c.is_best_seller = true`;
    }

    sql += ` ORDER BY c.created_at DESC;`;

    const res = await query(sql, params);

    // Lọc bỏ cost_price ở server nếu không có cost_price.view
    const sanitizedCombos = res.rows.map(row => {
      if (!canViewCostPrice) {
        const { cost_price, ...safeData } = row;
        return safeData;
      }
      return row;
    });

    return NextResponse.json({ success: true, data: sanitizedCombos });
  } catch (error: any) {
    console.error('Error fetching admin combos:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// POST: Thêm mới combo
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!hasPermission(session, 'combos.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tạo combo.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      original_price,
      sale_price,
      total_items = 10,
      discount = 0,
      image,
      is_featured = true,
      is_best_seller = false,
      is_active = true,
      items = [],
    } = body;

    if (!name || sale_price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Tên combo và giá bán là bắt buộc' },
        { status: 400 }
      );
    }

    const id = `combo_${Date.now()}`;

    const canEditCostPrice = hasPermission(session, 'cost_price.edit');
    const costPriceVal = canEditCostPrice && body.cost_price !== undefined
      ? Math.max(0, parseInt(body.cost_price, 10) || 0)
      : 0;

    // Giá + món: kiểm tra đầu vào TRƯỚC khi ghi; % giảm do máy chủ tự tính, không tin giá trị client gửi
    const salePriceNum = Number(sale_price);
    const originalPriceNum = original_price === undefined || original_price === null || original_price === '' ? salePriceNum : Number(original_price);
    const priceCheck = checkComboPrices(salePriceNum, originalPriceNum);
    if ('error' in priceCheck) {
      return NextResponse.json({ success: false, error: priceCheck.error }, { status: 400 });
    }
    const discountPct = priceCheck.discountPct;
    const parsedItems = await parseComboItems(items);
    if ('error' in parsedItems) {
      return NextResponse.json({ success: false, error: parsedItems.error }, { status: 400 });
    }
    const itemList = parsedItems.list;

    // Slug duy nhất: thêm hậu tố nếu trùng
    let slug = slugify(name);
    const slugTaken = await query(`SELECT 1 FROM combos WHERE slug = $1 LIMIT 1;`, [slug]);
    if (slugTaken.rows.length > 0) slug = `${slug}-${Date.now().toString().slice(-4)}`;

    // Tạo combo + món + ảnh trong MỘT transaction: lỗi giữa chừng không để lại combo thiếu món trên cửa hàng
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

    await client.query(
      `INSERT INTO combos (
        id, slug, name, description, original_price, sale_price,
        total_items, discount, image, is_featured, is_best_seller, is_active, cost_price, sold_offset
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
      [
        id,
        slug,
        String(name).trim(),
        description ? String(description) : null,
        originalPriceNum,
        salePriceNum,
        parseInt(total_items || 10, 10),
        discountPct,
        image ? String(image) : '/images/combos/combo-1.jpg',
        Boolean(is_featured),
        Boolean(is_best_seller),
        Boolean(is_active),
        costPriceVal,
        Math.max(0, parseInt(body.sold_offset, 10) || 0),
      ]
    );

    for (let i = 0; i < itemList.length; i++) {
      const it = itemList[i];
      await client.query(
        `INSERT INTO combo_items (id, combo_id, product_id, quantity, unit)
         VALUES ($1, $2, $3, $4, $5);`,
        [`${id}_item_${i + 1}`, id, it.product_id, it.quantity, it.unit]
      );
    }

    if (Array.isArray(body.images) && body.images.length > 0) {
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (img && (img.url || typeof img === 'string')) {
          const imgUrl = typeof img === 'string' ? img : img.url;
          const imgAlt = typeof img === 'object' && img.alt ? img.alt : name;
          const sortOrder = typeof img === 'object' && img.sortOrder !== undefined ? img.sortOrder : i + 1;
          const imgId = `cimg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await client.query(
            `INSERT INTO combo_images (id, combo_id, url, alt, sort_order, image_type, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true);`,
            [imgId, id, imgUrl, imgAlt, sortOrder, 'gallery']
          );
        }
      }
    }

      await client.query('COMMIT;');
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }

    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'COMBO_CREATE',
      entityType: 'COMBO',
      entityId: id,
      afterJson: { id, slug, name, sale_price },
    });

    return NextResponse.json({ success: true, data: { id, slug, name } });
  } catch (error: any) {
    console.error('Error creating admin combo:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật combo
export async function PUT(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      original_price,
      sale_price,
      total_items,
      discount,
      image,
      is_featured,
      is_best_seller,
      is_active,
      items,
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Thiếu ID combo' }, { status: 400 });
    }

    const currRes = await query(`SELECT * FROM combos WHERE id = $1;`, [id]);
    if (currRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy combo' }, { status: 404 });
    }
    const currentCombo = currRes.rows[0];

    // Kiểm tra quyền sửa giá bán
    const isPriceChanging = sale_price !== undefined && parseInt(sale_price, 10) !== currentCombo.sale_price;
    if (isPriceChanging && !hasPermission(session, 'products.manage_price')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa giá combo.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Kiểm tra quyền sửa giá vốn
    const isCostPriceChanging = body.cost_price !== undefined && parseInt(body.cost_price, 10) !== currentCombo.cost_price;
    if (isCostPriceChanging && !hasPermission(session, 'cost_price.edit')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa giá vốn combo.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (!hasPermission(session, 'combos.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa combo.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Kiểm tra giá / món TRƯỚC khi ghi (giá hiệu lực = giá mới nếu có, ngược lại giá hiện tại)
    const pricesTouched = sale_price !== undefined || original_price !== undefined;
    let derivedDiscount: number | null = null;
    if (pricesTouched) {
      const effSale = sale_price !== undefined ? Number(sale_price) : Number(currentCombo.sale_price);
      const effOriginal = original_price !== undefined ? Number(original_price) : Number(currentCombo.original_price);
      const priceCheck = checkComboPrices(effSale, effOriginal);
      if ('error' in priceCheck) {
        return NextResponse.json({ success: false, error: priceCheck.error }, { status: 400 });
      }
      derivedDiscount = priceCheck.discountPct;
    }
    let putItems: ComboItemInput[] | null = null;
    if (Array.isArray(items)) {
      const parsedItems = await parseComboItems(items);
      if ('error' in parsedItems) {
        return NextResponse.json({ success: false, error: parsedItems.error }, { status: 400 });
      }
      putItems = parsedItems.list;
    }

    const updates: string[] = [];
    const params: any[] = [id];

    if (name !== undefined) {
      params.push(String(name).trim());
      updates.push(`name = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description ? String(description) : null);
      updates.push(`description = $${params.length}`);
    }
    if (original_price !== undefined) {
      params.push(parseInt(original_price, 10));
      updates.push(`original_price = $${params.length}`);
    }
    if (sale_price !== undefined) {
      params.push(parseInt(sale_price, 10));
      updates.push(`sale_price = $${params.length}`);
    }
    if (total_items !== undefined) {
      params.push(parseInt(total_items, 10));
      updates.push(`total_items = $${params.length}`);
    }
    if (derivedDiscount !== null) {
      params.push(derivedDiscount);
      updates.push(`discount = $${params.length}`);
    }
    if (image !== undefined) {
      params.push(String(image));
      updates.push(`image = $${params.length}`);
    }
    if (is_featured !== undefined) {
      params.push(Boolean(is_featured));
      updates.push(`is_featured = $${params.length}`);
    }
    if (is_best_seller !== undefined) {
      params.push(Boolean(is_best_seller));
      updates.push(`is_best_seller = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(Boolean(is_active));
      updates.push(`is_active = $${params.length}`);
    }
    if (body.cost_price !== undefined && hasPermission(session, 'cost_price.edit')) {
      params.push(parseInt(body.cost_price, 10));
      updates.push(`cost_price = ${params.length}`);
    }
    if (body.sold_offset !== undefined && body.sold_offset !== null && body.sold_offset !== '') {
      params.push(Math.max(0, parseInt(body.sold_offset, 10) || 0));
      updates.push(`sold_offset = ${params.length}`);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // UPDATE + thay món + thay ảnh trong MỘT transaction: lỗi giữa chừng không để lại combo rỗng / nửa vời
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
    if (updates.length > 0) {
      await client.query(`UPDATE combos SET ${updates.join(', ')} WHERE id = $1;`, params);
    }

    if (putItems) {
      await client.query(`DELETE FROM combo_items WHERE combo_id = $1;`, [id]);
      for (let i = 0; i < putItems.length; i++) {
        const it = putItems[i];
        await client.query(
          `INSERT INTO combo_items (id, combo_id, product_id, quantity, unit)
           VALUES ($1, $2, $3, $4, $5);`,
          [`${id}_item_${i + 1}`, id, it.product_id, it.quantity, it.unit]
        );
      }
    }

    if (Array.isArray(body.images)) {
      await client.query(`DELETE FROM combo_images WHERE combo_id = $1;`, [id]);
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (img && (img.url || typeof img === 'string')) {
          const imgUrl = typeof img === 'string' ? img : img.url;
          const imgAlt = typeof img === 'object' && img.alt ? img.alt : (name || 'Combo');
          const sortOrder = typeof img === 'object' && img.sortOrder !== undefined ? img.sortOrder : i + 1;
          const imgId = `cimg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await client.query(
            `INSERT INTO combo_images (id, combo_id, url, alt, sort_order, image_type, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true);`,
            [imgId, id, imgUrl, imgAlt, sortOrder, 'gallery']
          );
        }
      }
    }

      await client.query('COMMIT;');
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }

    if (isPriceChanging) {
      await writeAuditLog({
        adminId: session.id,
        adminUsername: session.username,
        role: session.role,
        action: 'COMBO_PRICE_UPDATE',
        entityType: 'COMBO',
        entityId: id,
        beforeJson: { sale_price: currentCombo.sale_price },
        afterJson: { sale_price },
      });
    }

    if (isCostPriceChanging) {
      await writeAuditLog({
        adminId: session.id,
        adminUsername: session.username,
        role: session.role,
        action: 'COMBO_COST_UPDATE',
        entityType: 'COMBO',
        entityId: id,
        beforeJson: { cost_price: currentCombo.cost_price },
        afterJson: { cost_price: parseInt(body.cost_price, 10) },
      });
    }

    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'COMBO_UPDATE',
      entityType: 'COMBO',
      entityId: id,
      beforeJson: currentCombo,
      afterJson: body,
    });

    return NextResponse.json({ success: true, message: 'Cập nhật combo thành công' });
  } catch (error: any) {
    console.error('Error updating admin combo:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: Xóa combo
export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!hasPermission(session, 'combos.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xóa combo.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID combo' }, { status: 400 });
    }

    const currRes = await query(`SELECT * FROM combos WHERE id = $1;`, [id]);
    if (currRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy combo' }, { status: 404 });
    }
    const comboToDelete = currRes.rows[0];

    // Không xóa combo còn nằm trong đơn chưa hoàn tất (đơn vẫn cần dữ liệu combo để xuất kho theo món)
    const openOrders = await query(
      `SELECT COUNT(DISTINCT o.id)::int AS n
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = $1 AND o.status IN ('PENDING','CONFIRMED','PROCESSING','SHIPPING');`,
      [id]
    );
    if ((openOrders.rows[0]?.n || 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Còn ${openOrders.rows[0].n} đơn hàng chưa hoàn tất có combo này. Hãy xử lý xong các đơn đó hoặc chọn "Tạm ẩn" thay vì xóa.`,
          code: 'COMBO_IN_USE',
        },
        { status: 409 }
      );
    }

    // Xóa ảnh + món + combo trong MỘT transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
      await client.query(`DELETE FROM combo_images WHERE combo_id = $1;`, [id]);
      await client.query(`DELETE FROM combo_items WHERE combo_id = $1;`, [id]);
      await client.query(`DELETE FROM combos WHERE id = $1;`, [id]);
      await client.query('COMMIT;');
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }

    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'COMBO_DELETE',
      entityType: 'COMBO',
      entityId: id,
      beforeJson: comboToDelete,
      afterJson: null,
    });

    return NextResponse.json({ success: true, message: 'Đã xóa combo thành công' });
  } catch (error: any) {
    console.error('Error deleting admin combo:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
