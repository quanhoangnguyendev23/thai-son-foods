-- Cài đặt chung của website (khoá -> giá trị), admin bật/tắt được không cần build lại.
-- Chạy lại nhiều lần vẫn an toàn (IF NOT EXISTS). Chỉ thêm bảng mới, không sửa/xoá dữ liệu cũ.
-- Ứng dụng cũng tự tạo bảng này khi cần (src/lib/site-settings.ts).
-- Khoá hiện có: daily_deals_enabled (true/false) — "Deal trong ngày". Chưa có dòng = TẮT.
CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
