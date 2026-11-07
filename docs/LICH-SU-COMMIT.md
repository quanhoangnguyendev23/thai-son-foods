# Chú thích lại các commit ghi vắn tắt

Các commit dưới đây trên `main` có lời ghi chỉ là "a", "b", "c"… Nội dung được đọc lại từ chính thay đổi của commit. Mỗi commit cũng có một **tag** cùng tên (mục Tags trên GitHub), bấm vào để xem commit kèm chú thích.

| Ngày | Commit | Ghi cũ | Tag | Nội dung thật |
|---|---|---|---|---|
| 21/09 | `6767ede` | a | `chu-thich/01-khoi-tao-website` | **Khởi tạo website.** Trang chủ (ảnh lớn, sản phẩm, combo, thương hiệu, kho), đầu / chân trang, trang sản phẩm và chi tiết, combo, giỏ hàng, thanh toán, API đặt hàng, CSDL (Prisma + `db.ts`), giỏ hàng, dữ liệu sản phẩm / combo / banner, ảnh sản phẩm, quy tắc AGENTS / GEMINI. |
| 30/09 | `9f6657a` | b | `chu-thich/02-quan-tri-tai-khoan-kho` | **Trang quản trị, tài khoản khách, kho nhiều chi nhánh.** Đăng nhập / đăng ký admin; API admin (đơn, kho, combo, cửa hàng, thành viên, đồng bộ, chuyển kho, đối soát); đăng nhập khách (email, Google, Facebook), trang tài khoản; tồn kho theo chi nhánh, giữ chỗ, việc dọn giữ chỗ hằng đêm; chọn chi nhánh; email đơn hàng; chi tiết combo; script tạo / kiểm tra kho. |
| 02/10 | `86fc20b` | c | `chu-thich/03-chuan-bi-go-live` | **Chuẩn bị chạy thật (giai đoạn 0).** Quy cách chai (`bottle_multiplier`), API công khai sản phẩm / combo / danh mục, gợi ý và tra địa chỉ đầu tiên (`api/geo`, `vietnam-addresses`), tồn kho combo, báo cáo lợi nhuận, `vercel.json`, bộ test go-live, tài liệu `docs/golive`. |
| 04/10 | `1c97251` | d | `chu-thich/04-ban-theo-loc-thung` | **Chỉ bán theo lốc / thùng** (không bán chai lẻ, tự quy đổi quy cách) trong giỏ hàng; nâng cấp trang giỏ hàng, thanh toán, combo, chọn quy cách ở thông tin sản phẩm; `web.config` để chạy web sau IIS trên máy chủ Windows. |
| 04/10 | `f69c633` | e | `chu-thich/05-vung-bam-dien-thoai` | **Sửa cho dễ bấm trên điện thoại:** nới vùng bấm của liên kết / nút ở đầu trang, chân trang, thẻ sản phẩm, đăng nhập, giỏ hàng, thanh toán, chọn chi nhánh. |
| 08/10 | `bed051c` | 4 | `chu-thich/06-doi-tac-ctv-dai-ly` | **Phân hệ Đối tác / CTV / Đại lý.** Trang đối tác, đăng ký đối tác, đại lý; API đối tác (đăng ký có OTP, hồ sơ, giấy tờ, sổ cái, rút tiền, thống kê, nâng cấp đại lý), đơn của đại lý; admin duyệt đối tác và chi trả; lô hàng theo hạn dùng; xác nhận chuyển khoản; ghi mã giới thiệu; tài liệu kiến trúc. |
| 10/10 | `5c17672` | f | `chu-thich/07-trang-chi-tiet-san-pham` | **Làm lại trang chi tiết sản phẩm:** bộ ảnh (ảnh nhỏ cột trái + ảnh chính vuông), thông tin sản phẩm, mô tả và bảng dinh dưỡng, ảnh giới thiệu tính năng, khối đánh giá. |
| 10/10 | `5dcc6f9` | 10/10 | `chu-thich/08-danh-gia-va-duoc-tai-tro` | **Đánh giá sản phẩm** (lưu trữ, API), khối **"Được tài trợ"** (banner + thẻ cột bên), làm lại khối kho / nhà máy trên trang chủ, chỉnh đầu trang và trang combo. |
| 13/10 | `e0931c6` | fix | `chu-thich/09-gps-ban-do-goi-y-cua-hang` | **Vị trí giao bằng GPS và bản đồ ghim**, gợi ý cửa hàng gần nhất (`StoreRecommendationSheet`, `/api/stores/recommend`), viết lại gợi ý / tra địa chỉ, sửa đăng nhập / đăng ký khách, tài liệu `DEPLOY.md`, sao lưu CSDL, bộ kiểm thử QA và báo cáo UI/UX. |
| 16/10 | `07c6dbc` | lan | `chu-thich/10-mo-web-qua-lan` | **Mở web qua IP mạng nội bộ (LAN)** và cảnh báo ở trang thanh toán khi địa chỉ gõ tay lệch điểm ghim trên bản đồ hơn 1 km. |

Vì sao không sửa thẳng lời ghi của commit: sửa sẽ viết lại toàn bộ lịch sử `main` từ 21/09 và phải đẩy đè (force push). Bản đang chạy, mọi nhánh và máy khác đang dựa vào lịch sử cũ sẽ bị lệch. Dùng tag và bảng này thì lịch sử giữ nguyên mà vẫn tra được.

Từ nay, ghi commit theo mẫu `loại(phần): việc đã làm`, ví dụ `feat(thanh-toan): chọn giờ giao` hay `fix(gio-hang): sai tổng tiền`.
