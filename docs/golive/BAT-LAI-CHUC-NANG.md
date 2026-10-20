# CHỨC NĂNG ĐANG TẮT & PROMPT BẬT LẠI / TRIỂN KHAI TIẾP

Các chức năng dưới đây **chưa chốt với doanh nghiệp** nên đã được tắt khỏi website bán hàng khi go-live.
Mã nguồn vẫn còn đầy đủ; mỗi chức năng được điều khiển bằng một cờ. Khi cần, đổi cờ rồi dán prompt tương ứng
vào Claude Code để triển khai phần còn thiếu.

## Bảng tóm tắt

| # | Chức năng | Cờ điều khiển | Trạng thái mặc định |
|---|---|---|---|
| 1 | Giao hàng định kỳ (Subscribe & Save) | `ENABLE_SUBSCRIBE_SAVE` trong `src/config/membership.ts` | Tắt |
| 2 | Hội viên Thái Sơn Prime | `ENABLE_MEMBERSHIP` trong `src/config/membership.ts` | Tắt |
| 3 | Chương trình Đối tác (CTV / Đại lý / Rút tiền) | `NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM=true` | Tắt |
| 4 | Đăng nhập Google / Facebook | `NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN=true` | Tắt |
| 5 | Các khối "Bản mẫu" (deal đồng hồ, mã giảm giá, đã mua trong tháng, địa chỉ giao mẫu, yêu thích, Mua lại, Gợi ý cho bạn, Khách cũng xem) | `NEXT_PUBLIC_SHOW_PLACEHOLDERS=true` | Tắt |

Ghi chú chung:
- Biến `NEXT_PUBLIC_*` được nhúng lúc build → **đổi biến xong phải build/deploy lại**.
- Cờ ở mục 1, 2 nằm trong file mã nguồn (đổi `false` → `true`), không phải biến môi trường.
- Trước khi bật bất kỳ chức năng nào lên production: bật ở **staging** trước, chạy `npm test`, thử bằng tay.
- Mọi prompt đều yêu cầu tuân thủ `AGENTS.md` (không đổi cấu trúc thư mục, sửa vi phẫu, không tái cấu trúc).

---

## 1. GIAO HÀNG ĐỊNH KỲ (SUBSCRIBE & SAVE)

**Hiện trạng:** cờ `ENABLE_SUBSCRIBE_SAVE = false`. Khối trên trang chủ / chi tiết sản phẩm bị ẩn, trang
`/tai-khoan/dinh-ky` chuyển về trang chủ. Mã đã có: `SubscribeSaveSection.tsx`, `src/app/tai-khoan/dinh-ky/`,
`src/app/api/subscriptions/*`, `src/app/api/cron/subscriptions/{reminders,generate-orders}`, `src/lib/membership/*`,
test `tests/test_subscribe_and_save_spec.mjs`.

**Cần chốt với doanh nghiệp trước:** mức chiết khấu (đang 15%), đơn tối thiểu (120.000đ), bán kính giao (25 km),
giờ cắt đơn T-1 18:00, quy tắc nhắc lịch T-5/T-3, miễn phí giao, chu kỳ giao hỗ trợ.

**Lưu ý:** `next.config.ts` đang có redirect `/tai-khoan/dinh-ky` → `/`; phải xóa khi bật lại.

**Lưu ý kỹ thuật quan trọng:** `vercel.json` hiện chỉ có cron `cleanup-reservations`. Hai cron định kỳ là route `POST`
đọc `CRON_SECRET`, trong khi Vercel Cron gọi bằng `GET` → cần chuyển sang `GET` + `Authorization: Bearer`, hoặc dùng
bộ lập lịch khác.

