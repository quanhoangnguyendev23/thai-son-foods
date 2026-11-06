-- Hoàn tác bootstrap_catchup_20261106_schema.sql. CẢNH BÁO: xóa bảng order_status_history (mất lịch sử đổi trạng thái
-- ghi từ sau khi áp) và 3 cột giờ giao của đơn (mất giờ hẹn giao đã lưu). Chỉ chạy sau khi đã hoàn tác code về bản
-- không dùng các cột/bảng này.
DROP TRIGGER IF EXISTS trg_orders_status_history ON orders;
DROP FUNCTION IF EXISTS tsf_log_order_status_v1();
DROP TABLE IF EXISTS order_status_history;
DROP INDEX IF EXISTS idx_orders_store_delivery_slot;
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_slot_end;
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_slot_start;
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_mode;
