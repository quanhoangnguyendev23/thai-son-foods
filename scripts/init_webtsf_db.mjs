import { Pool } from 'pg';

const password = 'Tsf@123';

async function main() {
  console.log('Connecting with postgres / Tsf@123...');
  const rootPool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: password,
    database: 'postgres',
  });

  const check = await rootPool.query("SELECT 1 FROM pg_database WHERE datname = 'WebTSF'");
  if (check.rows.length === 0) {
    console.log("Database 'WebTSF' does not exist yet. Creating 'WebTSF'...");
    await rootPool.query('CREATE DATABASE "WebTSF";');
    console.log("Database 'WebTSF' created successfully!");
  } else {
    console.log("Database 'WebTSF' already exists!");
  }
  await rootPool.end();

  console.log("Connecting directly to 'WebTSF' database...");
  const dbPool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: password,
    database: 'WebTSF',
  });

  // Create tables
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(50) PRIMARY KEY,
      slug VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(50) PRIMARY KEY,
      slug VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(50),
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id VARCHAR(50) PRIMARY KEY,
      product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      quantity INTEGER DEFAULT 1,
      price INTEGER NOT NULL,
      unit VARCHAR(50) DEFAULT 'chai',
      bottle_multiplier INTEGER NOT NULL DEFAULT 1 CHECK (bottle_multiplier > 0)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(50) PRIMARY KEY,
      order_code VARCHAR(50) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(255),
      province VARCHAR(100) NOT NULL,
      district VARCHAR(100) NOT NULL,
      ward VARCHAR(100) NOT NULL,
      address TEXT NOT NULL,
      note TEXT,
      payment_method VARCHAR(50) DEFAULT 'cod',
      shipping_fee INTEGER DEFAULT 0,
      subtotal INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id VARCHAR(50) PRIMARY KEY,
      order_id VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
      product_id VARCHAR(50),
      name VARCHAR(255) NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit VARCHAR(50) DEFAULT '1 chai',
      thumbnail VARCHAR(500)
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'ADMIN',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Tables created / verified in WebTSF successfully!');

  // Seed categories
  const cats = [
    { id: 'cat-sua-hat', slug: 'sua-hat', name: 'Sữa Hạt' },
    { id: 'cat-tra-sua', slug: 'tra-sua', name: 'Trà Sữa' },
    { id: 'cat-nuoc-giai-khat', slug: 'nuoc-giai-khat', name: 'Nước Giải Khát' },
  ];

  for (const c of cats) {
    await dbPool.query(
      `INSERT INTO categories (id, slug, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`,
      [c.id, c.slug, c.name]
    );
  }

  // Seed sample products
  const prods = [
    {
      id: 'prod-sb-01',
      slug: 'sua-bap-nep-thai-son',
      name: 'Sữa Bắp Nếp Thái Sơn',
      sku: 'SB-01',
      short_description: 'Sữa bắp nếp thơm ngon, bổ dưỡng từ nguyên liệu bắp nếp chọn lọc.',
      description: 'Sữa Bắp Nếp Thái Sơn được chế biến từ nguồn nguyên liệu bắp nếp tươi ngon, được chọn lọc kỹ lưỡng, mang đến hương vị thơm ngọt tự nhiên, bổ dưỡng cho cả gia đình.',
      price: 18000,
      unit: '1 chai',
      category_id: 'cat-sua-hat',
      thumbnail: '/images/products/sua-bap-nep.png',
      is_featured: true,
      is_best_seller: true,
      is_new: false,
    },
    {
      id: 'prod-td-01',
      slug: 'tao-do-hat-chia-thai-son',
      name: 'Táo Đỏ Hạt Chia Thái Sơn',
      sku: 'TD-01',
      short_description: 'Nước táo đỏ hạt chia bổ dưỡng, giàu chất xơ và vitamin.',
      description: 'Táo Đỏ Hạt Chia Thái Sơn kết hợp tinh hoa từ táo đỏ và hạt chia, mang đến thức uống giàu dinh dưỡng, bổ sung chất xơ và vitamin cho cơ thể.',
      price: 18000,
      unit: '1 chai',
      category_id: 'cat-nuoc-giai-khat',
      thumbnail: '/images/products/tao-do-hat-chia.png',
      is_featured: true,
      is_best_seller: false,
      is_new: true,
    },
    {
      id: 'prod-ss-01',
      slug: 'sua-hat-sen-lotus-yoo',
      name: 'Sữa Hạt Sen Lotus Yoo',
      sku: 'SS-01',
      short_description: 'Sữa hạt sen Lotus Yoo thanh mát, bổ dưỡng.',
      description: 'Sữa Hạt Sen Lotus Yoo được chiết xuất từ hạt sen tươi, mang đến hương vị thanh mát, nhẹ nhàng. Sản phẩm giàu dinh dưỡng, thích hợp cho mọi lứa tuổi.',
      price: 28000,
      unit: '1 chai',
      category_id: 'cat-sua-hat',
      thumbnail: '/images/products/sua-hat-sen-lotus.png',
      is_featured: true,
      is_best_seller: true,
      is_new: false,
    },
    {
      id: 'prod-sl-01',
      slug: 'sua-gao-lut-ohsawa-yoo',
      name: 'Sữa Gạo Lứt Ohsawa Yoo',
      sku: 'SL-01',
      short_description: 'Sữa gạo lứt Ohsawa Yoo thơm ngon, giàu dinh dưỡng.',
      description: 'Sữa Gạo Lứt Ohsawa Yoo được chế biến từ gạo lứt nguyên cám, giữ trọn vẹn dinh dưỡng tự nhiên.',
      price: 28000,
      unit: '1 chai',
      category_id: 'cat-sua-hat',
      thumbnail: '/images/products/sua-gao-lut-ohsawa.png',
      is_featured: false,
      is_best_seller: false,
      is_new: false,
    },
    {
      id: 'prod-lh-01',
      slug: 'sam-la-han-hoa-cuc-thai-son',
      name: 'Sâm La Hán Hoa Cúc Thái Sơn',
      sku: 'LH-01',
      short_description: 'Nước sâm la hán hoa cúc thanh nhiệt, giải độc.',
      description: 'Sâm La Hán Hoa Cúc Thái Sơn kết hợp la hán quả và hoa cúc, tạo nên thức uống thanh nhiệt, giải độc, mát gan.',
      price: 18000,
      unit: '1 chai',
      category_id: 'cat-nuoc-giai-khat',
      thumbnail: '/images/products/la-han.png',
      is_featured: false,
      is_best_seller: false,
      is_new: false,
    },
    {
      id: 'prod-md-01',
      slug: 'nha-dam-mu-trom-thai-son',
      name: 'Nha Đam Mủ Trôm Thái Sơn',
      sku: 'MD-01',
      short_description: 'Nước nha đam mủ trôm mát lành, tốt cho tiêu hóa.',
      description: 'Nha Đam Mủ Trôm Thái Sơn kết hợp nha đam tươi và mủ trôm, mang đến thức uống mát lành, hỗ trợ tiêu hóa tốt.',
      price: 18000,
      unit: '1 chai',
      category_id: 'cat-nuoc-giai-khat',
      thumbnail: '/images/products/mu-trom.png',
      is_featured: false,
      is_best_seller: true,
      is_new: false,
    },
    {
      id: 'prod-mac-01',
      slug: 'matcha-tra-sua-ciao',
      name: 'Matcha Trà Sữa Ciao',
      sku: 'MAC-01',
      short_description: 'Matcha trà sữa Ciao đậm đà, thơm ngon.',
      description: 'Matcha Trà Sữa Ciao mang đến hương vị matcha đậm đà kết hợp trà sữa béo ngậy.',
      price: 20000,
      unit: '1 chai',
      category_id: 'cat-tra-sua',
      thumbnail: '/images/products/matcha-tra-sua-ciao.png',
      is_featured: false,
      is_best_seller: false,
      is_new: true,
    },
    {
      id: 'prod-txg-01',
      slug: 'tra-xanh-go',
      name: 'Trà Xanh GO',
      sku: 'TXG-01',
      short_description: 'Trà xanh GO thanh mát, tự nhiên.',
      description: 'Trà Xanh GO được chế biến từ lá trà xanh tươi, giữ nguyên hương vị thanh mát tự nhiên.',
      price: 18000,
      unit: '1 chai',
      category_id: 'cat-tra-sua',
      thumbnail: '/images/products/tra-xanh-go.png',
      is_featured: false,
      is_best_seller: false,
      is_new: false,
    },
    {
      id: 'prod-sgl-01',
      slug: 'sua-gao-lut-mekong-xanh',
      name: 'Sữa Gạo Lứt Mekong Xanh',
      sku: 'SGL-01',
      short_description: 'Sữa gạo lứt Mekong Xanh từ đồng bằng sông Cửu Long.',
      description: 'Sữa Gạo Lứt Mekong Xanh được làm từ gạo lứt vùng đồng bằng sông Cửu Long, mang hương vị đặc trưng.',
      price: 18000,
      unit: '1 chai',
      category_id: 'cat-sua-hat',
      thumbnail: '/images/products/sua-gao-lut-mekong.png',
      is_featured: false,
      is_best_seller: false,
      is_new: false,
    },
    {
      id: 'prod-tsa-01',
      slug: 'tra-sua-ciao',
      name: 'Trà Sữa Ciao',
      sku: 'TSA-01',
      short_description: 'Trà sữa Ciao béo ngậy, thơm ngon.',
      description: 'Trà Sữa Ciao mang đến hương vị trà sữa đậm đà, béo ngậy.',
      price: 20000,
      unit: '1 chai',
      category_id: 'cat-tra-sua',
      thumbnail: '/images/products/tra-sua-ciao.png',
      is_featured: false,
      is_best_seller: false,
      is_new: false,
    },
    {
      id: 'prod-shs-01',
      slug: 'sua-hat-sen-mekong-xanh',
      name: 'Sữa Hạt Sen Mekong Xanh',
      sku: 'SHS-01',
      short_description: 'Sữa hạt sen Mekong Xanh thanh mát, bổ dưỡng.',
      description: 'Sữa Hạt Sen Mekong Xanh được chiết xuất từ hạt sen vùng Đồng Tháp, mang đến hương vị thanh nhẹ.',
      price: 18000,
      unit: '1 chai',
      category_id: 'cat-sua-hat',
      thumbnail: '/images/products/sua-hat-sen-mekong.png',
      is_featured: false,
      is_best_seller: false,
      is_new: false,
    },
    {
      id: 'prod-tsg-01',
      slug: 'tra-sua-go',
      name: 'Trà Sữa GO',
      sku: 'TSG-01',
      short_description: 'Trà sữa GO tiện lợi, đậm vị.',
      description: 'Trà Sữa GO mang đến hương vị trà sữa đặc trưng, tiện lợi sử dụng mọi lúc mọi nơi.',
      price: 18000,
      unit: '1 chai',
      category_id: 'cat-tra-sua',
      thumbnail: '/images/products/tra-sua-go.png',
      is_featured: false,
      is_best_seller: false,
      is_new: false,
    },
  ];

  for (const p of prods) {
    await dbPool.query(
      `INSERT INTO products (id, slug, name, sku, short_description, description, price, unit, category_id, thumbnail, is_featured, is_best_seller, is_new, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         price = EXCLUDED.price,
         thumbnail = EXCLUDED.thumbnail,
         short_description = EXCLUDED.short_description`,
      [
        p.id,
        p.slug,
        p.name,
        p.sku,
        p.short_description,
        p.description,
        p.price,
        p.unit,
        p.category_id,
        p.thumbnail,
        p.is_featured,
        p.is_best_seller,
        p.is_new,
      ]
    );
  }

  // Seed variants for Sữa Bắp
  await dbPool.query(`DELETE FROM product_variants WHERE product_id = 'prod-sb-01'`);
  const variants = [
    { id: 'v-sb-1', name: '1 chai', quantity: 1, price: 18000, unit: 'chai' },
    { id: 'v-sb-6', name: '6 chai', quantity: 6, price: 108000, unit: 'lốc' },
    { id: 'v-sb-12', name: '12 chai', quantity: 12, price: 216000, unit: 'thùng' },
    { id: 'v-sb-24', name: '24 chai', quantity: 24, price: 432000, unit: 'thùng' },
  ];

  for (const v of variants) {
    await dbPool.query(
      `INSERT INTO product_variants (id, product_id, name, quantity, price, unit)
       VALUES ($1, 'prod-sb-01', $2, $3, $4, $5)`,
      [v.id, v.name, v.quantity, v.price, v.unit]
    );
  }

  console.log('Seeded all 12 products and categories into WebTSF database!');

  // Query verification
  const count = await dbPool.query('SELECT count(*) FROM products');
  console.log('Total products in database WebTSF:', count.rows[0].count);

  await dbPool.end();
}

main().catch(console.error);
