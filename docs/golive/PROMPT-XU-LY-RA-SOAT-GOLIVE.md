# Prompt xử lý các việc trong RA-SOAT-GOLIVE-2026-11-14.md

Cách dùng: mỗi lần dán **Prompt chung** + **một** prompt việc bên dưới vào phiên mới. Làm theo thứ tự trong mục "Kế hoạch hành động" của báo cáo. Việc ghi "(Người làm)" là việc con người phải tự làm: AI chỉ soạn hướng dẫn hoặc script, không tự chạy.

---

## Prompt chung (dán đầu mọi phiên)

```
Dự án Thái Sơn Foods tại D:\WebTSF\thai-son-foods. Đọc docs/golive/RA-SOAT-GOLIVE-2026-11-14.md, tìm đúng mã phát hiện (F-xx) tôi giao bên dưới, đọc bằng chứng/nguồn ghi trong đó trước khi làm.

Quy tắc bắt buộc:
- Tuân thủ AGENTS.md: sửa tối thiểu, không đổi cấu trúc file, 7 màu / 2 phông / 9 cỡ chữ; trang chi tiết SP và trang gói luôn sửa đồng bộ.
- Làm việc trên nhánh mới tách từ main, đặt tên fix/golive-<mã F>. Không push, không merge khi tôi chưa duyệt.
- Không đọc file D:\WebTSF\Vercel-env-secrets-MOI.txt. Không gõ, không in, không đoán mật khẩu hay secret; việc cần secret thì viết script để tôi tự chạy.
- Không ghi vào DB cloud/production. Test trên DB local; khi test đặt đơn phải để trống TELEGRAM_BOT_TOKEN, ZALO_BOT_TOKEN, SMTP_USER để không bắn tin thật.
- Trước khi sửa: nêu nguyên nhân gốc và cách sửa định làm, chờ tôi duyệt nếu thay đổi nghiệp vụ.
- Sau khi sửa: chạy npx tsc --noEmit, npx eslint (file đã sửa), npm run lint:colors, lint:fonts, lint:font-sizes, và bộ test liên quan; báo kết quả thật (đạt / fail kèm lỗi).
- Cuối cùng cập nhật cột trạng thái của mã F đó trong RA-SOAT-GOLIVE-2026-11-14.md (thêm dòng "Đã xử lý dd/mm: <commit> " hoặc "Chấp nhận rủi ro: <lý do>").
```

---

## Trước golive — bắt buộc

### F-02 · Secret mới cho production (Dev viết script, Người làm chạy)
```
Việc: F-02. (1) Liệt kê mọi file đang được Git theo dõi có mật khẩu PostgreSQL hoặc secret viết cứng (git grep), sửa để đọc từ biến môi trường, không đổi hành vi khác. (2) Viết hướng dẫn + script PowerShell tạo secret mới cho production (JWT_SECRET, CRON_SECRET, ADMIN_REGISTER_KEY) và SQL tạo user DB ít quyền chỉ dùng cho ứng dụng. Script in ra giá trị cho TÔI tự dán vào .env production, bạn không chạy script. (3) Ghi rõ hậu quả đổi JWT_SECRET (phiên đăng nhập cũ mất).
```

### F-01 + F-08 + F-21 · Dựng production trên máy chủ công ty (Người làm + IT, AI soạn tài liệu)
```
Việc: F-01, F-08, F-21. Viết tài liệu docs/golive/CUTOVER.md: thứ tự từng bước dựng production trên máy chủ công ty (IIS + PostgreSQL) theo HUONG_DAN_TRIEN_KHAI.md; danh sách 24 migration trong scripts/migrations theo đúng thứ tự chạy trên DB trống (đọc nội dung từng file để xác định phụ thuộc); cách tạo bảng ghi migration đã chạy; cấu hình TRUSTED_PROXY_COUNT và HTTPS (Phần B, C); lịch chạy cron dọn giữ chỗ bằng Windows Task Scheduler thay cho vercel.json; checklist smoke test sau triển khai. Mỗi bước có cột: người làm, thời gian ước tính, cách kiểm tra đạt. Không tự chạy gì trên máy chủ.
```

