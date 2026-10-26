# HƯỚNG DẪN DEPLOY WEBSITE THÁI SƠN FOODS LÊN VERCEL VÀ GẮN TÊN MIỀN CÔNG TY

Tài liệu này hướng dẫn chi tiết quy trình đưa website Thái Sơn Foods lên Production trên **Vercel**, tạo Database Cloud (PostgreSQL) và gắn tên miền **thaisonfoods.vn** / **shop.thaisonfoods.vn** qua **Cloudflare**.

---

## I. TẠI SAO CẦN DATABASE CLOUD CHO VERCEL?

- **Vercel** là nền tảng Serverless (chạy các hàm Stateless trên Cloud), không chứa sẵn dịch vụ PostgreSQL cục bộ (`127.0.0.1`).
- Khi chạy cục bộ, dự án kết nối qua `127.0.0.1:5432`.
- Để website chạy ổn định trên Vercel, chúng ta cần một cơ sở dữ liệu PostgreSQL trực tuyến (Cloud Database).

---

## II. BƯỚC 1: TẠO POSTGRESQL DATABASE CHO VERCEL (CHỌN 1 TRONG 2 CÁCH MIỄN PHÍ)

### Cách 1: Vercel Postgres / Neon (Khuyên dùng nhất - 1 Click)
1. Đăng nhập vào [vercel.com](https://vercel.com) và vào Project **thai-son-foods**.
2. Chọn tab **Storage** trên thanh menu dự án.
3. Bấm **Create Database** -> Chọn **Postgres (Serverless by Neon)**.
4. Đặt tên database: `webtsf-production`.
5. Chọn khu vực (Region): **Singapore (sin1)** để tốc độ truy cập từ Việt Nam nhanh nhất.
6. Bấm **Create**. Vercel sẽ tự động cấu hình các biến môi trường:
   - `DATABASE_URL`
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`

### Cách 2: Supabase PostgreSQL (Máy chủ Singapore `ap-southeast-1`)
1. Truy cập [supabase.com](https://supabase.com) và bấm **Start your project** (Đăng nhập qua GitHub).
2. Tạo Project mới:
   - Name: `WebTSF-Production`
   - Database Password: Tự đặt mật khẩu mạnh (dùng mật khẩu mạnh, ngẫu nhiên, ≥ 20 ký tự)
   - Region: **Singapore (`ap-southeast-1`)**
3. Vào **Project Settings** -> **Database** -> Mục **Connection string**, chọn tab **URI** (hoặc Transaction Pooler).
4. Copy chuỗi kết nối dạng:
   ```text
   postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
5. Vào Vercel -> Project **Settings** -> **Environment Variables** -> Thêm biến:
   - Key: `DATABASE_URL`
   - Value: Chuỗi kết nối vừa copy (áp dụng cho cả Production, Preview).

### ⚠️ BẮT BUỘC: `DATABASE_URL` trên Vercel phải là chuỗi POOLER
Vercel chạy nhiều instance serverless song song, mỗi instance mở pool kết nối riêng (`src/lib/db.ts` mặc định
`max = 3` khi chạy trên Vercel; đặt `DB_POOL_MAX` để ghi đè). Nếu dùng chuỗi kết nối trực tiếp, lúc đông khách
Postgres sẽ cạn kết nối ("too many connections").
- **Neon / Vercel Postgres:** dùng host có hậu tố `-pooler`, ví dụ `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require`.
- **Supabase:** dùng Transaction Pooler cổng **6543** kèm `?pgbouncer=true` (như chuỗi mẫu ở Cách 2), không dùng cổng 5432.
- Mã nguồn không dùng prepared statement có tên (`name:`) hay `LISTEN/NOTIFY` nên chạy được qua pgbouncer (chế độ transaction).
- Riêng các lệnh chạy một lần từ máy (restore dữ liệu, migration) có thể dùng chuỗi kết nối trực tiếp.

---

## III. BƯỚC 2: CHUYỂN TOÀN BỘ DỮ LIỆU TỪ MÁY NÀY LÊN CLOUD DATABASE

Hệ thống đã chuẩn bị sẵn file dump chứa đầy đủ 37 bảng, 12 sản phẩm mới, 38 chi nhánh và kho hàng tại:
`backups/WebTSF_production_ready.sql`

Chỉ cần mở Terminal và chạy lệnh sau (thay thế bằng chuỗi kết nối Cloud Database của bạn):

```bash
node scripts/restore_to_cloud_db.mjs "postgresql://user:password@host:port/dbname?sslmode=require"
```

*Quá trình import tự động hoàn tất trong khoảng 3 - 5 giây.*

---

## IV. BƯỚC 3: CẤU HÌNH BIẾN MÔI TRƯỜNG TRÊN VERCEL

Vào **Settings** -> **Environment Variables** trên Vercel và đảm bảo có các biến sau:

| Tên biến | Giá trị mẫu | Mục đích |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...` | Kết nối Cloud Database |
| `NEXT_PUBLIC_APP_URL` | `https://shop.thaisonfoods.vn` | URL chính thức của website |
| `JWT_SECRET` | Khóa bảo mật ngẫu nhiên dài >= 32 ký tự | Xác thực phiên đăng nhập |
| `ADMIN_REGISTER_KEY` | Chuỗi ngẫu nhiên mạnh (đặt riêng, không dùng lại) | Khóa tạo tài khoản Super Admin ban đầu |
| `ENABLE_MOCK_OAUTH` | `false` | **Bắt buộc false** trên Production |
| `CRON_SECRET` | Chuỗi ngẫu nhiên (`openssl rand -hex 32`) | Bắt buộc: bảo vệ các cron job (không có thì cron từ chối chạy) |
| `BLOB_READ_WRITE_TOKEN` | Tự sinh khi tạo **Vercel Blob Store** (Storage → Create → Blob) rồi Connect vào dự án | Bắt buộc trên Vercel: nơi lưu ảnh/video admin tải lên (ổ đĩa serverless không bền) |
| `NEXT_PUBLIC_SHOW_PLACEHOLDERS` | Không đặt (hoặc `false`) | Ẩn các khối "Bản mẫu" với khách. Chỉ đặt `true` khi demo nội bộ |
| `NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM` | Không đặt (hoặc `false`) | Giữ khóa chương trình CTV/Đại lý/Payouts (giai đoạn 2) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Từ Google Cloud Console (xem `docs/golive/BAT-LAI-CHUC-NANG.md` mục 4) | Đăng nhập Google; thiếu thì nút Google tự ẩn |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Từ Meta for Developers | Đăng nhập Facebook; thiếu thì nút Facebook tự ẩn |
| `NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN` | Không đặt (mặc định bật) | Đặt `false` để tắt hẳn đăng nhập mạng xã hội |
| `SMTP_HOST` | `smtp.gmail.com` | Máy chủ gửi email đơn hàng |
| `SMTP_PORT` | `587` | Cổng SMTP |
| `SMTP_USER` | Email gửi tin của công ty | Email gửi tin |
| `SMTP_PASS` | Mật khẩu ứng dụng (App Password) của email gửi — KHÔNG ghi vào tài liệu | Mật khẩu ứng dụng Gmail |
| `EMAIL_FROM` | `Thái Sơn Foods <email-gui-tin@thaisonfoods.vn>` | Tiêu đề người gửi |

---

## V. BƯỚC 4: GẮN TÊN MIỀN CÔNG TY TRÊN CLOUDFLARE

Vì tên miền `thaisonfoods.vn` và `shop.thaisonfoods.vn` đang được quản lý DNS tại **Cloudflare**:

1. **Trên Vercel:**
   - Vào Vercel -> Project **Settings** -> **Domains**.
   - Thêm tên miền: `shop.thaisonfoods.vn` (hoặc `thaisonfoods.vn`).

2. **Trên Cloudflare Dashboard:**
   - Chọn tên miền `thaisonfoods.vn` -> Chọn tab **DNS** -> **Records**.
   - Bấm **Add record**:
     - **Type:** `CNAME`
     - **Name:** `shop` (nếu dùng subdomain `shop.thaisonfoods.vn`)
     - **Target:** `cname.vercel-dns.com`
     - **Proxy status:** Bật **DNS only** (biểu tượng đám mây xám) để Vercel tự động cấp và quản lý SSL Let's Encrypt (hoặc bật Proxied nếu dùng SSL Full/Strict trên Cloudflare).
     - **TTL:** Auto.
   - Bấm **Save**.

3. **Xác thực:**
   - Quay lại Vercel, bấm **Refresh** tại mục Domains.
   - Khi trạng thái chuyển sang tích xanh ✅ **Valid Configuration**, website đã chính thức chạy trên tên miền công ty với HTTPS an toàn.

---

## VI. BƯỚC 5: PUSH CODE ĐỂ VERCEL TỰ ĐỘNG BUILD LẠI

Mã nguồn cục bộ hiện có 15 commit cải tiến đã build test thành công 100%. Để đẩy lên Vercel:

```bash
git push origin main
```
Vercel sẽ tự động kích hoạt tiến trình Build & Deploy bản mới nhất trong vòng 1-2 phút!
---

## CHECKLIST GO-LIVE (làm theo thứ tự)

**A. Bảo mật — trước khi push**
- [ ] Đổi mật khẩu ứng dụng Gmail (SMTP) đã từng ghi trong tài liệu cũ.
- [ ] Tạo mới `JWT_SECRET` (`openssl rand -base64 48`), `CRON_SECRET` (`openssl rand -hex 32`), `ADMIN_REGISTER_KEY`.
- [ ] Đổi mật khẩu CSDL production (không dùng lại mật khẩu máy local).

**B. Vercel**
- [ ] Merge nhánh `golive-prep` vào `main`, push.
- [ ] Storage → tạo **Postgres** và **Blob**, Connect vào dự án (tự sinh `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`).
- [ ] Đặt đủ biến môi trường theo bảng ở mục IV (đặc biệt `JWT_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `SMTP_*`, `ENABLE_MOCK_OAUTH=false`).
- [ ] Import dữ liệu: `node scripts/restore_to_cloud_db.mjs "<DATABASE_URL>"`.

**C. Kiểm thử trên bản staging/preview**
- [ ] Đăng nhập admin; mở Đơn hàng, Tồn kho, chuyển kho một đơn thử.
- [ ] Tải ảnh sản phẩm từ admin → ảnh hiển thị (kiểm tra Blob).
- [ ] Đặt 1 đơn COD thử → nhận email xác nhận; trừ/giữ tồn kho đúng.
- [ ] Mở `/robots.txt`, `/sitemap.xml` (host phải là domain thật), `/test-email` phải bị chặn.
- [ ] Trang chủ, chi tiết sản phẩm, chi tiết combo không còn nhãn "Bản mẫu".

**D. Domain (làm sau cùng)**
- [ ] Gắn domain ở Cloudflare/Vercel theo mục V; kiểm tra HTTPS.
