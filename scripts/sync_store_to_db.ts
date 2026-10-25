import { Pool } from 'pg';
import { products, categories } from '../src/data/products';
import { combos } from '../src/data/combos';

export async function syncStoreToDatabase() {
  console.log('🚀 Starting synchronization from Store Website Data to PostgreSQL WebTSF...');

  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'Tsf@123',
    database: 'WebTSF',
  });

  try {
    // 1. Ensure tables and columns exist
    console.log('📦 Verifying schema & creating missing tables/columns...');
    await pool.query(`
      -- Categories
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(50) PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        name_en VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);

      -- Products
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(500) NOT NULL,
        name_en VARCHAR(500),
        sku VARCHAR(50),
        volume VARCHAR(50),
        short_description TEXT,
        description TEXT,
        price INTEGER NOT NULL,
        unit VARCHAR(50) DEFAULT '1 chai',
        thumbnail VARCHAR(500) NOT NULL,
        category_id VARCHAR(50) REFERENCES categories(id) ON DELETE SET NULL,
        is_featured BOOLEAN DEFAULT false,
        is_new BOOLEAN DEFAULT false,
        is_best_seller BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        is_vegan BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en VARCHAR(500);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS volume VARCHAR(50);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN DEFAULT true;
      ALTER TABLE products ALTER COLUMN name TYPE VARCHAR(500);

      -- Product Variants
      CREATE TABLE IF NOT EXISTS product_variants (
        id VARCHAR(50) PRIMARY KEY,
        product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1,
        price INTEGER NOT NULL,
        unit VARCHAR(50) DEFAULT 'chai',
        volume VARCHAR(50),
        bottle_multiplier INTEGER NOT NULL DEFAULT 1 CHECK (bottle_multiplier > 0)
      );
      ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS volume VARCHAR(50);

      -- Combos Table
      CREATE TABLE IF NOT EXISTS combos (
        id VARCHAR(50) PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(500) NOT NULL,
        name_en VARCHAR(500),
        description TEXT,
        description_en TEXT,
        original_price INTEGER NOT NULL,
        sale_price INTEGER NOT NULL,
        total_items INTEGER DEFAULT 10,
        discount INTEGER DEFAULT 0,
        image VARCHAR(500),
        is_featured BOOLEAN DEFAULT true,
        is_best_seller BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Combo Items
      CREATE TABLE IF NOT EXISTS combo_items (
        id VARCHAR(50) PRIMARY KEY,
        combo_id VARCHAR(50) REFERENCES combos(id) ON DELETE CASCADE,
        product_id VARCHAR(50),
        quantity INTEGER DEFAULT 1,
        unit VARCHAR(50) DEFAULT 'chai'
      );
    `);

    // 2. Sync Categories
    console.log(`\n📂 Syncing ${categories.length} categories...`);
    const categoryMap: Record<string, string> = {
      'sua-hat': 'cat-sua-hat',
      'tra-sua': 'cat-tra-sua',
      'nuoc-giai-khat': 'cat-nuoc-giai-khat',
      'sua-bap': 'cat-sua-bap',
    };

    for (const cat of categories) {
      const dbCatId = categoryMap[cat.id] || `cat-${cat.id}`;
      await pool.query(
        `INSERT INTO categories (id, slug, name, name_en)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE 
         SET name = EXCLUDED.name, name_en = EXCLUDED.name_en;`,
        [dbCatId, cat.slug, cat.name, cat.nameEn || cat.name]
      );
      console.log(`  ✓ Category: ${cat.name} (${cat.slug}) -> ID: ${dbCatId}`);
    }

    // 3. Sync Products
    console.log(`\n🥤 Syncing ${products.length} official products...`);
    for (const p of products) {
      const prodId = p.id;
      const targetCatId = categoryMap[p.categoryId] || p.categoryId;

      // Upsert product and get the actual DB primary key ID
      const prodRes = await pool.query(
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

      // Clean and re-insert variants using dbProdId
      await pool.query(`DELETE FROM product_variants WHERE product_id = $1;`, [dbProdId]);
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          await pool.query(
            `INSERT INTO product_variants (id, product_id, name, quantity, price, unit, volume)
             VALUES ($1, $2, $3, $4, $5, $6, $7);`,
            [
              `var_${dbProdId}_${v.id}`,
              dbProdId,
              v.name,
              v.quantity,
              v.price,
              v.unit || 'chai',
              v.volume || null,
            ]
          );
        }
      }
      console.log(`  ✓ Product: [${p.sku}] ${p.name.slice(0, 50)}... | ${p.price}đ (${p.variants?.length || 0} variants)`);
    }

    // 4. Sync Combos
    console.log(`\n🎁 Syncing ${combos.length} official combos...`);
    for (const c of combos) {
      await pool.query(
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
      await pool.query(`DELETE FROM combo_items WHERE combo_id = $1;`, [c.id]);
      if (c.products && c.products.length > 0) {
        for (let idx = 0; idx < c.products.length; idx++) {
          const item = c.products[idx];
          await pool.query(
            `INSERT INTO combo_items (id, combo_id, product_id, quantity, unit)
             VALUES ($1, $2, $3, $4, $5);`,
            [`${c.id}_item_${idx + 1}`, c.id, item.productId, item.quantity, 'chai']
          );
        }
      }
      console.log(`  ✓ Combo: ${c.name.slice(0, 50)}... | ${c.salePrice}đ (${c.totalItems} chai)`);
    }

    console.log('\n🎉 ALL STORE DATA SYNCHRONIZED SUCCESSFULLY TO POSTGRESQL WebTSF!');
    return {
      success: true,
      categoriesCount: categories.length,
      productsCount: products.length,
      combosCount: combos.length,
    };
  } catch (error) {
    console.error('❌ Error synchronizing store to database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run immediately if executed via CLI
if (process.argv[1]?.endsWith('sync_store_to_db.ts')) {
  syncStoreToDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
