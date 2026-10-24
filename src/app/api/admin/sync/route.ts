import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { products, categories } from '@/data/products';
import { combos } from '@/data/combos';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Chức năng đồng bộ Store -> DB bị vô hiệu hóa hoàn toàn trên môi trường production.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'system.sync')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền đồng bộ hệ thống.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const prodCountRes = await query(`SELECT count(*) as count FROM products;`);
    const comboCountRes = await query(`SELECT count(*) as count FROM combos;`);
    const catCountRes = await query(`SELECT count(*) as count FROM categories;`);

    return NextResponse.json({
      success: true,
      data: {
        website: {
          productsCount: products.length,
          combosCount: combos.length,
          categoriesCount: categories.length,
        },
        database: {
          productsCount: parseInt(prodCountRes.rows[0]?.count || '0', 10),
          combosCount: parseInt(comboCountRes.rows[0]?.count || '0', 10),
          categoriesCount: parseInt(catCountRes.rows[0]?.count || '0', 10),
        },
        isSynchronized:
          parseInt(prodCountRes.rows[0]?.count || '0', 10) === products.length &&
          parseInt(comboCountRes.rows[0]?.count || '0', 10) === combos.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Chức năng đồng bộ Store -> DB bị vô hiệu hóa hoàn toàn trên môi trường production.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'system.sync')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền đồng bộ hệ thống.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    console.log('Admin triggered synchronization from store website data to database...');

    // 1. Ensure categories
    const categoryMap: Record<string, string> = {
      'sua-hat': 'cat-sua-hat',
      'tra-sua': 'cat-tra-sua',
      'nuoc-giai-khat': 'cat-nuoc-giai-khat',
      'sua-bap': 'cat-sua-bap',
    };

    for (const cat of categories) {
      const dbCatId = categoryMap[cat.id] || `cat-${cat.id}`;
      await query(
        `INSERT INTO categories (id, slug, name, name_en)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE 
         SET name = EXCLUDED.name, name_en = EXCLUDED.name_en;`,
        [dbCatId, cat.slug, cat.name, cat.nameEn || cat.name]
      );
    }

    // 2. Sync Products
    for (const p of products) {
      const prodId = p.id;
      const targetCatId = categoryMap[p.categoryId] || p.categoryId;

      const prodRes = await query(
        `INSERT INTO products (
          id, slug, name, name_en, sku, volume, short_description, description,
          price, unit, thumbnail, category_id, is_featured, is_new, is_best_seller, is_active, is_vegan
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          name_en = EXCLUDED.name_en,
          sku = EXCLUDED.sku,
          volume = EXCLUDED.volume,
          short_description = EXCLUDED.short_description,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          unit = EXCLUDED.unit,
          thumbnail = EXCLUDED.thumbnail,
          category_id = EXCLUDED.category_id,
          is_featured = EXCLUDED.is_featured,
          is_new = EXCLUDED.is_new,
          is_best_seller = EXCLUDED.is_best_seller,
          is_active = EXCLUDED.is_active,
          is_vegan = EXCLUDED.is_vegan
        RETURNING id;`,
        [
          prodId,
          p.slug,
          p.name,
          p.nameEn || p.name,
          p.sku || null,
          p.volume || null,
          p.shortDescription || null,
          p.description || null,
          p.price,
          p.unit || '1 chai',
          p.thumbnail,
          targetCatId,
          p.isFeatured || false,
          p.isNew || false,
          p.isBestSeller || false,
          p.isActive !== undefined ? p.isActive : true,
          p.isVegan !== undefined ? p.isVegan : true,
        ]
      );
      const dbProdId = prodRes.rows[0].id;

      // Clean and re-insert variants
      await query(`DELETE FROM product_variants WHERE product_id = $1;`, [dbProdId]);
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          await query(
            `INSERT INTO product_variants (id, product_id, name, quantity, price, unit, volume, bottle_multiplier)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
            [
              `var_${dbProdId}_${v.id}`,
              dbProdId,
              v.name,
              v.quantity,
              v.price,
              v.unit || 'chai',
              v.volume || null,
              // Số chai thật trong gói (lốc/thùng) để trừ kho đúng; mặc định bằng số lượng
              Math.max(1, Number(v.quantity) || 1),
            ]
          );
        }
      }
    }

    // 3. Sync Combos
    for (const c of combos) {
      await query(
        `INSERT INTO combos (
          id, slug, name, name_en, description, description_en,
          original_price, sale_price, total_items, discount, image,
          is_featured, is_best_seller, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          name_en = EXCLUDED.name_en,
          description = EXCLUDED.description,
          description_en = EXCLUDED.description_en,
          original_price = EXCLUDED.original_price,
          sale_price = EXCLUDED.sale_price,
          total_items = EXCLUDED.total_items,
          discount = EXCLUDED.discount,
          image = EXCLUDED.image,
          is_featured = EXCLUDED.is_featured,
          is_best_seller = EXCLUDED.is_best_seller,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          c.id,
          c.slug,
          c.name,
          c.nameEn || c.name,
          c.description || null,
          c.descriptionEn || null,
          c.originalPrice,
          c.salePrice,
          c.totalItems || 10,
          c.discount || 0,
          c.image || null,
          true,
          c.id === 'combo-10' || c.id === 'combo-van-phong',
          c.isActive !== undefined ? c.isActive : true,
        ]
      );

      // Clean and re-insert combo items
      await query(`DELETE FROM combo_items WHERE combo_id = $1;`, [c.id]);
      if (c.products && c.products.length > 0) {
        for (let idx = 0; idx < c.products.length; idx++) {
          const item = c.products[idx];
          await query(
            `INSERT INTO combo_items (id, combo_id, product_id, quantity, unit)
             VALUES ($1, $2, $3, $4, $5);`,
            [`${c.id}_item_${idx + 1}`, c.id, item.productId, item.quantity, 'chai']
          );
        }
      }
    }

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'SYSTEM_SYNC',
      entityType: 'SYSTEM',
      afterJson: {
        products: products.length,
        combos: combos.length,
        categories: categories.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Đồng bộ toàn bộ dữ liệu từ Website sang Cơ sở dữ liệu thành công!',
      counts: {
        products: products.length,
        combos: combos.length,
        categories: categories.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error during store sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