### F-03 · Backup, restore thử, rollback toàn hệ thống
```
Việc: F-03. Đọc scripts/backup_db.sh, viết bản PowerShell tương đương cho máy chủ Windows (pg_dump định dạng custom, giữ 14 bản, tên có ngày giờ). Viết docs/golive/ROLLBACK-TOAN-HE-THONG.md: tiêu chí kích hoạt rollback (ví dụ: không đặt được đơn > 15 phút, sai tiền/tồn trên đơn), các bước quay về bản code trước + restore DB, người quyết định. Diễn tập restore trên DB local: backup WebTSF_staging → restore sang DB mới tên webtsf_restore_test → đếm số dòng orders, order_items, products, combos hai bên khớp nhau → xóa DB tạm. Báo kết quả đối soát.
```

### F-05 · Giám sát tối thiểu
```
Việc: F-05. Thêm route GET /api/health trả 200 khi kết nối DB được (không lộ thông tin cấu hình, không cần đăng nhập, có giới hạn tần suất). Ghi log lỗi server ra file có xoay vòng khi chạy production (không ghi SĐT/địa chỉ đầy đủ vào log). Viết hướng dẫn gắn dịch vụ uptime miễn phí gọi /api/health 5 phút/lần và gửi cảnh báo về nhóm Telegram vận hành. Test route bằng curl trên local.
```

### F-13 + F-16 · Chạy đủ bộ test, sửa test cũ
```
Việc: F-13, F-16. (1) Sửa tests/golive_order_tamper_test.mjs: thêm locationConfirmed: true, locationConfirmedBy: 'USER_MAP_PIN' vào body mẫu; sửa mục [j] cho đúng việc gói (ENABLE_COMBOS) đang bật: gói trong bảng combos phải được server tính giá DB, không nhận giá client. Chỉ sửa test, không sửa code ứng dụng. (2) Trên DB local, chạy và báo kết quả: npm run test:address, npm run test:rbac, tests/phase4_reviews_test.mjs, tests/phase8_reviews_security_rbac_test.mjs, tests/test_oauth_social_login.mjs, tests/test_cron_cleanup_*.mjs, tests/phase3_golive_revenue_inventory_test.mjs, tests/phase4_5_golive_empty_dashboard_test.mjs, tests/load_20_orders_test.mjs, và cả bộ node:test. Với mỗi test fail: phân loại lỗi thật / test cũ, không tự sửa code ứng dụng. Dọn dữ liệu test sinh ra.
```

### F-04 · Kịch bản UAT (BA soạn, chủ doanh nghiệp chạy)
```
Việc: F-04. Viết docs/golive/UAT-KICH-BAN.md dạng bảng để in ra: 15–20 kịch bản cho chủ doanh nghiệp và quản lý cửa hàng tự chạy trên môi trường staging (đặt đơn SP lẻ, đặt gói, Deal trong ngày, địa chỉ ngoài 20 km, đặt ngoài giờ 07:00–16:30, admin xác nhận → giao → hoàn tất, hủy đơn và kiểm tồn trả lại, nhân viên chi nhánh chỉ thấy đơn chi nhánh mình, xuất Excel, báo đơn Zalo/Telegram tới đúng nhóm). Mỗi kịch bản: bước làm, kết quả mong đợi, cột Đạt/Không đạt, ghi chú. Cuối file có phần ký xác nhận. Đọc thêm docs/golive/KHAO-SAT-DOANH-NGHIEP.docx để thêm kịch bản cho yêu cầu nghiệp vụ trong đó.
```

---

## Trước golive — nên làm (hoặc ký chấp nhận rủi ro)

### F-09 · Địa chỉ hành chính cũ/mới
```
Việc: F-09. Rà src/data/vietnam-addresses.ts, src/data/stores.ts và luồng địa chỉ ở trang thanh toán + api/orders. Báo cáo trước (chưa sửa): hiện dùng chuẩn nào, chỗ nào lẫn cũ/mới, đơn lưu những trường địa chỉ gì. Đưa 2 phương án (giữ Quận/Phường cũ cho khách quen và chuẩn hoá hiển thị; hoặc chuyển hẳn sang Tỉnh + Phường mới từ 01/07/2025) với ảnh hưởng tới đơn cũ, phí ship, gợi ý địa chỉ. Chờ tôi chọn rồi mới sửa.
```

### F-10 · R20 thành phần gói không nhận dạng
```
Việc: F-10 (REVIEW.md R20). Tôi chọn: <TỪ CHỐI ĐƠN | BỎ QUA THÀNH PHẦN NHƯNG GHI LOG>. Sửa expandComboItems trong src/lib/inventory.ts theo lựa chọn này, test R20 trong bộ node:test phải đạt, các test khác không đổi kết quả.
```

