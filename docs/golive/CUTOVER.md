# CUTOVER — Dựng production Thái Sơn Foods trên máy chủ công ty (IIS + PostgreSQL)

Xử lý: F-01 (dựng production + migration), F-08 (`TRUSTED_PROXY_COUNT` / HTTPS), F-21 (cron thay `vercel.json`) trong `docs/golive/RA-SOAT-GOLIVE-2026-11-14.md`.
Mô hình: trình duyệt → IIS (80/443, `web.config` trong repo) → Next.js `127.0.0.1:3000` → PostgreSQL.

Tài liệu đi kèm: `HUONG_DAN_TRIEN_KHAI.md` (Phần A–E), `docs/golive/F-02-SECRET-PRODUCTION.md` (secret, user DB), `.env.production.example`.
Người làm: **IT** = quản trị máy chủ/mạng · **Dev** = lập trình viên · **QL** = quản lý cửa hàng / chủ doanh nghiệp. Thời gian là ước tính cho người đã quen việc.

> Điều kiện trước khi bắt đầu: F-02 xong phần code (nhánh `fix/golive-F-02`), có bản backup DB staging, có người quyết định rollback (mục 8).

---

## 0. Đã kiểm chứng gì (14/11/2026, máy dev, DB trống tạo riêng rồi xoá)

| Kiểm tra | Kết quả |
|---|---|
| Lược đồ gốc từ code (`scripts/schema_bootstrap_dry_run.mjs`) chạy trên DB trống | Đạt, tạo 30 bảng |
| 12 migration chạy theo thứ tự mục 3 | Đạt, không lỗi |
| So lược đồ với DB staging đang chạy | **Thiếu** `inventory_logs`, `products.volume`, `products.name_en`, `products.is_vegan`, `product_variants.volume`, `categories.name_en` — code đang dùng (trang danh mục, admin sản phẩm, nhật ký kho sẽ lỗi). Đã thêm `scripts/migrations/golive_fresh_db_gaps_schema.sql` |
| Chạy lại toàn bộ bằng `scripts/chay_migration_production.ps1` (bootstrap + 13 file) | Lần 1: 14 file chạy xong. Lần 2: bỏ qua cả 14 (đã ghi trong `schema_migrations`) |
| So lại với staging | Cột, index, ràng buộc khớp. Chỉ còn thiếu 5 bảng app **tự tạo khi chạy** (`email_logs`, `inventory_sheet_rows`, `inventory_sheet_state`, `inventory_stop_sale`, `item_weekly_delivery`) — cần user DB của app có quyền tạo bảng (đã có trong F-02) |
| `scripts/goi_cron_don_giu_cho.ps1` | Khoá sai → ghi "LỖI 401", mã thoát 1; thiếu khoá → báo thiếu, mã thoát 1; gọi được → "OK 200", mã thoát 0 |

Chưa kiểm chứng: chạy trên máy chủ thật, IIS, HTTPS, Task Scheduler (chỉ thử script gọi, chưa thử đăng ký lịch).

---

## 1. Chuẩn bị (T-7 → T-1, chưa đụng tới khách)

| # | Việc | Người làm | Thời gian | Cách kiểm tra đạt |
|---|---|---|---|---|
| 1.1 | Chốt ngày giờ golive (ngoài giờ bán 07:00–16:30), người trực, người quyết định rollback | QL + Dev | 30 phút | Có tên người và số điện thoại trong mục 8 |
| 1.2 | Máy chủ: Windows Server có IIS + URL Rewrite + Application Request Routing (ARR); Node.js LTS (bản đang dùng ở dev); PostgreSQL 15+ (cả `psql`, `pg_dump`); Git | IT | 2–3 giờ | `node -v`, `psql --version` (>= 15), `git --version` chạy được; IIS Manager có mục URL Rewrite và ARR |
| 1.3 | Tên miền trỏ về máy chủ, chứng chỉ TLS hợp lệ, binding HTTPS 443 trên site IIS | IT | 1–2 giờ (chưa tính chờ DNS) | Mở `https://<tên-miền>/` (trang mặc định IIS) không báo lỗi chứng chỉ |
| 1.4 | PostgreSQL chỉ nghe nội bộ: `listen_addresses = 'localhost'` (hoặc IP nội bộ), tường lửa chặn 5432 từ ngoài | IT | 30 phút | Từ máy khác: `Test-NetConnection <IP> -Port 5432` → `False` |
| 1.5 | Gộp các nhánh golive đã duyệt vào `main`, ghi lại mã commit sẽ triển khai | Dev | 30 phút | `git log -1` trên `main` = commit đã ghi; build ở máy dev đạt |
| 1.6 | Chuẩn bị dữ liệu danh mục (mục 4): khôi phục tên 17 gói đang để tên dài test trên DB staging, kiểm giá, ảnh, chi nhánh | Dev + QL | 1–2 giờ | QL xác nhận danh sách SP, gói, giá, chi nhánh đúng |
| 1.7 | Diễn tập toàn bộ mục 2 → 6 trên một máy/thư mục thử (có thể là máy dev) | Dev | 2 giờ | Smoke test mục 7 đạt trên bản diễn tập |

