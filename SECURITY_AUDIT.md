# Báo cáo kiểm toán bảo mật — Thái Sơn Foods

- Ngày: 11/11/2026
- Phạm vi: thư mục `D:\WebTSF\thai-son-foods`, nhánh đang mở `chore/cleanup` (HEAD `2d210cd`) **kèm các thay đổi chưa commit** trong thư mục làm việc. Đối chiếu thêm với `upstream/main` (`b27549b`, bản đang chạy trên Vercel).
- Cách làm: chỉ đọc. Không sửa, xóa hay commit file nào khác ngoài file này. Không cài gói mới. Không gửi mã nguồn hay secret ra dịch vụ ngoài.

> Lưu ý quan trọng: nhiều lỗ hổng dưới đây **đã có bản vá** trên nhánh `fix/nang-cap-nextjs` (51d9670) và `fix/lo-hong-bao-mat` (1edd556) — đã push lên upstream ngày 10/11 nhưng **chưa merge vào `main`** và chưa có trong nhánh `chore/cleanup`. Bản đang chạy (upstream/main) vẫn còn lỗ hổng.

---

## 1. Tóm tắt

| Mức độ | Số lượng | ID |
|---|---|---|
| Critical | 1 | C-1 |
| High | 3 | H-1, H-2, H-3 |
| Medium | 3 | M-1, M-2, M-3 |
| Low | 5 | L-1, L-2, L-3, L-4, L-5 |
| Info | 3 | I-1, I-2, I-3 |

**Việc cần làm ngay (theo thứ tự):**
1. C-1: commit `ENABLE_CUSTOM_COMBOS = false` (hiện chỉ có trong thư mục làm việc) và deploy. Bản đang chạy cho phép khách tự đặt giá combo.
2. H-3: kiểm tra `JWT_SECRET` trên Vercel và máy chủ công ty. Nếu trùng khóa trong `.env` máy dev (từng bị commit ở `6bb128d`) thì đổi ngay.
3. H-1: đổi mật khẩu PostgreSQL `postgres` (7 ký tự, đã nằm trong 22 file được commit lên 2 repo GitHub).
4. H-2: merge nhánh `fix/nang-cap-nextjs` (next 16.4.6, sharp 0.35.5, nodemailer 10.4.0, bỏ wildcard blob).
5. M-1, M-2: merge nhánh `fix/lo-hong-bao-mat`.

### Công cụ và skill đã dùng

| Công cụ / skill | Trạng thái | Ghi chú |
|---|---|---|
| Skill `security-review` (Claude Code) | Đã dùng làm khung | Skill được viết cho diff của 1 PR; ở đây diff là toàn bộ repo (4,8 MB) nên áp dụng phương pháp của skill (dựng ngữ cảnh → lần luồng dữ liệu → lọc false positive, chỉ giữ phát hiện tin cậy ≥ 8/10) bằng cách đọc code trực tiếp, không chạy sub-agent. |
| Agent `claude-security` | Có nhưng không chạy | Quét đa agent rất tốn token; brief yêu cầu ưu tiên chính xác. Có thể chạy sau nếu anh muốn. |
| Skill Trail of Bits (`semgrep`, `static-analysis`, `secrets`…) | Không có | Không cài trên máy. |
| Skill OWASP Top 10 / ASVS | Không có | Đối chiếu OWASP Top 10 2021 thủ công. |
| `semgrep --config auto` | Không chạy | Không có trên máy; `--config auto` tải rule và gửi số liệu ra ngoài, trái ràng buộc. |
| `gitleaks`, `trufflehog` | Không có | Thay bằng grep regex (khóa Google, Telegram, Vercel Blob, chuỗi kết nối Postgres, mật khẩu) trên file được theo dõi + `git grep` qua toàn bộ lịch sử cho từng giá trị secret trong `.env`. |
| `npm audit --package-lock-only` | Đã chạy | Chỉ gửi danh sách tên/phiên bản gói lên npm registry (không gửi code). |
| grep / đọc tay | Đã dùng | 105 route API, middleware, xác thực, đơn hàng, upload, OAuth, đối tác, cấu hình. |

