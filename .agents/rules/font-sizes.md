# QUY TẮC THANG CỠ CHỮ THÁI SƠN FOODS (BẮT BUỘC)

Toàn bộ website (trang khách hàng và trang quản trị) chỉ dùng một thang cỡ chữ cố định.
**Không được tự đặt cỡ chữ mới**, kể cả khi chỉ "tinh chỉnh cho vừa". Muốn thêm hay đổi cỡ phải được chủ dự án duyệt.

## Thang cỡ chữ

| Lớp Tailwind | Cỡ | Dòng | Dùng cho |
| --- | --- | --- | --- |
| `text-2xs` | 11px | 1.45 | Chỉ nhãn/huy hiệu rất nhỏ (-12%, Mới, Hot), số trên icon giỏ hàng |
| `text-xs` | 12px | 16px | Chú thích, ngày giờ, ghi chú dưới ô nhập, giá/chai |
| `text-sm` | 14px | 20px | Chữ phụ, nút nhỏ, bảng và biểu mẫu trang quản trị |
| `text-base` | 16px | 24px | Chữ thường, ô nhập, nút chính |
| `text-lg` | 18px | 28px | Tên sản phẩm trên thẻ, giá trong danh sách |
| `text-xl` | 20px | 28px | Tiêu đề nhỏ, giá trong khung mua |
| `text-2xl` | 24px | 32px | Tiêu đề mục, giá lớn trang chi tiết |
| `text-3xl` | 30px | 36px | Tiêu đề trang |
| `text-4xl` | 36px | 40px | Tiêu đề lớn (hero, banner) — cỡ lớn nhất |
| `text-emph` | 1.125em | (kế thừa) | Nhấn mạnh một cụm trong câu (web không dùng chữ đậm) |

- Điện thoại và máy tính dùng chung thang. Muốn tiêu đề to hơn ở màn hình rộng thì thêm tiền tố: `text-2xl md:text-3xl xl:text-4xl`.
- `text-2xs`, `text-emph` khai báo trong `src/app/globals.css` (`@theme inline`); các cỡ còn lại là mặc định của Tailwind. Không đổi giá trị các token này.

## Không được

- Cỡ tuỳ ý: `text-[13px]`, `text-[0.8rem]`, `text-[1.2em]`, `text-[clamp(...)]`, `text-[length:...]`.
- Cỡ ngoài thang: `text-5xl` … `text-9xl`.
- `style={{ fontSize: ... }}`, `fontSize={13}`, `font-size: ...` trong CSS với giá trị ngoài thang (11, 12, 14, 16, 18, 20, 24, 30, 36 px).
- Chữ nhỏ hơn 11px ở bất kỳ đâu.

## Ô nhập trên điện thoại

Dưới 640px, `input`, `select`, `textarea` luôn có cỡ 16px (quy tắc cuối khối `@theme` trong `src/app/globals.css`), để iPhone không tự phóng to trang khi chạm vào ô. Không gỡ quy tắc này, không ghi đè bằng `!important`.

## Ngoại lệ

- `src/app/2010/` (trang quà tặng riêng), `src/app/api/auth/mock-oauth/` (trang giả lập đăng nhập khi phát triển), `src/lib/email/` (email gửi khách, không dùng được class).
- Thuộc tính `fontSize="..."` trên chữ bên trong SVG (logo, huy hiệu vẽ bằng SVG) tính theo đơn vị `viewBox`, không phải px, nên không bị kiểm.

## Trước khi bàn giao thay đổi giao diện

Chạy `npm run lint:font-sizes`: phải báo **"Cỡ chữ NGOÀI thang: 0"**. Mỗi chỗ sai được in kèm cỡ gần nhất trong thang; thay bằng đúng lớp đó.
