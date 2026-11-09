-- Ô địa chỉ (vòng 4, 06/11/2026): xác nhận ghim cho địa chỉ ĐÃ LƯU ở tài khoản (mỗi tài khoản hiện có 1 địa chỉ).
-- Sửa chữ, Quận/Phường hoặc tọa độ thì app xóa xác nhận (so với bản chụp). Tất cả cho phép rỗng.
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_pin_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_pin_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_pin_lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_pin_snapshot TEXT;
