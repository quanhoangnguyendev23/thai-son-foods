import { Pool } from 'pg';

// SEC-02: mật khẩu DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function dbPasswordFromEnv() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return decodeURIComponent(new URL(url).password);
}

const password = dbPasswordFromEnv();

async function setup() {
  console.log('Testing connection to PostgreSQL server with postgres user...');

  // Connect to default 'postgres' database first to check/create 'WebTSF'
  const rootPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    const res = await rootPool.query('SELECT version();');
    console.log('Connected to PostgreSQL successfully!');
    console.log('Version:', res.rows[0].version);

    // Check if WebTSF database exists
    const checkDb = await rootPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'WebTSF';"
    );

    if (checkDb.rows.length === 0) {
      console.log("Database 'WebTSF' does not exist yet. Creating database 'WebTSF'...");
      await rootPool.query('CREATE DATABASE "WebTSF";');
      console.log("Database 'WebTSF' created successfully!");
    } else {
      console.log("Database 'WebTSF' already exists!");
    }
  } catch (err) {
    console.error('Error connecting to root postgres database:', err.message);
    process.exit(1);
  } finally {
    await rootPool.end();
  }

  // Now connect to WebTSF database and initialize tables
  console.log("Connecting to 'WebTSF' database to initialize tables...");
  const appPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: password,
    database: 'WebTSF',
    connectionTimeoutMillis: 5000,
  });

  try {
    await appPool.query(`
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
        name VARCHAR(100) NOT NULL,
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
    `);
    console.log("All tables in 'WebTSF' database verified and created successfully!");

    // Check count of tables
    const tableList = await appPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Tables in WebTSF:');
    tableList.rows.forEach((r) => console.log(' - ' + r.table_name));
  } catch (err) {
    console.error('Error creating tables in WebTSF:', err.message);
  } finally {
    await appPool.end();
  }
}

setup();