### Những điểm đã kiểm tra và thấy ổn (không báo lỗi)
- Mọi route `/api/admin/*` đều gọi `getAdminSession()` **và** kiểm tra quyền `hasPermission()` (RBAC); không thấy route quản trị nào chỉ dựa vào đăng nhập.
- SQL: toàn bộ câu truy vấn dùng tham số `$n`; các chỗ ghép chuỗi (`admin/combos`, `admin/orders`, `reports/profit`, `admin/reviews`, `logRetention`) chỉ ghép tên cột/điều kiện cố định trong code.
- Đặt đơn (thư mục làm việc): giá sản phẩm lẻ, biến thể và combo cố định lấy từ DB; phí ship tính lại ở máy chủ; `userId` chỉ lấy từ cookie.
- Tra cứu đơn công khai: phải khớp mã đơn + SĐT, che PII, khóa sau nhiều lần sai.
- Upload: chỉ ảnh/mp4, tên file sinh ngẫu nhiên, kiểm tra magic byte, chặn SVG/HTML; phục vụ file qua `resolveInsideUploadRoot` (chống path traversal) + `nosniff`.
- JWT: HS256 qua `jose`, production từ chối khóa mặc định/yếu; token admin bị thu hồi khi đổi mật khẩu hoặc khóa tài khoản.
- CSRF: middleware kiểm tra Origin/Referer cho mọi POST/PUT/PATCH/DELETE; cron dùng `Authorization: Bearer` + `timingSafeEqual`.
- OAuth Google/Facebook có `state` chống CSRF; Google chỉ nhận email đã xác minh; mock OAuth tắt ở production.
- Đăng ký admin công khai bị chặn khi đã có admin; admin đầu tiên cần `ADMIN_REGISTER_KEY`.

---

## 2. Bảng phát hiện

| ID | Mức độ | Hạng mục (OWASP 2021) | File:dòng | Mô tả ngắn | Xác minh |
|---|---|---|---|---|---|
| C-1 | Critical | A04 Insecure Design | `src/config/features.ts:27` (HEAD, upstream/main); `src/app/api/orders/route.ts:328,358` (upstream/main) | Combo tự chọn dùng giá do trình duyệt gửi (0đ, âm) + số chai âm | CONFIRMED (đọc code; chưa thử trên site thật) |
| H-1 | High | A07 / A02 (lộ thông tin xác thực) | `scripts/init_webtsf_db.mjs:3`, `prisma/seed-stores.mjs:17` và 20 file khác | Mật khẩu siêu người dùng PostgreSQL 7 ký tự viết cứng, đã push lên GitHub | CONFIRMED |
| H-2 | High | A06 Vulnerable Components | `package.json:33`, `next.config.ts:48` | `next 16.3.5` (npm audit: critical), `sharp < 0.35.5` (librsvg), wildcard ảnh blob | CONFIRMED (phiên bản) / LIKELY (khai thác) |
| H-3 | High | A02 Cryptographic Failures / A07 | `next.config.ts:21` tại commit `6bb128d` (có trong upstream/main) | `JWT_SECRET` đang dùng ở `.env` từng bị commit làm giá trị dự phòng; ai có repo ký được token đăng nhập khách | CONFIRMED (lộ khóa) / LIKELY (phụ thuộc khóa production) |
| M-1 | Medium | A07 Identification & Auth Failures | `src/app/api/auth/register/route.ts:88-110`, `src/app/api/auth/callback/google/route.ts:75-90` | Chiếm trước tài khoản: đăng ký bằng email người khác (không xác minh), Google gộp vào tài khoản đó | CONFIRMED (luồng code) |
| M-2 | Medium (High khi bật Đối tác) | A01 Broken Access Control | `src/app/api/partner/register/route.ts:93-99,119` | Đăng ký đối tác gắn vào tài khoản bất kỳ có cùng email; mật khẩu mặc định `P@ss` + 4 số cuối SĐT | CONFIRMED (đang tắt bằng cờ) |
| M-3 | Medium | A04 Insecure Design | `src/app/api/orders/route.ts` (giữ kho), `src/lib/runtimeConfig.ts:33`, `.env` `TRUSTED_PROXY_COUNT=0` | Khách vô danh đặt đơn COD giữ kho 24h; sau proxy mọi khách chung 1 nhóm giới hạn | LIKELY |
| L-1 | Low | A07 | `src/lib/partner/otp.ts:45,61` | Mã OTP chủ `123456` hợp lệ khi `NODE_ENV !== 'production'` (chạy `npm run dev` qua LAN) | CONFIRMED (đang tắt bằng cờ) |
| L-2 | Low | A07 | `src/app/api/auth/callback/facebook/route.ts:66-73` | Facebook không có email → email giả `fb_<id>@facebook.user`, ai cũng đăng ký trước được | CONFIRMED (Facebook chưa có khóa nên chưa bật) |
| L-3 | Low | A08 / A07 | `src/lib/auth.ts:76-90,205-220` | Token admin và token khách cùng khóa ký, không có `aud`/`typ` | INFO (đã được giảm thiểu nhờ tra DB) |
| L-4 | Low | A02 Cryptographic Failures | `src/lib/db.ts:20,34` | Kết nối PostgreSQL từ xa bật TLS nhưng `rejectUnauthorized: false` | LIKELY (cần vị trí mạng trung gian) |
| L-5 | Low | A01 / A04 (lộ dữ liệu API) | `src/lib/reviews/repository.ts:805` qua `GET /api/reviews` | API đánh giá công khai trả `userId`, `orderId` của người đánh giá | CONFIRMED |
| I-1 | Info | A03 Injection (phòng thủ chiều sâu) | `src/app/san-pham/[slug]/page.tsx:432` | JSON-LD chèn bằng `dangerouslySetInnerHTML` không thoát `<` | INFO |
| I-2 | Info | A05 Security Misconfiguration | `next.config.ts:71` | CSP chỉ ở chế độ Report-Only | INFO |
| I-3 | Info | A07 | `scripts/qa_deep_test_suite.mjs:59`, `scripts/test_inventory_phase1.mjs:44`… | Mật khẩu tài khoản admin thử nghiệm viết cứng trong script | LIKELY đã vô hiệu (cần kiểm) |