### F-07 · Chống đơn trùng (idempotency)
```
Việc: F-07. Thêm khóa idempotency cho POST /api/orders: trình duyệt sinh 1 khóa cho mỗi lần thanh toán (giữ nguyên khi bấm lại), server lưu cột idempotency_key UNIQUE trong orders (migration mới trong scripts/migrations, chạy lại nhiều lần vẫn an toàn); gửi lại cùng khóa thì trả lại đơn đã tạo, không tạo đơn mới. Viết test: 2 POST song song cùng khóa → 1 đơn; mất phản hồi rồi gửi lại → cùng mã đơn.
```

### F-06 · npm audit
```
Việc: F-06. Chạy npm audit --omit=dev, lập bảng từng gói high/critical: gói, phiên bản, lỗ hổng, đường dẫn phụ thuộc, code dự án có dùng phần bị lỗi không, bản sửa. Nâng các gói nâng được mà không đổi phiên bản lớn; gói phải đổi phiên bản lớn thì chỉ báo cáo. Sau khi nâng: build + toàn bộ test.
```

### F-12 · Tra cứu đơn và quên mật khẩu
```
Việc: F-12. Làm trang /tra-cuu-don dùng GET /api/orders hiện có (mã đơn + SĐT, giữ nguyên chống dò); thêm link ở header/footer. Làm luồng quên mật khẩu qua email (mã một lần hết hạn 15 phút, giới hạn tần suất, không cho biết email có tồn tại hay không). Theo AGENTS.md về màu/phông/cỡ chữ. Test cả hai luồng, gồm luồng lỗi.
```

### F-15 · Câu phí ship ở giỏ
```
Việc: F-15. Ở src/app/gio-hang/page.tsx, khi chưa có địa chỉ thì không ghi "Đã gồm thuế & phí ship / Miễn phí" chắc chắn; đổi thành câu cho biết phí ship tính theo khoảng cách ở bước thanh toán (miễn phí trong 10 km cho đơn từ 200k). Có cả bản tiếng Anh. Chỉ sửa đúng chỗ này.
```

---

## Sau golive

### F-11 · Xác minh email / chiếm trước tài khoản
```
Việc: F-11 (SECURITY_AUDIT.md M-1). Đề xuất và làm: gửi mã xác minh khi đăng ký email; Google chỉ gộp vào tài khoản đã xác minh email. Tài khoản cũ chưa xác minh xử lý thế nào: nêu phương án, chờ tôi duyệt.
```

### F-14, F-18, F-19, F-22 · Dọn lỗi nhỏ
```
Việc: F-14 (R28: xác nhận đơn thiếu hàng trả 409 + câu rõ thay vì 500), F-19 (bỏ userId, orderId khỏi GET /api/reviews), F-18 (đề xuất lộ trình chuyển CSP từ Report-Only sang chặn, chưa bật), F-22 (giảm cảnh báo eslint ở file đang sửa, không sửa hàng loạt). Mỗi mục một commit.
```

### F-17 · Trước khi bật Đối tác / Hội viên / Giao định kỳ
```
Việc: F-17. Tôi muốn bật module <TÊN>. Đọc docs/golive/BAT-LAI-CHUC-NANG.md và REVIEW.md, sửa các lỗi thuộc module đó (R30–R34, R40, R41, R43, Lỗi 6 tùy module) theo thứ tự đề xuất trong TONG-HOP-RA-SOAT.md, mỗi lỗi một commit, test tương ứng phải chuyển sang đạt. Chưa bật cờ khi tôi chưa duyệt.
```

---

## Rà soát lại sau khi xử lý

```
Đọc docs/golive/RA-SOAT-GOLIVE-2026-11-14.md. Kiểm lại từng mã F-01..F-22 trên code main hiện tại và môi trường hiện có: còn tồn tại không, bằng chứng gì. Chạy lại bộ kiểm tra như lần 14/11 (tsc, eslint, 3 lint thương hiệu, node:test, test chống sửa giá, đặt 1 đơn COD trên local với báo đơn tắt). Tạo báo cáo mới docs/golive/RA-SOAT-GOLIVE-<ngày>.md cùng 8 mục, kết luận GO / NO-GO / GO CÓ ĐIỀU KIỆN. Không sửa code hay dữ liệu thật.
```
