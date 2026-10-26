import HomePage from '@/components/home/HomePage';
import HomePageLegacy from '@/components/home/HomePageLegacy';
import { HOMEPAGE_CONFIG } from '@/config/homepage';

import { query } from '@/lib/db';
import { Banner, Product, Combo } from '@/types';
import { banners as defaultBanners } from '@/data/banners';
import { products as defaultProducts } from '@/data/products';
import { combos as defaultCombos } from '@/data/combos';

export const dynamic = 'force-dynamic';

async function getHeroBanners(): Promise<Banner[]> {
  try {
    const countRes = await query(
      `SELECT COUNT(*) AS total FROM banners WHERE placement = 'hero';`
    );
    const totalInDb = Number(countRes.rows[0]?.total || 0);

    const res = await query(
      `SELECT * FROM banners WHERE placement = 'hero' AND is_active = true ORDER BY sort_order ASC`
    );

    if (totalInDb > 0) {
      return res.rows.map((r: any) => ({
        id: r.id,
        title: r.title || '',
        titleEn: r.title_en || '',
        subtitle: r.subtitle || '',
        subtitleEn: r.subtitle_en || '',
        tag: r.tag || undefined,
        image: r.image,
        mobileImage: r.mobile_image || undefined,
        link: r.link || '',
        alt: r.alt || r.title || 'Thái Sơn Foods',
        sortOrder: Number(r.sort_order) || 1,
        isActive: Boolean(r.is_active),
        source: 'db' as const,
      }));
    }
  } catch (err) {
    console.error('Error fetching live hero banners:', err);
  }
  return defaultBanners;
}

// 2 ô khuyến mãi cạnh hero: banner admin có placement = 'promo' (tối đa 2). Rỗng → dùng ô mẫu trong homepage-placeholders.ts
async function getPromoBanners(): Promise<Banner[]> {
  try {
    const res = await query(
      `SELECT * FROM banners WHERE placement = 'promo' AND is_active = true ORDER BY sort_order ASC LIMIT 2`
    );
    return res.rows
      .filter((r: any) => Boolean(r.image))
      .map((r: any) => ({
        id: r.id,
        title: r.title || '',
        subtitle: r.subtitle || '',
        tag: r.tag || undefined,
        image: r.image,
        mobileImage: r.mobile_image || undefined,
        link: r.link || '',
        alt: r.alt || r.title || 'Thái Sơn Foods',
        source: 'db' as const,
      }));
  } catch (err) {
    console.error('Error fetching promo banners:', err);
    return [];
  }
}

// Tên danh mục do admin cấu hình (bảng categories) — dùng để hiển thị tiêu đề các hàng sản phẩm theo danh mục
async function getLiveCategories(): Promise<Array<{ id: string; name: string; nameEn?: string }>> {
  try {
    const res = await query(`SELECT id, slug, name, name_en FROM categories ORDER BY created_at ASC`);
    return res.rows.map((r: any) => ({
      id: String(r.slug || r.id || '').replace(/^cat-/, ''),
      name: r.name,
      nameEn: r.name_en || undefined,
    }));
  } catch (err) {
    console.error('Error fetching live categories:', err);
    return [];
  }
}

async function getLiveProducts(): Promise<Product[]> {
  try {
    const res = await query(`
      SELECT 
        p.*,
        c.name AS category_name,
        c.slug AS category_slug,
        COALESCE((
          SELECT json_agg(
            json_build_object('id', pv.id, 'name', pv.name, 'quantity', pv.quantity, 'price', pv.price, 'unit', pv.unit)
            ORDER BY pv.quantity ASC
          )
          FROM product_variants pv WHERE pv.product_id = p.id
        ), '[]') AS variants,
        COALESCE((
          SELECT json_agg(
            json_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'sortOrder', pi.sort_order, 'isThumbnail', (pi.image_type = 'thumbnail'))
            ORDER BY pi.sort_order ASC
          )
          FROM product_images pi WHERE pi.product_id = p.id AND pi.is_active = true
        ), '[]') AS images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
      ORDER BY p.is_featured DESC, p.created_at ASC;
    `);

    if (res.rows.length > 0) {
      return res.rows.map((row: any) => {
        const base = defaultProducts.find((p) => p.id === row.id || p.slug === row.slug || p.sku === row.sku) || {
          id: row.id,
          name: row.name,
          nameEn: row.name_en || row.name,
          slug: row.slug,
          sku: row.sku || row.id,
          price: Number(row.price) || 0,
          unit: row.unit || 'lốc',
          categoryId: (row.category_id ? row.category_id.replace(/^cat-/, '') : 'sua-hat'),
          thumbnail: row.thumbnail || '/images/products/sua-bap-nep.png',
          images: [{ id: 'img-1', url: row.thumbnail || '/images/products/sua-bap-nep.png', alt: row.name, sortOrder: 1 }],
          shortDescription: row.short_description || '',
          description: row.description || '',
          isActive: Boolean(row.is_active),
          isFeatured: Boolean(row.is_featured),
          isBestSeller: Boolean(row.is_best_seller),
          isNew: Boolean(row.is_new),
          variants: [],
        };

        const activeImages = Array.isArray(row.images) && row.images.length > 0 ? row.images : [];
        const thumbFromImages = activeImages.find((img: any) => img.isThumbnail)?.url || activeImages[0]?.url;
        // Ảnh gallery mới khai báo trong products.ts được ưu tiên hơn ảnh cũ lưu trong DB
        const codeGalleryThumb = base.thumbnail?.startsWith('/images/products/gallery/') ? base.thumbnail : null;
        const finalThumbnail = codeGalleryThumb || row.thumbnail || thumbFromImages || base.thumbnail;

        return {
          ...base,
          name: row.name || base.name,
          nameEn: row.name_en || base.nameEn,
          sku: row.sku || base.sku,
          price: Number(row.price) || base.price,
          unit: row.unit || base.unit,
          shortDescription: row.short_description || base.shortDescription,
          description: row.description || base.description,
          thumbnail: finalThumbnail,
          categoryId: (row.category_id ? row.category_id.replace(/^cat-/, '') : base.categoryId),
          isFeatured: row.is_featured !== null ? Boolean(row.is_featured) : base.isFeatured,
          isNew: row.is_new !== null ? Boolean(row.is_new) : base.isNew,
          isBestSeller: row.is_best_seller !== null ? Boolean(row.is_best_seller) : base.isBestSeller,
          isActive: Boolean(row.is_active),
          variants: (Array.isArray(row.variants) && row.variants.length > 0)
            ? row.variants.map((v: any) => ({
                id: v.id,
                name: v.name,
                quantity: Number(v.quantity) || 1,
                price: Number(v.price) || 0,
                unit: v.unit || 'lốc',
              }))
            : base.variants,
        };
      });
    }

    const countRes = await query(`SELECT COUNT(*) AS total FROM products;`);
    if (Number(countRes.rows[0]?.total || 0) > 0) {
      return [];
    }
  } catch (err) {
    console.error('Error fetching live products:', err);
  }
  return defaultProducts.filter((p) => p.isActive);
}