---

## 3. Chi tiết từng phát hiện

### C-1 — Khách tự đặt giá combo tự chọn (Critical)

**Trạng thái:** HEAD `chore/cleanup` và `upstream/main` đều có `ENABLE_CUSTOM_COMBOS = true`. Thư mục làm việc đã đổi thành `false` nhưng **chưa commit**, nên bản deploy hiện tại vẫn bị.

`upstream/main:src/app/api/orders/route.ts`:
```ts
127  const price = Math.round(Number(item.price) || 0);          // giá từ body, nhận 0 hoặc âm
...
328  let itemPrice = rawItem.price;                               // mặc định = giá trình duyệt gửi
...
341  if (pId && (pId.startsWith('combo-') || pId.includes('combo'))) {
350    const comboRes = await client.query(`SELECT ... FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;`, [pId]);
354    if (comboRes.rows.length > 0) { itemPrice = comboRes.rows[0].sale_price; ... }
358    else if (!ENABLE_CUSTOM_COMBOS) { return 400 }            // cờ = true → bỏ qua, giữ giá client
```
`upstream/main:src/lib/inventory.ts` (`expandComboItems`): `combo-4-chai-<productId>:<qty>` → `parseInt(pQtyStr) || 1` nhận số âm.

**Cách khai thác:** gửi `POST /api/orders` (kèm `Origin` đúng site) với `items: [{ productId: "combo-4-chai-<id SP thật>:4", price: 0, quantity: 10 }]`, phương thức COD. Máy chủ tạo đơn 40 chai giá 0đ (hoặc giá âm làm giảm tổng đơn có sản phẩm khác). Số chai âm (`:-50`) làm giảm số "đang giữ" trong kho.

**Tác động:** mất doanh thu, sai sổ kho, đơn giả lọt qua nhân viên nếu không soát kỹ giá.

**Khắc phục:**
1. Ngay: commit thay đổi đang có trong thư mục làm việc và deploy:
   ```ts
   export const ENABLE_CUSTOM_COMBOS = false;
   ```
   (Thư mục làm việc cũng đã thêm `AND is_active = true` cho truy vấn combo — nên commit cùng.)
2. Lâu dài (trước khi bật lại combo tự chọn): máy chủ tự tính giá từ DB và chặn số lượng không hợp lệ:
   ```ts
   const pQty = Number.parseInt(pQtyStr, 10);
   if (!Number.isInteger(pQty) || pQty < 1 || pQty > 24) throw new Error('INVALID_COMBO_QTY');
   // itemPrice = tổng (giá DB của từng sản phẩm × pQty) − chiết khấu combo cấu hình ở máy chủ
   ```
   và từ chối mọi `price <= 0` từ client ở bước chuẩn hóa.

**CWE:** CWE-602 (Client-Side Enforcement of Server-Side Security), CWE-20, CWE-840.

---

### H-1 — Mật khẩu PostgreSQL viết cứng và đã lên GitHub (High)

```js
// scripts/init_webtsf_db.mjs:3
const password = 'Ts…';                      // (đã che)
// prisma/seed-stores.mjs:17
'postgresql://postgres:Ts…23@127.0.0.1:5432/WebTSF?sslmode=disable',
```
22 file được Git theo dõi chứa cùng mật khẩu, trùng `DB_PASSWORD` trong `.env` hiện tại. Mật khẩu chỉ 7 ký tự, theo mẫu dễ đoán (tên công ty + số). Repo được push lên `github.com/Hdang1904/thai-son-foods-1` và `github.com/quanhoangnguyendev23/thai-son-foods`.

