-- Ô địa chỉ (vòng 3, 05/11/2026): lưu nguồn / độ chính xác / mã gợi ý / kết quả kiểm tra phường của đơn,
-- và bảng log ẩn danh chất lượng gợi ý (không mã đơn, không mã khách, không IP; tự xóa sau 30 ngày).
-- Chạy: node scripts/apply_address_round3_migration.mjs        Hoàn tác: ... --rollback
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_source VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_precision VARCHAR(10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_place_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_check VARCHAR(24);

CREATE TABLE IF NOT EXISTS address_events (
  id BIGSERIAL PRIMARY KEY,
  hour TIMESTAMP WITH TIME ZONE NOT NULL,
  query VARCHAR(80),
  result_count SMALLINT,
  rank SMALLINT,
  source VARCHAR(12),
  provider_status VARCHAR(12),
  precision VARCHAR(10),
  address_source VARCHAR(14),
  location_trusted BOOLEAN,
  location_check VARCHAR(24),
  pin_moved VARCHAR(10),
  pin_choice VARCHAR(4),
  pin_lat NUMERIC(7,3),
  pin_lng NUMERIC(7,3)
);
CREATE INDEX IF NOT EXISTS idx_address_events_hour ON address_events(hour);
