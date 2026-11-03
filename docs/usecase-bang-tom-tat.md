# Bảng tóm tắt use case - Website Thái Sơn Foods

Nguồn: đọc trực tiếp mã nguồn trong `src/` (API route, `middleware.ts`, `lib/rbac.ts`, `config/features.ts`, `vercel.json`).
Các file sơ đồ: `usecase.puml` (tổng quan), `usecase-mua-hang.puml`, `usecase-quan-tri.puml`, `usecase-chua-ro.puml`.

## 1. Actor

| Actor | Loại | Ghi chú | Bằng chứng |
|---|---|---|---|
| Khách vãng lai | Chính | Không cần đăng nhập, vẫn đặt hàng được | `api/orders/route.ts` (POST), `GET` tra cứu bằng mã đơn + SĐT |
| Khách hàng (đã đăng nhập) | Chính, kế thừa Khách vãng lai | Hồ sơ, lịch sử đơn, đánh giá, yêu thích | `api/auth/*`, `api/user/*`, `context/UserAuthContext.tsx` |
| Nhân viên quản trị | Chính (lớp cha của 3 vai trò) | Đăng nhập /admin | `api/admin/auth/login`, `lib/rbac.ts` |
| Nhân viên cửa hàng (STORE_STAFF) | Chính, kế thừa | Chỉ thấy đơn/kho chi nhánh mình (`getStoreScope`) | `lib/rbac.ts` `ROLE_PERMISSIONS` |
| Marketing (MARKETING) | Chính, kế thừa | Sản phẩm, combo, danh mục, nội dung, đánh giá | `lib/rbac.ts` |
| Super Admin (SUPER_ADMIN) | Chính, kế thừa | Toàn bộ quyền | `lib/rbac.ts` |
| Đối tác (CTV) / Đại lý | Chính - ĐANG TẮT | Cờ `NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM` | `config/features.ts`, `middleware.ts` |
| Zalo Bot | Hệ thống ngoài | Nhận tin báo đơn mới | `lib/notify/zalo.ts` |
| Dịch vụ email (SMTP / Resend) | Hệ thống ngoài | Email đơn hàng | `lib/email/service.ts` |
| Google / Facebook OAuth | Hệ thống ngoài | Đăng nhập nhanh | `lib/oauth.ts`, `api/auth/callback/*` |
| Google Maps / Nominatim | Hệ thống ngoài | Định vị địa chỉ giao hàng | `api/geo/geocode/route.ts` |
| Google Sheet | Hệ thống ngoài | Nguồn tồn kho khi `INVENTORY_SOURCE=sheet` | `lib/inventorySheet.ts`, `config/inventorySheet.ts` |
| Bộ hẹn giờ (Cron) | Hệ thống ngoài | Gọi API bằng `Bearer CRON_SECRET` | `vercel.json`, `api/cron/*` |

## 2. Use case

