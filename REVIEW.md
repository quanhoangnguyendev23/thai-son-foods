# REVIEW.md — Rà soát logic (11/11/2026)

Phạm vi đã đọc kỹ: `src/store/cart.ts`, `src/config/inventory.ts`, `src/lib/` (savings, utils, costSnapshot,
order-status, deliverySlots, rateLimit, password-policy, content-validation, inventorySheetParser,
một phần inventory, storeRecommender, membership/stateMachine) và `src/app/api/orders/route.ts` (POST).
Phần giao diện chỉ đọc ở những chỗ gọi tới logic trên. Các phần chưa đọc kỹ liệt kê ở cuối file.

Lỗ hổng bảo mật đã có báo cáo riêng (`bao-cao-bao-mat-2026-11-09.md`, `-11-10.md`, `SECURITY_AUDIT.md`)
nên không chép lại ở đây; chỉ ghi mục mới hoặc mục liên quan trực tiếp tới logic.

Quy ước: mục nào chỉ nghi ngờ thì ghi **cần xác minh**. Các mục còn lại đã kiểm chứng bằng cách đọc code liên quan.
Cột "Test" chỉ tên test tái hiện trong `tests/` (test đó được mong đợi là FAIL cho tới khi lỗi được sửa).

---

## Trung bình

### R1. Chống spam đơn theo SĐT bị vô hiệu khi SĐT có dấu cách/chấm/gạch hoặc đầu +84
- **File:dòng:** `src/app/api/orders/route.ts:53`, `:296`, `:325-343`, `:839`
- **Mô tả:** Hai bước kiểm tra "tối đa 3 đơn PENDING cùng SĐT" (V4) và "cách nhau tối thiểu 5 phút" (V5) tìm trong DB
  bằng `cleanPhone` (đã bỏ dấu cách, chấm, gạch). Nhưng câu INSERT lại lưu biến `phone` thô (chỉ `trim`).
  Đơn lưu là `0901 234 567` thì lần sau tìm `0901234567` không bao giờ khớp. Tương tự `+84901234567` và `0901234567`
  là cùng một số nhưng được coi là hai số khác nhau.
- **Tái hiện:** Gửi liên tiếp nhiều `POST /api/orders` với `phone: "0901 234 567"`. Không lần nào bị chặn 429.
- **Đề xuất sửa:** Lưu `cleanPhone` (và đổi `+84` về `0`) vào cột `orders.phone`, dùng cùng một giá trị cho cả tra cứu lẫn lưu.
- **Liên quan:** "Lỗi 7 — Spam đơn COD" trong báo cáo bảo mật 10/11 (cùng hậu quả, khác nguyên nhân).
- **Test:** `tests/orders_api_integration.test.mjs` (3 test R1).
- **ĐÃ SỬA** ở commit `6af2d4c`: dùng `normalizePhone` (đã có sẵn trong route) cho kiểm tra, INSERT `orders.phone` và so khớp đối tác.
- **Nơi đọc `orders.phone` và mức ảnh hưởng** (đã grep trước khi sửa):
  - `GET /api/orders` (tra cứu công khai): so khớp bằng `normalizePhone` cả hai phía, không đổi, chạy đúng với cả dữ liệu cũ lẫn mới.
  - `src/lib/reviews/repository.ts:947,950`: so `regexp_replace(o.phone,'\D','','g')` với `[0xxx, 84xxx]`. Dữ liệu mới luôn dạng `0xxx` nên vẫn khớp; không hỏng.
  - `src/app/api/admin/orders/route.ts:167` và `admin/partners/[id]/route.ts:167` (ô tìm kiếm `o.phone LIKE`): đơn mới lưu liền không dấu, nên gõ "0901 234 567" có dấu cách sẽ không tìm thấy (trước đây cũng không tìm thấy đơn lưu dạng liền). Hiển thị SĐT trong admin, Telegram, Zalo, email thôi dấu cách là khác biệt nhìn thấy được duy nhất.
  - Kiểm tra tự giới thiệu đối tác trong `POST /api/orders`: trước đây so `cleanPhone` với `partner.phone` thô; nay so qua `normalizePhone` cả hai phía (có sửa để không thụt lùi).
  - `scripts/golive_purge_test_data.mjs:53-54`: khớp danh sách SĐT cố định, nay khớp được nhiều hơn, vô hại.
  - `GET /api/user/orders`: lọc theo `user_id`, không dùng SĐT, không ảnh hưởng.
- **Dữ liệu cũ:** đơn cũ lưu SĐT thô vẫn còn nguyên cho tới khi chạy `scripts/normalize_order_phones.mjs` (mặc định chỉ xem trước, cần `--apply` mới ghi; **em chưa chạy trên DB nào của anh**, chỉ chạy xem trước trên DB test). Trong lúc chưa chạy, đơn cũ có SĐT dạng lạ vẫn không bị đếm vào giới hạn 3 đơn chờ, giống hành vi trước khi sửa.

### R2. Kiểm tra chống spam nằm ngoài giao dịch nên hai lần bấm đồng thời đều lọt
- **File:dòng:** `src/app/api/orders/route.ts:325-358` (kiểm tra), `:811-814` (BEGIN và khóa)
- **Mô tả:** V4/V5 chạy bằng `query()` trước khi `BEGIN`. Khóa `pg_advisory_xact_lock` ở dòng 814 theo mã chi nhánh,
  không theo SĐT, và được lấy sau khi đã kiểm tra xong. Hai request cùng SĐT đến cùng lúc đều thấy "chưa có đơn gần đây"
  và cùng tạo đơn.
- **Tái hiện:** Gửi song song 2 request giống hệt nhau (bấm đúp nút đặt hàng trên mạng chậm). Kết quả 2 đơn.
  Khớp với 2 lỗi "đơn trùng" trong báo cáo kiểm thử mobile 03/11.
- **Đề xuất sửa:** Đưa V4/V5 vào trong giao dịch, sau một khóa tư vấn theo SĐT; hoặc thêm khóa idempotency do client gửi.
- **Test:** `tests/orders_api_integration.test.mjs` (R2: 5 vòng × 8 request đồng thời). Trước khi sửa: vòng 1 ra 2 đơn, hoặc vòng 2 ra 8 đơn; chạy 3 lần đều FAIL.
- **ĐÃ SỬA** ở commit `a2a7dcc`: V4/V5 chạy trong giao dịch sau `pg_advisory_xact_lock` theo SĐT đã chuẩn hóa; khóa SĐT luôn lấy trước khóa chi nhánh. Sau sửa, chạy 3 lần liên tiếp đều PASS.
- **Kiểm chứng lại test R2 (11/11):** test tạo **6 đơn**: 1 đơn khởi động (SĐT riêng, dùng để nạp sẵn mô-đun và kết nối DB trước khi bắn đồng thời) cộng 5 vòng × 1 đơn.
  Mã thứ 6 chính là đơn khởi động, không phải đơn lọt. Output thật: `khởi động TSF-14649762, vòng 1 TSF-14835393, vòng 2 TSF-16317348, vòng 3 TSF-17217535, vòng 4 TSF-17902620, vòng 5 TSF-18771321`
  (mỗi mã một SĐT khác nhau). Test nay đếm **dòng trong bảng `orders` theo SĐT** sau mỗi vòng (không chỉ đếm response 200), đối chiếu mã đơn trả về với dòng đã lưu và kiểm tổng 6 dòng cho 6 SĐT.
