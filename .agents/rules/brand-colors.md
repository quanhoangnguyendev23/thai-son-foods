# QUY TẮC BẢNG MÀU THƯƠNG HIỆU THÁI SƠN FOODS (BẮT BUỘC)

Đây là bảng màu chính thức của công ty. Mọi tác vụ trên website (khách hàng và trang quản trị) phải dùng đúng các màu này.
**Không được tự ý thêm, bớt, đổi, pha hay "tinh chỉnh" màu**, kể cả khi người dùng chỉ yêu cầu sửa giao diện chung chung.
Chỉ được đổi bảng màu khi chủ dự án yêu cầu rõ ràng bằng mã HEX mới.

## 7 màu gốc

| Token (Tailwind / CSS) | HEX | Vai trò |
| --- | --- | --- |
| `brand-forest` | `#22544C` | Màu chính: header, nút chính, tiêu đề |
| `brand-emerald` | `#236E45` | Hover/active của màu chính, trạng thái thành công, link |
| `brand-leaf` | `#7CA250` | Màu phụ: thông tin, tag/badge, biểu đồ |
| `brand-amber` | `#E09245` | Nhấn 1: cảnh báo, điểm nhấn, giá nổi bật |
| `brand-copper` | `#B56322` | Nhấn 2 (ô thứ 3 trong bảng màu gốc; ảnh gốc ghi nhầm trùng `#7CA250`) |
| `brand-chestnut` | `#82422D` | Nhấn tối: chữ nhấn mạnh, viền đậm |
| `brand-crimson` | `#EE355C` | CTA nổi bật, lỗi, nhãn Hot/Mới |

## Cách dùng

1. **Nguồn duy nhất:** `src/app/brand-tokens.css`. Chỉ nơi này được khai báo mã HEX. Các thang 50–950 (forest, emerald, leaf, amber, copper, chestnut, crimson, ink) đều sinh từ 7 màu gốc.
2. Trong component chỉ dùng class/biến token (`bg-green-primary`, `text-corn`, `bg-forest-700`, `text-ink-950`, `var(--color-brand-forest)`...).
   **Không** viết mã HEX, `rgb()`, `hsl()` hay class màu tuỳ ý dạng `bg-[#...]` trong component.
3. Các palette mặc định của Tailwind (gray, slate, emerald, amber, red, rose, blue...) đã bị **ghi đè** bằng thang thương hiệu trong `brand-tokens.css`. Không xoá phần ghi đè này và không thêm palette mới.
4. **Không dùng màu đen** (kể cả gần đen) và **không dùng màu tím** (hue 250–320). Chữ đậm nhất dùng `ink-950` (xanh rêu rất đậm). Bóng đổ/lớp phủ dùng `rgba(34, 84, 76, x)`.
   Plugin `postcss-brand-colors.cjs` tự đổi mọi màu đen/gần đen thành `#143D38`; không gỡ plugin này.
5. **Ngoại lệ duy nhất:** logo/nút của bên thứ ba phải giữ màu nhận diện của họ (Google `#4285F4 #34A853 #FBBC05 #EA4335`, Facebook `#1877F2`, Zalo `#0068FF`) và nội dung trong ảnh/banner.
6. Trắng `#FFFFFF` và nền ngà `ivory #FAF7F0` được phép dùng làm nền.

## Trước khi bàn giao bất kỳ thay đổi giao diện nào

- Chạy: `grep -rnE "#[0-9A-Fa-f]{3,8}\b|rgb\(|hsl\(" src/app src/components --include=*.tsx` và bảo đảm không có màu mới ngoài các ngoại lệ ở mục 5.
- Không thay đổi giá trị trong `src/app/brand-tokens.css` nếu chưa được chủ dự án duyệt bằng văn bản.
