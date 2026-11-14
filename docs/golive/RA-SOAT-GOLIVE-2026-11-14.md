# Rà soát sẵn sàng golive — Thái Sơn Foods (14/11/2026)

Vai trò: BA senior + QA lead. Chỉ rà soát và báo cáo, không sửa code hay dữ liệu thật.
Phạm vi rà theo mặc định đã nêu ở Bước 1: code `main` = `bb86e4f`; golive gồm bán lẻ + gói, COD, Deal trong ngày bật; Đối tác / Hội viên / Giao định kỳ tắt. Test chỉ trên DB local `WebTSF_staging` (và DB test `webtsf_review_test` của bộ node:test), báo đơn Telegram/Zalo và email tắt khi test. Không chạm DB Vercel.

Ký hiệu nguồn: **[XM]** sự thật đã xác minh (có lệnh/kết quả) · **[GĐ]** giả định · **[SL]** rủi ro suy luận.

---

## 1. Tóm tắt điều hành

**Khuyến nghị: NO-GO tại thời điểm 14/11/2026. Chuyển sang GO CÓ ĐIỀU KIỆN khi xong 5 điều kiện bắt buộc bên dưới.**

Lý do chính:
- **Luồng bán hàng cốt lõi chạy đúng [XM].** Khách vãng lai xem SP → thêm SP lẻ + gói → thanh toán COD → tạo đơn TSF-97651585. DB khớp: 290.600đ, phí ship 0, 2 dòng đúng giá, chi nhánh gần nhất (~2,4 km). Server tự tính giá, không nhận giá 1đ từ client (143/145 kiểm tra chống sửa giá đạt, 2 fail do test cũ).
- **Môi trường production chưa tồn tại [XM].** Máy chủ công ty (IIS + PostgreSQL) chưa triển khai, chưa chạy thử checklist Phần E của `HUONG_DAN_TRIEN_KHAI.md`. Vercel chỉ là bản xem thử.
- **Secret đã lộ chưa thay [XM].** Mật khẩu PostgreSQL còn viết cứng trong file đã đưa lên Git; `JWT_SECRET` đang dùng nằm trong lịch sử Git (`6bb128d`). Production phải dùng bộ secret mới.
- **Không có bằng chứng UAT, backup/restore, rollback toàn hệ thống, giám sát [XM: không tìm thấy trong repo].** `ROLLBACK.md` chỉ cho trang chủ.
- **11 test fail là lỗi thật nhưng nằm trong module đang tắt [XM].** API các module này trả 404 `FEATURE_DISABLED`, nên không chặn golive; phải sửa trước khi bật.

Số lượng phát hiện theo severity (sau tự kiểm ở Bước 4):

| Blocker | Critical | Major | Minor | Suggestion | Tổng |
|---|---|---|---|---|---|
| 3 | 2 | 8 | 7 | 2 | 22 |

**Điều kiện bắt buộc trước golive:**
1. Dựng production trên máy chủ công ty, chạy hết checklist Phần A–E của `HUONG_DAN_TRIEN_KHAI.md`, chạy đủ migration, smoke test 1 đơn thật (F-01).
2. Tạo secret mới cho production: mật khẩu DB + user ứng dụng ít quyền, `JWT_SECRET`, `CRON_SECRET`, `ADMIN_REGISTER_KEY` (F-02).
3. Backup DB production trước golive và **thử restore một lần**; viết rollback toàn hệ thống có tiêu chí kích hoạt (F-03).
4. Chủ doanh nghiệp / quản lý cửa hàng chạy UAT theo kịch bản ngắn (đặt đơn, admin xác nhận, giao, hủy) và ký xác nhận (F-04).
5. Giám sát tối thiểu: kiểm tra uptime + nơi xem log lỗi + người nhận cảnh báo (F-05).

---

## 2. Ma trận truy vết yêu cầu

Không có BRD có mã yêu cầu và tiêu chí chấp nhận, nên mã UC dưới đây lấy theo `docs/usecase-bang-tom-tat.md` (mục 2). "Test case" = test tự động trong `tests/` hoặc test tay ngày 14/11.

