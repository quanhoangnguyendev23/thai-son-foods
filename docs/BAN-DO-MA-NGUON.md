# Bản đồ mã nguồn — phần nào trên web nằm ở file nào

Mở thư mục trên GitHub sẽ thấy file `README.md` của thư mục đó giải thích từng file. Bảng dưới đây tra ngược: thấy một phần trên web, muốn biết sửa ở đâu.

## Trang khách hàng

| Phần trên web | Trang (src/app) | Thành phần chính (src/components) |
|---|---|---|
| Trang chủ | `page.tsx` | `home/HomePage.tsx` (bản mới, bố cục Amazon), `home/HomePageLegacy.tsx` (bản cũ). Từng khối: `home/*` |
| Thanh trên cùng, menu, ô tìm kiếm | (mọi trang) | `layout/Header.tsx`, `layout/BranchTopBar.tsx`; trang chủ mới dùng `layout/HeaderAmazon.tsx` |
| Chân trang | (mọi trang) | `layout/Footer.tsx`, `layout/FooterAmazon.tsx` (trang chủ mới), `layout/FooterLegal.tsx` (thông tin pháp lý, dữ liệu ở `src/config/legal.ts`) |
| Danh sách sản phẩm | `san-pham/page.tsx` | `product/ProductGrid.tsx`, `product/ProductCard.tsx` |
| Chi tiết sản phẩm | `san-pham/[slug]/page.tsx` | `product/ProductMainSection.tsx` (ảnh + thông tin + khung mua), `product/ProductGallery.tsx`, `product/ProductBuyBox.tsx`, `product/ProductDetailTabs.tsx`, đánh giá `product/ProductReviewsSection.tsx` |
| Danh sách combo / chi tiết combo | `combo/page.tsx`, `combo/[slug]/page.tsx` | `product/ComboDetailView.tsx`, `product/ComboCarousel.tsx` |
| Trang thương hiệu | `thuong-hieu/[slug]/page.tsx` | `product/BrandCardsSection.tsx`, dữ liệu `src/data/brands.ts` |
| Giỏ hàng | `gio-hang/page.tsx` | `cart/CartDrawer.tsx` (ngăn kéo), `cart/CartStickySidebar.tsx`, `cart/FloatingCartWidget.tsx`; dữ liệu giỏ `src/store/cart.ts` |
| Thanh toán / đặt hàng | `thanh-toan/page.tsx` | Ô địa chỉ `checkout/AddressSuggestionList.tsx` + `src/hooks/useAddressSearch.ts`, bản đồ ghim `checkout/LocationConfirmMapModal.tsx`, chọn cửa hàng `checkout/StoreRecommendationSheet.tsx`; API `api/orders` |
| Chọn chi nhánh | (popup) | `store/BranchSelectorModal.tsx`, `src/store/branch.ts` |
| Đăng nhập / đăng ký khách | (popup) | `auth/AuthModal.tsx`, `auth/SocialAuthButtons.tsx`; API `api/auth/*` |
| Tài khoản khách (hồ sơ, địa chỉ, đơn đã đặt) | `tai-khoan/page.tsx` | `src/context/UserAuthContext.tsx` |
| Giao định kỳ / Túi tiết kiệm | `tai-khoan/dinh-ky`, `tai-khoan/tui-tiet-kiem` | `layout/SavingsBagButton.tsx`, `src/lib/savings.ts` |
| Hội viên | `member/page.tsx` | `src/lib/membership/*`, `src/config/membership.ts` |
| Đại lý / đối tác | `dai-ly`, `doi-tac`, `dang-ky-doi-tac` | `src/lib/partner/*`, `src/config/partner.ts` |
| Trang quà tặng /2010 | `2010/page.tsx` | riêng, không dùng header/footer cửa hàng |

## Trang quản trị (admin)

| Phần | File |
|---|---|
| Toàn bộ trang quản trị (đơn hàng, sản phẩm, combo, kho, báo cáo, tài khoản…) | `src/app/admin/page.tsx` |
| Biểu đồ Tổng quan | `src/app/admin/DashboardCharts.tsx` |
| Tồn kho đọc từ Google Sheet | `src/app/admin/SheetInventoryPanel.tsx` |
| Đăng nhập / đăng ký quản trị | `src/app/admin/login`, `src/app/admin/register` |
| Duyệt đánh giá | `src/app/admin/reviews/page.tsx` |
| API quản trị | `src/app/api/admin/*` |

## Phía máy chủ

| Việc | File |
|---|---|
| Kết nối CSDL + tạo bảng | `src/lib/db.ts` |
| Đặt hàng | `src/app/api/orders/route.ts` |
| Tồn kho, giữ chỗ | `src/lib/inventory.ts`, `src/lib/inventoryGatekeeper.ts`, `src/config/inventory.ts` |
| Phí ship, khoảng cách, chọn cửa hàng | `src/lib/storeRecommender.ts`, `src/lib/geo.ts`, `src/config/inventory.ts` |
| Ô địa chỉ, bản đồ, kiểm tra phường | `src/lib/address/*`, `src/app/api/geo/*` |
| Giờ giao hàng | `src/lib/deliverySlots.ts`, `src/app/api/delivery-slots` |
| Lịch sử trạng thái đơn | `src/lib/orderStatusHistory.ts` |
| Email, Telegram, Zalo báo đơn | `src/lib/email/*`, `src/lib/notify/*` |
| Phân quyền admin, đăng nhập | `src/lib/rbac.ts`, `src/lib/auth.ts`, `src/middleware.ts` |
| Việc chạy định kỳ (dọn giữ chỗ, đồng bộ kho, giao định kỳ) | `src/app/api/cron/*` |

## Khác

- Màu thương hiệu: `src/app/brand-tokens.css` (chỉ 7 màu, xem `AGENTS.md` mục 5).
- Cỡ chữ: thang 9 cỡ trong `src/app/globals.css` (xem `AGENTS.md` mục 7).
- Dữ liệu tĩnh (sản phẩm, combo, banner, cửa hàng, địa giới): `src/data/`.
- Cờ bật/tắt tính năng: `src/config/`.
- Lược đồ CSDL: `prisma/schema.prisma`, migration trong `scripts/migrations/`.
- Script chạy tay (sao lưu, migration, đo, quét): `scripts/`. Test: `tests/`.
- Các nhánh Git theo chức năng: `docs/NHANH-GIT.md`.
- Chú thích lại các commit ghi vắn tắt (a, b, c…): `docs/LICH-SU-COMMIT.md` và các tag `chu-thich/*`.
