-- Rollback Migration 01: Hoàn tác các cột định vị GPS đã thêm vào stores và orders

ALTER TABLE orders DROP COLUMN IF EXISTS latitude;
ALTER TABLE orders DROP COLUMN IF EXISTS longitude;
ALTER TABLE orders DROP COLUMN IF EXISTS location_confirmed;
ALTER TABLE orders DROP COLUMN IF EXISTS location_confirmed_by;
ALTER TABLE orders DROP COLUMN IF EXISTS address_new;
ALTER TABLE orders DROP COLUMN IF EXISTS address_old;
ALTER TABLE orders DROP COLUMN IF EXISTS recommended_store_id;
ALTER TABLE orders DROP COLUMN IF EXISTS was_overridden;
ALTER TABLE orders DROP COLUMN IF EXISTS ranking_snapshot;

ALTER TABLE stores DROP COLUMN IF EXISTS area_label;
ALTER TABLE stores DROP COLUMN IF EXISTS province_code;
ALTER TABLE stores DROP COLUMN IF EXISTS address_new;
ALTER TABLE stores DROP COLUMN IF EXISTS address_old;
ALTER TABLE stores DROP COLUMN IF EXISTS location_verified_by;
ALTER TABLE stores DROP COLUMN IF EXISTS location_verified_at;
ALTER TABLE stores DROP COLUMN IF EXISTS supports_delivery;
ALTER TABLE stores DROP COLUMN IF EXISTS supports_pickup;
ALTER TABLE stores DROP COLUMN IF EXISTS delivery_radius_km;
ALTER TABLE stores DROP COLUMN IF EXISTS prep_minutes;
ALTER TABLE stores DROP COLUMN IF EXISTS max_active_orders;
ALTER TABLE stores DROP COLUMN IF EXISTS opening_hours;
ALTER TABLE stores DROP COLUMN IF EXISTS holiday_overrides;
ALTER TABLE stores DROP COLUMN IF EXISTS is_accepting_orders;
ALTER TABLE stores DROP COLUMN IF EXISTS paused_until;
ALTER TABLE stores DROP COLUMN IF EXISTS pause_reason;
