import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const pool = new pg.Pool({
  connectionString:
    requireDatabaseUrl(),
});

async function runPartnerMigration() {
  console.log('🚀 BẮT ĐẦU MIGRATION PHÂN HỆ ĐỐI TÁC (PARTNER / CTV / ĐẠI LÝ)...');
  const client = await pool.connect();
  try {
    // Import initDatabase or execute the SQL queries directly
    console.log('1. Cập nhật các cột mở rộng cho bảng orders...');
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_channel VARCHAR(50) DEFAULT 'CUSTOMER';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'UNPAID';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reconciled_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reconciled_by VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS dealer_tier_snapshot VARCHAR(50);
    `);

    console.log('2. Tạo bảng dealer_tiers...');
    await client.query(`
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
    `);

    console.log('3. Tạo bảng partner_profiles...');
    await client.query(`
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
    `);

    console.log('4. Tạo bảng partner_documents...');
    await client.query(`
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
    `);

    console.log('5. Tạo bảng partner_commission_policies...');
    await client.query(`
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
    `);

    console.log('6. Tạo bảng referral_clicks...');
    await client.query(`
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
    `);

    console.log('7. Tạo bảng order_attributions...');
    await client.query(`
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
    `);

    console.log('8. Tạo bảng partner_ledger...');
    await client.query(`
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
    `);

    console.log('9. Tạo bảng payout_requests...');
    await client.query(`
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
    `);

    console.log('10. Tạo bảng inventory_lots...');
    await client.query(`
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
    `);

    console.log('11. Seed các chính sách mặc định & Dealer tiers...');
    // Seed default commission policy if empty
    await client.query(`
      INSERT INTO partner_commission_policies (id, name, partner_type, rate_type, rate, base_type, min_order_value, is_active)
      VALUES ('pol_default_ctv', 'Chính sách Hoa hồng CTV Tiêu chuẩn', 'CTV', 'PERCENTAGE', 10.00, 'PRODUCT_SUBTOTAL', 50000, true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed default dealer tiers if empty
    await client.query(`
      INSERT INTO dealer_tiers (id, tier_name, tier_code, min_monthly_revenue, min_monthly_orders, discount_rate, credit_limit, benefits_description, is_active)
      VALUES 
        ('tier_bronze', 'Đại lý Đồng', 'TIER_1', 20000000, 30, 15.00, 0, 'Chiết khấu 15% cho đơn sỉ từ 50 chai, giao hàng tận nơi', true),
        ('tier_silver', 'Đại lý Bạc', 'TIER_2', 50000000, 75, 20.00, 10000000, 'Chiết khấu 20% cho đơn từ 150 chai, hỗ trợ POSM & công nợ 10tr', true),
        ('tier_gold', 'Đại lý Vàng', 'TIER_3', 100000000, 150, 25.00, 30000000, 'Chiết khấu 25% cho đơn từ 300 chai, hỗ trợ tủ lạnh & công nợ 30tr', true)
      ON CONFLICT (tier_code) DO NOTHING;
    `);

    console.log('✅ MIGRATION HOÀN TẤT THÀNH CÔNG 100%!');
  } catch (error) {
    console.error('❌ Lỗi migration:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runPartnerMigration();
