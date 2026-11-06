-- ==============================================================================
-- Migration Phase 7: Membership & Subscribe & Save Engine (Idempotent)
-- Hệ thống Hội viên (Thái Sơn Prime) & Đăng ký Giao định kỳ (Subscribe & Save)
-- ==============================================================================

-- 1. Bảng Hạng Thành Viên (Membership Tiers)
CREATE TABLE IF NOT EXISTS membership_tiers (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  price INTEGER DEFAULT 0 NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'month' NOT NULL,
  discount_rate DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
  free_shipping BOOLEAN DEFAULT false NOT NULL,
  point_rate DOUBLE PRECISION DEFAULT 1.0 NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Bảng Trạng Thái Gói Hội Viên Người Dùng (User Memberships)
CREATE TABLE IF NOT EXISTS user_memberships (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  tier_id VARCHAR(50) NOT NULL REFERENCES membership_tiers(id),
  status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_renew BOOLEAN DEFAULT false NOT NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  paused_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON user_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_status_expires ON user_memberships(status, expires_at);

-- 3. Bảng Hợp Đồng Đăng Ký Giao Định Kỳ (Subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(50) PRIMARY KEY,
  subscription_code VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
  delivery_frequency VARCHAR(20) DEFAULT '1_WEEK' NOT NULL,
  preferred_day_of_week INTEGER DEFAULT 2 NOT NULL,
  preferred_time_slot VARCHAR(50) DEFAULT '08:00-12:00' NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  shipping_address TEXT NOT NULL,
  province VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  ward VARCHAR(100) NOT NULL,
  store_code VARCHAR(50) REFERENCES stores(code) ON DELETE SET NULL,
  payment_method VARCHAR(50) DEFAULT 'vietqr' NOT NULL,
  next_delivery_date TIMESTAMP WITH TIME ZONE NOT NULL,
  last_delivered_date TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_next_date ON subscriptions(status, next_delivery_date);

-- 4. Bảng Mặt Hàng Đăng Ký Định Kỳ (Subscription Items)
CREATE TABLE IF NOT EXISTS subscription_items (
  id VARCHAR(50) PRIMARY KEY,
  subscription_id VARCHAR(50) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id VARCHAR(100) NOT NULL,
  variant_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) DEFAULT 'Lốc 7 chai' NOT NULL,
  price_snapshot INTEGER NOT NULL,
  discount_rate DOUBLE PRECISION DEFAULT 0.15 NOT NULL,
  final_price INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_items_subscription_id ON subscription_items(subscription_id);

-- 5. Bảng Lịch Giao Định Kỳ & Lịch Sử Từng Kỳ (Subscription Schedules)
CREATE TABLE IF NOT EXISTS subscription_schedules (
  id VARCHAR(50) PRIMARY KEY,
  subscription_id VARCHAR(50) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'SCHEDULED' NOT NULL,
  generated_order_id VARCHAR(50) REFERENCES orders(id) ON DELETE SET NULL,
  skip_reason TEXT,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT uq_sub_schedule_date UNIQUE (subscription_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_subscription_schedules_status_date ON subscription_schedules(status, scheduled_date);

-- 6. Bảng Sổ Cái Tích Điểm Hội Viên (Loyalty Point Ledger)
CREATE TABLE IF NOT EXISTS loyalty_point_ledger (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  reference_id VARCHAR(100),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loyalty_point_ledger_user ON loyalty_point_ledger(user_id, created_at DESC);

-- 7. Khởi tạo dữ liệu mẫu cho các gói hội viên chuẩn (Idempotent Seed)
INSERT INTO membership_tiers (id, code, name, price, billing_cycle, discount_rate, free_shipping, point_rate, description, is_active)
VALUES
  ('tier_free', 'FREE', 'Khách Thường (Standard)', 0, 'none', 0.0, false, 1.0, 'Tích 1% điểm thưởng mua hàng, giá bán lẻ tiêu chuẩn', true),
  ('tier_prime_monthly', 'PRIME_MONTHLY', 'Thái Sơn Prime Tháng', 49000, 'month', 0.15, true, 2.0, 'Freeship 100%, Giảm 15% Subscribe & Save trọn đời, Tích x2 điểm thưởng', true),
  ('tier_prime_yearly', 'PRIME_YEARLY', 'Thái Sơn Prime Năm', 499000, 'year', 0.15, true, 2.0, 'Tiết kiệm 15% so với gói tháng, Freeship 100%, Giảm 15% Subscribe & Save, Quà tặng sinh nhật', true)
ON CONFLICT (code) DO NOTHING;