- **Giao diện khi request thứ hai nhận 429 (đã đọc `src/app/thanh-toan/page.tsx`, chưa sửa):**
  - Nút đặt hàng `disabled={isSubmitting ...}` (dòng 2700) và `setIsSubmitting(true)` ngay trước `fetch` (dòng 1182), nên bấm đúp bình thường bị chặn ở trình duyệt. Tuy nhiên `handleSubmit` **không có chốt chặn trong hàm** (không có `if (isSubmitting) return` hay khóa bằng `useRef`), chỉ dựa vào nút bị vô hiệu.
  - Khi request thứ hai vẫn tới server và nhận 429, nhánh `!res.ok` (dòng 1304-1324) hiện popup "Lưu ý" với đúng câu của server: "Vui lòng chờ N giây trước khi đặt đơn tiếp theo." Không có mã lỗi riêng nên giao diện không phân biệt được với lỗi khác.
  - **Khách có thể thấy báo lỗi dù đơn đã tạo** theo 2 kịch bản: (a) request đầu tạo đơn nhưng phản hồi bị mất (mạng chập chờn, hết thời gian chờ): khách thấy "Không thể kết nối đến máy chủ", giỏ hàng còn nguyên, bấm lại thì nhận 429 "chờ N giây" và không được báo là đơn trước có thể đã được ghi nhận; chờ hết 5 phút rồi đặt lại sẽ ra **đơn trùng**.
    (b) hai request cùng bay: request thành công làm hiện màn hình "Đặt hàng thành công" và xóa giỏ, request 429 về sau mở thêm popup "Vui lòng chờ ..." đè lên màn hình thành công.
  - **Đề xuất (chưa sửa):** 1) khóa idempotency: trình duyệt sinh một mã cho mỗi lần thanh toán (giữ trong `useRef`/`sessionStorage` đến khi thành công), gửi kèm; máy chủ lưu mã vào đơn (cột `idempotency_key` UNIQUE) trong cùng giao dịch, sau khóa SĐT, và nếu gặp lại mã đó thì trả đúng đơn cũ (200, cùng `orderCode`) thay vì 429. Cách này xử lý cả bấm đúp lẫn gửi lại sau mất mạng.
    2) thêm `if (isSubmitting) return` hoặc khóa `useRef` đầu `handleSubmit`. 3) trả 429 kèm `code` riêng (ví dụ `ORDER_RATE_LIMITED`) để giao diện hiện câu "Có thể đơn của bạn đã được ghi nhận, vui lòng kiểm tra bằng Tra cứu đơn hàng trước khi đặt lại" thay vì chỉ "chờ N giây" (không trả mã đơn cũ trong 429 để không lộ mã đơn theo SĐT).
    Cách 1 cần thêm cột trong DB nên chờ anh duyệt.

### R3. Địa chỉ chi nhánh lưu trong đơn lấy từ trình duyệt
- **File:dòng:** `src/app/api/orders/route.ts:70`, `:379`, `:409`, `:853`
- **Mô tả:** Khi `storeCode` hợp lệ, server chỉ lấy địa chỉ chi nhánh từ DB nếu client không gửi `storeAddress`.
  Nếu client gửi thì giá trị đó được lưu thẳng vào `orders.store_address` (cột TEXT, không lọc HTML, không giới hạn độ dài)
  và đi vào email/thông báo. Email có `escapeHtml` nên không chèn được thẻ, nhưng nội dung sai vẫn hiện cho nhân viên và khách.
- **Tái hiện:** `POST /api/orders` với `storeCode` đúng và `storeAddress: "Địa chỉ giả ..."`. Đơn lưu địa chỉ giả.
- **Đề xuất sửa:** Luôn dùng `storeRes.rows[0].address`, bỏ qua `storeAddress` của client.
- **Test:** `tests/orders_api_integration.test.mjs` (test R3).
- **ĐÃ SỬA** ở commit `6aa712c`: `targetStoreAddress` luôn lấy từ bảng `stores` (null nếu không có chi nhánh); bỏ biến `storeAddress` không còn dùng.

---

## Nhẹ

### R4. `addItem` / `setQuantity` nhận `NaN` làm số lượng
- **File:dòng:** `src/store/cart.ts:193`, `:264-271`
- **Mô tả:** `Math.max(1, Math.min(maxAllowed, NaN))` trả về `NaN`. Ở `setQuantity`, `NaN <= 0` là sai nên không rơi vào nhánh xóa.
  Dòng hàng nhận `quantity: NaN`, kéo theo `getSubtotal()` và `getTotalQuantity()` thành `NaN`.
  Số thập phân (2.5) cũng được giữ nguyên.
- **Tái hiện:** `useCartStore.getState().addItem(sp, NaN)` hoặc `setQuantity(id, NaN)`.
- **Ghi chú:** Các nơi gọi hiện tại (`gio-hang/page.tsx:851`) đã tự lọc nên giao diện chưa dính; đây là lỗ hổng ở tầng store.
- **Đề xuất sửa:** Chuẩn hóa `quantity` bằng `Number.isFinite` + `Math.floor` ngay trong store.
- **Test:** `tests/cart_store.test.mjs` (2 test R4).
- **ĐÃ SỬA** ở commit `6a7091f`: `addItem` dùng 1 khi số lượng là NaN; `setQuantity` bỏ qua NaN và giữ nguyên dòng hàng; số lẻ làm tròn xuống.

### R5. Nút "Hoàn tác" trên thẻ sản phẩm không hoàn tác khi dòng đã gộp vào mã khác
- **File:dòng:** `src/components/product/ProductCard.tsx:95-99`, `src/store/cart.ts:196-212`
- **Mô tả:** `addItem` gộp theo `getCartMergeKey` và giữ `productId` của dòng có trước (ví dụ mã từ trang chi tiết `...-var_xxx`).
  `handleUndoAdd` lại tìm đúng mã của thẻ (`<id>-<defaultVariant.id>`). Không tìm thấy thì `current = 0`, gọi `removeItem(id)`
  với mã không tồn tại, nên số lượng vừa thêm vẫn nằm trong giỏ.
