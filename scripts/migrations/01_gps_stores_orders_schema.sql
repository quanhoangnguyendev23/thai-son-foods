-- Migration 01: Bổ sung các cột định vị GPS và xếp hạng chi nhánh cho stores và orders
-- Tuân thủ mục 18.2 và 18.7 trong tài liệu đặc tả tính năng GPS Thái Sơn Foods

-- 1. Bổ sung các cột thông tin cho bảng stores
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

-- 2. Bổ sung các cột vị trí GPS và snapshot xếp hạng cho bảng orders
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