| Mã | Mô tả | Đã build? | Có test case? | Kết quả test | Ghi chú |
|---|---|---|---|---|---|
| UC-01 | Xem & tìm SP / gói | Có | Test tay 14/11 | Đạt [XM] | Trang chủ, SP, gói trả 200; không còn chữ "combo" trên trang chủ |
| UC-02 | Quản lý giỏ hàng | Có | `cart_store`, `cart_rehydrate` + test tay | Đạt [XM] | Tổng giỏ đúng 290.600đ, tiết kiệm 15.400đ |
| UC-03 | Chọn chi nhánh / gợi ý gần nhất | Có | `store_recommender.test` + test tay | Đạt [XM] | Tự chọn Diên Hồng ~2,4 km, đủ hàng |
| UC-04 | Đặt hàng COD, giữ chỗ tồn | Có | `orders_api_integration`, `orders_lifecycle`, `inventory_confirm_concurrency` + test tay | Đạt [XM] | Không có khóa idempotency (F-07) |
| UC-05 | Báo đơn Zalo / Telegram | Có | Không có test tự động | Chưa test [XM] | Tắt trong test để không bắn tin thật |
| UC-06 | Email xác nhận đơn | Có | Không | Chưa test | SMTP tắt khi test |
| UC-07 | Xác định vị trí giao hàng | Có | `test:address` (8 file, chưa chạy hôm nay) + test tay | Đạt có lỗi [XM] | Bắt buộc xác nhận ghim; danh mục quận cũ (F-09) |
| UC-08 | Tra cứu đơn (mã + SĐT) | API có, **không có trang** | Không | Chưa test | Khách không có chỗ tra cứu (F-12) |
| UC-09 | Xem / bình chọn đánh giá | Có | `phase4_reviews_test`, `phase8_reviews_security_rbac_test` | Không chạy hôm nay | |
| UC-10 | Đăng ký / đăng nhập email | Có | `api_sessions_integration` | Đạt [XM] | Không xác minh email, không có quên mật khẩu (F-11, F-12) |
| UC-11 | Đăng nhập Google / Facebook | Có | `test_oauth_social_login` | Không chạy hôm nay | Cần khóa thật trên production |
| UC-12 | Hồ sơ, lịch sử đơn, yêu thích | Có | Một phần | Chưa test tay | |
| UC-13 | Admin: đăng nhập, đổi mật khẩu lần đầu | Có | `admin_api_integration_test` | Chưa test tay (không có mật khẩu) | API admin không đăng nhập trả 401/403 [XM] |
| UC-14 | Admin: quản lý đơn, đổi trạng thái, xuất Excel | Có | `order_status_delivery.test`, `orders_lifecycle` | Đạt (tự động) [XM] | Chưa test tay giao diện |
| UC-15 | Admin: chuyển chi nhánh, đối soát COD | Có | `reproduce_transfer_stock_deficiency` | Không chạy hôm nay | |
| UC-16 | Admin: tồn kho, nhập lô | Có | `inventory_pure`, `phase5_fefo` | Đạt (inventory_pure) [XM] | Tồn golive là số lớn đặt sẵn (đã chốt) |
| UC-17 | Admin: SP, gói, danh mục, banner | Có | `product_detail_content`, `product_live_flags` | Đạt [XM] | Gói: R20 (F-10) |
| UC-18 | Admin: báo cáo lợi nhuận, dashboard | Có | `phase3_golive_revenue_inventory`, `phase4_5_golive_empty_dashboard` | Không chạy hôm nay | |
| UC-19 | Admin: tài khoản, phân quyền RBAC, nhật ký | Có | `test:rbac` | Không chạy hôm nay | |
| UC-20 | Cron dọn giữ chỗ | Có | `test_cron_cleanup_*` | Không chạy hôm nay | Cron khai báo trong `vercel.json`; **máy chủ IIS chưa có lịch chạy** [SL] |
| UC-21 | Deal trong ngày | Có (13/11) | Không | Test tay: hiện trên trang chủ [XM] | **Build không có trong tài liệu use case** (scope creep có kiểm soát) |
| UC-22 | Gói gợi ý xoay vòng, zoom ảnh, hiệu ứng | Có (13/11) | Không | Chưa test chuyên biệt | Không có trong tài liệu use case |
| OFF-1..3 | Đối tác / Hội viên / Giao định kỳ | Có, đang tắt | Có | 11 fail [XM] | API trả 404 `FEATURE_DISABLED` [XM] |