**Prompt:**
```
Bật chức năng Giao hàng định kỳ (Subscribe & Save) cho website Thái Sơn Foods, tuân thủ AGENTS.md
(không đổi cấu trúc thư mục, sửa vi phẫu, không tái cấu trúc).

Bối cảnh: cờ MEMBERSHIP_CONFIG.ENABLE_SUBSCRIBE_SAVE trong src/config/membership.ts đang false. Mã đã có sẵn ở
SubscribeSaveSection.tsx, src/app/tai-khoan/dinh-ky/, src/app/api/subscriptions/*, src/lib/membership/*,
src/app/api/cron/subscriptions/{reminders,generate-orders}.

Các thông số đã chốt với doanh nghiệp (điền trước khi gửi): chiết khấu = ___%, đơn tối thiểu = ___đ,
bán kính giao = ___km, giờ cắt đơn = ___h, nhắc lịch trước ___ ngày, chu kỳ hỗ trợ = ___.

Việc cần làm:
1. Rà soát toàn bộ luồng: đăng ký → lịch giao → nhắc T-x → sinh đơn T-1 → trừ/giữ tồn kho → hủy/bỏ qua/tạm dừng.
2. Đối chiếu các thông số trong src/config/membership.ts với thông số đã chốt ở trên và cập nhật.
3. Hai cron subscriptions hiện là POST; vercel.json chỉ có cron cleanup-reservations. Thêm cron cho
   reminders và generate-orders, chuyển sang GET + Authorization: Bearer CRON_SECRET (giữ fail-closed, so sánh
   timing-safe, không nhận secret qua query string).
4. Xóa redirect '/tai-khoan/dinh-ky' → '/' trong next.config.ts, bật ENABLE_SUBSCRIBE_SAVE = true, kiểm tra các điểm hiển thị: trang chủ, chi tiết sản phẩm, header (menu tài
   khoản), /tai-khoan/dinh-ky; kiểm tra giao diện mobile không có thanh trượt ngang.
5. Chạy: npx tsc --noEmit, npx eslint src, npm test, và thử tay 1 hợp đồng đăng ký trên staging.
6. Báo cáo: danh sách file đã đổi, kết quả test, rủi ro còn lại. KHÔNG commit/push nếu tôi chưa yêu cầu.
```

---

## 2. HỘI VIÊN THÁI SƠN PRIME

**Hiện trạng:** cờ `ENABLE_MEMBERSHIP = false`. Ẩn: trang `/member` (chuyển về trang chủ), mục "Thái Sơn Prime" ở
header, khối giới thiệu hội viên và huy hiệu "prime" ở thẻ sidebar trang chi tiết sản phẩm
(`ProductSidebarSponsoredCard.tsx`). Mã đã có: `src/app/member/`, `src/app/api/membership/*`,
`docs/member/`, test `tests/phase2_membership_step2_test.mjs`, `tests/phase3_member_fullstack_e2e_test.mjs`.

**Lưu ý:** `next.config.ts` đang có redirect `/member` → `/` (tạm thời). Khi bật lại phải **xóa redirect này**.

**Prompt:**
```
Bật chức năng Hội viên Thái Sơn Prime, tuân thủ AGENTS.md (không đổi cấu trúc, sửa vi phẫu).

Bối cảnh: MEMBERSHIP_CONFIG.ENABLE_MEMBERSHIP trong src/config/membership.ts đang false. Mã đã có ở
src/app/member/, src/app/api/membership/*, docs/member/, và các điểm hiển thị: header (HeaderAmazon.tsx/Header.tsx),
ProductSidebarSponsoredCard.tsx (khối giới thiệu hội viên + huy hiệu prime).

Quyền lợi/gói hội viên đã chốt (điền trước khi gửi): ___ (tên gói, phí, quyền lợi, thời hạn).

Việc cần làm:
1. Đọc docs/member/ và tài liệu nghiệp vụ để nắm luồng đăng ký, OTP, nâng/hạ hạng, hủy, tạm dừng.
2. Cập nhật nội dung quyền lợi hiển thị cho khớp gói đã chốt (không dùng số liệu bịa).
3. Xóa redirect '/member' → '/' trong next.config.ts, bật ENABLE_MEMBERSHIP = true.
4. Kiểm tra: đăng ký/đăng nhập hội viên, trang /member, header, thẻ sidebar sản phẩm, mobile không trượt ngang.
5. Chạy: npx tsc --noEmit, npx eslint src, npm test; thử tay trên staging.
6. Báo cáo file đã đổi, kết quả, rủi ro. KHÔNG commit/push nếu tôi chưa yêu cầu.
```

---

## 3. CHƯƠNG TRÌNH ĐỐI TÁC (CTV / ĐẠI LÝ / RÚT TIỀN)

**Hiện trạng:** cờ `NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM` chưa đặt → middleware chặn:
- trang `/doi-tac`, `/dang-ky-doi-tac`, `/dai-ly` → về trang chủ;
- `/admin/partners`, `/admin/payouts` → về `/admin`; menu admin "Đối tác CTV & Đại lý", "Duyệt chi trả" hiển thị mờ;
- API `/api/partner/*`, `/api/dealer/*`, `/api/admin/partners*`, `/api/admin/payouts*` → 404;
- `ReferralTracker` (bắt mã `?ref=` và ghi cookie 30 ngày) không chạy.

Mã đã có: `src/app/doi-tac`, `dang-ky-doi-tac`, `dai-ly`, `src/app/admin/{partners,payouts}`, `src/app/api/{partner,dealer}`,
`src/lib/partner/*`, `src/config/partner.ts`, `docs/partner-module-architecture.md`, `docs/partner-module-gap-analysis.md`,
tests `tests/phase1_partner_foundation_test.mjs`, `phase2_ctv_order_ledger_test.mjs`, `phase3_payout_test.mjs`, `phase4_dealer_test.mjs`.

