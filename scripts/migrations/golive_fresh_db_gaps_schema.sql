-- ==============================================================================
-- GO-LIVE (F-01): bù lược đồ cho DB production dựng MỚI TỪ ĐẦU
--
-- Dựng thử DB trống (14/11/2026) bằng bộ khởi tạo src/lib/db.ts (scripts/schema_bootstrap_dry_run.mjs)
-- + 12 migration trong scripts/migrations vẫn THIẾU các bảng/cột dưới đây, trong khi code đang dùng:
--   inventory_logs          src/lib/inventory.ts, api/admin/inventory, api/admin/inventory/logs (REVIEW.md R29)
--   products.volume         src/lib/product-stats.ts, api/admin/products, trang chi tiết SP
--   products.name_en        api/categories (bản tiếng Anh)
--   products.is_vegan       đọc khi đồng bộ sản phẩm
--   product_variants.volume api/admin/sync
--   categories.name_en      api/categories
-- Định nghĩa lấy đúng như DB staging đang chạy (WebTSF_staging, information_schema 14/11/2026).
--
-- Chạy SAU bootstrap + các migration khác (thứ tự: docs/golive/CUTOVER.md).
-- Mọi câu đều IF NOT EXISTS: chạy lại nhiều lần vẫn an toàn, không sửa/xoá dữ liệu có sẵn.
-- Hoàn tác: scripts/migrations/golive_fresh_db_gaps_rollback.sql
-- ==============================================================================

BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS volume VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en VARCHAR(500);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN DEFAULT true;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS volume VARCHAR(50);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id VARCHAR(100) PRIMARY KEY,
  store_code VARCHAR(50) NOT NULL,
  product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  old_reserved INTEGER NOT NULL DEFAULT 0,
  new_reserved INTEGER NOT NULL DEFAULT 0,
  change_type VARCHAR(50) NOT NULL,
  order_id VARCHAR(50),
  actor VARCHAR(100) NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inv_logs_store ON inventory_logs(store_code);
CREATE INDEX IF NOT EXISTS idx_inv_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_logs_created_at ON inventory_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_logs_order ON inventory_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_inv_logs_store_created ON inventory_logs(store_code, created_at DESC);

COMMIT;