| Actor | Use case | Mô tả ngắn | File / endpoint |
|---|---|---|---|
| Khách vãng lai | Xem & tìm sản phẩm / combo | Danh sách, chi tiết, tìm kiếm, so sánh | `api/products`, `api/combos`, `app/san-pham/[slug]`, `components/layout/HeaderAmazon.tsx`, `ProductCompareTable.tsx` |
| Khách vãng lai | Quản lý giỏ hàng | Thêm / sửa / xóa dòng hàng | `store/cart.ts`, `app/gio-hang/page.tsx`, `CartDrawer.tsx` |
| Khách vãng lai | Chọn chi nhánh nhận hàng | Chọn tay hoặc nhận gợi ý chi nhánh gần nhất | `api/stores`, `api/stores/recommend`, `BranchSelectorModal.tsx`, `StoreRecommendationSheet.tsx` |
| Khách vãng lai | Đặt hàng (COD) | Tạo đơn, kiểm tra tồn và giữ chỗ, kiểm tra rủi ro COD | `POST api/orders`, `app/thanh-toan/page.tsx`, `api/inventory/check` |
| (hệ thống) | Gửi tin báo đơn Zalo | Gửi tới các `chat_id` đã cấu hình; thiếu biến thì bỏ qua | `lib/notify/zalo.ts`, `api/orders/route.ts` (gọi `notifyNewOrderZalo`) |
| (hệ thống) | Gửi email xác nhận đơn | `ORDER_CONFIRMATION` khi tạo đơn | `api/orders/route.ts`, `lib/email/service.ts` |
| Khách vãng lai | Xác định vị trí giao hàng | Geocode / autocomplete / reverse | `api/geo/*`, `LocationConfirmMapModal.tsx` |
| Khách vãng lai | Tra cứu đơn hàng | Mã đơn + SĐT, có chống dò | `GET api/orders`, `lib/rateLimit.ts` |
| Khách vãng lai | Xem đánh giá / bình chọn hữu ích | Danh sách, tóm tắt sao | `GET api/reviews`, `api/reviews/summary`, `api/reviews/[id]/helpful` |
| Khách vãng lai | Đăng ký / Đăng nhập | Email + mật khẩu | `api/auth/register`, `api/auth/login`, `AuthModal.tsx` |
| Khách vãng lai | Đăng nhập Google / Facebook | Chỉ hiện khi có khóa của nhà cung cấp | `api/auth/google`, `api/auth/facebook`, `api/auth/callback/*` |
| Khách hàng | Quản lý hồ sơ | Xem, sửa thông tin | `api/auth/me` (GET, PUT), `app/tai-khoan/page.tsx` |
| Khách hàng | Xem lịch sử đơn hàng | Đơn của chính mình | `api/user/orders` |
| Khách hàng | Viết đánh giá | Cần đăng nhập (`getUserSession`) | `POST api/reviews`, `api/user/reviews`, `ProductReviewsSection.tsx` |
| Khách hàng | Quản lý yêu thích | Thêm / xóa / xem | `api/user/wishlist` (GET, POST, DELETE), `WishlistPanel.tsx` |
| Nhân viên quản trị | Đăng nhập quản trị / Đổi mật khẩu | Bắt buộc đổi mật khẩu lần đầu | `api/admin/auth/login`, `change-password`, `logout`, `me` |
| Nhân viên quản trị | Xem Dashboard | Công ty (`dashboard.view_company`) hoặc chi nhánh (`dashboard.view_store`); biểu đồ, bảng đơn chưa hoàn thành | `api/admin/stats`, `app/admin/DashboardCharts.tsx`, `app/admin/page.tsx` |
| Nhân viên quản trị | Quản lý đơn hàng | Xem, lọc, đổi trạng thái; STORE_STAFF chỉ chi nhánh mình; xóa cần `orders.update_status_all` | `api/admin/orders` (GET, PUT, DELETE) |
| Nhân viên quản trị | Xem đơn chưa hoàn thành | Lọc `status=OPEN` (mọi đơn trừ Hoàn thành / Đã hủy) | `api/admin/orders/route.ts` |
| Nhân viên quản trị | Xuất Excel đơn hàng | `export=xlsx`, 2 sheet | `api/admin/orders/route.ts`, `lib/xlsx.ts` |
| Nhân viên quản trị | Xác nhận thanh toán chuyển khoản | Nhập mã giao dịch ngân hàng (xem mục 4) | `api/admin/orders/[id]/confirm-payment` |
| Super Admin | Chuyển đơn sang chi nhánh khác | Chuyển nguyên tử, `orders.transfer` | `api/admin/orders/transfer` |
| Super Admin | Đối soát COD / xử lý hoàn | `cod.reconcile`, `cod.process_return` | `api/admin/orders/reconcile` |
| Nhân viên quản trị | Quản lý tồn kho | Xem theo chi nhánh, điều chỉnh tay, nhập lô, nhật ký | `api/admin/inventory`, `inventory/lots`, `inventory/logs`, `inventory/combo-details` |
| Nhân viên quản trị | Xem tồn kho từ Google Sheet, ngừng bán, cập nhật ngay | Chỉ khi `INVENTORY_SOURCE=sheet` | `api/admin/inventory/sheet` (GET, POST), `SheetInventoryPanel.tsx` |
| Marketing, Super Admin | Quản lý sản phẩm | Giá bán (`products.manage_price`), giá vốn (`cost_price.edit`), ảnh | `api/admin/products`, `products/[id]/images` |
| Marketing, Super Admin | Quản lý combo | `combos.manage` | `api/admin/combos`, `combos/[id]/images` |
| Marketing, Super Admin | Quản lý danh mục | `categories.manage` | `api/admin/categories` |
| Marketing, Super Admin | Quản lý banner & slide thương hiệu, tải ảnh | `content.manage`, `upload.use` | `api/admin/banners`, `brand-slides`, `upload` |
| Marketing, Super Admin | Kiểm duyệt / trả lời đánh giá | `reviews.reply`, `reviews.moderate` | `api/admin/reviews`, `reviews/[id]`, `app/admin/reviews/page.tsx` |
| Super Admin | Xem báo cáo lợi nhuận, xem giá vốn | `profit.view`, `cost_price.view`; xuất Excel ở phía trình duyệt | `api/admin/reports/profit`, `lib/xlsx.ts` |
| Super Admin | Quản lý tài khoản quản trị | Tạo, sửa, xóa, gán vai trò và chi nhánh (`users.manage`) | `api/admin/users` |
| Super Admin | Xem nhật ký thao tác | `audit.view` | `api/admin/audit`, `lib/audit.ts` |
| Nhân viên quản trị | Quản lý cửa hàng | `stores.edit_own` (STORE_STAFF), `stores.edit_all` | `api/admin/stores` |
| Cron | Dọn giữ chỗ quá hạn | 00:00 hằng ngày | `vercel.json`, `api/cron/cleanup-reservations` |
| Cron | Đồng bộ tồn kho từ Google Sheet | 22:30 hằng ngày (và tự đọc lại khi có người xem) | `vercel.json`, `api/cron/sync-inventory`, `lib/inventorySheet.ts` |

