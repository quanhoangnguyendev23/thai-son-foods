# Tổng hợp rà soát logic và bộ test (11/11 đến 12/11/2026)

Nhánh `chore/cleanup`, chưa push. Chi tiết từng mục (file:dòng, cách tái hiện, đề xuất) nằm trong `REVIEW.md`. File này chỉ tóm tắt trạng thái.

## 1. Kết quả hiện tại

- **Bộ test:** `node:test` chạy bằng `npx tsx --test`, không cài thêm thư viện. 15 file `tests/*.test.mjs`.
- **Lần chạy cuối:** 212 test, 198 đạt, 11 fail, 3 todo. Độ phủ 80,09% dòng, 67,04% nhánh, 51,15% hàm (chỉ tính file được nạp).
- **11 fail đều là lỗi thật chưa sửa** (cố ý để fail, không nới lỏng test): R20, Lỗi 6, R30, R31, R32, R34, R40 (2 test), R41 (2 test), R43.
- **3 todo chờ quyết định nghiệp vụ:** R8, R25, R33.
- Test tích hợp chạy trên DB riêng `webtsf_review_test` (PostgreSQL local), không đụng `WebTSF` và `WebTSF_staging` (chỉ SELECT khi cần đọc dữ liệu thật). Chưa chạy script nào với `--apply`.

## 2. Đã sửa (mỗi mục một commit)

| Mục | Nội dung | Commit |
|---|---|---|
| R1 | Một hàm chuẩn hóa SĐT cho kiểm tra, lưu và so khớp (kèm `scripts/normalize_order_phones.mjs`, chưa chạy) | `6af2d4c` |
| R2 | Chống spam theo SĐT chạy trong giao dịch, sau khóa tư vấn theo SĐT | `a2a7dcc` |
| R3 | Địa chỉ chi nhánh luôn lấy từ DB | `6aa712c` |
| R4 | Giỏ hàng không ghi NaN vào số lượng | `6a7091f` |
| R5 | Nút Hoàn tác tìm dòng theo khóa gộp (`undoAdd`) | `d6f58bc` |
| R6 | Câu báo lỗi ngoài bán kính làm tròn lên 0,1 km | `b8de342` |
| R7 | `formatShortVND` không hiện "1000K" | `63f0e43` |
| R9 | Xóa hàm phí ship cũ, test dùng hàm thật | `4a1d29d` |
| R10 | Ghi chú nhánh `catch` dự phòng | `5da7591` |
| R11 | JSDoc đúng hàm | `24bdf75` |
| R14 | Giỏ cũ chia theo số chai của lốc nhỏ nhất | `eece46e` |
| R15 | `confirmStock` khóa dòng tồn kho, đã kiểm tra thứ tự khóa, không deadlock | `2ab8f58` |
| R16 | Giỏ nhận dạng mã quy cách `-loc5` | `222f44f` |
| R17 | Hoàn hàng nhập kho theo reservation đã confirmed | `43829a4` |
| R18 | Tự hủy đơn quá hạn thì hủy luôn hoa hồng ước tính | `32fb2b9` |
| R19 | Sự kiện hoa hồng idempotent, bỏ lần gọi trùng ở PUT admin | `2e97d7c` |
| R21 | Hủy đơn đã trừ kho ghi nhật ký tồn kho | `1ef70ca` |
| R22 | Hoa hồng đối tác theo phần trăm, `??` thay `\|\|`, sửa lỗi khóa ngoại khi dùng chính sách dự phòng | `d17969c` |
| R23 | Chiết khấu hạng đại lý 0% không bị đổi thành 15% (cả `dealer/products`) | `57c6dd2` |
| R24 | PUT combo và sản phẩm kiểm tra giá vốn; `null` và chuỗi rỗng bị từ chối | `0de4783`, `48ef30e` |
| Thẻ sản phẩm | Số lượng trên nút đếm theo khóa gộp (`findCartLine`) | `caf26ef` |

## 3. Đã rút lại hoặc hạ mức (em đã đính chính trong báo cáo)

- **R6 (phần đầu):** "20,04 km vẫn được giao" là sai; code từ chối đúng.
- **R10:** không phải mã chết, `catch` còn bao cả lệnh `import` động; chỉ thêm ghi chú.
- **R12:** gạch bỏ (`cost_price` là INTEGER, phép chia luôn chẵn).
- **R13:** hạ xuống, không có sản phẩm nào mang chữ "combo" trong id/slug/sku ở hai DB local và dữ liệu tĩnh.
- **R15:** hạ xuống Nhẹ; admin không sửa tay tồn kho xuống dưới giữ chỗ được.

## 4. Chưa sửa, đang chờ anh