**Cần chốt với doanh nghiệp trước (đang là giá trị tạm trong `src/config/partner.ts`):** hoa hồng mặc định (10%),
đơn tối thiểu sinh hoa hồng (50.000đ), thời gian giữ trước khi rút được (7 ngày), rút tối thiểu (200.000đ), hạn mức/ngày,
phí rút, ngưỡng nâng CTV → Đại lý (doanh số 20 triệu/tháng, 30 đơn), có tự động duyệt hay không, chính sách thuế/khấu trừ.

**Lưu ý:** `next.config.ts` có redirect `/dai-ly` → `/` (tạm thời), cần xóa khi bật. Nút/đường dẫn tới `/doi-tac` hiện
chưa có ở header/footer nên cần quyết định vị trí đặt link công khai.

**Prompt:**
```
Bật Chương trình Đối tác (CTV/Đại lý/Rút tiền) cho Thái Sơn Foods, tuân thủ AGENTS.md (không đổi cấu trúc,
sửa vi phẫu, không tái cấu trúc).

Bối cảnh: hiện tắt bằng cờ NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM (src/config/features.ts, middleware.ts chặn trang/API,
ReferralTracker no-op, menu admin làm mờ). Tài liệu: docs/partner-module-architecture.md,
docs/partner-module-gap-analysis.md. Mã: src/app/doi-tac, dang-ky-doi-tac, dai-ly, src/app/admin/{partners,payouts},
src/app/api/{partner,dealer}, src/lib/partner/*, src/config/partner.ts.

Chính sách đã chốt (điền trước khi gửi): hoa hồng = ___%, đơn tối thiểu = ___đ, giữ ___ ngày, rút tối thiểu = ___đ,
hạn mức/ngày = ___đ, phí rút = ___%, ngưỡng lên Đại lý = ___ doanh số/___ đơn, duyệt tự động = ___.

Việc cần làm:
1. Đọc 2 tài liệu docs/partner-module-* và liệt kê khoảng trống còn lại (gap) so với chính sách đã chốt.
2. Cập nhật src/config/partner.ts theo chính sách đã chốt.
3. Hoàn thiện các khoảng trống nghiệp vụ theo thứ tự ưu tiên: ghi nhận giới thiệu → hoa hồng khi đơn hoàn tất →
   sổ cái (ledger) → yêu cầu rút tiền → duyệt chi trả (admin) → nâng hạng Đại lý.
4. Xóa redirect '/dai-ly' → '/' trong next.config.ts; đặt link công khai tới /doi-tac (header/footer) nếu tôi đồng ý.
5. Bật NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM=true (staging trước). Kiểm tra: đăng ký CTV (OTP), mã giới thiệu ?ref=,
   đơn có hoa hồng, rút tiền, admin duyệt chi, phân quyền, và mobile không trượt ngang.
6. Chạy: npx tsc --noEmit, npx eslint src, và các test partner/payout/dealer trong tests/.
7. Báo cáo file đã đổi, kết quả test, rủi ro (đặc biệt về tiền/hoa hồng). KHÔNG commit/push nếu tôi chưa yêu cầu.
```

---

## 4. ĐĂNG NHẬP GOOGLE / FACEBOOK

**Hiện trạng:** nút đăng nhập mạng xã hội trong `AuthModal.tsx` bị ẩn bởi `NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN`.
Mã đã có: `src/components/auth/SocialAuthButtons.tsx`, `src/app/api/auth/{google,facebook}/route.ts`.
`/api/auth/mock-oauth` chỉ chạy ở môi trường dev (đã chặn ở production).

**Cần chuẩn bị:** tạo ứng dụng OAuth ở Google Cloud Console và Meta for Developers; đặt biến
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` trên Vercel;
khai báo Redirect URI theo domain thật; Facebook cần trang Chính sách quyền riêng tư và xác minh ứng dụng.

**Prompt:**
```
Bật đăng nhập Google/Facebook cho Thái Sơn Foods, tuân thủ AGENTS.md (sửa vi phẫu).

Bối cảnh: nút social trong src/components/auth/AuthModal.tsx đang ẩn bởi NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN
(src/config/features.ts). Mã: src/components/auth/SocialAuthButtons.tsx, src/app/api/auth/{google,facebook}/route.ts.
Tôi đã đặt các biến GOOGLE_CLIENT_ID/SECRET và FACEBOOK_CLIENT_ID/SECRET trên Vercel và khai báo Redirect URI:
___ (điền domain).

Việc cần làm:
1. Rà soát luồng OAuth (state chống CSRF, kiểm tra email đã xác minh, gộp tài khoản theo email, xử lý lỗi/hủy cấp quyền).
2. Đảm bảo mock-oauth KHÔNG chạy ở production; bổ sung CSP connect-src/frame-src nếu thiếu.
3. Đặt NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN=true (staging trước), thử đăng nhập bằng cả hai nhà cung cấp, kiểm tra
   chuyển về đúng trang (returnUrl) và tài khoản hiển thị đúng ở /tai-khoan.
