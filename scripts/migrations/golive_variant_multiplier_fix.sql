-- ============================================================================
-- GO-LIVE: Đồng bộ product_variants.bottle_multiplier = quantity
-- Lý do: bản production_ready có các quy cách 7/10/12/15 chai nhưng bottle_multiplier = 1,
--        trong khi /api/orders lấy số chai giữ kho từ bottle_multiplier (và từ chối quy cách lệch).
-- Lưu giá trị cũ vào bảng golive_variant_multiplier_backup để rollback
--   (scripts/migrations/golive_variant_multiplier_fix_rollback.sql).
-- Chạy:  psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/migrations/golive_variant_multiplier_fix.sql
-- An toàn khi chạy lại: chỉ cập nhật dòng còn lệch; backup giữ giá trị GỐC của lần chạy đầu.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS golive_variant_multiplier_backup (
  variant_id VARCHAR(255) PRIMARY KEY,
  old_bottle_multiplier INTEGER,
  quantity INTEGER,
  backed_up_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trước khi sửa: các dòng lệch
SELECT id, product_id, name, quantity, bottle_multiplier AS old_bottle_multiplier
FROM product_variants
WHERE quantity > 0 AND bottle_multiplier IS DISTINCT FROM quantity
ORDER BY id;

-- Lưu giá trị cũ (không ghi đè backup của lần chạy trước)
INSERT INTO golive_variant_multiplier_backup (variant_id, old_bottle_multiplier, quantity)
SELECT id, bottle_multiplier, quantity
FROM product_variants
WHERE quantity > 0 AND bottle_multiplier IS DISTINCT FROM quantity
ON CONFLICT (variant_id) DO NOTHING;

-- Sửa và in số dòng bị ảnh hưởng
WITH updated AS (
  UPDATE product_variants
  SET bottle_multiplier = quantity
  WHERE quantity > 0 AND bottle_multiplier IS DISTINCT FROM quantity
  RETURNING id
)
SELECT COUNT(*) AS affected_rows FROM updated;

-- Sau khi sửa: phải còn 0 dòng lệch
SELECT COUNT(*) AS remaining_mismatched_rows
FROM product_variants
WHERE quantity > 0 AND bottle_multiplier IS DISTINCT FROM quantity;

COMMIT;