- **Tái hiện:** Thêm lốc 7 chai từ trang chi tiết, rồi thêm cùng sản phẩm từ thẻ ở trang chủ, bấm Hoàn tác. Số lượng không giảm.
- **Mức xác minh:** Phần store đã kiểm chứng bằng test. Phần giao diện suy ra từ code, **cần xác minh** trên trình duyệt với dữ liệu thật.
- **Đề xuất sửa:** Hoàn tác theo `getCartMergeKey` thay vì theo `productId`.
- **Test:** `tests/cart_store.test.mjs` (test R5 và test `undoAdd`).
- **ĐÃ SỬA** ở commit `d6f58bc`: thêm action `undoAdd` vào store (tìm dòng theo khóa gộp) và `ProductCard` gọi nó.
  **Lưu ý trung thực về test R5:** bản đầu của test chép lại các dòng `find`/`setQuantity`/`removeItem` của component, nên sửa component
  không bao giờ làm test đổi kết quả. Em đổi các bước của test sang gọi `undoAdd` của store; assert (`getTotalQuantity() === 1`) giữ nguyên.
- **Liên quan, chưa sửa (ngoài phạm vi R5):** `ProductCard.tsx:73-75` đếm số lượng trên nút bằng `items.find(i => i.productId === ...)`
  nên cũng hiện 0 khi dòng nằm dưới mã khác. Cùng nguyên nhân gốc, nên sửa chung nếu anh đồng ý. Không có chỗ tương tự ở trang combo
  (chỉ `ProductCard` có nút Hoàn tác).

### R6. (ĐÃ RÚT LẠI phần đầu) Câu báo lỗi ngoài bán kính hiện "20.0 km vượt quá 20 km"
- **File:dòng:** `src/config/inventory.ts:86-93`
- **Rút lại:** bản đầu của mục này ghi "20,04 km vẫn được nhận giao". Chạy thật ngày 11/11 cho kết quả ngược lại:
  `calculateShippingFee(100000, 20.04)` trả `isBeyondRadius: true`, `surcharge: 0`, vì giới hạn so với số km thô (`20.04 > 20`).
  Em đã suy luận sai khi chưa chạy thử. Hành vi này đúng quy định, không phải lỗi.
- **Còn lại (Nhẹ):** câu `reason` dùng `toFixed(1)` nên 20,04 km hiện là `"Khoảng cách (20.0 km) vượt quá bán kính giao tối đa (20 km)"`,
  tự mâu thuẫn. Khách thấy 20.0 km mà bị từ chối.
- **Đề xuất sửa:** hiện 2 chữ số thập phân hoặc làm tròn lên cùng cách với phụ thu.
- **Test:** `tests/shipping_fee.test.mjs` (test R6 dòng báo lỗi: FAIL; test "20,04 km ngoài bán kính": PASS, ghi nhận hành vi đúng).

### R7. `formatShortVND` hiện "1000K" thay vì "1Tr"
- **File:dòng:** `src/lib/savings.ts:72-76`
- **Mô tả:** Với 999.500 đến 999.999, nhánh nghìn làm tròn thành `1000K`. Số âm thì trả nguyên dạng `-5000`.
- **Tái hiện:** `formatShortVND(999500)` trả `"1000K"`.
- **Đề xuất sửa:** Làm tròn trước rồi mới chọn đơn vị.
- **Test:** `tests/savings_utils.test.mjs` (test R7).
- **ĐÃ SỬA** ở commit `63f0e43`: làm tròn nghìn trước khi chọn đơn vị; từ 1000K trở lên dùng "Tr".

### R8. Túi tiết kiệm vẫn tính cho combo đã tạm dừng trong DB
- **File:dòng:** `src/lib/savings.ts:26-28`, `:53-58`, `:60-65`
- **Mô tả:** Comment dòng 26 nói mảng rỗng nghĩa là mọi combo tạm dừng và không gợi ý combo cũ. Nhưng `findCombo` khi không thấy trong
  danh sách từ DB lại tìm tiếp trong `staticCombos`, nên `getCartSavings` vẫn cộng tiết kiệm theo giá gốc tĩnh.
- **Tái hiện:** `getCartSavings([dòng combo tĩnh], [])` trả số dương.
- **Cần anh quyết định:** combo đã tạm dừng còn nằm trong giỏ thì có hiện tiết kiệm không.
- **Đã chạy thật (11/11):** `getCartSavings([dòng combo-van-phong], [])` trả `20000` (hành vi hiện tại: vẫn tính).
  Test R8 trong `tests/savings_utils.test.mjs` assert `0` (hành vi mà comment ở dòng 26 mô tả), nên đang để `todo` và sẽ FAIL nếu bỏ `todo`.
  Bản trước của mục này ghi "test ghi lại hành vi đang có", câu đó sai: test assert hành vi MONG MUỐN theo comment, không phải hành vi hiện tại.

### R9. Hàm tính phí ship cũ còn nằm trong `storeRecommender.ts`
- **File:dòng:** `src/lib/storeRecommender.ts:143-161`; `tests/store_recommender.test.mjs:11-17`
- **Mô tả:** `calculateShippingFee(roadKm, orderSubtotal)` vẫn theo chính sách cũ (15k/25k, +4k mỗi km, miễn phí từ 300k trong 5 km),
  trái với chính sách chốt 04/11 ở `src/config/inventory.ts`. Hàm này không còn nơi nào trong `src` gọi (đã grep),
  nhưng vẫn được export cùng tên với hàm đúng. File test cũ chép lại hàm này vào trong test thay vì import, nên đang test bản sao.
- **Đề xuất sửa:** Xóa hàm cũ hoặc đổi tên rõ là đã bỏ; sửa test cũ để import hàm thật.
- **ĐÃ SỬA** ở commit `4a1d29d`: xóa hàm cũ (đã grep: không còn nơi nào import). `tests/store_recommender.test.mjs` nay import `calculateShippingFee`
  (`@/config/inventory`) và `getPeakHourMultiplier` (`@/lib/storeRecommender`); biểu phí trong TEST 1 viết lại theo chính sách chốt 04/11
  (giá trị cũ 15k/25k thuộc chính sách đã bỏ nên không thể giữ). Chạy bằng `npx tsx`. TEST 1 và 2 PASS (đã chạy, xem báo cáo).
- **Phát hiện thêm, chưa xử lý:** TEST 3, 4, 5 của file này gọi server đang chạy và đòi chi nhánh Cần Thơ (`CTH`) và Biên Hòa (`AMA`),
  trái với `SERVICE_AREA.HCM_ONLY = true`, nên nhiều khả năng đã lỗi thời. Em không chạy chúng vì phải gọi server cổng 3000 (anh dặn không đụng).
  Em chỉ thêm `BASE_URL` qua biến môi trường để chạy được với server khác.

