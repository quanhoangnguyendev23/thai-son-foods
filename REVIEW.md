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
  Cách tái hiện ngoài đời: admin sửa tay tồn kho xuống thấp hơn tổng giữ chỗ rồi hai admin bấm xác nhận hai đơn cùng sản phẩm gần như cùng lúc.
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

## Đã đọc và không thấy lỗi
- `src/lib/order-status.ts`: quy tắc chuyển trạng thái khớp mô tả.
- `src/lib/deliverySlots.ts`: khung giờ, múi giờ VN, mốc 16:30 khớp mô tả.
- `src/lib/inventorySheetParser.ts` (`parseCsv`, `parseSheetDate`, `parseSheetDateTime`): xử lý BOM, dấu nháy kép, ngày không tồn tại.
- `src/lib/content-validation.ts` (`resolveUploadedFile`): chặn thoát thư mục, kể cả dấu `\` trên Windows.
- `src/lib/rateLimit.ts`: đúng mô tả (lưu ý đã biết: lưu trong bộ nhớ từng tiến trình).
- `src/lib/inventory.ts` (`extractBottleMultiplier`, `calculateSellable`): không thấy lỗi; mã lạ do client gửi không tạo ra giá thấp hơn.

## Chưa đọc kỹ (không kết luận)
- `src/lib/reviews/repository.ts`, `src/lib/membership/repository.ts` và `service.ts`, `src/lib/partner/*`, `src/lib/address/*`
  (nhóm địa chỉ đã có bộ test riêng `npm run test:address`).
- `src/lib/inventory.ts` các hàm `expandComboItems`, `reserveStock`, `releaseStock`, `cleanupExpiredReservations`, `processOrderReturn`.
- Khoảng 100 API route ngoài `POST /api/orders`, toàn bộ trang admin và phần lớn component giao diện.