---

## 2. Cài ứng dụng và secret (ngày golive, T0)

| # | Việc | Người làm | Thời gian | Cách kiểm tra đạt |
|---|---|---|---|---|
| 2.1 | Lấy mã nguồn đúng commit ở 1.5 vào thư mục ứng dụng (ví dụ `C:\inetpub\thai-son-foods`) | IT | 10 phút | `git log -1` = commit ở 1.5 |
| 2.2 | Tạo secret + user DB: `scripts\tao_secret_production.ps1`, rồi trong cùng cửa sổ chạy `scripts\tao_user_db_it_quyen.sql` (chi tiết: `F-02-SECRET-PRODUCTION.md`) | IT | 20 phút | SQL in `so_bang_chua_thuoc_app_user = 0`; role `tsf_app` có `rolsuper = f` |
| 2.3 | Tạo `.env` theo `.env.production.example`. Giữ tạm như Phần A `HUONG_DAN_TRIEN_KHAI.md`: `NODE_ENV=production`, `APP_ENV=production`, `TRUSTED_PROXY_COUNT=0`, `COOKIE_SECURE=false`, `NEXT_PUBLIC_APP_URL`/`ALLOWED_ORIGINS` = địa chỉ `http://` tạm, `OTP_TEST_CODE` trống, `DB_SCHEMA_BOOTSTRAP` trống, `INVENTORY_SOURCE=manual`. Điền `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `ADMIN_REGISTER_KEY` từ 2.2; khoá Zalo/Telegram/SMTP/Google/Facebook của production | IT + Dev | 30 phút | Dev đối chiếu đủ biến bắt buộc (không xem giá trị secret) |
| 2.4 | `npm ci` rồi `npm run build` | IT | 10–15 phút | Build kết thúc không lỗi |

---

## 3. Lược đồ DB (migration) và bảng ghi migration

### Thứ tự chạy trên DB trống

| Thứ tự | File | Phụ thuộc / lý do đứng ở vị trí này |
|---|---|---|
| 0 | `000_bootstrap.sql` (sinh từ code, xem 3.1) | Tạo 30 bảng gốc (`stores`, `products`, `orders`, `admin_users`, `users`, `combos`…). Mọi migration sau đều `ALTER`/tham chiếu các bảng này |
| 1 | `phase1_rbac_schema.sql` | Cần `admin_users`, `stores` (khoá ngoại `admin_users.store_code → stores.code`); tạo `audit_logs` |
| 2 | `01_gps_stores_orders_schema.sql` | Thêm cột GPS cho `stores`, `orders` |
| 3 | `phase4_cost_price_schema.sql` | Cột giá vốn `products`, `combos`, `order_items` |
| 4 | `phase7_membership_schema.sql` | Tham chiếu `stores`, `orders`; tạo bảng hội viên/định kỳ (module đang tắt nhưng code vẫn truy vấn) |
| 5 | `phase8_reviews_schema.sql` | Tạo `product_reviews`, `review_helpful_votes` |
| 6 | `phase8_reviews_v2_schema.sql` | Sau 5 (chống spam đánh giá) |
| 7 | `address_round3_schema.sql` | Cột nguồn địa chỉ cho `orders`, bảng `address_events` |
| 8 | `address_round4_schema.sql` | Cột ghim địa chỉ cho `users` |
| 9 | `bootstrap_catchup_20261106_schema.sql` | Sau 1 (đọc `audit_logs`), tạo `order_status_history` + trigger |
| 10 | `site_settings_schema.sql` | Bảng cài đặt (Deal trong ngày) |
| 11 | `product_detail_content_schema.sql` | Cột `products.detail_content` |
| 12 | `golive_fresh_db_gaps_schema.sql` (**mới**) | Bù bảng/cột code đang dùng mà 0–11 chưa tạo (mục 0) |
| 13 | `golive_variant_multiplier_fix.sql` | Sửa dữ liệu `product_variants`; trên DB trống không đổi gì. **Chạy lại sau khi nạp dữ liệu (mục 4)** |

12 file `*_rollback.sql` cùng thư mục là bản hoàn tác, **không** chạy khi dựng mới. Thứ tự trên đã được kiểm trên DB trống (mục 0); đổi thứ tự thì phải thử lại.

### 3.1 Các bước

| # | Việc | Người làm | Thời gian | Cách kiểm tra đạt |
|---|---|---|---|---|
| 3.1 | Sinh lược đồ gốc từ đúng commit đang triển khai: `npx tsx scripts/schema_bootstrap_dry_run.mjs --out C:\deploy\bootstrap.sql` (không kết nối DB) | Dev / IT | 2 phút | File có dòng đầu "Chạy thử bộ khởi tạo lược đồ … 175 câu" (số câu có thể khác nếu code đổi) |
| 3.2 | Chạy thử: `powershell -ExecutionPolicy Bypass -File scripts\chay_migration_production.ps1 -Bootstrap C:\deploy\bootstrap.sql -DryRun` | IT | 2 phút | In "SẼ CHẠY" đủ 14 file, dòng cuối "CHẠY THỬ: chưa ghi gì" |
| 3.3 | Chạy thật (bỏ `-DryRun`). Script đọc `DATABASE_URL` của `tsf_app` trong `.env` | IT | 5 phút | 14 dòng "xong:", cuối in bảng `schema_migrations` 14 dòng |
| 3.4 | Chạy lại lệnh 3.3 lần nữa | IT | 1 phút | 14 dòng "bỏ qua (đã chạy)", không lỗi |

**Bảng ghi migration** (`schema_migrations`, tạo tự động bởi script):

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(200) PRIMARY KEY,   -- tên file đã chạy
  sha256     CHAR(64)     NOT NULL,      -- mã băm nội dung lúc chạy
  applied_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  applied_by VARCHAR(100) NOT NULL DEFAULT current_user
);
```