### R10. Nhánh `catch` tính khoảng cách dự phòng gần như không bao giờ chạy
- **File:dòng:** `src/app/api/orders/route.ts:609-622`; `src/lib/storeRecommender.ts:185-213`
- **Mô tả:** `getRoadDistanceAndDuration` tự bắt mọi lỗi OSRM và tự rơi về công thức ×1,35, không ném lỗi ra ngoài.
  Khối `catch` ở route gần như không bao giờ chạy tới.
- **Đề xuất sửa:** Bỏ khối `catch` hoặc giữ nhưng ghi chú rõ.
- **ĐÃ XỬ LÝ (giữ lại + ghi chú)** ở commit `5da7591`. Bản đầu của mục này gọi là "mã chết", chưa chính xác: `try` còn bao cả lệnh
  `await import('@/lib/storeRecommender')`, nên `catch` là lưới an toàn cho lỗi nạp mô-đun. Bỏ nó thì lỗi đó làm hỏng đơn (HTTP 500).
  Không đổi hành vi, chỉ thêm comment.

### R11. JSDoc đặt nhầm hàm
- **File:dòng:** `src/lib/utils.ts:1-5`
- **Mô tả:** Mô tả "Format a number as Vietnamese currency" nằm trên `formatKcal`, còn `formatPrice` không có mô tả.
- **ĐÃ SỬA** ở commit `24bdf75` (chỉ di chuyển comment, không đổi code).

### R12. (ĐÃ GẠCH BỎ) Giá vốn một đơn vị bị làm tròn làm lệch tổng
- **File:dòng:** `src/lib/costSnapshot.ts:63-64`
- **Kết luận: không phải lỗi.** Bản đầu nêu ví dụ "10đ chia 3 đơn vị" nhưng ví dụ đó không xảy ra thật. Bằng chứng:
  1. Cột `cost_price` là `INTEGER` (`src/lib/db.ts:467-474`), nên giá vốn mỗi chai luôn là số nguyên.
  2. `route.ts:878` truyền `bottleQuantity = số chai mỗi lốc × số lượng dòng`, và `expandComboItems` cũng gộp số lượng dòng vào số chai,
     nên tổng giá vốn của dòng luôn chia hết cho số lượng dòng.
  3. Test `computeLineUnitCosts (R12 ...)` trong `tests/savings_utils.test.mjs` (3 test, PASS): 3 lốc × 7 chai × 8.333đ ra đúng 58.331đ/lốc, nhân lại đúng tổng.
  Chỉ có thể lệch nếu sau này đổi `cost_price` sang kiểu có số lẻ.

### R13. (HẠ XUỐNG, chưa khai thác được) Nhận diện combo bằng `includes('combo')`
- **File:dòng:** `src/app/api/orders/route.ts:506`
- **Mô tả:** Mọi mã chứa chuỗi "combo" đều vào nhánh combo. Một sản phẩm lẻ có mã/slug chứa "combo" sẽ bị từ chối
  ("Combo đang tạm ngưng") hoặc bị tra nhầm bảng `combos`.
- **Đã kiểm chứng bằng đọc dữ liệu (chỉ SELECT, phiên chỉ đọc), ngày 11/11:**
  | Nguồn | Sản phẩm lẻ | Quy cách | SP có "combo" trong id/slug/sku/tên | Quy cách có "combo" trong id |
  |---|---|---|---|---|
  | DB `WebTSF_staging` | 12 | 44 | 0 | 0 |
  | DB `WebTSF` | 12 | 46 | 0 | 0 |
  | `src/data/products.ts` | 12 | | 0 | |
  Chiều ngược lại cũng ổn: mọi combo trong staging có id dạng `combo_<số>`, nên đều chứa "combo".
- **Kết luận:** hiện không có sản phẩm nào bị ảnh hưởng; chỉ là rủi ro tiềm ẩn nếu admin đặt slug/id có chữ "combo" cho sản phẩm lẻ.
  Mức Nhẹ. Cách chặn rẻ nhất là kiểm tra khi lưu sản phẩm ở admin, không cần đổi route.

### R14. (XÁC NHẬN, đã sửa mô tả) `sanitizeCartItems` chia số chai lẻ cho số cố định 7 hoặc 5
- **File:dòng:** `src/store/cart.ts:127-130`
- **Mô tả đã sửa:** Bản đầu nêu giả thuyết "15 chai chứa ký tự 5". Giả thuyết đó không xảy ra với dữ liệu thật: lốc nhỏ nhất của mọi sản phẩm là **7 hoặc 6 chai**
  (đã đọc `WebTSF_staging` và `src/data/products.ts`: 10 sản phẩm 7 chai, 2 sản phẩm 6 chai). Lỗi thật là số chia bị đoán cứng:
  `packDivisor = variantName.includes('5') ? 5 : 7`, không lấy số chai của lốc nhỏ nhất. Sản phẩm lốc 6 chai (Sữa hạt sen Lotus, Sữa gạo lứt Ohsawa
  và 2 sản phẩm lốc 6 chai trong DB) bị chia cho 7.
- **Tái hiện (đã chạy):** giỏ cũ lưu trong localStorage có 24 chai lẻ `sua-hat-sen-lotus` → sau khi nạp lại còn **3 lốc = 18 chai** (đúng phải 4 lốc = 24 chai).
- **Mức độ: Nhẹ.** Chỉ xảy ra với giỏ lưu từ bản cũ còn dòng "1 chai"; giá cuối vẫn do máy chủ tính lại lúc đặt đơn, nhưng số lượng khách thấy trong giỏ bị đổi âm thầm.
- **Đề xuất sửa:** chia cho `quantity` của quy cách nhỏ nhất mà `sanitizeCartProduct` đã chọn.
- **Test:** `tests/cart_rehydrate.test.mjs` (test R14: FAIL, `quantity = 3 lốc = 18 chai, mong đợi 24 chai`; 2 test nền PASS). **Chưa sửa, chờ anh quyết định.**

### R15. `confirmStock` đọc tồn kho không khóa dòng
- **File:dòng:** `src/lib/inventory.ts:1207-1233`; `src/app/api/admin/orders/route.ts:537`
- **Mô tả:** Tồn kho được `SELECT` không có `FOR UPDATE` rồi mới `UPDATE ... GREATEST(0, stock - qty)`. Hai admin xác nhận hai đơn
  cùng sản phẩm cùng lúc khi tồn thật thấp hơn tổng giữ chỗ (ví dụ sau khi sửa tay tồn kho) có thể cùng qua bước kiểm tra,
  rồi bị kẹp về 0 mà nhật ký ghi là `order_confirmed` chứ không phải `oversell_clamped`.
