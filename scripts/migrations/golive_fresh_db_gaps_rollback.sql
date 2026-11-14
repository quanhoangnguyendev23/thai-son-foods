-- Hoàn tác golive_fresh_db_gaps_schema.sql. CHỈ dùng trên DB dựng mới vừa chạy migration đó và chưa có dữ liệu thật:
-- xoá bảng inventory_logs sẽ mất toàn bộ nhật ký tồn kho; xoá cột sẽ mất dung tích / tên tiếng Anh đã nhập.
BEGIN;
DROP TABLE IF EXISTS inventory_logs;
ALTER TABLE categories DROP COLUMN IF EXISTS name_en;
ALTER TABLE product_variants DROP COLUMN IF EXISTS volume;
ALTER TABLE products DROP COLUMN IF EXISTS is_vegan;
ALTER TABLE products DROP COLUMN IF EXISTS name_en;
ALTER TABLE products DROP COLUMN IF EXISTS volume;
COMMIT;
