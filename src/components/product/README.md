# Giao diện sản phẩm và combo

Dùng ở trang danh sách `/san-pham`, chi tiết `/san-pham/[slug]`, combo `/combo`, `/combo/[slug]`, thương hiệu `/thuong-hieu/[slug]` và một số khối trên trang chủ.

## Thẻ và danh sách

| File | Là phần nào |
|---|---|
| `ProductCard.tsx` | **Thẻ sản phẩm** (ảnh, tên, giá, nút thêm giỏ) dùng ở mọi nơi |
| `ProductGrid.tsx` | Lưới sản phẩm ở trang danh sách |
| `ProductCarousel.tsx` | Hàng sản phẩm cuộn ngang |
| `ComboCarousel.tsx` | Hàng combo cuộn ngang |
| `ProductCombosSidebar.tsx` | Danh sách combo (dạng hàng ngang hoặc cột bên) |
| `RecentlyViewedProducts.tsx` | Sản phẩm đã xem gần đây |
| `WishlistPanel.tsx` | Danh sách yêu thích |
| `BrandCardsSection.tsx` | Thẻ thương hiệu (ảnh lớn + logo) |

## Trang chi tiết sản phẩm (từ trên xuống)

| File | Là phần nào |
|---|---|
| `ProductComboStrip.tsx` | Dải combo phía trên đường dẫn |
| `ProductMainSection.tsx` | **Khu chính**: ảnh, thông tin, khung mua |
| `ProductGallery.tsx` | Bộ ảnh sản phẩm, kính lúp, xem phóng to |
| `ProductInfo.tsx` | Tên, giá, mô tả ngắn, quy cách |
| `PackSizeSelector.tsx` | Chọn quy cách (lốc, thùng…) |
| `ProductBuyBox.tsx` | **Khung mua**: giá, phí giao, tồn kho, số lượng, nút mua |
| `QuantitySelector.tsx` | Ô chọn số lượng |
| `MobileBuyBar.tsx` | Thanh mua cố định ở đáy màn hình điện thoại |
| `ProductDetailTabs.tsx` | Các tab thông tin chi tiết |
| `ProductDescription.tsx` | Mô tả, bảng dinh dưỡng |
| `ProductFeatureShowcase.tsx`, `ScrollBannerShowcase.tsx` | Ảnh giới thiệu tính năng sản phẩm (cuộn) |
| `FrequentlyBoughtTogether.tsx`, `ProductBundleSuggestions.tsx` | Gợi ý mua kèm |
| `ProductCompareTable.tsx` | Bảng so sánh sản phẩm |
| `ProductReviewsSection.tsx`, `ProductReviews.tsx` | **Đánh giá** của khách |
| `ProductReviewAds.tsx` | Ô gợi ý trong mục đánh giá |
| `ProductSponsoredBanner.tsx`, `ProductSponsoredMiniCard.tsx`, `ProductSidebarSponsoredCard.tsx` | Khối "Được tài trợ" (gợi ý sản phẩm khác) |
| `ProductRealBlocks.tsx` | Khối dữ liệu thật (năng lực giao hàng, đã bán…) |
| `ProductPlaceholderBlocks.tsx` | Khối mẫu cho tính năng chưa có (dữ liệu `src/data/product-detail-placeholders.ts`) |
| `ProductPageEndBlocks.tsx` | Hai khối cuối trang |

## Combo và sau khi đặt

| File | Là phần nào |
|---|---|
| `ComboDetailView.tsx` | **Trang chi tiết combo** |
| `OrderSuccessModal.tsx` | Hộp thông báo đặt hàng thành công |