- **XÁC NHẬN bằng test đồng thời trên DB test riêng (mức Trung bình):** `tests/inventory_confirm_concurrency.test.mjs`.
  Dựng tồn thực tế 10 chai, giữ chỗ 14 chai (2 đơn × 7). Giữ khóa dòng tồn kho để cả hai lần xác nhận cùng đã đọc tồn (10) trước khi cập nhật, rồi thả khóa.
  - Tuần tự (đối chứng): đơn thứ hai bị `InsufficientStockConfirmError`, tồn dừng ở 3. PASS.
  - Đồng thời: **cả hai thành công**, nhật ký ghi `order_confirmed, order_confirmed`, tồn bị kẹp về 0, không có `oversell_clamped` và không có cảnh báo nào.
    FAIL: `cả 2 đơn xác nhận thành công ..., tồn thực tế còn 0 (lẽ ra không thể xuất 14 chai từ 10 chai) mà không có cảnh báo`.
  **Đính chính (Bước 6):** bản đầu của mục này nói "admin sửa tay tồn kho xuống thấp hơn giữ chỗ", nhưng `PUT /api/admin/inventory` đã chặn đúng việc đó
  (`route.ts:291`: không cho giảm tồn xuống dưới số đang giữ chỗ). Nên lỗi đua này chỉ lộ ra khi dữ liệu đã vi phạm điều kiện "tồn >= giữ chỗ" bằng đường khác
  (sửa SQL tay, đồng bộ Google Sheet khi `INVENTORY_SOURCE=sheet`, dữ liệu cũ). **Hạ xuống mức Nhẹ**; test vẫn đúng ở mức hàm.
- **Đề xuất sửa:** thêm `FOR UPDATE` vào câu `SELECT stock_quantity, reserved FROM store_inventory` ở `inventory.ts:1207`. Các lần xác nhận cùng chi nhánh sẽ xếp hàng
  và đơn thứ hai thấy tồn đã giảm. **Chưa sửa, chờ anh quyết định.**

### R16. Giỏ hàng không nhận dạng mã quy cách dạng "-loc5" như comment mô tả
- **File:dòng:** `src/store/cart.ts:27-28`; so với `src/lib/inventory.ts:339-340`
- **Mô tả:** Comment ghi mẫu nhận dạng gồm `"-7chai", "-10chai", "-loc5"`, nhưng biểu thức `/[-_](\d+)(?:chai|loc|thung)/`
  bắt buộc chữ số đứng TRƯỚC `loc`. Mã `x-loc5` trả hệ số 1 thay vì 5, nên giới hạn số lượng ở giỏ tính theo 1.000 dòng
  thay vì 200 lốc. Phía server (`extractBottleMultiplier`) có thêm mẫu `(?:loc|thung|pack|lon)(\d+)` nên ra đúng 5:
  client và server lệch nhau. Server vẫn chặn 1.000 chai nên không bán vượt, chỉ sai ở giao diện.
- **Tái hiện:** `getItemBottleMultiplier({ variantId: 'x-loc5' })` trả `1`.
- **Phát hiện khi chạy test** (giai đoạn 4), đã đọc lại code để xác nhận.
- **Đề xuất sửa:** Thêm mẫu `[-_](?:loc|thung)(\d+)` ở client, hoặc dùng chung một hàm với server.
- **Test:** `tests/cart_store.test.mjs` (test R16).
- **ĐÃ SỬA** ở commit `222f44f`: thêm mẫu chữ rồi số (`loc|thung|pack|lon` + số), cùng mẫu với `extractBottleMultiplier`.

---

# Vòng 2 (ngày 11/11/2026): kho, hoàn hàng, hoa hồng đối tác, route admin

Đã đọc kỹ: `reserveStock`, `confirmStock`, `releaseStock`, `cleanupExpiredReservations`, `expandComboItems`, `processOrderReturn`, `reconcileCodPayment`
(`src/lib/inventory.ts`); `src/lib/partner/orderEvent.ts`; `src/app/api/admin/orders/route.ts` (PUT, DELETE đọc phần đầu), `admin/orders/reconcile`,
`admin/orders/transfer`, `admin/inventory` (PUT), `admin/combos` (PUT), `dealer/orders`, `src/lib/rbac.ts`.
Test tích hợp trên DB riêng: `tests/orders_lifecycle_integration.test.mjs` (14 test), `tests/orders_api_integration.test.mjs` (13 test).
**Chưa sửa mục nào ở vòng này, chờ anh quyết định.**

## Nghiêm trọng

### R22. Hoa hồng đối tác tính sai đơn vị: chính sách 10,00 (%) bị nhân như hệ số 10 lần
- **File:dòng:** `src/app/api/orders/route.ts:735-745`; dữ liệu mẫu `scripts/migrate_partner_module.mjs:222`
- **Mô tả:** Bảng `partner_commission_policies` lưu `rate = 10.00` với `rate_type = 'PERCENTAGE'` (nghĩa là 10%). Route đọc `Number(policy.rate) || 0.10`
  và tính `Math.round(subtotal * commissionRate)` mà không chia 100. Giá trị dự phòng trong code lại là `0.10` (dạng phân số), nên hai nơi dùng hai đơn vị khác nhau.
  Với chính sách có trong DB, hoa hồng ước tính **gấp 10 lần giá trị đơn** (1.000%), đúng ra là 10%.
- **Tái hiện (đã chạy):** `tests/orders_api_integration.test.mjs`, test R22. Đơn 126.000đ có mã giới thiệu, chính sách đúng như dữ liệu mẫu:
  `đơn 126000đ, hoa hồng ước tính 1260000đ`.
- **Mức ảnh hưởng thật:** DB `WebTSF_staging` đang có chính sách `pol_default_ctv | PERCENTAGE | 10.00 | is_active = true`, nên đơn có mã giới thiệu trên staging sẽ sai.
  Staging hiện có 0 dòng `order_attributions` (chưa có đơn nào bị ảnh hưởng).
  **Truy nguồn 3 dòng `partner_ledger` loại COMMISSION tổng 564.000đ (chỉ SELECT, ngày 11/11):** không liên quan R22 và không phải dữ liệu thật. Đó là dữ liệu demo tạo tay ngày 08/10/2026
  cho tài khoản `ptn_demo_ctv_01`: `led_demo_seed_01` 500.000đ `AVAILABLE` (ghi chú "Số dư hoa hồng khả dụng để test rút tiền demo"), `led_test_1791434966219` 32.000đ `ESTIMATED` (mã tham chiếu `TSF-DEMO-1723`)
  và `led_test_1791435008959` 32.000đ `CONFIRMED` (`TSF-DEMO-2970`). Cả ba có `order_id` rỗng, không có `order_attributions`, số tiền ghi cứng (32.000đ), không tính theo công thức nào.
  Staging còn 5 dòng `PAYOUT_HOLD` (tạm giữ rút tiền demo) và 12 hồ sơ đối tác mẫu.
  DB `WebTSF` chưa có bảng đối tác. Hoa hồng ước tính chỉ thành tiền thật khi đơn hoàn tất và thu tiền (`COD_RECONCILED`), nhưng số "thu nhập ước tính" đã hiện sai cho đối tác,
  và `current_balance` cộng đúng con số sai đó khi xác nhận.
