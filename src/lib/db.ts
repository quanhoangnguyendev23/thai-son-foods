import 'dotenv/config';
import { Pool } from 'pg';

const rawDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const isRemoteUrl = Boolean(
  rawDbUrl &&
  !rawDbUrl.includes('127.0.0.1') &&
  !rawDbUrl.includes('localhost')
);

const poolMax = parseInt(process.env.DB_POOL_MAX || '20', 10);

export const pool = new Pool(
  rawDbUrl
    ? {
        connectionString: rawDbUrl,
        ssl: isRemoteUrl ? { rejectUnauthorized: false } : undefined,
        max: poolMax,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : process.env.DB_PASSWORD
    ? {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'WebTSF',
        ssl:
          process.env.DB_HOST && !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)
            ? { rejectUnauthorized: false }
            : undefined,
        max: poolMax,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        // Không có cấu hình nào: chỉ dùng cho máy phát triển cục bộ (không kèm mật khẩu trong mã nguồn)
        connectionString: 'postgresql://postgres@127.0.0.1:5432/WebTSF?sslmode=disable',
        max: poolMax,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error] Unexpected error on idle client:', err);
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

async function runInitDatabase() {
  const client = await pool.connect();
  try {
    // Create categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(50) PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create products table
    await client.query(`
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
    `);

    // Create product variants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id VARCHAR(50) PRIMARY KEY,
        product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        quantity INTEGER DEFAULT 1,
        price INTEGER NOT NULL,
        unit VARCHAR(50) DEFAULT 'chai',
        bottle_multiplier INTEGER NOT NULL DEFAULT 1 CHECK (bottle_multiplier > 0)
      );
    `);

    // Create orders table
    await client.query(`
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
    `);

    // Create order items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit VARCHAR(255) DEFAULT '1 chai',
        thumbnail VARCHAR(500)
      );
    `);

    // Create admin users table
    await client.query(`
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

    // Create combos and combo items tables
    await client.query(`
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

      CREATE TABLE IF NOT EXISTS combo_items (
        id VARCHAR(50) PRIMARY KEY,
        combo_id VARCHAR(50) REFERENCES combos(id) ON DELETE CASCADE,
        product_id VARCHAR(50),
        quantity INTEGER DEFAULT 1,
        unit VARCHAR(50) DEFAULT 'chai'
      );
    `);

    // Create customer users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        province VARCHAR(100),
        district VARCHAR(100),
        ward VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure orders table has user_id column
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id VARCHAR(50);
    `);

    // Ensure users table supports OAuth provider info, active status, and GPS coordinates
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'local';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    `);

    // Ensure products table has stock_quantity
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 100;
      ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS bottle_multiplier INTEGER NOT NULL DEFAULT 1;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_variants_bottle_multiplier'
        ) THEN
          ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_bottle_multiplier CHECK (bottle_multiplier > 0);
        END IF;
      END $$;
    `);

    // Create store inventory table
    await client.query(`
      CREATE TABLE IF NOT EXISTS store_inventory (
        id VARCHAR(50) PRIMARY KEY,
        store_code VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        stock_quantity INTEGER NOT NULL DEFAULT 100,
        reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
        safety_stock INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(100),
        UNIQUE(store_code, product_id)
      );
      ALTER TABLE store_inventory ADD COLUMN IF NOT EXISTS reserved INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE store_inventory ADD COLUMN IF NOT EXISTS safety_stock INTEGER NOT NULL DEFAULT 0;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_store_inventory_reserved'
        ) THEN
          ALTER TABLE store_inventory ADD CONSTRAINT chk_store_inventory_reserved CHECK (reserved >= 0);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_store_inventory_stock_quantity'
        ) THEN
          ALTER TABLE store_inventory ADD CONSTRAINT chk_store_inventory_stock_quantity CHECK (stock_quantity >= 0);
        END IF;
      END $$;
    `);

    // Add combo_snapshot to order_items
    await client.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS combo_snapshot JSONB;
    `);

    // Create stock reservations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_reservations (
        id VARCHAR(100) PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        store_code VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        released_at TIMESTAMP WITH TIME ZONE
      );
      CREATE INDEX IF NOT EXISTS idx_stock_res_order ON stock_reservations(order_id);
      CREATE INDEX IF NOT EXISTS idx_stock_res_status ON stock_reservations(status);
      CREATE INDEX IF NOT EXISTS idx_stock_res_expires ON stock_reservations(expires_at);
      CREATE INDEX IF NOT EXISTS idx_stock_res_store_prod ON stock_reservations(store_code, product_id);
    `);

    // Create stores table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        province VARCHAR(100) DEFAULT 'Hồ Chí Minh',
        district VARCHAR(100),
        ward VARCHAR(100),
        map_url VARCHAR(500),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        region VARCHAR(50),
        group_code VARCHAR(50),
        status INTEGER DEFAULT 1,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_code VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_address TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT false;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_resolved_count INTEGER DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_total_count INTEGER DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_reconciled BOOLEAN DEFAULT false;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_collected_amount INTEGER DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_reconciled_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_reconciled_by VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_reason TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_disposition VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS canonical_product_id VARCHAR(255);
      ALTER TABLE order_items ALTER COLUMN canonical_product_id TYPE VARCHAR(255);
      ALTER TABLE order_items ALTER COLUMN product_id TYPE VARCHAR(255);
      ALTER TABLE order_items ALTER COLUMN unit TYPE VARCHAR(255);
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS bottle_multiplier INTEGER DEFAULT 1;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_bottles INTEGER DEFAULT 0;

      -- Performance indexes for production scale
      CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
      CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_store_code ON orders(store_code);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_store_inventory_lookup ON store_inventory(store_code, product_id);
    `);

    // Add new columns to stores if table already exists
    await client.query(`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS region VARCHAR(50);
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS group_code VARCHAR(50);
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS notes TEXT;
    `);

    // Create image management tables (product_images, combo_images, banners, brand_slides)
    await client.query(`
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

    // RBAC & Audit logs schema
    await client.query(`
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS store_code VARCHAR(50);
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_users_store_code'
        ) THEN
          ALTER TABLE admin_users
            ADD CONSTRAINT fk_admin_users_store_code
            FOREIGN KEY (store_code) REFERENCES stores(code)
            ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_admin_users_role'
        ) THEN
          ALTER TABLE admin_users
            ADD CONSTRAINT chk_admin_users_role
            CHECK (role IN ('SUPER_ADMIN', 'MARKETING', 'STORE_STAFF'));
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        admin_id VARCHAR(50),
        admin_username VARCHAR(100),
        role VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100),
        store_code VARCHAR(50),
        before_json JSONB,
        after_json JSONB,
        ip VARCHAR(100),
        user_agent TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_username ON audit_logs(admin_username);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_store_code ON audit_logs(store_code);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

      -- Phase 4: Cost price and profit reporting
      ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0;
      ALTER TABLE combos ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0;
      -- Số lượng ĐÃ BÁN THẬT ở kênh ngoài website (cửa hàng, đại lý...) do admin nhập; cộng với đơn trên web khi hiển thị
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_offset INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE combos ADD COLUMN IF NOT EXISTS sold_offset INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price INTEGER;

      -- =========================================================================
      -- PARTNER MODULE (CTV & ĐẠI LÝ) - EXTENDED SCHEMA
      -- =========================================================================
      
      -- Orders extension for Partner / Dealer channels & Payment status
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_channel VARCHAR(50) DEFAULT 'CUSTOMER';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'UNPAID';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reconciled_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reconciled_by VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS dealer_tier_snapshot VARCHAR(50);

      -- 1. Dealer Tiers definition
      CREATE TABLE IF NOT EXISTS dealer_tiers (
        id VARCHAR(50) PRIMARY KEY,
        tier_name VARCHAR(100) NOT NULL,
        tier_code VARCHAR(50) UNIQUE NOT NULL,
        min_monthly_revenue BIGINT DEFAULT 0,
        min_monthly_orders INTEGER DEFAULT 0,
        discount_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
        credit_limit BIGINT DEFAULT 0,
        benefits_description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Partner Profiles (1:1 with users)
      CREATE TABLE IF NOT EXISTS partner_profiles (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        partner_code VARCHAR(50) UNIQUE NOT NULL,
        partner_type VARCHAR(20) NOT NULL DEFAULT 'CTV',
        lifecycle_status VARCHAR(30) NOT NULL DEFAULT 'LITE',
        phone VARCHAR(50) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        id_card_number VARCHAR(50),
        id_card_issued_date DATE,
        id_card_issued_place VARCHAR(255),
        tax_code VARCHAR(50),
        bank_name VARCHAR(100),
        bank_account_number VARCHAR(50),
        bank_account_name VARCHAR(255),
        bank_branch VARCHAR(255),
        tier_id VARCHAR(50) REFERENCES dealer_tiers(id) ON DELETE SET NULL,
        referral_count INTEGER DEFAULT 0,
        total_revenue_generated BIGINT DEFAULT 0,
        total_commission_earned BIGINT DEFAULT 0,
        current_balance BIGINT DEFAULT 0,
        verified_at TIMESTAMP WITH TIME ZONE,
        approved_by VARCHAR(50),
        rejection_reason TEXT,
        suspension_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_user ON partner_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_code ON partner_profiles(partner_code);
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_status ON partner_profiles(lifecycle_status);
      CREATE INDEX IF NOT EXISTS idx_partner_profiles_phone ON partner_profiles(phone);

      -- 3. Partner Private Documents
      CREATE TABLE IF NOT EXISTS partner_documents (
        id VARCHAR(50) PRIMARY KEY,
        partner_id VARCHAR(50) NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        file_path TEXT NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        verified_by VARCHAR(50),
        verified_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_partner_docs_partner ON partner_documents(partner_id);

      -- 4. Partner Commission Policies
      CREATE TABLE IF NOT EXISTS partner_commission_policies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        partner_type VARCHAR(20) NOT NULL DEFAULT 'CTV',
        rate_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
        rate NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
        base_type VARCHAR(50) NOT NULL DEFAULT 'PRODUCT_SUBTOTAL',
        min_order_value INTEGER DEFAULT 0,
        effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        effective_to TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 5. Referral Clicks Tracking
      CREATE TABLE IF NOT EXISTS referral_clicks (
        id VARCHAR(50) PRIMARY KEY,
        partner_id VARCHAR(50) NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
        referral_code VARCHAR(50) NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        referer_url TEXT,
        landing_page TEXT,
        clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ref_clicks_partner_date ON referral_clicks(partner_id, clicked_at DESC);

      -- 6. Order Attributions
      CREATE TABLE IF NOT EXISTS order_attributions (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        partner_id VARCHAR(50) NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
        referral_code VARCHAR(50) NOT NULL,
        attribution_method VARCHAR(50) DEFAULT 'LAST_CLICK',
        is_self_referral BOOLEAN DEFAULT false,
        fraud_flags JSONB,
        policy_id VARCHAR(50) REFERENCES partner_commission_policies(id) ON DELETE SET NULL,
        snapshot_policy_name VARCHAR(255),
        snapshot_commission_rate NUMERIC(10, 2) NOT NULL,
        eligible_order_amount INTEGER NOT NULL,
        estimated_commission INTEGER NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_order_attributions_partner ON order_attributions(partner_id);
      CREATE INDEX IF NOT EXISTS idx_order_attributions_order ON order_attributions(order_id);

      -- 7. Partner Ledger (Immutable financial log)
      CREATE TABLE IF NOT EXISTS partner_ledger (
        id VARCHAR(50) PRIMARY KEY,
        partner_id VARCHAR(50) NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
        order_id VARCHAR(50) REFERENCES orders(id) ON DELETE SET NULL,
        entry_type VARCHAR(50) NOT NULL,
        amount INTEGER NOT NULL,
        direction VARCHAR(10) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'ESTIMATED',
        available_at TIMESTAMP WITH TIME ZONE,
        policy_snapshot JSONB,
        reference_id VARCHAR(100),
        note TEXT,
        created_by VARCHAR(50) NOT NULL DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_partner_ledger_partner ON partner_ledger(partner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_partner_ledger_order ON partner_ledger(order_id);
      CREATE INDEX IF NOT EXISTS idx_partner_ledger_status ON partner_ledger(status);

      -- 8. Payout Requests
      CREATE TABLE IF NOT EXISTS payout_requests (
        id VARCHAR(50) PRIMARY KEY,
        partner_id VARCHAR(50) NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        bank_name VARCHAR(100) NOT NULL,
        bank_account_number VARCHAR(50) NOT NULL,
        bank_account_name VARCHAR(255) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        rejection_reason TEXT,
        bank_reference VARCHAR(100),
        reviewed_by VARCHAR(50),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        paid_by VARCHAR(50),
        paid_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payout_requests_partner ON payout_requests(partner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

      -- 9. Inventory Lots & Expiry (FEFO)
      CREATE TABLE IF NOT EXISTS inventory_lots (
        id VARCHAR(50) PRIMARY KEY,
        store_code VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        lot_code VARCHAR(100) NOT NULL,
        manufacturing_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
        reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(store_code, product_id, lot_code)
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_lots_fefo ON inventory_lots(store_code, product_id, expiry_date ASC);

      -- 10. Stores & Orders GPS Location Extensions (Phục vụ đề xuất chi nhánh & định vị chuẩn xác)
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS area_label VARCHAR(100);
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS province_code VARCHAR(20);
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS address_new TEXT;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS address_old TEXT;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS location_verified_by VARCHAR(50);
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS location_verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS supports_delivery BOOLEAN DEFAULT true;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS supports_pickup BOOLEAN DEFAULT true;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_radius_km DOUBLE PRECISION DEFAULT 10.0;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS prep_minutes INTEGER DEFAULT 15;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS max_active_orders INTEGER DEFAULT 25;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{"mon":{"open":"07:00","close":"21:30"},"tue":{"open":"07:00","close":"21:30"},"wed":{"open":"07:00","close":"21:30"},"thu":{"open":"07:00","close":"21:30"},"fri":{"open":"07:00","close":"21:30"},"sat":{"open":"07:00","close":"21:30"},"sun":{"open":"07:00","close":"21:30"}}';
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS holiday_overrides JSONB DEFAULT '{}';
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_accepting_orders BOOLEAN DEFAULT true;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS paused_until TIMESTAMP WITH TIME ZONE;
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS pause_reason TEXT;
      CREATE INDEX IF NOT EXISTS idx_stores_delivery_active ON stores(is_active, is_accepting_orders, supports_delivery);

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_confirmed BOOLEAN DEFAULT false;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_confirmed_by VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_new TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_old TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS recommended_store_id VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS was_overridden BOOLEAN DEFAULT false;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS ranking_snapshot JSONB;
      CREATE INDEX IF NOT EXISTS idx_orders_lat_lng ON orders(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_orders_recommended_store ON orders(recommended_store_id);

      -- 11. Danh sách yêu thích theo tài khoản & lượt xem sản phẩm ẩn danh (gợi ý "khách cũng xem")
      CREATE TABLE IF NOT EXISTS wishlists (
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('product', 'combo')),
        item_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, item_type, item_id)
      );
      CREATE TABLE IF NOT EXISTS product_views (
        id BIGSERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(100) NOT NULL,
        viewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
        UNIQUE (session_id, product_id, viewed_on)
      );
      CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id, viewed_on);
      CREATE INDEX IF NOT EXISTS idx_product_views_session ON product_views(session_id, viewed_on);
    `);

    console.log('Database tables verified/created successfully!');
  } finally {
    client.release();
  }
}

/**
 * Khởi tạo / nâng cấp lược đồ CSDL — CHỈ CHẠY MỘT LẦN mỗi tiến trình (các lần gọi sau dùng lại kết quả).
 * Trước đây hàm này chạy toàn bộ lệnh DDL (CREATE/ALTER TABLE...) ở MỖI request: nhiều request đồng thời giành
 * khóa lược đồ gây "deadlock detected" (HTTP 500 khi đặt hàng) và làm chậm mọi API. Nếu lần chạy lỗi thì cho phép thử lại.
 */
let initDatabasePromise: Promise<void> | null = null;
export function initDatabase(): Promise<void> {
  if (!initDatabasePromise) {
    initDatabasePromise = runInitDatabase().catch((err) => {
      initDatabasePromise = null;
      throw err;
    });
  }
  return initDatabasePromise;
}