**Cao khi bật tính năng** (chương trình đối tác, hội viên, giao định kỳ đang tắt mặc định):
- **R40** gửi OTP không giới hạn tần suất, xác minh OTP hội viên đăng nhập thẳng vào tài khoản theo SĐT.
- **R41** `POST /api/membership/subscribe`: điểm thưởng và dùng thử không giới hạn, gói trả phí không qua thanh toán.
- **R43** hai định nghĩa trái nhau cho bảng `loyalty_point_ledger`.
- **Lỗi 6** (đã có trong báo cáo 10/11, bản sửa ở nhánh `fix/lo-hong-bao-mat`): rút tiền vượt thời gian đối soát. **R30:** số dư khả dụng hiển thị không trừ khoản đã rút.
- **R32** cron sinh đơn định kỳ không `ROLLBACK`, trả kết nối hỏng về pool. **R34** đơn định kỳ tạo từ giao diện (mã `sub-*`) không xác nhận được. **R31** cron tính giá một chai cho cả lốc khi mã trùng catalog.

**Trung bình:** R20 (thành phần combo không nhận dạng được bị bỏ qua), R28 (xác nhận đơn thiếu hàng trả 500 và câu chung chung ở production), R29 (`initDatabase` không dựng đủ bảng/cột: `inventory_logs`, `products.volume`), R35 (đối tác yêu cầu nâng cấp đại lý bị mất quyền rút tiền).

**Nhẹ:** R8, R25 đến R27, R33, R36 đến R39, R42, R44.

## 5. Quyết định cần anh trả lời

1. **R8:** combo đã tạm dừng còn trong giỏ có hiện tiết kiệm không (a: không, sửa code; b: có, sửa comment).
2. **R20:** thành phần combo không nhận dạng được thì từ chối cả đơn hay bỏ qua thành phần thiếu.
3. **R25:** nhân viên cửa hàng được ép xuất kho thiếu hàng (`allowOversell`) không. Hiện không giao diện nào gửi cờ này.
4. **R26, R27, R33:** R26 chuyển chi nhánh không lấy khóa như đặt đơn; R27 tồn ảo 100 chai ở nhánh đơn cũ; R33 cron giữ chỗ một phần khi thiếu hàng.
5. **Mức đơn tối thiểu cho hoa hồng** (`min_order_value` 50.000đ trong chính sách): hiện chưa áp.
6. **Đơn trùng khi bấm đúp hoặc mất mạng:** khóa idempotency cần thêm cột `idempotency_key` (UNIQUE) trong `orders`; hoặc chỉ thêm chốt chặn ở trình duyệt và mã lỗi 429 riêng.
7. **R6:** em chọn làm tròn lên 0,1 km; đổi sang 2 chữ số thập phân nếu anh muốn.
8. **Test `canonicalProductId`:** `tests/inventory_pure.test.mjs` import hàm này, hiện chỉ có trong thay đổi chưa commit của thread khác; bỏ khỏi file hay chờ thread kia commit.
9. **Mục nào sửa tiếp.** Đề xuất theo thứ tự: R40, R41, R32, Lỗi 6 cùng R30, R34, R28.

## 6. Cách chạy

Tạo DB test một lần: `psql -U postgres -c "CREATE DATABASE webtsf_review_test"` (schema tự dựng). Không dùng glob `tests/*.test.mjs` vì `store_recommender.test.mjs` TEST 3 đến 5 gọi server cổng 3000.

```bash
npx tsx --test --test-reporter=spec tests/shipping_fee.test.mjs tests/cart_store.test.mjs tests/cart_rehydrate.test.mjs tests/order_status_delivery.test.mjs tests/savings_utils.test.mjs tests/inventory_pure.test.mjs tests/validation_ratelimit.test.mjs tests/partner_config.test.mjs tests/orders_api_integration.test.mjs tests/inventory_confirm_concurrency.test.mjs tests/orders_lifecycle_integration.test.mjs tests/api_sessions_integration.test.mjs tests/money_routes_integration.test.mjs tests/membership_integration.test.mjs
```

Các file test chạm DB dùng khóa tư vấn của PostgreSQL nên tự xếp hàng khi chạy song song. Đầu ra của lần chạy cuối: `tests/last_unit_run_output.txt`.

## 7. Cần biết

- Máy còn khoảng 59 thay đổi chưa commit của thread khác (combo, trang sản phẩm). Mọi commit của em chỉ chứa dòng của em.
- Phần chưa đọc kỹ: `partner/profile`, `partner/orders`, `subscriptions/[id]/*`, `cron/.../reminders`, `admin/members`, `auth/register`, `auth/me`, `auth/callback/*`, `mock-oauth`, `user/*`, trang quản trị và phần lớn giao diện.
- Các tệp ở thư mục dự án: `REVIEW.md` (chi tiết), `tests/helpers/review_test_db.mjs` và `tests/helpers/review_test_session.mjs` (bộ dựng DB và phiên đăng nhập giả).
