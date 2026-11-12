# Hướng dẫn triển khai an toàn trên máy chủ công ty (IIS + Next.js)

Tài liệu cho bộ phận IT. Áp dụng cho các mã lỗi **DBG-01** (chạy sai chế độ) và **HTTPS-01** (chạy HTTP) trong báo cáo bảo mật.

Mô hình: trình duyệt → **IIS** (cổng 80/443, file `web.config` trong repo) → **Next.js** ở `127.0.0.1:3000`.

Làm **đúng thứ tự** A → B → C. Phần C **chỉ** làm khi IIS đã có HTTPS chạy ổn định.

> Mọi giá trị trong file mẫu `.env.production.example` chỉ là chỗ giữ chỗ. Không chép khóa/mật khẩu thật vào repo hoặc gửi qua chat.

---

## Phần A — Chạy đúng chế độ production (DBG-01)

Vì sao: khi chạy `npm run dev` (hoặc `NODE_ENV` khác `production`), web trả chi tiết lỗi (cả câu SQL), chấp nhận mã OTP thử và tắt cookie Secure.

1. Trên máy chủ, mở thư mục ứng dụng, cập nhật mã nguồn mới nhất.
2. Tạo file `.env` (hoặc biến môi trường của dịch vụ Windows / PM2) theo mẫu `.env.production.example`. Ở bước này **giữ tạm**:
   - `NODE_ENV=production`
   - `APP_ENV=production` (nếu lỡ chạy sai chế độ, app dừng ngay khi khởi động thay vì chạy tiếp)
   - `TRUSTED_PROXY_COUNT=0` (đổi ở Phần B)
   - `COOKIE_SECURE=false`, `NEXT_PUBLIC_APP_URL` và `ALLOWED_ORIGINS` vẫn là địa chỉ `http://...` đang dùng (đổi ở Phần C)
   - `OTP_TEST_CODE` **để trống** (chỉ dùng cho test tự động, không bao giờ đặt trên máy chủ thật)
3. Cài và build:
   ```bat
   npm ci
   npm run build
   ```
4. Chạy bằng script mới:
   ```bat
   npm run start:prod
   ```
   `start:prod` = `next start -H 127.0.0.1 -p 3000`: Next.js chỉ nghe trên máy chủ, mọi truy cập phải đi qua IIS.
   Script `npm start` cũ (`-H 0.0.0.0`, nghe mọi địa chỉ) vẫn giữ nguyên để dùng khi thử trong LAN.
   - **Không** dùng `npm run dev` trên máy chủ thật.
   - Nếu chạy bằng dịch vụ Windows / PM2 / NSSM: đổi lệnh khởi động thành `npm run start:prod` và đặt biến `NODE_ENV=production` trong cấu hình dịch vụ.
5. Kiểm tra log khởi động: **không** được có dòng bắt đầu bằng `[DBG-01]` hay `CRITICAL PRODUCTION CONFIGURATION ERRORS`.
6. Mở web qua IIS (`http://<IP-hoặc-tên-miền>/`) → trang chủ, đăng nhập admin, đặt thử 1 đơn đều chạy.

Lưu ý: sau bước 4, `http://<IP>:3000` từ máy khác **không vào được nữa** (đúng mong muốn). Ai đang dùng địa chỉ này phải chuyển sang địa chỉ qua IIS.

---

## Phần B — Chặn cổng 3000 từ bên ngoài, rồi mới đặt TRUSTED_PROXY_COUNT

Vì sao: app chỉ tin header `X-Forwarded-For` (IP khách) khi `TRUSTED_PROXY_COUNT=1`. Nếu cổng 3000 vẫn mở ra ngoài, kẻ xấu gửi thẳng vào cổng 3000 kèm IP giả để né khóa đăng nhập / giới hạn số lần thử.

1. Chặn cổng 3000 chiều vào từ mọi máy khác:
   - Windows Firewall (PowerShell chạy quyền Administrator):
     ```powershell
     New-NetFirewallRule -DisplayName "Chan Next.js 3000 tu ben ngoai" -Direction Inbound -Protocol TCP -LocalPort 3000 -RemoteAddress Any -Action Block
     ```
     Nếu đã có rule cho phép cổng 3000 trước đây (dùng cho thử LAN), tắt hoặc xóa rule đó.
   - Nếu máy chủ nằm sau tường lửa mạng / Azure NSG / router: xóa rule mở cổng 3000 ở đó.
2. Kiểm tra từ **một máy khác** trong mạng: `Test-NetConnection <IP-may-chu> -Port 3000` → phải báo `TcpTestSucceeded : False`.
3. Kiểm tra IIS có gắn `X-Forwarded-For`: IIS Manager → máy chủ → **Application Request Routing Cache** → **Server Proxy Settings** → ô **Preserve client IP in the following header** = `X-Forwarded-For` (bật).
4. **Chỉ sau khi bước 2 đạt**: đổi `TRUSTED_PROXY_COUNT=1`, khởi động lại app.
5. Kiểm tra: nhập sai mật khẩu admin 5 lần từ một máy → máy đó bị khóa, máy khác vẫn đăng nhập bình thường.

Nếu trước IIS còn một lớp proxy / cân bằng tải khác, báo lập trình viên để đặt số lớp đúng (không tự đặt lớn hơn 1).

---

## Phần C — Bật HTTPS (CHỈ làm khi IIS đã có HTTPS)

