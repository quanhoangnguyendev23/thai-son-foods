# Các nhánh Git theo chức năng (06/11/2026)

Gốc chung: `b27549b` (bản phát hành 04/11, trùng `upstream/main`). Mỗi nhánh chỉ chứa một chức năng để dễ xem, sửa và đưa lên riêng.
Nhánh `tong-hop/2026-11-06` = gộp tất cả các nhánh dưới đây, dùng để đóng gói lên server.

| Nhánh | Nằm trên | Gồm những gì |
|---|---|---|
| `feat/dia-chi` | `b27549b` | **Ô địa chỉ & bản đồ ghim (thanh toán, tài khoản, admin).** Thư viện `src/lib/address/` (gợi ý, dữ liệu hành chính NQ 1685, đoạn đường trùng tên, vùng giao, kiểm tra phường), API `/api/geo/*`, `/api/orders` chỉ nhận vị trí đáng tin + đường lui "cần gọi xác nhận" (COD), xác nhận ghim địa chỉ đã lưu, nút "Đã gọi xác nhận" ở admin, migration vòng 3/4 + migration bù, tài liệu `docs/DEPLOY-DIA-CHI.md`, test `npm run test:address`. 4 commit: thư viện → API + lược đồ → giao diện → tài liệu/script. |
| `feat/gio-giao-hang` | `feat/dia-chi` | **Giờ giao hàng.** Giao ngay hoặc hẹn khung giờ 07:00–16:30 (`src/lib/deliverySlots.ts`, `/api/delivery-slots`), máy chủ kiểm khung giờ khi đặt, chọn giờ ở trang thanh toán, giờ giao trong admin, email, Telegram, Zalo. |
| `feat/lich-su-trang-thai-don` | `feat/dia-chi` | **Lịch sử đổi trạng thái đơn.** Bảng `order_status_history` + trigger, admin thấy ai xác nhận / ai huỷ / lúc nào, dòng thời gian trong chi tiết đơn. |
| `style/thang-co-chu` | `b27549b` | **Giao diện: thang cỡ chữ 9 cỡ cho toàn web** (trang chủ, sản phẩm, combo, giỏ hàng, thanh toán, tài khoản, đại lý/đối tác, admin). Quy tắc `.agents/rules/font-sizes.md`, lệnh `npm run lint:font-sizes`. |
| `ui/khung-anh-va-huy-hieu` | `b27549b` | **Giao diện ảnh sản phẩm:** khung ảnh 4:3 nền trắng hiện trọn hình, huy hiệu giảm giá / Hot / Mới / số lượng dời sang góc phải (thẻ sản phẩm, combo, giỏ hàng, thanh toán, tài khoản, admin). |
| `chore/go-trang-ctv-dai-ly` | `b27549b` | **Gỡ trang CTV & Đại lý, Duyệt chi trả** khỏi trang quản trị (2 trang trả 404, bỏ khối menu). |
| `chore/migration-cu` | `b27549b` | **Đưa file migration cũ vào repo** (01_gps, phase1 RBAC, phase4 giá vốn, phase7 hội viên, phase8 đánh giá), trước đây bị `.gitignore` bỏ qua. |
| `data/anh-upload-va-sku` | `b27549b` | **Dữ liệu sản phẩm:** 3 ảnh admin tải lên (`public/uploads/products/`), SKU sữa gạo lứt Yoo 568ml `SL-01` → `SL`. |

## Gộp

- Thứ tự gộp không xung đột: `feat/dia-chi` → `feat/gio-giao-hang` → `feat/lich-su-trang-thai-don` → các nhánh còn lại (thứ tự tùy ý).
- `feat/gio-giao-hang` và `feat/lich-su-trang-thai-don` đặt trên `feat/dia-chi` vì cùng sửa `src/app/api/orders/route.ts` và `src/lib/db.ts`.
- `style/thang-co-chu` gộp riêng vẫn chạy được, nhưng `npm run lint:font-sizes` chỉ báo 0 khi gộp đủ các nhánh (vài dòng đổi cỡ chữ nằm chung dòng với thay đổi của nhánh khác).
- `feat/dia-chi-thanh-toan` (đã push trước đó) có cùng nội dung với `tong-hop/2026-11-06`, chỉ là chưa chia nhánh.
