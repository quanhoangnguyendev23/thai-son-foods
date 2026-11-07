# Thành phần giao diện (components)

Mỗi thư mục là một nhóm phần của web. Thư mục lớn có `README.md` riêng.

| Thư mục | Là phần nào |
|---|---|
| `home/` | **Trang chủ** (xem `home/README.md`) |
| `layout/` | **Đầu trang, chân trang** dùng cho mọi trang (xem `layout/README.md`) |
| `product/` | **Sản phẩm và combo**: thẻ sản phẩm, trang chi tiết, đánh giá (xem `product/README.md`) |
| `cart/` | **Giỏ hàng**: `CartDrawer.tsx` ngăn kéo giỏ bên phải, `CartStickySidebar.tsx` cột tóm tắt giỏ, `FloatingCartWidget.tsx` nút giỏ nổi + hiệu ứng "bay vào giỏ" |
| `checkout/` | **Thanh toán**: `AddressSuggestionList.tsx` khung gợi ý địa chỉ, `LocationConfirmMapModal.tsx` bản đồ ghim vị trí giao, `StoreRecommendationSheet.tsx` danh sách cửa hàng giao được |
| `auth/` | **Đăng nhập khách**: `AuthModal.tsx` hộp đăng nhập / đăng ký, `SocialAuthButtons.tsx` nút Google / Facebook |
| `store/` | `BranchSelectorModal.tsx` hộp chọn chi nhánh / khu vực |
| `ui/` | Mảnh giao diện dùng chung: `Button`, `Badge`, `SectionTitle` (tiêu đề mục), `AppDialog` (hộp thông báo thay alert), `card` / `chart` / `select` (dùng ở admin) |
| `common/` | `ReferralTracker.tsx` ghi mã giới thiệu của đối tác |
