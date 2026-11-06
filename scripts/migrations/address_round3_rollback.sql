-- Hoàn tác address_round3_schema.sql (mất dữ liệu 4 cột mới và bảng address_events)
DROP TABLE IF EXISTS address_events;
ALTER TABLE orders DROP COLUMN IF EXISTS location_check;
ALTER TABLE orders DROP COLUMN IF EXISTS provider_place_id;
ALTER TABLE orders DROP COLUMN IF EXISTS address_precision;
ALTER TABLE orders DROP COLUMN IF EXISTS address_source;
