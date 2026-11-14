# F-02 — Secret mới cho production và gỡ secret viết cứng khỏi Git

Liên quan: `docs/golive/RA-SOAT-GOLIVE-2026-11-14.md` (F-02), `SECURITY_AUDIT.md` (H-1, H-3, I-3), `HUONG_DAN_TRIEN_KHAI.md`.

## 1. Đã gỡ khỏi code (nhánh `fix/golive-F-02`)

Quét mọi file Git đang theo dõi, so với giá trị thật trong `.env` / `.env.local` của máy dev (chỉ so khớp, không in giá trị):

| Loại | Trước | Sau |
|---|---|---|
| Mật khẩu PostgreSQL thật | 0 file (đã gỡ ở đợt SEC-02 trước đó) | 0 |
| `JWT_SECRET`, `ADMIN_REGISTER_KEY`, `SMTP_PASS`, `GOOGLE_CLIENT_SECRET`, token Zalo/Telegram | 0 file | 0 |
| `CRON_SECRET` thật làm giá trị dự phòng | 4 file | 0 — bắt buộc đặt biến `CRON_SECRET` |
| Mật khẩu tài khoản admin mặc định (`admin`, `adminCH1`, quản trị chi nhánh) | 11 file | 0 — biến `TEST_ADMIN_PASSWORD` / `STORE_ADMIN_INITIAL_PASSWORD` |
| Mật khẩu tài khoản QA (`qa_staff_*`) | 2 file | 0 — biến `QA_SEED_PASSWORD` |
| Mật khẩu tài khoản demo đối tác | 1 file | 0 — biến `DEMO_PARTNER_PASSWORD` |

Các file đã sửa: `scripts/create_store_admins.mjs`, `scripts/golive_secure_admin_accounts.mjs`, `scripts/qa_seed_test_accounts.mjs`, `scripts/seed_demo_partners.mjs`, `scripts/qa_deep_test_suite.mjs`, `scripts/test_admin_product_edit_flow.mjs`, `scripts/test_inventory_phase1.mjs`, `scripts/test_inventory_phase4.mjs`, `scripts/test_order_inventory_deduction.mjs`, `tests/phase1_partner_foundation_test.mjs`, `tests/phase3_payout_test.mjs`, `tests/phase4_dealer_test.mjs`, `tests/phase5_fefo_inventory_test.mjs`, `tests/phase6_readonly_checklist_verify.mjs`, `tests/security/pre_golive_security_regression.mjs`, `tests/test_cron_cleanup_http.mjs`.

Hành vi: giữ nguyên, trừ một điểm — thiếu biến môi trường thì script dừng với câu "Thiếu biến môi trường X", thay vì âm thầm dùng mật khẩu cũ. Các script seed không còn in mật khẩu ra màn hình.

`scripts/golive_secure_admin_accounts.mjs`: danh sách "mật khẩu yếu" không còn ghi chữ mật khẩu mặc định cũ. Khi chạy, đặt `KNOWN_WEAK_PASSWORDS` (các mật khẩu mặc định cũ, cách nhau bằng dấu phẩy); `TEST_ADMIN_PASSWORD`, `QA_SEED_PASSWORD`, `STORE_ADMIN_INITIAL_PASSWORD` nếu có cũng tự được coi là yếu. **Không đặt biến này thì script không nhận ra tài khoản còn dùng mật khẩu mặc định cũ.**

Không đổi (không phải secret): mật khẩu của tài khoản test tạo tạm rồi xoá trong test, chuỗi tấn công mẫu (`hacker_attempt`, SQLi), khoá JWT mặc định công khai `INSECURE_DEFAULT_JWT_SECRET` (app từ chối khoá này khi chạy production, `src/lib/jwtSecret.ts`), chuỗi mẫu trong `.env.example`, `DEPLOY.md`.

### Việc của người vận hành trên máy dev

Thêm vào `.env` local (không commit) để các script test cũ chạy lại như trước — giá trị là mật khẩu các tài khoản test đang có trong DB local:

```
TEST_ADMIN_PASSWORD=...        # mật khẩu admin / adminCH1 trên DB local
QA_SEED_PASSWORD=...           # mật khẩu qa_staff_* (scripts/qa_seed_test_accounts.mjs)
DEMO_PARTNER_PASSWORD=...      # chỉ khi chạy scripts/seed_demo_partners.mjs
STORE_ADMIN_INITIAL_PASSWORD=... # chỉ khi chạy scripts/create_store_admins.mjs
```

## 2. Secret vẫn nằm trong LỊCH SỬ Git

Gỡ khỏi code hiện tại **không** xoá được khỏi lịch sử (đã push lên 2 remote). Coi như đã lộ, phải thay:

| Secret đã lộ trong lịch sử | Việc phải làm |
|---|---|
| Mật khẩu user `postgres` của máy dev/staging (SECURITY_AUDIT H-1) | Đổi mật khẩu `postgres` trên mọi máy còn dùng nó; chặn cổng 5432 từ mạng ngoài |
| `JWT_SECRET` đang dùng ở `.env` dev (commit `6bb128d`, H-3) | Production dùng khoá mới (mục 3). Không dùng lại khoá dev ở bất kỳ môi trường thật nào |
| `CRON_SECRET` dev | Production dùng khoá mới (mục 3) |
| Mật khẩu admin mặc định, QA, demo | Production dựng DB sạch, không có các tài khoản này; DB nào còn chúng thì chạy `scripts/golive_secure_admin_accounts.mjs` để khoá hoặc đổi |