Quy tắc về sau: migration mới → thêm file vào `scripts/migrations` và vào cuối danh sách `$Order` trong `scripts/chay_migration_production.ps1`; không sửa file đã chạy (script sẽ dừng nếu mã băm khác). Xem file nào đã chạy: `SELECT * FROM schema_migrations ORDER BY applied_at;`.

---

## 4. Dữ liệu ban đầu

DB vừa dựng chỉ có lược đồ (và 3 hạng hội viên mẫu). Cần dữ liệu danh mục; **không** chép đơn hàng, khách hàng, tài khoản admin, nhật ký từ staging.

| # | Việc | Người làm | Thời gian | Cách kiểm tra đạt |
|---|---|---|---|---|
| 4.1 | Trên máy dev, xuất **chỉ dữ liệu** các bảng danh mục từ DB staging đã chuẩn (sau bước 1.6): `pg_dump --data-only --column-inserts -t categories -t products -t product_variants -t product_images -t combos -t combo_items -t combo_images -t stores -t store_inventory -t banners -t brand_slides -t site_settings -f catalog.sql "<DATABASE_URL staging>"` | Dev | 15 phút | File `catalog.sql` có `INSERT INTO` cho đủ 12 bảng |
| 4.2 | Chép `catalog.sql` và thư mục ảnh `public/uploads` (theo `UPLOAD_DIR`) sang máy chủ | IT | 15 phút | Số file ảnh hai bên bằng nhau |
| 4.3 | Nạp: `psql "<DATABASE_URL tsf_app>" -v ON_ERROR_STOP=1 -1 -f catalog.sql` (một giao dịch, lỗi thì không ghi gì) | IT | 5 phút | Lệnh kết thúc không có `ERROR`; `SELECT count(*)` các bảng = số ở staging |
| 4.4 | Chạy lại `golive_variant_multiplier_fix.sql` bằng psql (sửa `bottle_multiplier` của dữ liệu vừa nạp) | IT | 2 phút | Dòng "Sau khi sửa" báo 0 dòng lệch |
| 4.5 | Tồn kho golive: đặt số lớn theo quyết định đã chốt (nhập tay trên admin hoặc theo bảng `store_inventory` vừa nạp) | QL | 30 phút | Trang admin Tồn kho hiện đúng chi nhánh, không âm |
| 4.6 | Tạo Super Admin đầu tiên bằng `ADMIN_REGISTER_KEY` (chỉ chạy được khi bảng `admin_users` trống), đổi mật khẩu lần đầu; tạo tài khoản quản lý chi nhánh. Sau đó xoá `ADMIN_REGISTER_KEY` khỏi `.env` | QL + Dev | 30 phút | Đăng nhập admin được; tạo admin thứ hai bằng khoá đó bị từ chối |
| 4.7 | Bật "Deal trong ngày" trong admin (nếu golive có Deal) | QL | 5 phút | Trang chủ hiện khối Deal |