**Cách khai thác:** ai đọc được repo (cộng tác viên, repo lỡ để public, máy dev bị lộ) có mật khẩu user `postgres` (siêu người dùng). Nếu máy chủ công ty dùng lại mật khẩu này hoặc mở cổng 5432 ra LAN, kẻ tấn công đọc/sửa/xóa toàn bộ dữ liệu khách hàng, đơn hàng, hash mật khẩu.

**Tác động:** lộ toàn bộ CSDL (PII khách), nếu là superuser còn có thể chạy lệnh hệ điều hành qua `COPY ... PROGRAM`.

**Khắc phục:**
1. Đổi mật khẩu `postgres` ở mọi máy đã dùng (`ALTER USER postgres WITH PASSWORD '<≥20 ký tự ngẫu nhiên>';`), tạo user riêng cho ứng dụng với quyền tối thiểu (không SUPERUSER).
2. Sửa script đọc từ biến môi trường:
   ```js
   const DB_URL = process.env.DATABASE_URL;
   if (!DB_URL) { console.error('Thiếu DATABASE_URL'); process.exit(1); }
   ```
3. Coi mật khẩu cũ là đã lộ vĩnh viễn (lịch sử Git không xóa được trên các bản clone); chỉ viết lại lịch sử nếu thật cần.
4. Đảm bảo PostgreSQL chỉ nghe `127.0.0.1` trên máy chủ production.

**CWE:** CWE-798 (Hard-coded Credentials), CWE-521 (Weak Password).

---

### H-2 — Thư viện có lỗ hổng đã công bố (High)

```json
// package.json:33
"next": "16.3.5",
```
```ts
// next.config.ts:46-49
remotePatterns: [ ..., { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' } ]
```
- `next 16.3.5`: npm audit báo **critical** GHSA-vcvr-r3jv-pc5j (RCE trong `next/og ImageResponse` — dự án **không dùng** `next/og` nên đường này không khai thác được), cùng GHSA-4jqv-mc3x-m676 (nhiễm độc cache SSG/ISR khi tự host — liên quan trực tiếp khi chạy trên máy chủ công ty) và GHSA-3w37-wq28-93x7.
- `sharp < 0.35.5` (đi kèm next): GHSA-wq5f-xc86-pv6w (librsvg). Kết hợp wildcard `*.public.blob.vercel-storage.com`, bất kỳ ai có kho Vercel Blob đều có thể đưa ảnh tùy ý vào bộ tối ưu ảnh `/_next/image` của site.
- `nodemailer 10.0.12`: lỗi phân tích địa chỉ (GHSA-8c8m…, GHSA-m943…, GHSA-85x2…) có thể gửi thư sang người nhận ngoài ý muốn nếu địa chỉ email do khách nhập.
- Lưu ý: `node_modules` trên máy đang là next 16.4.6 (cài từ nhánh vá) **lệch** với `package.json`. Bản build ở máy khác/CI/Vercel sẽ dùng 16.3.5.

**Khắc phục:** merge nhánh `fix/nang-cap-nextjs` (51d9670): next + eslint-config-next 16.4.6, nodemailer ^10.4.0, sharp 0.35.5, remotePatterns chỉ cho đúng mã kho blob của mình. Sau đó `npm ci` và build lại. Xem bảng ở mục 5.

**CWE:** CWE-1395 (Dependency on Vulnerable Third-Party Component).

---

### H-3 — Khóa ký JWT đang dùng từng bị commit vào Git (High)

```ts
// next.config.ts tại commit 6bb128d (18/10/2026), có trong upstream/main và đã push 2 remote
env: {
  JWT_SECRET: process.env.JWT_SECRET || '<khóa 96 ký tự, đã che>',
  ADMIN_REGISTER_KEY: process.env.ADMIN_REGISTER_KEY || '<đã che>',
  CRON_SECRET: process.env.CRON_SECRET || '<đã che>',
```
Commit `f2c414d` (19/10) đã gỡ giá trị khỏi code, nhưng giá trị vẫn nằm trong lịch sử. `JWT_SECRET` trong `.env` hiện tại **trùng đúng** khóa này (đã đối chiếu bằng `git grep` qua mọi commit).

