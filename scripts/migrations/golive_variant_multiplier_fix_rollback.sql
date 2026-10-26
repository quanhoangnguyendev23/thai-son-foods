-- ============================================================================
-- ROLLBACK cho golive_variant_multiplier_fix.sql
-- Khôi phục product_variants.bottle_multiplier từ bảng golive_variant_multiplier_backup rồi xóa bảng backup.
-- Chạy:  psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f scripts/migrations/golive_variant_multiplier_fix_rollback.sql
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

WITH restored AS (
  UPDATE product_variants pv
  SET bottle_multiplier = b.old_bottle_multiplier
  FROM golive_variant_multiplier_backup b
  WHERE pv.id = b.variant_id
  RETURNING pv.id
)
SELECT COUNT(*) AS restored_rows FROM restored;

DROP TABLE golive_variant_multiplier_backup;

COMMIT;