Thay cho 4.1–4.3 có thể: khôi phục toàn bộ bản sao staging rồi dọn bằng `scripts/golive_purge_test_data.mjs` (có chạy thử). Cách này mang theo cả tài khoản/nhật ký test, nên chỉ dùng khi không xuất riêng được dữ liệu danh mục. ❓ Cần QL + Dev chọn một cách trước ngày golive.

---

## 5. Cron thay cho `vercel.json` (F-21)

`vercel.json` khai báo 2 lịch chỉ chạy trên Vercel. Trên IIS dùng **Windows Task Scheduler**:

| Lịch ở Vercel | Trên máy chủ công ty |
|---|---|
| `/api/cron/cleanup-reservations` — `0 0 * * *` (Vercel tính theo UTC = 07:00 giờ VN) | **Bắt buộc.** Chạy hằng ngày 00:05 giờ VN (ngoài giờ bán), bằng `scripts\goi_cron_don_giu_cho.ps1` |
| `/api/cron/sync-inventory` — `30 22 * * *` | **Không cần** khi `INVENTORY_SOURCE=manual` (mặc định golive). Chỉ thêm khi chuyển sang đọc Google Sheet |

| # | Việc | Người làm | Thời gian | Cách kiểm tra đạt |
|---|---|---|---|---|
| 5.1 | Chạy tay: `powershell -ExecutionPolicy Bypass -File C:\inetpub\thai-son-foods\scripts\goi_cron_don_giu_cho.ps1 -AppDir C:\inetpub\thai-son-foods` | IT | 5 phút | Dòng "OK 200" trong `logs\cron-cleanup.log` |
| 5.2 | Đăng ký lịch (PowerShell quyền Administrator, xem lệnh dưới) | IT | 10 phút | Task Scheduler có tác vụ "TSF cron don giu cho", "Last Run Result" = `0x0` sau khi bấm Run |
| 5.3 | Sáng hôm sau mở `logs\cron-cleanup.log` | IT | 2 phút | Có dòng "OK 200" lúc ~00:05 |

```powershell
$app = 'C:\inetpub\thai-son-foods'
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$app\scripts\goi_cron_don_giu_cho.ps1`" -AppDir `"$app`""
$trigger = New-ScheduledTaskTrigger -Daily -At 00:05
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
# Chạy bằng tài khoản dịch vụ có quyền đọc .env của ứng dụng (không dùng tài khoản cá nhân)
Register-ScheduledTask -TaskName 'TSF cron don giu cho' -Action $action -Trigger $trigger -Settings $settings `
  -User 'NT AUTHORITY\SYSTEM' -RunLevel Highest
```

Nếu app không nghe `127.0.0.1:3000` (đổi cổng), thêm `-BaseUrl http://127.0.0.1:<cổng>` vào `-Argument`.

---

## 6. Chạy app, IIS, proxy, HTTPS (F-08) — theo `HUONG_DAN_TRIEN_KHAI.md`

| # | Việc | Người làm | Thời gian | Cách kiểm tra đạt |
|---|---|---|---|---|
| 6.1 | Phần A: chạy `npm run start:prod` dưới dạng dịch vụ Windows (NSSM/PM2), tự khởi động lại khi máy chủ reboot | IT | 30 phút | Log khởi động **không** có `[DBG-01]` hay `CRITICAL PRODUCTION CONFIGURATION ERRORS`; reboot thử → app tự lên |
| 6.2 | Site IIS dùng `web.config` trong repo, trỏ về `127.0.0.1:3000` | IT | 20 phút | `http://<tên-miền>/` hiện trang chủ shop |
| 6.3 | Phần B bước 1–2: chặn cổng 3000 từ ngoài | IT | 10 phút | Từ máy khác: `Test-NetConnection <IP> -Port 3000` → `TcpTestSucceeded : False` |
| 6.4 | Phần B bước 3: ARR "Preserve client IP" = `X-Forwarded-For` | IT | 10 phút | Ảnh chụp cấu hình ARR |
| 6.5 | **Chỉ khi 6.3 đạt**: `TRUSTED_PROXY_COUNT=1`, khởi động lại app | IT | 5 phút | Sai mật khẩu admin 5 lần từ máy A → máy A bị khoá, máy B vẫn đăng nhập được |
| 6.6 | Phần C (chỉ khi 1.3 đạt): bật rule `RedirectHttpToHttps`; quyết định HSTS (`includeSubDomains` hay rule `HstsOnlyOnHttps`); đổi `NEXT_PUBLIC_APP_URL`, `ALLOWED_ORIGINS`, `GEO_SITE_URL` sang `https://<tên-miền>`, `COOKIE_SECURE=true` | IT + Dev | 30 phút | `http://` tự chuyển `https://`; cookie `tsf_admin_token` có cờ Secure + HttpOnly |
| 6.7 | Build lại (`NEXT_PUBLIC_APP_URL` đóng vào bản build) và khởi động lại | IT | 15 phút | Log khởi động sạch như 6.1 |
| 6.8 | Cập nhật đường dẫn callback OAuth ở Google Cloud / Meta sang `https://<tên-miền>/api/auth/callback/...` | Dev | 15 phút | Đăng nhập Google thành công trên tên miền thật |
| 6.9 | Sao lưu DB ngay sau khi dựng xong (bản "sạch" để rollback) | IT | 10 phút | Có file `pg_dump` mới, kích thước > 0 (quy trình đầy đủ: F-03) |