**Cách khai thác (nếu production dùng khóa này):**
1. Lấy `userId` của khách bất kỳ từ `GET /api/reviews?productId=<sp>` (xem L-5).
2. Ký token HS256 `{ id: "<userId>" }` bằng khóa lộ, đặt vào cookie khách.
3. `getUserSession()` chỉ kiểm tra chữ ký và tài khoản có bị khóa hay không → đăng nhập như nạn nhân, xem `/api/user/orders` (họ tên, SĐT, địa chỉ, lịch sử mua), sửa hồ sơ qua `PUT /api/auth/me`.
Giả mạo admin khó hơn vì cần `id` admin (`admin_<ms>_<5 ký tự ngẫu nhiên>`, không lộ ra API công khai), nhưng khóa lộ đồng nghĩa không còn lớp bảo vệ nào nếu id đó bị lộ (log, ảnh chụp màn hình, xuất CSV).

**Tác động:** chiếm phiên mọi khách hàng có đánh giá; lộ PII.

**Khắc phục:**
1. Đặt `JWT_SECRET` mới (≥ 48 byte ngẫu nhiên) trên **mọi** môi trường đang chạy, kể cả Vercel; đổi luôn `CRON_SECRET`, `ADMIN_REGISTER_KEY`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. Không dùng lại khóa của `.env` máy dev cho production.
3. Kết hợp L-3 (thêm `aud`) và L-5 (bỏ `userId` khỏi API công khai).

**CWE:** CWE-798, CWE-321 (Use of Hard-coded Cryptographic Key), CWE-540.

---

### M-1 — Chiếm trước tài khoản qua đăng ký không xác minh email + gộp Google theo email (Medium)

```ts
// src/app/api/auth/register/route.ts:88-110 — không gửi email xác minh
'SELECT id FROM users WHERE email = $1 LIMIT 1;' ...
`INSERT INTO users (id, email, password_hash, ...)`
// src/app/api/auth/callback/google/route.ts:75-90
const existing = await query('SELECT id, is_active FROM users WHERE email = $1 LIMIT 1;', [email]);
if (existing.rows.length > 0) {
  userId = existing.rows[0].id;           // đăng nhập vào tài khoản có sẵn
  await query(`UPDATE users SET ... provider = 'google' ...`)   // password_hash giữ nguyên
}
```
**Cách khai thác:** kẻ tấn công đăng ký `victim@gmail.com` + mật khẩu của mình. Sau đó nạn nhân bấm "Đăng nhập bằng Google" → vào đúng tài khoản đó. Kẻ tấn công vẫn đăng nhập được bằng mật khẩu cũ, xem đơn hàng, địa chỉ, SĐT của nạn nhân.

**Tác động:** lộ PII và lịch sử mua hàng của khách (Google đang bật vì `.env` có `GOOGLE_CLIENT_ID`).

**Khắc phục:** merge `fix/lo-hong-bao-mat` (commit 36e9ed1 — `resolveOAuthAccount` vô hiệu mật khẩu cũ khi Google nhận tài khoản trùng email). Tốt hơn nữa là xác minh email khi đăng ký:
```ts
if (existing && existing.provider === 'local' && !existing.email_verified_at) {
  await query(`UPDATE users SET password_hash = $1, provider = 'google', provider_id = $2 WHERE id = $3`,
              [`oauth_google_${googleSub}`, googleSub, existing.id]);   // mật khẩu cũ mất hiệu lực
}
```
**CWE:** CWE-287, CWE-640.

---

### M-2 — Đăng ký Đối tác gắn vào tài khoản người khác (Medium; High khi bật chương trình Đối tác)

```ts
// src/app/api/partner/register/route.ts:93-99
const userRes = await client.query(
  `SELECT id, full_name, email, phone FROM users WHERE phone = $1 OR email = $2 LIMIT 1;`,
  [cleanPhone, cleanEmail]);                     // email lấy từ body, không xác minh
if (userRes.rows.length > 0) { userId = userRes.rows[0].id; ... }
// :119
const pwdHash = await hashPassword(password || `P@ss${cleanPhone.slice(-4)}`);
```
OTP chỉ chứng minh quyền với **SĐT của kẻ tấn công**, còn `email` là của nạn nhân → hồ sơ đối tác (và phiên cổng đối tác) gắn vào `user_id` của nạn nhân. Tài khoản mới không có mật khẩu sẽ nhận mật khẩu đoán được.

**Hiện trạng:** middleware trả 404 cho `/api/partner/*` khi `NEXT_PUBLIC_ENABLE_PARTNER_PROGRAM !== 'true'` (đang tắt), nên **chưa khai thác được**. Sẽ thành High ngay khi bật.

**Khắc phục:** merge `fix/lo-hong-bao-mat` (commit 4257982): gắn vào phiên đang đăng nhập; chưa đăng nhập mà SĐT/email đã tồn tại → 409; bắt buộc mật khẩu ≥ 8 ký tự có chữ và số.

**CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key), CWE-1393 (Default Password).

---

