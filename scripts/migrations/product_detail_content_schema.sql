-- Nội dung khung "Thông tin sản phẩm" do admin nhập (thành phần, dinh dưỡng, ảnh nhãn, điểm nổi bật,
-- cách dùng, bảo quản, hạn dùng, nhà sản xuất, xuất xứ, chứng nhận, bao bì). Cấu trúc = ProductDetailContent
-- (src/data/product-detail-content.ts). NULL / trường trống → trang chi tiết dùng nội dung trong code như cũ.
-- Chạy lại nhiều lần vẫn an toàn (IF NOT EXISTS). Chỉ thêm cột, không sửa/xoá dữ liệu cũ.
-- Ứng dụng cũng tự thêm cột này ở môi trường phát triển (src/lib/db.ts).
ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_content JSONB;