---

## 3. Danh sách phát hiện

| ID | Loại | Severity | Mô tả | Bằng chứng / nguồn | Bước tái hiện | Tác động nghiệp vụ | Đề xuất xử lý | Phụ trách đề xuất |
|---|---|---|---|---|---|---|---|---|
| F-01 | Release | **Blocker** | Production trên máy chủ công ty chưa triển khai; chưa chạy migration, chưa chạy checklist sau triển khai | Memory dự án; `HUONG_DAN_TRIEN_KHAI.md` Phần E còn ô trống; 24 file trong `scripts/migrations`, không có bảng ghi migration đã chạy (không thấy `schema_migrations`) [XM] | — | Không có nơi chạy thật | Dựng production, chạy migration theo danh sách, smoke test | Dev + IT |
| F-02 | Release / Bảo mật | **Blocker** | Secret đã lộ: mật khẩu PostgreSQL viết cứng trong file tracked; `JWT_SECRET` hiện tại có trong lịch sử Git | `git grep` còn 1 file tracked có `postgres:<mật khẩu>@` [XM]; `SECURITY_AUDIT.md` H-1, H-3 | Xem `SECURITY_AUDIT.md` | Ai có repo có thể vào DB hoặc ký token đăng nhập khách | Secret mới cho production, user DB ít quyền; xóa mật khẩu khỏi file tracked | Dev + IT |
| F-03 | Release | **Blocker** | Không có quy trình backup/restore đã thử; rollback chỉ có cho trang chủ | `ROLLBACK.md` (chỉ trang chủ); `scripts/backup_db.sh` có nhưng không có biên bản đã restore [XM] | — | Sự cố dữ liệu ngày đầu không khôi phục được | Backup trước golive, restore thử 1 lần, viết rollback toàn hệ thống + tiêu chí kích hoạt | Dev + IT |
| F-04 | BA | Critical | Không có UAT và người ký duyệt; không có BRD với tiêu chí chấp nhận | Không tìm thấy trong repo [XM]; `KHAO-SAT-DOANH-NGHIEP.docx` là khảo sát, không phải UAT [GĐ: chưa đọc nội dung .docx] | — | Không chứng minh được hệ thống đúng ý doanh nghiệp | UAT 1 buổi theo kịch bản ngắn, ký xác nhận | BA + chủ DN |
| F-05 | Release | Critical | Không có giám sát, cảnh báo, dashboard vận hành | Không có file sentry/monitor/health trong `src` [XM] | — | Web sập hoặc lỗi đặt đơn không ai biết | Uptime check (miễn phí), ghi log lỗi ra file, người trực nhận cảnh báo | IT |
| F-06 | Test / Bảo mật | Major | `npm audit` (chỉ dependency production): 19 high, 8 moderate, 1 low; trực tiếp: `@vercel/blob`, `prisma` | Lệnh `npm audit --omit=dev` 14/11 [XM] | `npm audit --omit=dev` | Rủi ro thư viện có lỗ hổng đã công bố | Rà từng mục, nâng phiên bản hoặc ghi nhận "không khai thác được" | Dev |
| F-07 | Test | Major | Đặt đơn không có khóa idempotency: rớt mạng lúc bấm có thể tạo đơn trùng | `grep -c idempotency src/app/api/orders/route.ts` = 0 [XM]; báo cáo QA mobile 03/11 (C1) | Bấm Đặt hàng, ngắt mạng trước khi nhận phản hồi, bấm lại | Đơn trùng; đỡ được nhờ cửa hàng gọi xác nhận | Thêm `idempotency_key` UNIQUE hoặc chấp nhận rủi ro bằng văn bản | Dev + chủ DN |
| F-08 | Release / Bảo mật | Major | `TRUSTED_PROXY_COUNT=0`: sau IIS mọi khách chung một nhóm giới hạn tần suất | `.env` [XM]; `SECURITY_AUDIT.md` M-3 | — | Giờ cao điểm khách bị chặn đặt đơn nhầm | Làm đúng Phần B `HUONG_DAN_TRIEN_KHAI.md` | IT |
| F-09 | BA / Test | Major | Danh mục địa chỉ dùng đơn vị hành chính cũ: có cả "Quận 2", "Quận 9" và "TP. Thủ Đức"; chọn "Phường 1, Quận 3" nhưng ghim trả "Phường Xuân Hòa"; địa chỉ chi nhánh dùng tên phường mới | Test tay 14/11; đơn TSF-97651585 lưu "Phường Xuân Hòa, Quận 3" [XM]; `src/data/vietnam-addresses.ts` | Thanh toán → TP.HCM → Quận 3 → Phường 1 → gõ "100 Lý Chính Thắng" → chọn gợi ý | Địa chỉ trong đơn lẫn cũ/mới, shipper dễ nhầm | Chốt chuẩn địa chỉ (cũ hay mới), bỏ đơn vị đã giải thể | BA + Dev |
| F-10 | Test | Major | R20: thành phần gói không nhận dạng được bị bỏ qua im lặng (không trừ kho, không báo lỗi) | Test node:test R20 fail [XM]; `REVIEW.md` R20 | Xem test `R20` | Gói bật nên áp dụng; tồn đặt số lớn giảm tác động | Chủ DN quyết: từ chối đơn hay bỏ qua; sửa theo quyết định | Dev + chủ DN |
| F-11 | Bảo mật | Major | Đăng ký email không xác minh; Google gộp tài khoản theo email → chiếm trước tài khoản | `SECURITY_AUDIT.md` M-1; `register/route.ts` không có bước xác minh [XM] | Xem M-1 | Khách mất tài khoản / lộ lịch sử đơn | Xác minh email hoặc không gộp tài khoản chưa xác minh | Dev |
| F-12 | BA | Major | Không có trang tra cứu đơn, không có quên mật khẩu | `src/app` không có route tương ứng [XM]; API tra cứu có | — | Khách không tự xem đơn, quên mật khẩu thì kẹt | Thêm 2 trang, hoặc ghi rõ "gọi hotline" trong SOP | BA + Dev |
| F-13 | Test | Major | Bộ test tự động chưa chạy hôm nay: `test:address`, `test:rbac`, reviews, OAuth, cron, dashboard | Ma trận mục 2 [XM] | — | Hồi quy ở các khu vực này chưa được xác nhận | Chạy trước golive trên DB staging | QA |
| F-14 | Test | Minor | R28: xác nhận đơn thiếu hàng trả HTTP 500, câu chung chung | `TONG-HOP-RA-SOAT.md` mục 4 | Xem R28 | Ít gặp vì tồn đặt số lớn | Trả 409 + câu rõ | Dev |
| F-15 | BA | Minor | Trang giỏ ghi "Đã gồm thuế & phí ship / Miễn phí" trước khi biết địa chỉ; trên 10 km phí thật khác | `gio-hang/page.tsx:1026` [XM]; quy tắc phí ship theo km | Giỏ ≥ 200k, chưa nhập địa chỉ | Khách thấy giá khác khi thanh toán | Ghi "Phí ship tính theo địa chỉ" | Dev |
| F-16 | Test | Minor | Test golive cũ: `golive_order_tamper_test` thiếu cờ xác nhận ghim (58 fail giả), mục [j] còn giả định gói tắt | Chạy 14/11: 77/136 → bản có cờ 143/145 [XM] | Chạy test như hướng dẫn trong file | Báo fail giả, che lỗi thật | Cập nhật test | QA |
| F-17 | Test | Minor | 11 test fail ở module đang tắt (R30–R34, R40, R41, R43, Lỗi 6) | node:test 229/215/11/3 [XM]; API trả 404 [XM] | `npx tsx --test tests/*.test.mjs` | Không ảnh hưởng golive; chặn việc bật module | Sửa trước khi bật, theo `BAT-LAI-CHUC-NANG.md` | Dev |
| F-18 | Bảo mật | Minor | CSP mới ở chế độ Report-Only | `next.config.ts:80` [XM] | — | Giảm lớp phòng thủ XSS | Theo dõi báo cáo rồi bật chặn | Dev |
| F-19 | Bảo mật | Minor | API đánh giá công khai trả `userId`, `orderId` | `SECURITY_AUDIT.md` L-5 | `GET /api/reviews` | Lộ định danh nội bộ | Bỏ 2 trường khỏi phản hồi | Dev |
| F-20 | Dữ liệu | Minor | Dữ liệu test còn trong DB staging: đơn TSF-97651585 + 8 đơn 03/11, 17 gói tên dài | Memory dự án; đơn 14/11 [XM] | — | Nếu sao DB staging lên production sẽ kèm rác | Production dựng DB sạch, không sao staging | Dev |
| F-21 | Release | Suggestion | Cron (dọn giữ chỗ) đang khai báo cho Vercel; trên IIS cần Task Scheduler | `vercel.json` [XM]; `HUONG_DAN_TRIEN_KHAI.md` không có chữ "cron" [XM] | — | Giữ chỗ quá hạn không được dọn | Thêm lịch chạy trong hướng dẫn triển khai | IT |
| F-22 | Test | Suggestion | eslint 635 cảnh báo (0 lỗi) | Chạy 14/11 [XM] | `npx eslint .` | Không ảnh hưởng trực tiếp | Dọn dần | Dev |