### M-3 — Giữ kho bằng đơn COD vô danh; giới hạn tần suất dùng chung (Medium)

- Đặt đơn không cần đăng nhập, COD; mỗi đơn giữ kho `RESERVATION_EXPIRY_HOURS` (24h) trong `stock_reservations`.
- Giới hạn "3 đơn chờ / SĐT" (`src/config/inventory.ts:19`) dựa trên SĐT do khách tự nhập → đổi SĐT là qua.
- `.env` có `TRUSTED_PROXY_COUNT=0`; khi chạy sau nginx, mọi khách vô danh rơi vào nhóm IP `"unknown"` (middleware tự cảnh báo ở dòng 16) → hoặc là một người làm đầy giới hạn chặn cả site, hoặc giới hạn theo IP không có tác dụng.

**Cách khai thác:** script gửi vài trăm đơn COD với SĐT ngẫu nhiên → hết hàng "khả dụng" trên site trong 24h; khách thật không đặt được.

**Khắc phục:** đặt `TRUSTED_PROXY_COUNT=1` trên máy chủ sau nginx (đã ghi trong ghi chú IT); giảm thời gian giữ kho cho đơn chưa xác nhận (ví dụ 2h); giới hạn số đơn chờ theo IP thật + theo thiết bị; cân nhắc OTP SĐT cho đơn COD giá trị lớn.

**CWE:** CWE-770, CWE-799.

---

### L-1 — Mã OTP chủ `123456` ngoài production (Low)

```ts
// src/lib/partner/otp.ts:45
if (process.env.NODE_ENV !== 'production' && inputCode === '123456') {
```
Nếu máy chủ/LAN chạy `npm run dev` (NODE_ENV=development) và bật chương trình Đối tác, ai cũng vượt OTP. Bản vá trên `fix/lo-hong-bao-mat` chỉ cho mã này khi `NODE_ENV === 'test'`.

Chế độ dev chạy qua LAN (`0.0.0.0:3000`) còn lộ thêm: `POST /api/orders` trả `debug` gồm thông điệp lỗi + 5 dòng stack (`src/app/api/orders/route.ts:1150`), và endpoint MCP của dev server Next (GHSA-39w2-rjm5-chcv). Khắc phục: trên máy dùng chung chỉ chạy `next build && next start` (NODE_ENV=production).

**CWE:** CWE-798, CWE-489 (Active Debug Code).

---

### L-2 — Email giả cho tài khoản Facebook không có email (Low)

```ts
// src/app/api/auth/callback/facebook/route.ts:66,71-73
const email = profile.email ? ... : `fb_${fbId}@facebook.user`;
'SELECT id, is_active FROM users WHERE email = $1 OR (provider = $2 AND provider_id = $3) LIMIT 1;'
```
Kẻ tấn công biết Facebook ID công khai của nạn nhân có thể đăng ký trước `fb_<id>@facebook.user` bằng form thường (form chỉ kiểm tra có `@`), rồi nạn nhân đăng nhập Facebook sẽ vào tài khoản đó. Facebook chưa có khóa trong `.env` nên chưa bật. Khắc phục: chỉ tra theo `provider_id`, không tra theo email giả; cấm đăng ký thường với đuôi `@facebook.user`. Nhánh `fix/lo-hong-bao-mat` đã bỏ liên kết theo email cho Facebook.

**CWE:** CWE-287.

---

### L-3 — Token admin và token khách dùng chung khóa ký (Low)

`signAdminToken` và `signUserToken` cùng ký HS256 bằng `JWT_SECRET`, không có `aud`/`typ`. Hiện **không khai thác được** vì `getAdminSession()` tra lại bảng `admin_users` theo `id` (id khách và admin sinh ngẫu nhiên khác nhau). Khuyến nghị thêm `setAudience('admin')` / `setAudience('user')` và kiểm `audience` khi `jwtVerify` để không phụ thuộc vào việc id không trùng.

**CWE:** CWE-1270 / CWE-345.

---

### L-4 — TLS tới PostgreSQL không kiểm chứng chỉ (Low)

```ts
// src/lib/db.ts:18-21
connectionString: rawDbUrl,
ssl: isRemoteUrl ? { rejectUnauthorized: false } : undefined,
```
Khi DB ở xa (Vercel → Supabase), kết nối được mã hóa nhưng không xác thực máy chủ, nên kẻ đứng giữa đường mạng có thể giả DB, đọc mật khẩu DB và dữ liệu. Khi DB nằm cùng máy (`127.0.0.1`) thì không ảnh hưởng. Khắc phục:
```ts
ssl: isRemoteUrl ? { rejectUnauthorized: true, ca: process.env.DB_CA_CERT } : undefined,
```
(Supabase cung cấp file CA tải về trong Settings → Database.)