## 3. Chức năng ĐANG TẮT (có trong code nhưng không chạy mặc định)

| Nhóm | Điều kiện bật | Use case | File / endpoint |
|---|---|---|---|
| Chương trình Đối tác | `NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM=true` (middleware trả 404 / chuyển hướng khi tắt) | Đăng ký đối tác (OTP), mã giới thiệu `?ref=`, thống kê và sổ cái, rút tiền, nâng cấp Đại lý, đơn đại lý; Admin duyệt / tạm ngưng đối tác, duyệt rút tiền | `api/partner/*`, `api/dealer/*`, `api/admin/partners`, `api/admin/payouts`, `app/doi-tac`, `app/dang-ky-doi-tac`, `app/dai-ly`, `app/admin/partners`, `app/admin/payouts` |
| Hội viên | `MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP` (đang `false`) | Đăng ký, tạm dừng, hủy hội viên; admin quản lý hội viên | `api/membership/*`, `app/member`, `api/admin/members` |
| Subscribe & Save | `ENABLE_SUBSCRIBE_SAVE` (đang `false`) | Đơn giao định kỳ, bỏ qua kỳ, đổi tần suất / địa chỉ; cron tạo đơn và nhắc lịch | `api/subscriptions/*`, `api/cron/subscriptions/*`, `app/tai-khoan/dinh-ky` |

## 4. Mục "(chưa rõ)" cần xác nhận với doanh nghiệp

1. **Thanh toán chuyển khoản:** `POST /api/orders` chỉ chấp nhận `cod` (`SUPPORTED_PAYMENT_METHODS = ['cod']`), nhưng admin có endpoint và nút "Xác nhận thanh toán chuyển khoản". Chưa thấy luồng khách chọn chuyển khoản. Chưa rõ đây là chức năng dự phòng hay còn dang dở.
2. **Gửi OTP (đối tác, hội viên):** `lib/partner/otp.ts` và `lib/membership/otp.ts` chỉ ghi `console.log`, không có nhà cung cấp SMS. Chưa rõ OTP gửi tới người dùng bằng cách nào. Cả hai nhóm này đều đang tắt.
3. **Combo:** `ENABLE_COMBOS` và `ENABLE_CUSTOM_COMBOS` đang `true` ở nhánh này, nhưng chú thích trong `features.ts` ghi doanh nghiệp chưa chốt combo và chưa làm bước B1 (máy chủ tự tính giá combo tự chọn). Dùng được ở nhánh này nhưng chưa sẵn sàng go-live.
4. **Bán hàng ngoài COD / hủy đơn bởi khách:** không thấy chức năng khách tự hủy đơn trong code.
5. **Đồng bộ / seed dữ liệu** (`api/admin/sync`, `api/admin/seed`, trang `test-email`, `api/auth/mock-oauth`): công cụ dành cho phát triển, bị khóa hoặc tắt ở production. Không đưa vào sơ đồ chính.
6. **Trang giới thiệu thương hiệu** `/2010` (`Story2010.tsx`, `Scene1Game.tsx`): nội dung tĩnh / tương tác, không có xử lý dữ liệu, nên không vẽ thành use case riêng.
7. **Đăng ký quản trị viên đầu tiên** (`api/admin/auth/register`): chỉ chạy khi bảng `admin_users` còn trống và cần `ADMIN_REGISTER_KEY` (đã xác nhận phần đếm số admin, chưa đọc hết điều kiện).