---

## 4. Đánh giá độ phủ test

| Loại test | Trạng thái | Nhận xét / bằng chứng |
|---|---|---|
| Kiểm tra tĩnh (tsc, eslint, màu/phông/cỡ chữ) | Đã làm | tsc 0 lỗi; eslint 0 lỗi; 3 lint thương hiệu = 0 [XM] |
| Unit / integration (node:test) | Đã làm | 229 test: 215 đạt, 11 fail (module tắt), 3 todo [XM] |
| Chức năng – happy path khách | Đã làm | Đặt đơn COD end-to-end, đối chiếu DB [XM] |
| Chức năng – negative / validation | Làm chưa đủ | Form trống, SĐT sai, chưa xác nhận ghim: đạt. Chưa test: ngoài 20 km, ngoài giờ giao (code server có kiểm `deliverySlots.ts`), giỏ > 10 triệu |
| Chống sửa giá / giả mạo | Đã làm | 143/145 (2 fail do test cũ); giả mạo userId: đạt [XM] |
| Phân quyền | Làm chưa đủ | API admin chưa đăng nhập: 401/403 [XM]. Chưa test theo vai trò STORE_STAFF / MARKETING trên giao diện |
| Admin end-to-end (xác nhận → giao → hoàn tất / hủy) | Chưa làm (tay) | Chỉ có test tự động; thiếu mật khẩu admin để test tay |
| Tích hợp ngoài (Telegram, Zalo, SMTP, OAuth, OSM/OSRM) | Làm chưa đủ | OSM/OSRM chạy trong test tay [XM]; Telegram/Zalo/SMTP/OAuth chưa test hôm nay (cố ý tắt) |
| Hồi quy | Làm chưa đủ | Bộ node:test giống lần 13/11 (215 đạt); các bộ `test:address`, `test:rbac` chưa chạy |
| Hiệu năng / tải | Chưa làm | Có `tests/load_20_orders_test.mjs` nhưng chưa chạy; chưa đo trên máy chủ thật |
| Bảo mật | Làm chưa đủ | Có kiểm toán 11/11; chưa kiểm lại sau khi đổi secret; npm audit còn 19 high |
| Tương thích thiết bị | Làm chưa đủ | Mobile 375px: không tràn ngang ở 4 trang chính [XM]; chưa thử Safari/iOS thật |
| Dữ liệu & migration | Chưa làm | Không migrate dữ liệu cũ [GĐ]; chưa chạy thử 24 migration trên DB trống của production |
| Backup / restore | Chưa làm | Xem F-03 |
| UAT | Chưa làm | Xem F-04 |