4. Chạy: npx tsc --noEmit, npx eslint src. Báo cáo file đã đổi và rủi ro. KHÔNG commit/push nếu tôi chưa yêu cầu.
```

---

## 5. CÁC KHỐI "BẢN MẪU" (CHƯA CÓ NGHIỆP VỤ THẬT)

**Hiện trạng:** cờ `SHOW_PLACEHOLDER_BLOCKS` (`src/data/product-detail-placeholders.ts`, đọc từ
`NEXT_PUBLIC_SHOW_PLACEHOLDERS`) đang tắt. Khi tắt sẽ ẩn: nhãn "Bản mẫu · chờ triển khai", đồng hồ đếm ngược Deal
trong ngày, "Hơn 200 sản phẩm đã được mua trong tháng trước", mã giảm giá mẫu, địa chỉ giao mẫu, nút "Thêm vào danh sách
yêu thích", thẻ "Mua lại", khối "Gợi ý cho bạn" ở trang chủ, khối "Khách hàng đã xem sản phẩm này cũng xem".
Khối "Câu hỏi & trả lời" đã được **gỡ khỏi** trang sản phẩm và combo theo yêu cầu (component
`ProductQAPlaceholder` vẫn còn trong `ProductPlaceholderBlocks.tsx` nhưng không trang nào gọi).

Dữ liệu mẫu nằm ở `src/data/homepage-placeholders.ts` và `src/data/product-detail-placeholders.ts`.
Giao diện: `src/components/product/ProductPlaceholderBlocks.tsx`, `AmazonDealsRow.tsx`, `AmazonCategoryCards.tsx`,
`HomePage.tsx`, `src/app/san-pham/[slug]/page.tsx`.

**Prompt (chọn khối cần làm thật và sửa danh sách trước khi gửi):**
```
Triển khai thật các khối giao diện đang là "Bản mẫu" của Thái Sơn Foods, tuân thủ AGENTS.md (không đổi cấu trúc
thư mục, sửa vi phẫu, không tái cấu trúc). Mỗi khối làm xong thì bỏ khỏi file placeholder tương ứng.

Các khối cần làm thật lần này (xóa dòng không làm):
- Deal trong ngày có thời hạn thật (bảng/cột thời gian bắt đầu-kết thúc cho combo, đồng hồ đếm ngược theo dữ liệu thật,
  tự ẩn khi hết hạn) — hiện đồng hồ chỉ minh họa (AmazonDealsRow.tsx, DEAL_COUNTDOWN_PLACEHOLDER).
- "Đã mua trong tháng" lấy từ đơn hàng thật (đếm đơn hoàn tất 30 ngày gần nhất, ẩn nếu < ngưỡng).
- Mã giảm giá thật (CouponPlaceholder): bảng mã, điều kiện, áp dụng ở giỏ hàng/thanh toán, kiểm tra ở server.
- Danh sách yêu thích (WishlistPlaceholderButton): lưu theo tài khoản.
- "Mua lại" ở trang chủ: lấy từ lịch sử đơn của khách đã đăng nhập.
- "Gợi ý cho bạn" / "Khách cũng xem": thuật toán gợi ý dựa trên lịch sử xem/mua thật.
- Hỏi & đáp sản phẩm: cần quy trình duyệt nội dung, trả lời của CSKH, chống spam.
- Địa chỉ giao hàng trên Buy Box: lấy từ địa chỉ/chi nhánh thật của khách.

Yêu cầu: không hiển thị số liệu bịa; mọi dữ liệu lấy từ CSDL; kiểm tra quyền và validate ở server; mobile không trượt
ngang; chạy npx tsc --noEmit, npx eslint src, npm test. Sau khi hoàn thiện khối nào thì khối đó không còn phụ thuộc
cờ NEXT_PUBLIC_SHOW_PLACEHOLDERS. Báo cáo file đã đổi và rủi ro. KHÔNG commit/push nếu tôi chưa yêu cầu.
```

---

## Cách bật lại nhanh một cờ

| Cờ | Cách đổi |
|---|---|
| `ENABLE_SUBSCRIBE_SAVE`, `ENABLE_MEMBERSHIP` | Sửa `false` → `true` trong `src/config/membership.ts` |
| `NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM` | Vercel → Settings → Environment Variables (hoặc `.env` khi chạy local) → `true`, rồi build lại |
| `NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN` | như trên |
| `NEXT_PUBLIC_SHOW_PLACEHOLDERS` | như trên (chỉ dùng cho staging/demo nội bộ) |