**CWE:** CWE-295 (Improper Certificate Validation).

### L-5 — API đánh giá công khai trả `userId`, `orderId` (Low)

`GET /api/reviews?productId=...` trả nguyên `data.reviews` từ `getProductReviews()` (`src/lib/reviews/repository.ts:805` chọn `user_id AS "userId", order_id AS "orderId"`). Không cần đăng nhập. Riêng lẻ thì ít hại, nhưng là mắt xích để khai thác H-3 và làm lộ mã đơn nội bộ. Khắc phục: bỏ hai trường này khỏi response công khai:
```ts
data: data.reviews.map(({ userId, orderId, ...r }) => r),
```
**CWE:** CWE-200, CWE-213.

---

### I-1 — JSON-LD không thoát ký tự `<` (Info)

```tsx
// src/app/san-pham/[slug]/page.tsx:432
dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}   // chứa reviewBody, author.name của khách
```
Hiện an toàn vì `stripHtml` ở `src/app/api/reviews/route.ts:14` xóa mọi ký tự `<`. Nếu sau này đổi cách lọc (hoặc nhập đánh giá qua script/admin), chuỗi `</script>` sẽ thành XSS lưu trữ. Nên dùng:
```tsx
__html: JSON.stringify(jsonLd).replace(/</g, '\\u003c')
```
**CWE:** CWE-79.

### I-2 — CSP mới ở chế độ Report-Only (Info)
`next.config.ts:71` chỉ gửi `Content-Security-Policy-Report-Only`. Khi đã theo dõi đủ, chuyển sang `Content-Security-Policy` để chặn thật. **CWE-1021 / CWE-693.**

### I-3 — Mật khẩu admin thử nghiệm trong script (Info)
`scripts/qa_deep_test_suite.mjs:59`, `scripts/test_admin_product_edit_flow.mjs:8`, `scripts/test_inventory_phase1.mjs:44` có mật khẩu cho `admin`, `adminCH1`, `qa_staff_*` (dạng `Ad…3`, `Qa…d`). Script `scripts/golive_secure_admin_accounts.mjs` đặt lại mật khẩu ngẫu nhiên cho mọi tài khoản, nên nhiều khả năng đã vô hiệu. Cần kiểm trên DB production rằng script đó đã chạy và các tài khoản `qa_*` đã bị khóa/xóa. **CWE-798.**

---

## 4. Secret bị lộ (giá trị đã che)

| Secret | Vị trí | Trong Git? | Mức | Cách xử lý |
|---|---|---|---|---|
| Mật khẩu PostgreSQL `postgres` (`Ts…23`, 7 ký tự) | `.env`, `.env.production_backup`, **22 file tracked** trong `scripts/`, `prisma/` | **Có** (đã push 2 remote) | Cao | Đổi mật khẩu, tạo user ứng dụng ít quyền, sửa script đọc `DATABASE_URL` (xem H-1) |
| `JWT_SECRET` hiện tại (`0e3…fb`) | `.env` | **Có** — `next.config.ts` commit `6bb128d` (xem H-3) | Cao | Tạo khóa mới cho production: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; đổi khóa sẽ đăng xuất mọi người |
| Khóa JWT mặc định `tsf_super_secret_jwt_key_2026_thai_son_foods` | `src/lib/jwtSecret.ts:9` (cố ý, chỉ cho dev), `.env.production_backup` | Có | Thấp | Production đã từ chối khóa này. Xóa `.env.production_backup` khỏi máy khi không cần |
| `ADMIN_REGISTER_KEY` (`tsf…26`, dạng dễ đoán) | `.env`, `.env.production_backup` | **Có** — `next.config.ts` (`6bb128d`), `DEPLOY.md`, `register/route.ts` (đã gỡ ở bản hiện tại) | Thấp | Chỉ dùng khi bảng admin trống; đặt chuỗi ngẫu nhiên ≥ 32 ký tự trên production |
| `CRON_SECRET` (`sta…90`) | `.env` | **Có** — `next.config.ts` (`6bb128d`) và **vẫn còn** trong 4 file tracked: `scripts/qa_deep_test_suite.mjs`, `tests/phase6_readonly_checklist_verify.mjs`, `tests/security/pre_golive_security_regression.mjs`, `tests/test_cron_cleanup_http.mjs` | Trung bình | Production đặt chuỗi ngẫu nhiên mới |
| `GOOGLE_CLIENT_SECRET` (`GOC…2U`) | `.env` | Không | Thấp (chỉ trên máy) | Google Cloud Console → Credentials → OAuth client → "Reset secret" |
| `SMTP_PASS` (`vuja…ejp`, mật khẩu ứng dụng Gmail) | `.env`, `.env.production_backup` | **Có** — `DEPLOY.md` từ commit `e0931c6` (13/10) đến `f2c414d` (19/10) | Cao (ai có repo gửi được mail mạo danh công ty) | Tài khoản Google → Bảo mật → Mật khẩu ứng dụng → thu hồi và tạo mới |
| `ZALO_BOT_TOKEN` (`4077…jmD`) | `.env` | Không | Thấp (chỉ trên máy) | Zalo Bot Platform → tạo lại token |
| `TELEGRAM_BOT_TOKEN` (`9246…0FA`) | `.env.local` | Không | Thấp (chỉ trên máy) | BotFather → `/revoke` → cập nhật biến môi trường (cả Vercel) |

