-- ==============================================================================
-- Migration Phase 4: Quản lý giá vốn & Báo cáo lợi nhuận (Idempotent)
-- ==============================================================================

-- 1. Thêm cột cost_price vào bảng products (giá vốn sản phẩm cơ sở)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0;

-- 2. Thêm cột cost_price vào bảng combos (giá vốn combo)
ALTER TABLE combos ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0;

-- 3. Thêm cột snapshot cost_price vào bảng order_items
-- Lưu ý: Đơn hàng cũ chưa có snapshot sẽ có cost_price = NULL ("chưa có dữ liệu giá vốn")
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price INTEGER;

-- 4. Tạo index tối ưu truy vấn báo cáo lợi nhuận
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