async function getLiveCombos(): Promise<Combo[]> {
  try {
    const res = await query(`
      SELECT 
        c.*,
        COALESCE((
          SELECT json_agg(
            json_build_object('product_id', ci.product_id, 'quantity', ci.quantity)
          )
          FROM combo_items ci WHERE ci.combo_id = c.id
        ), '[]') AS items,
        COALESCE((
          SELECT json_agg(
            json_build_object('id', cimg.id, 'url', cimg.url, 'alt', cimg.alt, 'sortOrder', cimg.sort_order, 'isPrimary', (cimg.image_type = 'primary' OR cimg.image_type = 'thumbnail'))
            ORDER BY cimg.sort_order ASC
          )
          FROM combo_images cimg WHERE cimg.combo_id = c.id AND cimg.is_active = true
        ), '[]') AS images
      FROM combos c
      WHERE c.is_active = true
      ORDER BY c.created_at ASC;
    `);

    if (res.rows.length > 0) {
      return res.rows.map((row: any) => {
        const base = defaultCombos.find((c) => c.id === row.id || c.slug === row.slug) || {
          id: row.id,
          name: row.name,
          slug: row.slug,
          originalPrice: Number(row.original_price) || 0,
          salePrice: Number(row.sale_price) || 0,
          totalItems: Number(row.total_items) || 10,
          discount: Number(row.discount) || 0,
          image: row.thumbnail || '/images/combos/combo-1.jpg',
          description: row.description || '',
          products: [],
          isActive: true,
        };

        const activeImages = Array.isArray(row.images) && row.images.length > 0 ? row.images : [];
        const primaryFromImages = activeImages.find((img: any) => img.isPrimary)?.url || activeImages[0]?.url;
        const finalImage = row.thumbnail || primaryFromImages || base.image;

        return {
          ...base,
          name: row.name || base.name,
          originalPrice: row.original_price !== null && row.original_price !== undefined ? Number(row.original_price) : base.originalPrice,
          salePrice: row.sale_price !== null && row.sale_price !== undefined ? Number(row.sale_price) : base.salePrice,
          totalItems: row.total_items !== null && row.total_items !== undefined ? Number(row.total_items) : base.totalItems,
          discount: row.discount !== null && row.discount !== undefined ? Number(row.discount) : base.discount,
          image: finalImage,
          images: activeImages.map((img: any) => ({
            id: img.id,
            url: img.url,
            alt: img.alt || row.name,
            sortOrder: Number(img.sortOrder) || 1,
            isPrimary: Boolean(img.isPrimary),
          })),
          description: row.description || base.description,
          isActive: Boolean(row.is_active),
          products: (Array.isArray(row.items) && row.items.length > 0)
            ? row.items.map((it: any) => ({
                productId: it.product_id,
                quantity: Number(it.quantity) || 1,
              }))
            : base.products,
        };
      });
    }

    const countRes = await query(`SELECT COUNT(*) AS total FROM combos;`);
    if (Number(countRes.rows[0]?.total || 0) > 0) {
      return [];
    }
  } catch (err) {
    console.error('Error fetching live combos:', err);
  }
  return defaultCombos.filter((c) => c.isActive);
}

export default async function HomeRoute() {
  const [heroBanners, liveProducts, liveCombos, liveCategories, promoBanners] = await Promise.all([
    getHeroBanners(),
    getLiveProducts(),
    getLiveCombos(),
    getLiveCategories(),
    getPromoBanners(),
  ]);

  // Cờ rollback: false = trang chủ cũ (HomePageLegacy), true = bố cục Amazon (HomePage). Xem ROLLBACK.md
  if (!HOMEPAGE_CONFIG.USE_AMAZON_HOMEPAGE) {
    return <HomePageLegacy heroBanners={heroBanners} liveProducts={liveProducts} liveCombos={liveCombos} />;
  }

  return <HomePage heroBanners={heroBanners} liveProducts={liveProducts} liveCombos={liveCombos} liveCategories={liveCategories} promoBanners={promoBanners} />;
}