Không khuyến nghị viết lại lịch sử Git: phải force-push 2 remote, mọi bản clone cũ vẫn giữ secret; thay secret mới là cách xử lý đúng.

## 3. Tạo secret mới cho production (người vận hành tự chạy)

1. Mở PowerShell trên máy chủ production (hoặc máy quản trị tin cậy), đứng ở thư mục dự án.
2. Chạy:
   ```
   powershell -ExecutionPolicy Bypass -File scripts\tao_secret_production.ps1 -DbHost 127.0.0.1 -DbName WebTSF_production -AppUser tsf_app
   ```
   Script in ra `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `ADMIN_REGISTER_KEY`; không ghi file, không kết nối mạng.
3. Dán khối in ra vào `.env` production (cùng các biến khác theo `.env.production.example`). Lưu bản sao vào kho mật khẩu công ty.
4. **Trong cùng cửa sổ đó**, tạo user DB ít quyền (mục 4).
5. Đóng cửa sổ PowerShell (xoá biến `TSF_APP_DB_PASSWORD` khỏi bộ nhớ).
6. Khởi động app: log khởi động không được có `CRITICAL PRODUCTION CONFIGURATION ERRORS` (app tự kiểm `JWT_SECRET` >= 32 ký tự, khác khoá mặc định; `CRON_SECRET` >= 16 ký tự).
7. Cập nhật lịch chạy cron (Task Scheduler) dùng `CRON_SECRET` mới trong header `Authorization: Bearer ...`.
8. Tạo Super Admin đầu tiên bằng `ADMIN_REGISTER_KEY`; xong thì có thể xoá `ADMIN_REGISTER_KEY` khỏi `.env` (chỉ dùng khi bảng `admin_users` trống).

## 4. User DB ít quyền

File: `scripts/tao_user_db_it_quyen.sql` (psql 15 trở lên, chạy bằng tài khoản `postgres`):

```
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v app_user=tsf_app -v db_name=WebTSF_production -f scripts\tao_user_db_it_quyen.sql
```

Kết quả: role `tsf_app` đăng nhập được, **không** superuser, không tạo DB, không tạo role, giới hạn 50 kết nối; chỉ role này (và quản trị) kết nối được vào `WebTSF_production`; `tsf_app` sở hữu schema `public` và mọi bảng. Mật khẩu đọc từ biến môi trường của cửa sổ PowerShell, không nằm trong file và không hiện trên dòng lệnh. Chạy lại an toàn.

Sau bước này: chạy migration bằng `tsf_app` (dùng `DATABASE_URL` mới), không dùng `postgres` cho ứng dụng.

**Vì sao chưa tách user chỉ đọc/ghi dữ liệu (DML-only):** code còn tự chạy `CREATE TABLE/INDEX IF NOT EXISTS` lúc chạy, không qua cờ `DB_SCHEMA_BOOTSTRAP`, ở `src/lib/email/service.ts`, `src/lib/inventorySheet.ts`, `src/lib/orderStatusHistory.ts`, `src/lib/reviews/repository.ts`, `src/lib/site-settings.ts` và `ALTER TABLE` ở `src/app/api/admin/sync/route.ts`. PostgreSQL đòi quyền tạo trên schema (hoặc quyền chủ bảng) cho các lệnh này kể cả khi bảng đã có, nên user chỉ-DML sẽ làm các chức năng đó lỗi. Việc sau golive: đưa các lệnh này qua `isSchemaBootstrapEnabled()` rồi tách 2 role (`tsf_migrator` sở hữu bảng, `tsf_app` chỉ SELECT/INSERT/UPDATE/DELETE).

## 5. Hậu quả khi đổi `JWT_SECRET`

`JWT_SECRET` ký mọi token đăng nhập (`src/lib/auth.ts`, kiểm ở `src/middleware.ts`, `src/app/api/admin/auth/login/route.ts`). Đổi khoá:

- **Mọi phiên đăng nhập cũ mất hiệu lực ngay**: khách hàng (token 7 ngày) và admin/nhân viên (token 24 giờ) phải đăng nhập lại. Đăng nhập Google/Facebook cũng phải bấm lại.
- **Không mất dữ liệu**: tài khoản, mật khẩu, đơn hàng, địa chỉ đã lưu giữ nguyên. Giỏ hàng nằm ở trình duyệt nên còn nguyên.
- Đơn đang đặt dở của khách đã đăng nhập: lần gửi sau sẽ bị coi là chưa đăng nhập, khách đăng nhập lại rồi đặt tiếp.
- Với production mới dựng thì chưa có phiên nào, nên không ảnh hưởng ai. Nếu sau này phải đổi lại khoá (nghi lộ), làm ngoài giờ bán hàng và báo trước cho cửa hàng.
- Mỗi môi trường (dev, Vercel xem thử, production) dùng một khoá riêng. Token của môi trường này không dùng được ở môi trường kia.
