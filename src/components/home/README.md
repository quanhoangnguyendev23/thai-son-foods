# Giao diện trang chủ (`/`)

Trang `src/app/page.tsx` chọn một trong hai bản (cờ trong `src/config/homepage.ts`):

| File | Là phần nào |
|---|---|
| `HomePage.tsx` | **Trang chủ mới** (bố cục kiểu Amazon) — ghép các khối bên dưới |
| `HomePageLegacy.tsx` | Trang chủ cũ, giữ để quay lại khi cần |
| `AmazonHeroCarousel.tsx` | Ảnh lớn chạy ngang ở đầu trang chủ mới |
| `HeroPromoTiles.tsx` | Các ô khuyến mãi cạnh / dưới ảnh lớn |
| `AmazonCategoryCards.tsx` | Các thẻ danh mục, đơn hàng gần nhất của khách |
| `AmazonDealsRow.tsx` | Hàng sản phẩm đang giảm giá |
| `AmazonProductRow.tsx` | Hàng sản phẩm cuộn ngang trong khung trắng |
| `AmazonRecentlyViewed.tsx` | Sản phẩm khách đã xem gần đây |
| `HeroSlider.tsx` | Ảnh lớn chạy ngang của trang chủ cũ |
| `CategorySidebar.tsx` | Cột danh mục bên trái (trang chủ cũ) |
| `ProductSection.tsx` | Khối "Sản phẩm Thái Sơn" (lưới / hàng cuộn) |
| `ComboShowcase.tsx` | Khối combo trên trang chủ |
| `BrandShowcase.tsx`, `BrandBadge.tsx` | Khối giới thiệu thương hiệu và huy hiệu chữ xoay |
| `StorePromotionSidebar.tsx` | Cột khuyến mãi cửa hàng |
| `SubscribeSaveSection.tsx` | Khối "Đăng ký giao định kỳ" (Subscribe & Save) |
| `WarehouseSection.tsx` | Khối giới thiệu kho / nhà máy (ảnh tự chuyển) |

Dữ liệu: banner `src/data/banners.ts`, thương hiệu `src/data/brand-showcase.ts`, khối mẫu `src/data/homepage-placeholders.ts`.
