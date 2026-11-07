# Xử lý nghiệp vụ dùng chung (src/lib)

| File / thư mục | Dùng cho |
|---|---|
| `db.ts` | Kết nối CSDL Postgres, tạo / nâng cấp bảng khi chạy (production chỉ qua migration) |
| `inventory.ts`, `inventoryGatekeeper.ts` | **Tồn kho**: giữ chỗ, xác nhận, trả hàng, chống bán lố |
| `inventorySheet.ts`, `inventorySheetParser.ts` | Đọc tồn kho từ Google Sheet (khi bật) |
| `storeRecommender.ts` | **Chọn cửa hàng** giao gần nhất, khoảng cách đường đi |
| `geo.ts` | Tính khoảng cách GPS |
| `address/` | **Ô địa chỉ**: gợi ý, đơn vị hành chính mới / cũ, vùng giao, kiểm tra phường, Photon / Nominatim |
| `deliverySlots.ts` | **Giờ giao hàng** (giao ngay / hẹn khung) |
| `orderStatusHistory.ts`, `order-status.ts` | Lịch sử và quy tắc đổi trạng thái đơn |
| `costSnapshot.ts` | Lưu giá vốn lúc đặt đơn (báo cáo lợi nhuận) |
| `savings.ts` | Túi tiết kiệm |
| `email/` | Gửi email đơn hàng (mẫu thư `templates.ts`) |
| `notify/` | Báo đơn mới về Telegram, Zalo |
| `auth.ts`, `jwtSecret.ts`, `oauth.ts`, `password-policy.ts` | Đăng nhập, phiên, Google / Facebook, chính sách mật khẩu |
| `rbac.ts` | Phân quyền tài khoản quản trị |
| `rateLimit.ts`, `runtimeConfig.ts` | Giới hạn số lần gọi, cấu hình đọc lúc chạy (IP, nguồn hợp lệ) |
| `audit.ts`, `logRetention.ts` | Nhật ký thao tác quản trị và hạn lưu |
| `apiError.ts`, `content-validation.ts` | Thông báo lỗi an toàn, kiểm tra URL admin nhập |
| `product-detail.ts`, `product-stats.ts`, `sponsored-products.ts` | Tính toán cho trang chi tiết sản phẩm (giá theo quy cách, đã bán, khối gợi ý) |
| `products-file-sync.ts` | Ghi thông tin sản phẩm admin sửa vào `src/data/products.ts` |
| `uploadStorage.ts` | Nơi lưu ảnh admin tải lên |
| `areaPicker.ts`, `sortDistricts.ts` | Danh sách khu vực / quận cho popup chọn chi nhánh |
| `membership/`, `partner/`, `reviews/` | Hội viên, đối tác / CTV, đánh giá |
| `xlsx.ts` | Xuất file Excel báo cáo |
| `utils.ts` | Hàm nhỏ dùng chung (định dạng tiền…) |