---

## 7. Smoke test sau triển khai (trước khi bật nút "CỬA HÀNG" trên thaisonfoods.vn)

Đặt đơn thật bằng tên "TEST GOLIVE – KHÔNG GIAO", sau đó huỷ.

| # | Kiểm tra | Người làm | Thời gian | Đạt khi |
|---|---|---|---|---|
| 7.1 | Trang chủ, 1 trang sản phẩm, 1 trang gói, giỏ hàng, thanh toán | QL | 5 phút | Đủ ảnh, giá đúng, không có chữ "combo", không lỗi |
| 7.2 | Đặt 1 đơn COD (1 SP lẻ + 1 gói), xác nhận ghim | QL | 5 phút | Trang "Đặt hàng thành công" có mã đơn; nhóm Zalo/Telegram nhận tin báo đơn; email xác nhận tới (nếu nhập email) |
| 7.3 | Admin: thấy đơn, xác nhận, rồi huỷ | QL | 5 phút | Trạng thái đổi đúng; tồn kho trừ khi xác nhận, trả lại khi huỷ; Nhật ký kho có dòng tương ứng (bảng `inventory_logs`) |
| 7.4 | Nhân viên chi nhánh đăng nhập | QL | 5 phút | Chỉ thấy đơn chi nhánh mình |
| 7.5 | Admin: sửa 1 sản phẩm (dung tích) và lưu; xem trang danh mục | Dev | 5 phút | Lưu được (cột `products.volume`, `detail_content` có đủ) |
| 7.6 | Đăng ký khách, đăng nhập Google (nếu bật) | Dev | 5 phút | Thành công trên `https://` |
| 7.7 | Mở `/api/khong-ton-tai` | Dev | 1 phút | Không thấy câu SQL / stack trace |
| 7.8 | `/api/membership/subscribe`, `/api/partner/otp/send` (POST) | Dev | 2 phút | 404 `FEATURE_DISABLED` |
| 7.9 | Kiểm `HUONG_DAN_TRIEN_KHAI.md` Phần E | IT | 10 phút | Mọi ô đánh dấu |
| 7.10 | Log app 30 phút sau khi mở | Dev | 10 phút | Không có lỗi 500 lặp lại |
| 7.11 | QL đồng ý → bật nút "CỬA HÀNG" trên thaisonfoods.vn trỏ về tên miền shop | QL | 10 phút | Bấm nút từ web chính vào được shop |

---

## 8. Rollback trong ngày golive

| Tình huống | Làm gì | Ai quyết |
|---|---|---|
| Smoke test 7.x không đạt và không sửa được trong 60 phút | Không bật nút "CỬA HÀNG" (7.11). Shop chưa có khách nên không cần khôi phục gì; sửa rồi làm lại mục 7 | Người quyết định rollback (1.1) |
| Đã mở bán, lỗi chặn đặt đơn > 15 phút | Ẩn nút "CỬA HÀNG" trên web chính, nhận đơn qua hotline, rồi xử lý | Người quyết định rollback |
| Lỗi cấu hình IIS/proxy/HTTPS | Theo bảng Phần D `HUONG_DAN_TRIEN_KHAI.md` | IT |
| Lỗi do migration | Khôi phục bản backup 6.9 (hoặc `*_rollback.sql` tương ứng nếu chỉ một migration hỏng) | Dev |

Kế hoạch backup/restore và rollback toàn hệ thống đầy đủ: F-03.

Người trực ngày golive: ❓ (điền tên, số điện thoại) · Người quyết định rollback: ❓