- **Phụ:** `|| 0.10` coi chính sách có rate bằng 0 là 10%. Chính sách còn có `min_order_value = 50000` (50.000đ) nhưng câu `SELECT` không đọc cột này nên đơn nhỏ hơn 50.000đ vẫn có hoa hồng (**cần anh xác nhận** nghiệp vụ có áp mức tối thiểu không).
- **Đề xuất sửa:** chia 100 khi `rate_type = 'PERCENTAGE'` và dùng `??` thay `||`; chọn một đơn vị duy nhất cho cột `rate`.
- **Test:** `tests/orders_api_integration.test.mjs` (R22, 5 test).
- **ĐÃ SỬA** ở commit `d17969c`: chốt đơn vị cột `rate` là **phần trăm** khi `rate_type = 'PERCENTAGE'` (ghi trong comment ở route), chia 100 khi tính, `snapshot_commission_rate` cũng lưu theo phần trăm,
  `??` thay `||` (chính sách 0% là hợp lệ), `rate_type` khác `PERCENTAGE` hoặc `rate` không hợp lệ thì hoa hồng 0 và ghi cảnh báo. `min_order_value` **chưa áp** vì ô quyết định để trống.
- **Lỗi cùng khối, tìm ra khi viết test "không có chính sách trong DB" (R22b):** khi bảng chính sách trống, chính sách dự phòng trong code (`pol_default_ctv`) vẫn bị ghi vào `order_attributions.policy_id`
  (có khóa ngoại), nên đơn có mã giới thiệu bị lỗi 500 và không tạo được. Đã sửa cùng commit: `policy_id` là null khi dùng chính sách dự phòng.

## Trung bình

### R17. Hoàn hàng nhập kho theo cấu hình HIỆN TẠI thay vì số chai đã trừ lúc xác nhận
- **File:dòng:** `src/lib/inventory.ts:1751-1756` (`processOrderReturn`); cùng kiểu ở nhánh đơn cũ `1274-1278` và `1422-1426`
- **Mô tả:** `releaseStock` hoàn kho theo `stock_reservations` đã `confirmed` (đúng số chai đã trừ). Còn `processOrderReturn` bóc lại `order_items` bằng `expandComboItems`,
  tức tính theo `product_variants.bottle_multiplier` và `combo_items` **hiện tại**. Admin sửa số chai của quy cách (hoặc thành phần combo) sau khi đơn đã trừ kho thì hoàn hàng nhập sai số chai.
  Quy cách bị xóa thì hoàn hàng không xử lý được (`INVENTORY_RESOLVE_FAILED`). `admin/products` còn đặt `order_items.product_id = NULL` khi xóa sản phẩm (`route.ts:658`), nên đơn cũ của sản phẩm đó cũng không hoàn được.
- **Tái hiện (đã chạy):** đơn trừ 7 chai (tồn 10 thành 3), sau đó quy cách đổi thành 10 chai, hoàn hàng "nhập lại": tồn **13** (đúng phải 10). Quy cách bị xóa: lỗi `INVENTORY_RESOLVE_FAILED`.
  Đối chứng (không đổi cấu hình): 3 thành 10, PASS. Hàng hỏng: không cộng tồn, PASS.
- **Đề xuất sửa:** dùng các dòng `stock_reservations` `confirmed` của đơn (đúng số chai, đúng chi nhánh) giống `releaseStock`; chỉ bóc lại `order_items` cho đơn cũ không có reservation.
- **Test:** `tests/orders_lifecycle_integration.test.mjs` (2 test R17, FAIL).

### R18. Đơn của đối tác bị tự hủy vì quá hạn giữ chỗ nhưng hoa hồng ước tính vẫn là ESTIMATED
- **File:dòng:** `src/lib/inventory.ts:1631-1645` (`cleanupExpiredReservations`)
- **Mô tả:** Hủy tay (`releaseStock`) gọi `processPartnerOrderEvent('ORDER_CANCELLED')` nên hoa hồng chuyển `VOID`. Tự hủy vì quá hạn 24 giờ chỉ đổi `orders.status`, không gọi sự kiện.
  Dòng `partner_ledger` và `order_attributions` ở lại `ESTIMATED` mãi (đơn đã hủy không bao giờ hoàn tất để xác nhận). `partner/stats/route.ts:78` và `partner/ledger/route.ts:71` cộng mọi dòng `ESTIMATED`
  vào "thu nhập ước tính" của đối tác, nên số này phình lên bởi đơn đã hủy.
- **Tái hiện (đã chạy):** `đơn đã hủy nhưng sổ cái hoa hồng đang là ESTIMATED`. Đối chứng: hủy tay cùng đơn thì ra `VOID`, PASS.
- **Đề xuất sửa:** gọi `processPartnerOrderEvent(orderId, 'ORDER_CANCELLED', { client })` cho mỗi đơn vừa tự hủy, trong cùng giao dịch.
- **Test:** `tests/orders_lifecycle_integration.test.mjs` (R18, FAIL).

## Nhẹ

### R19. `processPartnerOrderEvent` không idempotent dù comment ghi "Hoàn toàn... idempotent"
- **File:dòng:** `src/lib/partner/orderEvent.ts:136-169`
- **Mô tả:** Với hoa hồng `CONFIRMED`/`AVAILABLE`/`PAID`, mỗi lần nhận `ORDER_CANCELLED` hoặc `ORDER_RETURNED` đều chèn thêm một `CLAWBACK` và trừ ví thêm một lần, vì câu tìm dòng gốc
  chỉ nhìn dòng `COMMISSION` (trạng thái dòng này không đổi sau khi thu hồi) và không xem `order_attributions.status = 'VOID'`.
- **Tái hiện (đã chạy):** gọi hai lần liên tiếp: `số bút toán thu hồi = 2`, ví từ 12.600 thành -12.600. Lần đầu: 1 bút toán, ví về 0 (PASS).
- **Mức độ:** hiện **chưa thấy đường gọi API** dẫn tới gọi hai lần cho đơn đã xác nhận hoa hồng (`reconcile` chặn bằng `ALREADY_CANCELLED`, `PUT` hủy chặn đơn Hoàn tất), nên chỉ là rủi ro tiềm ẩn.
  Lưu ý `PUT /api/admin/orders` khi hủy gọi sự kiện này hai lần (một lần trong `releaseStock`, một lần ở route); hiện vô hại vì lúc đó hoa hồng mới `ESTIMATED`.
