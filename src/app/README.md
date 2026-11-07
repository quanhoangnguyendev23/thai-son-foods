# Các trang của web (src/app)

Mỗi thư mục là một đường dẫn trên web; file `page.tsx` trong đó là trang đó.

| Thư mục / file | Đường dẫn | Là trang nào |
|---|---|---|
| `page.tsx` | `/` | **Trang chủ** (giao diện ở `src/components/home`) |
| `layout.tsx` | mọi trang | Khung chung: phông chữ, đầu / chân trang (sửa hạn chế, ảnh hưởng toàn web) |
| `globals.css`, `brand-tokens.css` | mọi trang | Kiểu chung, thang cỡ chữ, 7 màu thương hiệu (sửa hạn chế) |
| `san-pham/` | `/san-pham`, `/san-pham/[slug]` | **Danh sách sản phẩm**, **chi tiết sản phẩm** |
| `combo/` | `/combo`, `/combo/[slug]` | **Danh sách combo**, chi tiết combo |
| `thuong-hieu/` | `/thuong-hieu/[slug]` | Trang thương hiệu |
| `gio-hang/` | `/gio-hang` | **Giỏ hàng** |
| `thanh-toan/` | `/thanh-toan` | **Thanh toán / đặt hàng** (ô địa chỉ, bản đồ ghim, giờ giao, chọn cửa hàng) |
| `tai-khoan/` | `/tai-khoan` | **Tài khoản khách**: hồ sơ, địa chỉ đã lưu, đơn đã đặt; `dinh-ky/` giao định kỳ; `tui-tiet-kiem/` túi tiết kiệm |
| `member/` | `/member` | Hội viên |
| `dai-ly/`, `doi-tac/`, `dang-ky-doi-tac/` | | Đại lý, cổng đối tác / CTV, đăng ký đối tác |
| `admin/` | `/admin` | **Trang quản trị** (xem `admin` trong `docs/BAN-DO-MA-NGUON.md`) |
| `2010/` | `/2010` | Trang quà tặng riêng, không thuộc cửa hàng |
| `test-email/` | `/test-email` | Trang thử gửi email (chỉ dùng khi phát triển) |
| `api/` | `/api/...` | **Phía máy chủ** (xem `api/README.md`) |
