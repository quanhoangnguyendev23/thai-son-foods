import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { combos as defaultCombos } from '@/data/combos';
import { Combo } from '@/types';
import { isDailyDealsEnabled } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get('featured');

    let sql = `
      SELECT 
        c.*,
        COALESCE((
          SELECT json_agg(
            json_build_object('product_id', ci.product_id, 'quantity', ci.quantity, 'unit', ci.unit)
          )
          FROM combo_items ci WHERE ci.combo_id = c.id
        ), '[]') AS items
      FROM combos c
      WHERE c.is_active = true
    `;
    const params: any[] = [];

    if (featured === 'true') {
      sql += ` AND c.is_featured = true`;
    }

    sql += ` ORDER BY c.created_at ASC;`;

    // Công tắc admin "Deal trong ngày" đi kèm danh sách combo (trình duyệt đã gọi API này sẵn, không cần gọi thêm)
    const [res, dailyDealsEnabled] = await Promise.all([query(sql, params), isDailyDealsEnabled()]);

    // Fallback nếu DB hoàn toàn chưa có combo
    if (res.rows.length === 0) {
      const countRes = await query(`SELECT COUNT(*) AS total FROM combos;`);
      const totalInDb = Number(countRes.rows[0]?.total || 0);
      if (totalInDb === 0) {
        const filtered = defaultCombos.filter((c) => c.isActive);
        return NextResponse.json({ success: true, data: filtered, fallback: true, dailyDealsEnabled });
      }
      return NextResponse.json({ success: true, data: [], dailyDealsEnabled });
    }

    const mappedCombos: Combo[] = res.rows.map((row: any) => {
      const base = defaultCombos.find((c) => c.id === row.id || c.slug === row.slug) || {
        id: row.id,
        name: row.name,
        nameEn: row.name_en || row.name,
        slug: row.slug,
        description: row.description || '',
        descriptionEn: row.description_en || '',
        image: row.thumbnail || row.image || '/images/combos/combo-1.jpg',
        originalPrice: Number(row.original_price) || 0,
        salePrice: Number(row.sale_price) || 0,
        totalItems: Number(row.total_items) || 10,
        discount: Number(row.discount) || 0,
        isActive: Boolean(row.is_active),
        products: [],
      };

      return {
        ...base,
        name: row.name || base.name,
        nameEn: row.name_en || base.nameEn,
        slug: row.slug || base.slug,
        description: row.description || base.description,
        descriptionEn: row.description_en || base.descriptionEn,
        image: row.thumbnail || row.image || base.image,
        originalPrice: row.original_price !== null ? Number(row.original_price) : base.originalPrice,
        salePrice: row.sale_price !== null ? Number(row.sale_price) : base.salePrice,
        totalItems: row.total_items !== null ? Number(row.total_items) : base.totalItems,
        discount: row.discount !== null ? Number(row.discount) : base.discount,
        isActive: Boolean(row.is_active),
        isBestSeller: Boolean(row.is_best_seller),
        products: (Array.isArray(row.items) && row.items.length > 0)
          ? row.items.map((it: any) => ({
              productId: it.product_id,
              quantity: Number(it.quantity) || 1,
            }))
          : base.products,
      };
    });

    return NextResponse.json({ success: true, data: mappedCombos, dailyDealsEnabled });
  } catch (error: any) {
    console.error('Error fetching public combos:', error);
    return NextResponse.json({ success: true, data: defaultCombos.filter((c) => c.isActive), fallback: true });
  }
}