Ghi chú: `.gitignore` đã chặn `.env*` (trừ `.env.example`); hiện không có file `.env` nào được Git theo dõi.

---

## 5. Dependency có lỗ hổng (npm audit, 37 mục: 1 critical, 20 high, 15 moderate, 1 low)

| Gói | Phiên bản hiện tại | Lỗ hổng chính | Nâng lên | Ảnh hưởng runtime |
|---|---|---|---|---|
| `next` (trực tiếp) | 16.3.5 | GHSA-vcvr-r3jv-pc5j (critical, next/og — không dùng), GHSA-4jqv-mc3x-m676 (cache poisoning tự host), GHSA-3w37-wq28-93x7, GHSA-39w2-rjm5-chcv (dev MCP) | **16.4.6** | Có |
| `sharp` (qua next) | < 0.35.5 | GHSA-wq5f-xc86-pv6w (librsvg, high) | **0.35.5** | Có (tối ưu ảnh) |
| `nodemailer` (trực tiếp) | 10.0.12 | GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w, GHSA-85x2-q946-cp5h, GHSA-4ffr-jq9g-5ffx | **≥ 10.4.0** | Có (email đơn hàng) |
| `@vercel/blob` (trực tiếp) | 2.8.2 | kéo theo `undici < 7.30.1` (GHSA-4w7w-5xrc-9h26 cache poisoning, high), `zod < 4.6.6`, `@vercel/oidc` | Theo dõi bản mới; npm đề xuất hạ về 2.4.0 (không khuyến nghị) | Có khi dùng Blob |
| `prisma` (trực tiếp, CLI) | 8.0.0-rc.15 | kéo theo `hono`, `@hono/node-server`, `lodash` (GHSA-r5fr-rjxr-66jc), `chevrotain`, `vitest`… | Dùng bản ổn định khi phát hành (npm đề xuất 7.10.1) | Không (chỉ CLI/dev) |
| `typescript-eslint`, `vite`, `source-map-js`, `fast-xml-parser`, `glob`, `minimatch` | — | moderate/low/high trong công cụ dev | `npm audit fix` | Không |

Bản vá cho 3 dòng đầu đã có ở nhánh `fix/nang-cap-nextjs`.

---

## 6. Những gì KHÔNG quét được

- **Không chạy semgrep, gitleaks, trufflehog:** không có trên máy, không cài theo ràng buộc. Thay bằng grep regex và `git grep` theo giá trị; có thể bỏ sót secret định dạng lạ hoặc đã bị xóa khỏi `.env`.
- **Không thử khai thác trên site thật hay DB:** mọi trạng thái CONFIRMED là xác minh bằng đọc luồng code, không gửi request tấn công.
- **Không kiểm cấu hình máy chủ production** (nginx, tường lửa, PostgreSQL `listen_addresses`, biến môi trường thật trên Vercel/máy chủ công ty).
- **Các mục đã báo ngày 09/11 nhưng thuộc chương trình Đối tác đang tắt** (rút tiền bỏ qua 7 ngày đối soát, phí ship đại lý âm, phiên đối tác bỏ qua khóa tài khoản): không đọc lại chi tiết lần này; mục rút tiền đã vá trên `fix/lo-hong-bao-mat`.
- **Thư mục bỏ qua:** `node_modules/`, `.next/`, `_backup/` (bản sao giao diện cũ, không chạy), `docs/golive/patches/`, `patches/` (file diff), `scripts/backups/` (bản sao lưu DB, chưa tracked), ảnh/PDF/`.docx`/`Thumbs.db` (nhị phân), `src/data/hcm-*.ts` và `vietnam-*.ts` (dữ liệu sinh tự động).
- **Script trong `scripts/`:** chỉ quét secret, không đánh giá logic (chạy tay bởi dev, không nhận input từ người dùng web).
