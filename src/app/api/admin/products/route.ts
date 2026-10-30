import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { resolveProductCanonical } from '@/lib/inventory';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { syncProductToStaticFile } from '@/lib/products-file-sync';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const MAX_MONEY = 100_000_000;

/** Giá/số lượng của biến thể phải là số nguyên hợp lệ (dòng trống không tên/giá bị bỏ qua như trước). */
function validateVariantsInput(variants: unknown): string | null {
  if (!Array.isArray(variants)) return null;
  for (const v of variants) {
    if (!(v && v.name && v.price)) continue;
    const price = Number(v.price);
    const qty = Number(v.quantity || 1);
    if (!Number.isInteger(price) || price < 1 || price > MAX_MONEY) {
      return `Biến thể "${v.name}": giá phải là số nguyên từ 1 đến ${MAX_MONEY.toLocaleString('vi-VN')} đồng.`;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
      return `Biến thể "${v.name}": số lượng phải là số nguyên từ 1 đến 1.000.`;
    }
  }
  return null;
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

// GET: Lấy danh sách sản phẩm (loại bỏ trường cost_price nếu không có cost_price.view)
export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!hasPermission(session, 'products.view')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xem sản phẩm.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const canViewCostPrice = hasPermission(session, 'cost_price.view');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const filter = searchParams.get('filter') || 'ALL'; // ALL, ACTIVE, INACTIVE, FEATURED, BEST_SELLER

    let sql = `
      SELECT 
        p.*,
        c.name AS category_name,
        c.slug AS category_slug,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', pv.id,
              'name', pv.name,
              'quantity', pv.quantity,
              'price', pv.price,
              'unit', pv.unit,
              'bottle_multiplier', pv.bottle_multiplier,
              'bottleMultiplier', pv.bottle_multiplier
            )
            ORDER BY pv.quantity ASC
          ) FROM product_variants pv WHERE pv.product_id = p.id
        ), '[]') AS variants,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', pi.id,
              'url', pi.url,
              'alt', pi.alt,
              'sortOrder', pi.sort_order,
              'sort_order', pi.sort_order,
              'imageType', pi.image_type,
              'image_type', pi.image_type,
              'isActive', pi.is_active,
              'is_active', pi.is_active
            )
            ORDER BY pi.sort_order ASC, pi.created_at ASC
          ) FROM product_images pi WHERE pi.product_id = p.id
        ), '[]') AS images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(p.name) LIKE $${params.length} OR LOWER(COALESCE(p.sku, '')) LIKE $${params.length})`;
    }

    if (categoryId && categoryId !== 'ALL') {
      params.push(categoryId);
      sql += ` AND p.category_id = $${params.length}`;
    }

    if (filter === 'ACTIVE') {
      sql += ` AND p.is_active = true`;
    } else if (filter === 'INACTIVE') {
      sql += ` AND p.is_active = false`;
    } else if (filter === 'FEATURED') {
      sql += ` AND p.is_featured = true`;
    } else if (filter === 'BEST_SELLER') {
      sql += ` AND p.is_best_seller = true`;
    }

    sql += ` ORDER BY p.created_at DESC;`;

    const res = await query(sql, params);

    // Lọc bỏ triệt để cost_price ở server nếu không có quyền cost_price.view
    const sanitizedProducts = res.rows.map(row => {
      if (!canViewCostPrice) {
        const { cost_price, ...safeData } = row;
        return safeData;
      }
      return row;
    });

    return NextResponse.json({ success: true, data: sanitizedProducts });
  } catch (error: any) {
    console.error('Error fetching admin products:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// POST: Thêm mới sản phẩm
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!hasPermission(session, 'products.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền tạo sản phẩm.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      sku,
      short_description,
      description,
      price,
      unit,
      thumbnail,
      category_id,
      is_featured = false,
      is_new = false,
      is_best_seller = false,
      is_active = true,
      variants = [],
    } = body;

    if (!name || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Tên sản phẩm và giá là bắt buộc' },
        { status: 400 }
      );
    }

    const priceCheck = Number(price);
    if (!Number.isInteger(priceCheck) || priceCheck < 1 || priceCheck > 100_000_000) {
      return NextResponse.json(
        { success: false, error: 'Giá bán phải là số nguyên từ 1 đến 100.000.000 đồng.' },
        { status: 400 }
      );
    }

    const baseSlug = slugify(name);
    const uniqueSuffix = Date.now().toString().slice(-4);
    const slug = `${baseSlug}-${uniqueSuffix}`;
    const id = `prod_${Date.now()}`;

    const canEditCostPrice = hasPermission(session, 'cost_price.edit');
    const costPriceVal = canEditCostPrice && body.cost_price !== undefined
      ? Math.max(0, parseInt(body.cost_price, 10) || 0)
      : 0;

    const insertSql = `
      INSERT INTO products (
        id, slug, name, sku, short_description, description, price, unit, thumbnail,
        category_id, is_featured, is_new, is_best_seller, is_active, cost_price, sold_offset, volume, energy_kcal
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *;
    `;

    const values = [
      id,
      slug,
      String(name).trim(),
      sku ? String(sku).trim() : `TSF-${Date.now().toString().slice(-4)}`,
      short_description ? String(short_description) : '',
      description ? String(description) : '',
      parseInt(price, 10),
      unit ? String(unit) : '1 chai',
      thumbnail ? String(thumbnail) : '/images/products/sua-bap-nep.png',
      category_id ? String(category_id) : null,
      Boolean(is_featured),
      Boolean(is_new),
      Boolean(is_best_seller),
      Boolean(is_active),
      costPriceVal,
      Math.max(0, parseInt(body.sold_offset, 10) || 0),
      typeof body.volume === 'string' && body.volume.trim() ? body.volume.trim().slice(0, 30) : '330ml',
      // $18: năng lượng kcal/100ml (tuỳ chọn)
      body.energy_kcal !== undefined && body.energy_kcal !== null && body.energy_kcal !== '' && Number.isFinite(Number(body.energy_kcal))
        ? Math.min(9999, Math.max(0, Math.round(Number(body.energy_kcal) * 10) / 10))
        : null,
    ];

    const variantsError = validateVariantsInput(variants);
    if (variantsError) {
      return NextResponse.json({ success: false, error: variantsError }, { status: 400 });
    }

    // Validate variants trước khi insert product vào DB để tránh rò rỉ bản ghi khi lỗi
    if (Array.isArray(variants) && variants.length > 0) {
      for (const v of variants) {
        if (v.name && v.price) {
          const mult = parseInt(v.bottle_multiplier ?? v.bottleMultiplier, 10);
          if (isNaN(mult) || mult <= 0) {
            return NextResponse.json(
              {
                success: false,
                error: `Biến thể "${v.name}" bắt buộc nhập hệ số quy đổi số chai (bottle_multiplier > 0).`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    const result = await query(insertSql, values);
    const createdProduct = result.rows[0];

    // Thêm variants nếu có
    if (Array.isArray(variants) && variants.length > 0) {
      for (const v of variants) {
        if (v.name && v.price) {
          const mult = parseInt(v.bottle_multiplier ?? v.bottleMultiplier, 10);
          if (isNaN(mult) || mult <= 0) {
            return NextResponse.json(
              {
                success: false,
                error: `Biến thể "${v.name}" bắt buộc nhập hệ số quy đổi số chai (bottle_multiplier > 0).`,
              },
              { status: 400 }
            );
          }
          const varId = `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await query(
            `INSERT INTO product_variants (id, product_id, name, quantity, price, unit, bottle_multiplier)
             VALUES ($1, $2, $3, $4, $5, $6, $7);`,
            [varId, id, String(v.name), parseInt(v.quantity || 1, 10), parseInt(v.price, 10), v.unit || 'chai', mult]
          );
        }
      }
    }

    // Thêm images nếu có
    if (Array.isArray(body.images) && body.images.length > 0) {
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (img && (img.url || typeof img === 'string')) {
          const imgUrl = typeof img === 'string' ? img : img.url;
          const imgAlt = typeof img === 'object' && img.alt ? img.alt : name;
          const sortOrder = typeof img === 'object' && img.sortOrder !== undefined ? img.sortOrder : i + 1;
          const imgId = `pimg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await query(
            `INSERT INTO product_images (id, product_id, url, alt, sort_order, image_type, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true);`,
            [imgId, id, imgUrl, imgAlt, sortOrder, 'gallery']
          );
        }
      }
    }

    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'PRODUCT_CREATE',
      entityType: 'PRODUCT',
      entityId: id,
      afterJson: createdProduct,
    });

    return NextResponse.json({ success: true, data: createdProduct });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật sản phẩm (kiểm tra products.manage & products.manage_price, ghi audit log khi sửa giá)
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
      sku,
      short_description,
      description,
      price,
      unit,
      thumbnail,
      category_id,
      is_featured,
      is_new,
      is_best_seller,
      is_active,
      variants,
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Thiếu ID sản phẩm' }, { status: 400 });
    }

    // Lấy thông tin sản phẩm hiện tại
    const currRes = await query(`SELECT * FROM products WHERE id = $1;`, [id]);
    if (currRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }
    const currentProd = currRes.rows[0];

    // Kiểm tra dữ liệu giá / biến thể TRƯỚC khi ghi để không cập nhật dở dang
    if (price !== undefined) {
      const priceNum = Number(price);
      if (!Number.isInteger(priceNum) || priceNum < 1 || priceNum > MAX_MONEY) {
        return NextResponse.json(
          { success: false, error: `Giá bán phải là số nguyên từ 1 đến ${MAX_MONEY.toLocaleString('vi-VN')} đồng.` },
          { status: 400 }
        );
      }
    }
    const putVariantsError = validateVariantsInput(variants);
    if (putVariantsError) {
      return NextResponse.json({ success: false, error: putVariantsError }, { status: 400 });
    }

    // Kiểm tra quyền sửa giá bán
    const isPriceChanging = price !== undefined && parseInt(price, 10) !== currentProd.price;
    if (isPriceChanging && !hasPermission(session, 'products.manage_price')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa giá sản phẩm.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Kiểm tra quyền sửa giá vốn
    const isCostPriceChanging = body.cost_price !== undefined && parseInt(body.cost_price, 10) !== currentProd.cost_price;
    if (isCostPriceChanging && !hasPermission(session, 'cost_price.edit')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa giá vốn sản phẩm.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Kiểm tra quyền quản lý thông tin sản phẩm
    if (!hasPermission(session, 'products.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa thông tin sản phẩm.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const updateSql = `
      UPDATE products SET
        name = COALESCE($2, name),
        sku = COALESCE($3, sku),
        short_description = COALESCE($4, short_description),
        description = COALESCE($5, description),
        price = COALESCE($6, price),
        unit = COALESCE($7, unit),
        thumbnail = COALESCE($8, thumbnail),
        category_id = CASE WHEN $16::boolean THEN $9 ELSE category_id END,
        is_featured = COALESCE($10, is_featured),
        is_new = COALESCE($11, is_new),
        is_best_seller = COALESCE($12, is_best_seller),
        is_active = COALESCE($13, is_active),
        cost_price = COALESCE($14, cost_price),
        sold_offset = COALESCE($15, sold_offset),
        volume = COALESCE($17, volume),
        energy_kcal = COALESCE($18, energy_kcal)
      WHERE id = $1
      RETURNING *;
    `;

    const values = [
      id,
      name !== undefined ? String(name).trim() : null,
      sku !== undefined ? String(sku).trim() : null,
      short_description !== undefined ? String(short_description) : null,
      description !== undefined ? String(description) : null,
      price !== undefined ? parseInt(price, 10) : null,
      unit !== undefined ? String(unit) : null,
      thumbnail !== undefined ? String(thumbnail) : null,
      category_id || null, // $9: chỉ ghi khi request có gửi category_id (xem $16)
      is_featured !== undefined ? Boolean(is_featured) : null,
      is_new !== undefined ? Boolean(is_new) : null,
      is_best_seller !== undefined ? Boolean(is_best_seller) : null,
      is_active !== undefined ? Boolean(is_active) : null,
      body.cost_price !== undefined && hasPermission(session, 'cost_price.edit') ? parseInt(body.cost_price, 10) : null,
      body.sold_offset !== undefined && body.sold_offset !== null && body.sold_offset !== ''
        ? Math.max(0, parseInt(body.sold_offset, 10) || 0)
        : null,
      // $16: request có gửi category_id hay không — không gửi thì giữ danh mục cũ, gửi rỗng thì bỏ danh mục
      category_id !== undefined,
      // $17: dung tích chai (vd 330ml); không gửi / để trống thì giữ giá trị cũ
      typeof body.volume === 'string' && body.volume.trim() ? body.volume.trim().slice(0, 30) : null,
      // $18: năng lượng kcal/100ml; không gửi / để trống thì giữ giá trị cũ
      body.energy_kcal !== undefined && body.energy_kcal !== null && body.energy_kcal !== '' && Number.isFinite(Number(body.energy_kcal))
        ? Math.min(9999, Math.max(0, Math.round(Number(body.energy_kcal) * 10) / 10))
        : null,
    ];

    const result = await query(updateSql, values);
    const updatedProd = result.rows[0];

    // Cập nhật variants nếu có truyền vào
    if (Array.isArray(variants)) {
      // Validate hệ số chai bắt buộc cho toàn bộ biến thể trước khi xóa/thêm
      for (const v of variants) {
        if (v.name && v.price) {
          const mult = parseInt(v.bottle_multiplier ?? v.bottleMultiplier, 10);
          if (isNaN(mult) || mult <= 0) {
            return NextResponse.json(
              {
                success: false,
                error: `Biến thể "${v.name}" bắt buộc nhập hệ số quy đổi số chai (bottle_multiplier > 0).`,
              },
              { status: 400 }
            );
          }
        }
      }
      await query(`DELETE FROM product_variants WHERE product_id = $1;`, [id]);
      for (const v of variants) {
        if (v.name && v.price) {
          const mult = parseInt(v.bottle_multiplier ?? v.bottleMultiplier, 10);
          const varId = `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await query(
            `INSERT INTO product_variants (id, product_id, name, quantity, price, unit, bottle_multiplier)
             VALUES ($1, $2, $3, $4, $5, $6, $7);`,
            [varId, id, String(v.name), parseInt(v.quantity || 1, 10), parseInt(v.price, 10), v.unit || 'chai', mult]
          );
        }
      }
    }

    // Cập nhật images nếu có truyền vào
    if (Array.isArray(body.images)) {
      await query(`DELETE FROM product_images WHERE product_id = $1;`, [id]);
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (img && (img.url || typeof img === 'string')) {
          const imgUrl = typeof img === 'string' ? img : img.url;
          const imgAlt = typeof img === 'object' && img.alt ? img.alt : name;
          const sortOrder = typeof img === 'object' && img.sortOrder !== undefined ? img.sortOrder : i + 1;
          const imgId = `pimg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await query(
            `INSERT INTO product_images (id, product_id, url, alt, sort_order, image_type, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true);`,
            [imgId, id, imgUrl, imgAlt, sortOrder, 'gallery']
          );
        }
      }
    }

    // Ghi Audit Log nếu có sửa đổi giá
    if (isPriceChanging) {
      await writeAuditLog({
        adminId: session.id,
        adminUsername: session.username,
        role: session.role,
        action: 'PRODUCT_PRICE_UPDATE',
        entityType: 'PRODUCT',
        entityId: id,
        beforeJson: { price: currentProd.price },
        afterJson: { price: updatedProd.price },
      });
    }

    // Ghi Audit Log nếu có sửa đổi giá vốn
    if (isCostPriceChanging) {
      await writeAuditLog({
        adminId: session.id,
        adminUsername: session.username,
        role: session.role,
        action: 'PRODUCT_COST_UPDATE',
        entityType: 'PRODUCT',
        entityId: id,
        beforeJson: { cost_price: currentProd.cost_price },
        afterJson: { cost_price: updatedProd.cost_price },
      });
    }

    // Ghi Audit Log chung cho cập nhật sản phẩm
    await writeAuditLog({
      adminId: session.id,
      adminUsername: session.username,
      role: session.role,
      action: 'PRODUCT_UPDATE',
      entityType: 'PRODUCT',
      entityId: id,
      beforeJson: currentProd,
      afterJson: updatedProd,
    });

    // Tự động đồng bộ vào file src/data/products.ts để toàn bộ website lập tức hiển thị thông tin mới
    syncProductToStaticFile({
      id: updatedProd?.id || id,
      sku: updatedProd?.sku || sku,
      slug: updatedProd?.slug,
      name: updatedProd?.name || name,
      price: updatedProd?.price !== undefined ? Number(updatedProd.price) : price,
      unit: updatedProd?.unit || unit,
      short_description: updatedProd?.short_description || short_description,
      description: updatedProd?.description || description,
      thumbnail: updatedProd?.thumbnail || thumbnail,
      category_id: updatedProd?.category_id || category_id,
      is_active: updatedProd?.is_active ?? is_active,
      is_featured: updatedProd?.is_featured ?? is_featured,
      is_best_seller: updatedProd?.is_best_seller ?? is_best_seller,
      is_new: updatedProd?.is_new ?? is_new,
    });

    return NextResponse.json({ success: true, data: updatedProd });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: Xóa sản phẩm
export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập quản trị.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!hasPermission(session, 'products.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền xóa sản phẩm.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID sản phẩm' }, { status: 400 });
    }

    const currRes = await query(`SELECT * FROM products WHERE id = $1;`, [id]);
    if (currRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }
    const productToDelete = currRes.rows[0];

    // Không cho xóa sản phẩm đang được dùng. Xóa sản phẩm sẽ (theo ON DELETE CASCADE) kéo theo tồn kho chi nhánh,
    // giữ chỗ tồn kho của đơn đang chờ, lô hàng, quy cách và ảnh; riêng combo_items KHÔNG có khóa ngoại nên combo
    // sẽ còn tham chiếu "treo" tới sản phẩm đã mất (combo không tính được tồn kho / không bán được).
    // Gợi ý "tạm ẩn" (is_active = false) thay vì xóa.
    // combo_items có thể lưu mã danh mục tĩnh ("sua-bap-nep") thay vì mã bảng products ("prod-sb-01"):
    // quy đổi từng mã đang dùng về mã chuẩn để phát hiện mọi combo chứa sản phẩm này
    const comboRefs = await query(
      `SELECT DISTINCT ci.product_id AS ref, c.name FROM combo_items ci JOIN combos c ON c.id = ci.combo_id;`
    );
    const refCanonical = new Map<string, string | null>();
    const comboNames = new Set<string>();
    for (const row of comboRefs.rows) {
      if (!refCanonical.has(row.ref)) {
        refCanonical.set(row.ref, (await resolveProductCanonical(row.ref))?.id ?? null);
      }
      if (row.ref === id || refCanonical.get(row.ref) === id) comboNames.add(row.name);
    }
    const combosUsing = { rows: Array.from(comboNames).sort().slice(0, 5).map((name) => ({ name })) };
    if (combosUsing.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Sản phẩm đang nằm trong combo: ${combosUsing.rows.map((r: any) => r.name).join(', ')}. Hãy gỡ khỏi combo trước, hoặc chọn "Tạm ẩn" thay vì xóa.`,
          code: 'PRODUCT_IN_USE',
        },
        { status: 409 }
      );
    }
    const openOrders = await query(
      `SELECT COUNT(DISTINCT o.id)::int AS n
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE (oi.product_id = $1 OR oi.canonical_product_id = $1 OR oi.product_id LIKE $1 || '-%')
         AND o.status IN ('PENDING','CONFIRMED','PROCESSING','SHIPPING');`,
      [id]
    );
    if ((openOrders.rows[0]?.n || 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Còn ${openOrders.rows[0].n} đơn hàng chưa hoàn tất có sản phẩm này. Hãy xử lý xong các đơn đó hoặc chọn "Tạm ẩn" thay vì xóa.`,
          code: 'PRODUCT_IN_USE',
        },
        { status: 409 }
      );
    }

    // Xóa trong MỘT transaction: không để lại trạng thái dở dang nếu một bước lỗi
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
      // Giữ lịch sử đơn: order_items không còn trỏ tới sản phẩm đã xóa
      await client.query(`UPDATE order_items SET product_id = NULL WHERE product_id = $1;`, [id]);
      await client.query(`DELETE FROM product_variants WHERE product_id = $1;`, [id]);
      await client.query(`DELETE FROM product_images WHERE product_id = $1;`, [id]);
      await client.query(`DELETE FROM products WHERE id = $1;`, [id]);
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
      action: 'PRODUCT_DELETE',
      entityType: 'PRODUCT',
      entityId: id,
      beforeJson: productToDelete,
      afterJson: null,
    });

    return NextResponse.json({ success: true, message: 'Đã xóa sản phẩm thành công' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
