-- Hoàn tác address_round4_schema.sql
ALTER TABLE users DROP COLUMN IF EXISTS address_pin_snapshot;
ALTER TABLE users DROP COLUMN IF EXISTS address_pin_lng;
ALTER TABLE users DROP COLUMN IF EXISTS address_pin_lat;
ALTER TABLE users DROP COLUMN IF EXISTS address_pin_confirmed_at;