---

## 5. Đánh giá sẵn sàng golive (Phần C)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Kế hoạch cutover (thứ tự, người, giờ) | ❌ Chưa đạt | Không có tài liệu |
| Kế hoạch rollback + tiêu chí kích hoạt | ❌ Chưa đạt | `ROLLBACK.md` chỉ trang chủ; `HUONG_DAN_TRIEN_KHAI.md` Phần D chỉ cho cấu hình IIS |
| Cấu hình production, biến môi trường, chứng chỉ, tên miền | ⚠️ Cần xử lý | Có hướng dẫn; secret phải tạo mới (F-02); HTTPS và `TRUSTED_PROXY_COUNT` chưa làm (F-08) |
| App tự chặn khi cấu hình production sai | ✅ Đạt | `src/lib/auth.ts` kiểm JWT mặc định, CRON_SECRET, mock OAuth; trang `test-email` tự ẩn khi production [XM: đọc code] |
| Monitoring, logging, alert | ❌ Chưa đạt | F-05 |
| Backup trước golive | ❌ Chưa đạt | Có `scripts/backup_db.sh`, chưa có bằng chứng chạy/restore |
| Hypercare (đội trực, quy trình sự cố, SLA) | ❓ Thiếu thông tin | Không có tài liệu |
| Truyền thông người dùng / các bên | ❓ Thiếu thông tin | Shop gắn vào nút "CỬA HÀNG" của thaisonfoods.vn; chưa thấy kế hoạch thông báo |
| Tuân thủ pháp lý / chính sách | ✅ Đạt (theo quyết định đã có) | Chính sách nằm ở web chính, shop không cần (memory dự án) |
| Phụ thuộc ngoài (Zalo/Telegram bot, OAuth app, SMTP, OSM) | ⚠️ Cần xử lý | Khóa chạy được ở dev; chưa xác nhận app Google/Facebook đã đăng ký domain production; OSM là dịch vụ miễn phí, có giới hạn tần suất [SL] |
| Chức năng chưa sẵn sàng đã khóa | ✅ Đạt | Đối tác/Hội viên/Định kỳ trả 404 `FEATURE_DISABLED` [XM] |

