-- Gỡ cột nội dung "Thông tin sản phẩm" do admin nhập (trang chi tiết quay về nội dung trong code).
ALTER TABLE products DROP COLUMN IF EXISTS detail_content;