> **CẢNH BÁO:** sau phần này, truy cập bằng `http://IP` hoặc `http://IP:3000` sẽ **không đăng nhập được nữa** (cookie chỉ gửi qua HTTPS, `http://` bị chuyển sang `https://`). Mọi người phải dùng `https://<tên-miền>`. Báo trước cho người dùng nội bộ.

Điều kiện trước khi làm:
- Đã có tên miền trỏ về máy chủ.
- Đã cài chứng chỉ TLS hợp lệ (không phải chứng chỉ tự ký) và thêm **binding HTTPS cổng 443** cho site trong IIS.
- Mở `https://<tên-miền>/` thấy trang chủ, trình duyệt không báo lỗi chứng chỉ.

Các bước:
1. `X-Forwarded-Proto`: `web.config` đã tự lấy đúng scheme của request (rule `ReverseProxyToNextJs`). Không cần sửa. Nếu IIS báo lỗi 500.50 "server variable not allowed", vào **URL Rewrite** → **View Server Variables** → thêm `HTTP_X_FORWARDED_PROTO`.
2. Bật chuyển hướng HTTP → HTTPS: trong `web.config`, rule `RedirectHttpToHttps`, đổi `enabled="false"` thành `enabled="true"` (hoặc IIS Manager → URL Rewrite → chọn rule → **Enable Rule**).
3. HSTS (bắt trình duyệt luôn dùng HTTPS):
   - Ứng dụng đã tự gửi `Strict-Transport-Security: max-age=63072000; includeSubDomains` khi chạy production. `includeSubDomains` ép **mọi tên miền con** của tên miền công ty phải dùng HTTPS.
   - Nếu IT **đồng ý** điều đó: không cần làm gì thêm.
   - Nếu IT **không đồng ý**: bật rule `HstsOnlyOnHttps` trong `web.config` (`enabled="true"`). Rule này thay header bằng `max-age=31536000` (không có `includeSubDomains`), chỉ trên response HTTPS.
   - Khi trình duyệt đã nhận HSTS, nó nhớ trong thời hạn trên; tắt HTTPS sau đó sẽ khiến khách không vào được web. Chỉ bật khi chắc chắn giữ HTTPS lâu dài.
4. Sửa biến môi trường của app:
   - `NEXT_PUBLIC_APP_URL=https://<tên-miền>`
   - `ALLOWED_ORIGINS=https://<tên-miền>` (bỏ các địa chỉ IP / localhost / `http://`)
   - `GEO_SITE_URL=https://<tên-miền>`
   - `COOKIE_SECURE=true`
5. Vì `NEXT_PUBLIC_APP_URL` được đóng vào bản build: chạy lại `npm run build`, rồi khởi động lại `npm run start:prod`.
6. Cập nhật đường dẫn chuyển hướng OAuth ở Google Cloud Console / Meta for Developers sang `https://<tên-miền>/api/auth/callback/...` (nếu dùng đăng nhập Google/Facebook).

---

## Phần D — Hoàn tác (rollback)

| Tình huống | Cách hoàn tác |
|---|---|
| Sau Phần A web không chạy | Xem log. Lỗi `[DBG-01]` → kiểm tra `NODE_ENV=production`. Cần chạy tạm như cũ: bỏ `APP_ENV`, chạy `npm start`. |
| Sau Phần B không đăng nhập được / bị khóa hàng loạt | Đặt lại `TRUSTED_PROXY_COUNT=0`, khởi động lại app. Kiểm tra lại cấu hình `X-Forwarded-For` của IIS. |
| Cần mở lại cổng 3000 để thử LAN | `Disable-NetFirewallRule -DisplayName "Chan Next.js 3000 tu ben ngoai"`. Trước đó **phải** đặt `TRUSTED_PROXY_COUNT=0`. |
| Sau Phần C bị vòng lặp chuyển hướng / lỗi chứng chỉ | Tắt rule `RedirectHttpToHttps` (`enabled="false"`), đặt `COOKIE_SECURE=false`, `NEXT_PUBLIC_APP_URL` / `ALLOWED_ORIGINS` về địa chỉ `http://` cũ, build lại, khởi động lại. |
| Đã bật HSTS rồi phải tắt HTTPS | Không hoàn tác ngay được phía trình duyệt khách (họ nhớ đến hết `max-age`). Tránh tình huống này: chỉ bật HSTS khi HTTPS đã ổn định. |

---

## Phần E — Danh sách kiểm tra sau triển khai

- [ ] Log khởi động không có `[DBG-01]` và không có `CRITICAL PRODUCTION CONFIGURATION ERRORS`.
- [ ] App chạy bằng `npm run start:prod` (hoặc dịch vụ gọi lệnh này), không phải `npm run dev`.
- [ ] Từ máy khác: `Test-NetConnection <IP> -Port 3000` → `False`.
- [ ] `TRUSTED_PROXY_COUNT=1` **chỉ** khi dòng trên đạt.
- [ ] `OTP_TEST_CODE` trống trên máy chủ.
- [ ] (Sau Phần C) `http://<tên-miền>/` tự chuyển sang `https://<tên-miền>/`.
- [ ] (Sau Phần C) Đăng nhập admin, F12 → Application → Cookies: cookie `tsf_admin_token` có cờ **Secure** và **HttpOnly**.
- [ ] (Sau Phần C) F12 → Network → response trang chủ có header `Strict-Transport-Security`.
- [ ] Đặt thử 1 đơn, đăng nhập Google/Facebook (nếu bật) chạy bình thường.
- [ ] Gửi một URL lỗi (ví dụ `/api/khong-ton-tai`): không thấy câu SQL hay stack trace trong phản hồi.