- **Đề xuất sửa:** bỏ qua khi `order_attributions.status` đã là `VOID` hoặc đã có `CLAWBACK` của đơn.
- **Test:** `tests/orders_lifecycle_integration.test.mjs` (R19, FAIL).

### R20. Thành phần combo không nhận dạng được bị bỏ qua im lặng, trong khi sản phẩm lẻ bị từ chối
- **File:dòng:** `src/lib/inventory.ts:593-610` (combo trong DB) và các nhánh combo tự chọn `409-426`, `439-457`, `468-498`, `510-579`
- **Mô tả:** Sản phẩm lẻ không nhận dạng được: ném `INVENTORY_RESOLVE_FAILED` ("Đơn hàng bị từ chối để tránh lọt kho"). Combo có thành phần không nhận dạng được: `if (prod)` bỏ qua thành phần đó,
  đơn vẫn nhận, không giữ chỗ và không trừ kho phần đó, nhưng khách vẫn trả đủ giá combo.
- **Tái hiện (đã chạy):** combo 2 thành phần, 1 thành phần là sản phẩm đã xóa: `Missing expected rejection` (không lỗi). Đối chứng: combo hợp lệ ra đúng số chai, sản phẩm lẻ lạ bị từ chối, PASS.
- **Giảm nhẹ:** `admin/products` chặn xóa sản phẩm còn nằm trong combo (`route.ts:608-614`); `combo_items.product_id` không có khóa ngoại nên vẫn có thể lệch qua SQL tay hoặc dữ liệu cũ.
- **Cần anh xác nhận:** hành vi đúng là từ chối cả đơn (theo comment fail-fast của chính hàm này, em đã viết test theo đó) hay bỏ qua thành phần thiếu.
- **Test:** `tests/orders_lifecycle_integration.test.mjs` (R20, FAIL).

### R21. Hủy đơn đã trừ kho hoàn lại tồn kho nhưng không ghi nhật ký tồn kho
- **File:dòng:** `src/lib/inventory.ts:1380-1449` (`releaseStock`, nhánh `inventory_deducted`)
- **Mô tả:** Lúc xác nhận có `logInventoryChange` (`order_confirmed`), hoàn hàng có (`return_restocked`), hủy chưa trừ kho có (`order_cancelled`),
  riêng hủy sau khi đã trừ kho cộng lại `stock_quantity` mà không ghi dòng nào trong `inventory_logs`. Lịch sử kho thấy trừ 7 chai và không thấy cộng lại.
- **Tái hiện (đã chạy):** nhật ký của đơn chỉ có `order_confirmed (10 -> 3)`. Đối chứng: tồn kho hoàn lại đủ 7 chai, đơn thành CANCELLED, PASS.
- **Test:** `tests/orders_lifecycle_integration.test.mjs` (R21, FAIL).

### R23. Đại lý: chiết khấu 0% bị đọc thành 15%
- **File:dòng:** `src/app/api/dealer/orders/route.ts:51`
- **Mô tả:** `Number(tier.discount_rate) || 15.00` coi `0` là "thiếu" và dùng 15%. Hạng đại lý có chiết khấu 0% sẽ được giảm 15%.
- **Mức xác minh:** đọc code (hành vi của `||` với 0 là chắc chắn). Không có test tự động vì route cần phiên đối tác. Các hạng mẫu hiện là 15/20/25% nên chưa ai bị ảnh hưởng.
- **Liên quan đã biết:** `shippingFee` âm ở cùng route là "Lỗi 8" trong báo cáo bảo mật 10/11, không ghi lại ở đây.
- **Đề xuất sửa:** dùng `??` hoặc kiểm `Number.isFinite`.
- **ĐÃ SỬA** ở commit `57c6dd2`: thêm `resolveDealerDiscountPercent` (`src/config/partner.ts`, 0% hợp lệ), dùng ở `dealer/orders` và cả `dealer/products:47` (cùng lỗi, bản đầu bỏ sót).
  Test đơn vị: `tests/partner_config.test.mjs` (4 test). Test route cần phiên đối tác: làm ở Bước 4.

### R24. `PUT /api/admin/combos` không chuẩn hóa `cost_price` và `total_items` như `POST`
- **File:dòng:** `src/app/api/admin/combos/route.ts:398-400`, `422-425` (so với `POST` dòng `195-197` dùng `Math.max(0, parseInt(...) || 0)`)
- **Mô tả:** `PUT` đẩy thẳng `parseInt(body.cost_price, 10)`. Giá trị không phải số cho `NaN` và lỗi 500; giá vốn âm được lưu (làm báo cáo lợi nhuận sai). Chỉ tài khoản có `cost_price.edit` (SUPER_ADMIN) đi tới được.
- **Mức xác minh:** đọc code. Không có test tự động vì route cần phiên admin.
- **ĐÃ SỬA** ở commit `0de4783`: `PUT` combo kiểm `cost_price` (số nguyên 0 đến 100.000.000) và `total_items` (1 đến 1000), sai thì 400. Cùng lỗi ở `PUT /api/admin/products` (`cost_price`, dòng 444),
  bản đầu bỏ sót, đã sửa cùng commit. Test route cần phiên admin: làm ở Bước 4.

## Cần xác minh nghiệp vụ (chưa kết luận là lỗi)

- **R25. `allowOversell` / `forceConfirm`:** `PUT /api/admin/orders` (`route.ts:538`) nhận cờ này từ bất kỳ ai có quyền cập nhật đơn, kể cả `STORE_STAFF` (cho đơn chi nhánh mình), và cờ này bỏ qua kiểm tra đủ tồn kho.
  Nếu đây là nút "vẫn xuất kho" có chủ đích cho nhân viên thì không sao; nếu chỉ dành cho quản lý thì cần thêm kiểm tra quyền.
- **R26. Chuyển chi nhánh (`admin/orders/transfer`) không lấy khóa tư vấn theo chi nhánh** như `POST /api/orders` và `cleanupExpiredReservations` (đã thiết kế để tránh deadlock theo thứ tự khóa).
  Hai thao tác chuyển ngược chiều A sang B và B sang A cùng lúc có thể deadlock. Chưa tái hiện, chỉ SUPER_ADMIN gọi được.
  Phí giao cũng không tính lại khi đổi chi nhánh (phí đã tính theo khoảng cách tới chi nhánh cũ): cần anh cho biết có chủ đích không.
- **R27. `confirmStock` nhánh đơn cũ** (không có reservation, `inventory.ts:1282-1285`) tự tạo dòng `store_inventory` với `stock_quantity = 100` nếu chưa có; tồn "ảo" 100 chai có thể che việc thiếu hàng. Chỉ chạm tới với đơn tạo trước khi có cơ chế giữ chỗ.

---