---

## 6. Sổ đăng ký rủi ro

| Rủi ro | Xác suất | Tác động | Biện pháp giảm thiểu | Kế hoạch dự phòng |
|---|---|---|---|---|
| Lộ DB / giả token do secret cũ | Trung bình | Rất cao | Secret mới, user DB ít quyền, chặn cổng 5432 từ ngoài | Đổi secret ngay, thu hồi phiên, rà nhật ký |
| Sự cố triển khai ngày đầu (migration thiếu, cấu hình sai) | Cao | Cao | Diễn tập triển khai trên máy staging giống production | Giữ nút "CỬA HÀNG" ẩn cho tới khi smoke test đạt; rollback theo F-03 |
| Mất dữ liệu đơn | Thấp | Rất cao | Backup tự động hằng ngày + restore thử | Restore bản gần nhất, gọi lại khách theo log Zalo/Telegram |
| Đơn trùng (rớt mạng, bấm lại) | Trung bình | Thấp–TB | Cửa hàng gọi xác nhận từng đơn | Hủy đơn trùng trong admin |
| Địa chỉ sai do đơn vị hành chính cũ/mới | Trung bình | Trung bình | Bắt buộc ghim bản đồ (đã có) | Shipper gọi khách |
| Web lỗi không ai biết | Trung bình | Cao | Uptime check + cảnh báo | Hotline nhận đơn thay thế |
| Giới hạn tần suất chặn nhầm khách sau proxy | Cao nếu chưa cấu hình | Cao | Làm Phần B hướng dẫn IIS | Tạm nới giới hạn |
| Dịch vụ OSM/OSRM chậm hoặc chặn | Thấp–TB | Trung bình | Đã có đường lui "cần gọi xác nhận" (2 lần/24h) | Nhận đơn qua hotline |
| Bật nhầm module đang tắt | Thấp | Cao | Cờ cố định trong code + middleware | Tắt cờ, deploy lại |

---

## 7. Thông tin còn thiếu & giả định

