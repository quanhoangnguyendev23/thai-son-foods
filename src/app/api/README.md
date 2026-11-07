# API phía máy chủ (`/api/...`)

Mỗi thư mục là một nhóm API; file `route.ts` bên trong xử lý yêu cầu.

| Thư mục | Dùng cho |
|---|---|
| `orders/` | **Đặt hàng** từ trang thanh toán (kiểm tồn kho, phí ship, vị trí giao, giờ giao, báo đơn) |
| `products/`, `combos/`, `categories/` | Danh sách / chi tiết sản phẩm, combo, danh mục |
| `banners/`, `brand-slides/` | Ảnh banner, slide thương hiệu trên trang chủ |
| `inventory/`, `stores/` | Tồn kho theo chi nhánh, danh sách cửa hàng |
| `geo/` | **Ô địa chỉ và bản đồ**: gợi ý địa chỉ (`autocomplete`), tra tọa độ (`geocode`), địa chỉ tại ghim (`reverse`) |
| `delivery-slots/` | Khung giờ giao hàng |
| `auth/` | Đăng nhập / đăng ký khách, Google, Facebook, `me` (thông tin + địa chỉ đã lưu) |
| `user/` | Dữ liệu của khách đã đăng nhập: đơn hàng, đánh giá, túi tiết kiệm, yêu thích |
| `reviews/` | Gửi / đọc đánh giá sản phẩm |
| `membership/`, `subscriptions/` | Hội viên, giao định kỳ |
| `partner/`, `dealer/` | Đối tác / CTV, đại lý |
| `uploads/` | Phát ảnh admin tải lên |
| `cron/` | **Việc chạy định kỳ**: dọn giữ chỗ quá hạn + log cũ (`cleanup-reservations`), đồng bộ kho (`sync-inventory`), tạo đơn định kỳ (`subscriptions`). Cần `CRON_SECRET` |
| `admin/` | **API trang quản trị**: đơn hàng (đổi trạng thái, đối soát COD, xác nhận chuyển khoản, xác nhận vị trí), sản phẩm, combo, kho, cửa hàng, báo cáo, thống kê, tài khoản, đánh giá, banner, tải ảnh, nhật ký |
| `test-email/` | Thử gửi email (phát triển) |
