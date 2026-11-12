import { Pool } from 'pg';
import { products } from '../src/data/products';
import { combos } from '../src/data/combos';
import { banners } from '../src/data/banners';
import { defaultScrollBanners } from '../src/components/product/ScrollBannerShowcase';
import { brandSlides } from '../src/data/brand-showcase';

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || dbPasswordFromEnv(),
  database: process.env.DB_NAME || 'WebTSF',
});

async function main() {
  console.log('--- Starting Migration & Data Seeding for Image Management ---');

  // 1. Create Tables
  console.log('1. Creating tables in PostgreSQL...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_images (
      id VARCHAR(50) PRIMARY KEY,
      product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url VARCHAR(500) NOT NULL,
      alt VARCHAR(255),
      sort_order INTEGER DEFAULT 0,
      image_type VARCHAR(50) DEFAULT 'gallery',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_product_images_prod ON product_images(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_images_sort ON product_images(product_id, sort_order ASC);

    CREATE TABLE IF NOT EXISTS combo_images (
      id VARCHAR(50) PRIMARY KEY,
      combo_id VARCHAR(50) NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
      url VARCHAR(500) NOT NULL,
      alt VARCHAR(255),
      sort_order INTEGER DEFAULT 0,
      image_type VARCHAR(50) DEFAULT 'gallery',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_combo_images_combo ON combo_images(combo_id);
    CREATE INDEX IF NOT EXISTS idx_combo_images_sort ON combo_images(combo_id, sort_order ASC);

    CREATE TABLE IF NOT EXISTS banners (
      id VARCHAR(50) PRIMARY KEY,
      slug VARCHAR(100) UNIQUE NOT NULL,
      title VARCHAR(255),
      subtitle TEXT,
      tag VARCHAR(100),
      image VARCHAR(500) NOT NULL,
      mobile_image VARCHAR(500),
      alt VARCHAR(255),
      link VARCHAR(255),
      placement VARCHAR(50) DEFAULT 'hero',
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_banners_placement ON banners(placement, sort_order ASC);

    CREATE TABLE IF NOT EXISTS brand_slides (
      id VARCHAR(50) PRIMARY KEY,
      tag VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      image VARCHAR(500) NOT NULL,
      cta_text VARCHAR(100) DEFAULT 'Khám phá Thái Sơn',
      cta_link VARCHAR(255) DEFAULT '/#san-pham',
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_brand_slides_sort ON brand_slides(sort_order ASC);
  `);
  console.log('Tables created or verified successfully!');

  // 2. Seed Product Images
  console.log('2. Migrating Product Images...');
  // Get all existing products in DB to map accurately by slug or id or sku
  const dbProducts = await pool.query('SELECT id, slug, sku FROM products');
  const dbProdMap = new Map();
  for (const row of dbProducts.rows) {
    if (row.id) dbProdMap.set(row.id, row.id);
    if (row.slug) dbProdMap.set(row.slug, row.id);
    if (row.sku) dbProdMap.set(row.sku, row.id);
  }

  let prodImgCount = 0;
  for (const prod of products) {
    const targetDbId = dbProdMap.get(prod.id) || dbProdMap.get(prod.slug) || dbProdMap.get(prod.sku);
    if (!targetDbId) {
      console.warn(`Product ${prod.name} (${prod.id}) not found in DB products table, skipping image seed`);
      continue;
    }

    // Update thumbnail in DB products if different
    if (prod.thumbnail) {
      await pool.query('UPDATE products SET thumbnail = $1 WHERE id = $2', [prod.thumbnail, targetDbId]);
    }

    if (Array.isArray(prod.images) && prod.images.length > 0) {
      for (let i = 0; i < prod.images.length; i++) {
        const img = prod.images[i];
        const imgId = `pimg_${targetDbId}_${i + 1}`;
        await pool.query(
          `INSERT INTO product_images (id, product_id, url, alt, sort_order, image_type, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           ON CONFLICT (id) DO UPDATE SET
             url = EXCLUDED.url,
             alt = EXCLUDED.alt,
             sort_order = EXCLUDED.sort_order;`,
          [imgId, targetDbId, img.url, img.alt || prod.name, img.sortOrder ?? i + 1, 'gallery']
        );
        prodImgCount++;
      }
    }
  }
  console.log(`Seeded ${prodImgCount} product images into product_images table!`);

  // 3. Seed Combo Images
  console.log('3. Migrating Combo Images...');
  const dbCombos = await pool.query('SELECT id, slug FROM combos');
  const dbComboMap = new Map();
  for (const row of dbCombos.rows) {
    if (row.id) dbComboMap.set(row.id, row.id);
    if (row.slug) dbComboMap.set(row.slug, row.id);
  }

  let comboImgCount = 0;
  for (const combo of combos) {
    const targetComboId = dbComboMap.get(combo.id) || dbComboMap.get(combo.slug);
    if (!targetComboId) {
      console.warn(`Combo ${combo.name} (${combo.id}) not found in DB, skipping`);
      continue;
    }

    if (combo.image) {
      await pool.query('UPDATE combos SET image = $1 WHERE id = $2', [combo.image, targetComboId]);

      // Also add primary image as first gallery image
      const cImgId = `cimg_${targetComboId}_1`;
      await pool.query(
        `INSERT INTO combo_images (id, combo_id, url, alt, sort_order, image_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (id) DO UPDATE SET
           url = EXCLUDED.url,
           alt = EXCLUDED.alt;`,
        [cImgId, targetComboId, combo.image, combo.name, 1, 'thumbnail']
      );
      comboImgCount++;
    }
  }
  console.log(`Seeded ${comboImgCount} combo images into combo_images table!`);

  // 4. Seed Banners
  console.log('4. Migrating Banners...');
  let bannerCount = 0;
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    await pool.query(
      `INSERT INTO banners (id, slug, title, image, alt, link, placement, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'hero', $7, true)
       ON CONFLICT (slug) DO UPDATE SET
         image = EXCLUDED.image,
         alt = EXCLUDED.alt,
         link = EXCLUDED.link;`,
      [b.id || `banner-hero-${i + 1}`, b.id || `hero-${i + 1}`, 'Thái Sơn Foods', b.image, b.alt, b.link || '/#san-pham', i + 1]
    );
    bannerCount++;
  }

  for (let i = 0; i < defaultScrollBanners.length; i++) {
    const sb = defaultScrollBanners[i];
    await pool.query(
      `INSERT INTO banners (id, slug, title, subtitle, tag, image, alt, placement, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scroll', $8, true)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         subtitle = EXCLUDED.subtitle,
         tag = EXCLUDED.tag,
         image = EXCLUDED.image,
         alt = EXCLUDED.alt;`,
      [sb.id, sb.id, sb.title || '', sb.subtitle || '', sb.tag || '', sb.image, sb.alt, i + 1]
    );
    bannerCount++;
  }
  console.log(`Seeded ${bannerCount} banners into banners table!`);

  // 5. Seed Brand Slides
  console.log('5. Migrating Brand Slides...');
  let slideCount = 0;
  for (let i = 0; i < brandSlides.length; i++) {
    const s = brandSlides[i];
    await pool.query(
      `INSERT INTO brand_slides (id, tag, title, description, image, cta_text, cta_link, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       ON CONFLICT (id) DO UPDATE SET
         tag = EXCLUDED.tag,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         image = EXCLUDED.image,
         cta_text = EXCLUDED.cta_text,
         cta_link = EXCLUDED.cta_link;`,
      [s.id || `slide-${i + 1}`, s.tag, s.title, s.description, s.image, s.ctaText, s.ctaLink, i + 1]
    );
    slideCount++;
  }
  console.log(`Seeded ${slideCount} brand slides into brand_slides table!`);

  console.log('\n--- Migration & Data Seeding Completed Successfully! ---');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