| Thiếu / giả định | Ảnh hưởng đến kết luận |
|---|---|
| Ngày golive dự kiến | Không đánh giá được thời gian còn lại để đáp ứng 5 điều kiện |
| Môi trường production thật (máy, phiên bản PostgreSQL, IIS, HTTPS) [GĐ: theo `HUONG_DAN_TRIEN_KHAI.md`] | Mọi kết quả hôm nay là trên dev local, chưa phải production |
| BRD, tiêu chí chấp nhận, test case thủ công, danh sách bug chính thức | Ma trận truy vết dựa trên use case kỹ thuật, không phải yêu cầu đã ký |
| Biên bản UAT, người ký duyệt | Chưa có ai xác nhận nghiệp vụ đúng |
| Người phụ trách cutover, hypercare, SLA | Cột "Phụ trách đề xuất" là đề xuất, chưa có tên người |
| Nội dung `KHAO-SAT-DOANH-NGHIEP.docx` (chưa đọc) | Có thể có yêu cầu nghiệp vụ chưa được truy vết |
| Không migrate dữ liệu từ hệ thống cũ [GĐ] | Nếu có migrate, phần dữ liệu chưa được rà |
| Admin chưa test tay (không có mật khẩu) | Luồng xử lý đơn phía cửa hàng chỉ có bằng chứng từ test tự động |
| Kết quả test dựa trên `next dev`, không phải `next build` + `start` | Lần build 13/11 đạt; hiệu năng production chưa đo |

---

## 8. Kế hoạch hành động đề xuất

**Trước golive (bắt buộc):**
1. F-02 Tạo secret mới, user DB ít quyền, bỏ mật khẩu khỏi file tracked.
2. F-01 Dựng production trên máy chủ công ty theo `HUONG_DAN_TRIEN_KHAI.md` (A → E), chạy migration lên DB trống, F-08 cấu hình proxy/HTTPS, F-21 lịch chạy cron.
3. F-03 Backup + restore thử; viết rollback toàn hệ thống (tiêu chí: không đặt được đơn > 15 phút, lỗi dữ liệu đơn).
4. F-05 Uptime check + log lỗi + người nhận cảnh báo.
5. F-13 Chạy các bộ test chưa chạy trên staging; F-16 cập nhật test golive cũ.
6. F-04 UAT với chủ doanh nghiệp + quản lý cửa hàng, ký xác nhận.

**Trước golive (nên làm, có thể chấp nhận rủi ro bằng văn bản):**
7. F-09 Chốt chuẩn địa chỉ cũ/mới. 8. F-10 Quyết định R20. 9. F-07 Idempotency hoặc ghi nhận rủi ro. 10. F-06 Rà npm audit. 11. F-12 Trang tra cứu đơn / quên mật khẩu, hoặc SOP hotline. 12. F-15 Sửa câu phí ship trong giỏ.

**Trong golive:**
13. Đặt 1 đơn thật trên production, kiểm báo Zalo/Telegram/email, admin xác nhận và hủy; sau đó mới bật nút "CỬA HÀNG" trên thaisonfoods.vn.

**Sau golive (hypercare 1–2 tuần):**
14. Theo dõi đơn trùng, địa chỉ sai, lỗi 500; F-11, F-14, F-18, F-19, F-22.
15. Sửa F-17 trước khi bật Đối tác / Hội viên / Giao định kỳ.

---

## Phụ lục — Bước 4 tự kiểm tra

- **Hạ mức:** "Đơn trùng khi rớt mạng" giữ Major (không Critical) vì chủ dự án đã xác nhận cửa hàng gọi xác nhận từng đơn (03/11). 11 test fail hạ Minor vì đã xác minh API module tắt trả 404.
- **Rút lại:** "Nút giao ngay ~25 phút ngoài giờ giao" (nêu ở báo cáo test 14/11). Đọc code thấy server tự kiểm khung 07:00–16:30 (`deliverySlots.ts`), nên không còn là phát hiện; chỉ ghi "chưa test tay ngoài giờ" ở mục 4.
- **Gộp trùng:** C-1 (combo tự chọn) trong `SECURITY_AUDIT.md` không đưa vào vì `ENABLE_CUSTOM_COMBOS = false` [XM]. R40/R41 nằm trong F-17, không tách riêng.
- **Thiếu bằng chứng trực tiếp:** F-04 (chưa đọc .docx), xác suất trong mục 6 là ước lượng.
- **Dữ liệu test tạo hôm nay:** đơn TSF-97651585 trên `WebTSF_staging` (chưa xóa). Bộ chống sửa giá tự dọn 49 đơn `QA_TEST_` của nó.
