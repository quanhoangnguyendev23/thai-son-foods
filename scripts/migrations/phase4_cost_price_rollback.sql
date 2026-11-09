-- ==============================================================================
-- Rollback Migration Phase 4: Quản lý giá vốn & Báo cáo lợi nhuận
-- ==============================================================================

DROP INDEX IF EXISTS idx_order_items_product_id;
DROP INDEX IF EXISTS idx_order_items_order_id;

ALTER TABLE order_items DROP COLUMN IF EXISTS cost_price;
ALTER TABLE combos DROP COLUMN IF EXISTS cost_price;
ALTER TABLE products DROP COLUMN IF EXISTS cost_price;