## Đã đọc và không thấy lỗi
- `src/lib/order-status.ts`: quy tắc chuyển trạng thái khớp mô tả.
- `src/lib/deliverySlots.ts`: khung giờ, múi giờ VN, mốc 16:30 khớp mô tả.
- `src/lib/inventorySheetParser.ts` (`parseCsv`, `parseSheetDate`, `parseSheetDateTime`): xử lý BOM, dấu nháy kép, ngày không tồn tại.
- `src/lib/content-validation.ts` (`resolveUploadedFile`): chặn thoát thư mục, kể cả dấu `\` trên Windows.
- `src/lib/rateLimit.ts`: đúng mô tả (lưu ý đã biết: lưu trong bộ nhớ từng tiến trình).
- `src/lib/inventory.ts` (`extractBottleMultiplier`, `calculateSellable`): không thấy lỗi; mã lạ do client gửi không tạo ra giá thấp hơn.
- **Chống bán lố khi đặt đơn đồng thời** (`reserveStock` + khóa dòng): test 5 đơn song song × 7 chai cho tồn 20 chai: đúng 2 đơn thành công, giữ chỗ 14, 3 đơn 409; chạy 3 lần đều đạt.
- `confirmStock` tuần tự (từ chối khi thiếu tồn, idempotent), `releaseStock` phần tồn kho (chưa trừ: nhả giữ chỗ; đã trừ: hoàn đủ), `cleanupExpiredReservations` phần tồn kho (nhả giữ chỗ, hủy đơn PENDING): có test, đạt.
- `admin/orders` `PUT`: khóa dòng đơn, kiểm tra phạm vi cửa hàng (chống IDOR), máy trạng thái, chặn giao khi cần gọi xác nhận vị trí; không thấy lỗi ngoài R25.
- `admin/orders/reconcile`: chỉ đơn COD, chặn đơn Chờ/Đã hủy, chặn đối soát lặp, số tiền trong khoảng 1 đến tổng đơn; hoàn hàng chặn đơn Chờ và đơn đã hủy. Chỉ SUPER_ADMIN có quyền `cod.*` nên không cần lọc cửa hàng.
- `admin/inventory` `PUT`: kiểm tra đầu vào, khóa dòng, chặn giảm tồn dưới số đang giữ chỗ, ghi nhật ký.
- `admin/combos`: kiểm tra giá bán/giá gốc (`checkComboPrices`), quyền sửa giá và giá vốn (ngoại trừ R24).
- `rbac.ts`: bảng quyền khớp cách các route dùng.

## Chưa đọc kỹ (không kết luận)
- `src/lib/reviews/repository.ts`, `src/lib/membership/repository.ts` và `service.ts`, `src/lib/partner/*` (trừ `orderEvent.ts` và `referral.ts`), `src/lib/address/*`
  (nhóm địa chỉ đã có bộ test riêng `npm run test:address`).
- Route ghi dữ liệu chưa đọc: `admin/users`, `admin/members`, `admin/stores`, `admin/sync`, `admin/seed`, `admin/upload`, `admin/banners`, `admin/categories`, `admin/products` (chỉ đọc phần xóa),
  `admin/payouts`, `admin/partners`, `admin/inventory/lots` và `sheet`, `admin/orders/[id]/confirm-payment` và `confirm-location`, `partner/*`, `membership/*`, `subscriptions/*`, `cron/subscriptions/*`, `user/*`, `auth/*`.
  Một phần đã có trong các báo cáo bảo mật 09/11, 10/11 và `SECURITY_AUDIT.md`.
- Toàn bộ trang quản trị và phần lớn component giao diện.

---

# Rà mẫu `Number(...) || số` và `parseInt(...) || số` (11/11/2026)

Grep toàn `src` (`.ts`, `.tsx`): **185 chỗ**. 149 chỗ có mặc định `0` (0 chính là giá trị rỗng tự nhiên, 72 chỗ thuộc tiền/phí/tổng/giá vốn: không phải lỗi). 36 chỗ có mặc định khác 0, phân loại bên dưới.

| Nơi | Mặc định | 0 có hợp lệ không | Kết luận |
|---|---|---|---|
| `api/orders/route.ts:744` tỷ lệ hoa hồng | 0.10 | **Có** (chính sách 0%) | Lỗi, đã sửa ở R22 (`d17969c`) |
| `api/dealer/orders/route.ts:51` chiết khấu hạng | 15 | **Có** (hạng 0%) | Lỗi, đã sửa ở R23 (`57c6dd2`) |
| `api/dealer/products/route.ts:47` chiết khấu hạng | 15 | **Có** | Lỗi cùng R23, đã sửa (`57c6dd2`) |
| `app/page.tsx:37`, `:238` `sortOrder` | 1 | **Có** (thứ tự 0) | Nhẹ: thứ tự 0 bị đổi thành 1 nên hai mục có thể trùng thứ tự khi hiển thị. **Chưa sửa** (chỉ ảnh hưởng thứ tự hiển thị trang chủ, ngoài phạm vi), chờ anh quyết định |
| `api/combos/route.ts:59`, `app/page.tsx:213` `totalItems` | 10 | Không (combo 0 món vô nghĩa) | Không lỗi |
| `admin/page.tsx:7482` `total_items` | 1 | Không | Không lỗi (và `PUT` nay chặn ngoài 1 đến 1000, R24) |
| Số lượng dòng hàng `\|\| 1`: `orders:247`, `orders:878`, `dealer/orders:62`, `inventory/check:53,73`, `inventory.ts:395,741`, `costSnapshot.ts:63`, `cart.ts:136`, `subscriptions:131,153`, `cron/subscriptions/generate-orders:118`, `admin/sync:163`, `api/combos:82`, `products:144`, `app/page.tsx:163,246`, `admin/page.tsx:2026,7561` | 1 | Không (số lượng tối thiểu 1) | Không lỗi |
| `inventory.ts:408` số chai trong mã combo tự chọn | 1 | Không | Không lỗi (số âm là N2 trong báo cáo bảo mật 10/11) |
| `inventory.ts:504` cỡ combo bậc thang | 20 | Không | Không lỗi |
| `subscriptions/route.ts:201` `preferredDayOfWeek` | 2 | Không (miền 2 đến 8) | Không lỗi |
| `membership/pause:18` số tháng | 1 | Không | Không lỗi |
| `reviews/repository.ts:914` điểm sao | 5 | Không (1 đến 5) | Không lỗi: route `api/reviews` đã kiểm 1 đến 5 trước khi gọi |
| `notify/telegram.ts:133` `retry_after` | 5 | Không | Không lỗi |
| `admin/audit:47,48`, `admin/orders:371` giới hạn/trang | 50 / 1 | Không | Không lỗi |

Ngoài mẫu `||`, hai chỗ cùng họ (chuyển `parseInt` không kiểm tra) đã sửa ở R24.
