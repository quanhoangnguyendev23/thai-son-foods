# Deploy ô địa chỉ mới (vòng 3 → 5)

Áp dụng cho bản có thư viện `src/lib/address/`, kiểm tra phường sau khi đặt, xác nhận ghim địa chỉ đã lưu và đường lui "Cần gọi xác nhận vị trí".

Từ bản này, **production không tự sửa lược đồ DB lúc chạy** (`initDatabase()` bỏ qua CREATE/ALTER khi `NODE_ENV=production`). Mọi thay đổi lược đồ đi qua file trong `scripts/migrations/`. Deploy trước migration thì **mọi đơn mới sẽ lỗi** (thiếu cột `location_check`…).

**Production = server công ty (thaisonfood.tsf.com.vn).** Vercel (thai-son-foods.vercel.app) chỉ là bản chạy tạm cho mọi người xem thử trên điện thoại, không phải production; dùng nó làm môi trường preview được.

Chuỗi kết nối chỉ đặt trong biến môi trường của phiên terminal (`PROD_DATABASE_URL` = tài khoản có quyền ALTER), không ghi vào file.

## Thứ tự

### Bước 1. Sao lưu DB production

```bash
pg_dump "$PROD_DATABASE_URL" -Fc -f backups/prod_truoc_dia_chi_$(date +%Y%m%d_%H%M).dump
pg_restore -l backups/prod_truoc_dia_chi_*.dump | head
```

File phải có dung lượng > 0 và `pg_restore -l` đọc được. Chưa có bản sao lưu đọc được thì dừng.

### Bước 2. Migration (theo đúng thứ tự)

Xem trước, không chạy gì: `npx tsx scripts/schema_bootstrap_dry_run.mjs --since b27549b` in các câu mà production (bản 04/11) còn thiếu.

```bash
DATABASE_URL="$PROD_DATABASE_URL" node scripts/apply_address_round3_migration.mjs --round 3
DATABASE_URL="$PROD_DATABASE_URL" node scripts/apply_address_round3_migration.mjs --round 4
DATABASE_URL="$PROD_DATABASE_URL" node scripts/apply_address_round3_migration.mjs --round catchup
```

| File | Nội dung |
|---|---|
| `address_round3_schema.sql` | `orders.address_source`, `address_precision`, `provider_place_id`, `location_check` + bảng `address_events` |
| `address_round4_schema.sql` | `users.address_pin_confirmed_at`, `address_pin_lat`, `address_pin_lng`, `address_pin_snapshot` |
| `bootstrap_catchup_20261106_schema.sql` | Phần các luồng khác từng nhờ bộ khởi tạo tự tạo: 3 cột giờ giao + chỉ mục, bảng `order_status_history` + trigger + chép lịch sử cũ từ `audit_logs` |

Mỗi lệnh chạy trong một giao dịch (lỗi là hoàn tác cả file). Mọi câu đều `IF NOT EXISTS`: chạy lại không hỏng, không sửa dữ liệu có sẵn. Kiểm tra sau bước này: `npx tsx scripts/schema_bootstrap_dry_run.mjs` không còn câu nào production thiếu (so bằng `\d orders`, `\d users`, `\dt address_events`, `\dt order_status_history`).

### Bước 3. Biến môi trường trên server công ty (và bản preview)

Đặt trong file môi trường của dịch vụ chạy web trên server (không commit), và giống vậy ở bản preview.

| Biến | Bắt buộc | Giá trị / ghi chú |
|---|---|---|
| `DB_SCHEMA_BOOTSTRAP` | không | **Để trống.** Chỉ đặt `1` tạm thời cho DB mới tinh, xong thì xóa. |
| `GEO_PROVIDER` | không | `photon` (mặc định). `google` chỉ khi có khóa. |
| `PHOTON_BASE_URL` | không | Trống = Photon công cộng `https://photon.komoot.io` (bản đầu dùng cái này, có giới hạn lượt gọi). |
| `GEO_TIMEOUT_MS` | không | Mặc định `2000`. |
| `GEO_APP_NAME` | nên có | Tên app trong User-Agent gửi Photon/Nominatim/OSRM, vd `ThaiSonFoods`. |
| `GEO_SITE_URL` | nên có | `https://thai-son-foods.vercel.app` (hoặc tên miền thật). |
| `GEO_CONTACT_EMAIL` | nên có | Hộp thư công ty để OSM liên hệ (chính sách Nominatim yêu cầu). |
| `NEXT_PUBLIC_MAP_SATELLITE` | không | **Để trống.** Chỉ đặt `1` khi đã mua giấy phép thương mại của Esri (xem mục "Ảnh bản đồ"). |
| `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | không | Chỉ khi chuyển sang Google. |
| `CRON_SECRET` | **có** | Route `/api/cron/cleanup-reservations` dọn `address_events` > 30 ngày; thiếu biến này route trả 500 và không dọn. Lịch trong `vercel.json` chỉ chạy trên Vercel: **trên server công ty phải tự đặt lịch** (Task Scheduler / cron) gọi mỗi ngày một lần, xem mục "Lịch dọn trên server công ty". |

### Bước 4. Deploy preview

Bản preview: Vercel (bản xem thử) hoặc một cổng/thư mục riêng trên server công ty. **Preview dùng chung DB nào thì DB đó phải đã qua bước 2** (nếu preview trỏ vào DB production thì đặt hàng thử ở preview là tạo đơn thật: dùng tài khoản test và xóa sau).

### Bước 5. Tester kiểm trên preview

1. Thanh toán: gõ "Lê Lợi" (chưa ghi khu) → 4 mục đầu ở 4 quận cũ khác nhau, có Gò Vấp; tên gần giống có nhãn "Tên gần giống".
2. Chọn gợi ý → bản đồ mở, dòng "Ghim đang ở P. …" hiện sau khi thả ghim; xác nhận rồi đặt đơn.
3. Admin: đơn có "Nguồn vị trí", "Độ chính xác"; vài giây sau có "Kiểm tra phường".
4. Tài khoản: lưu địa chỉ có xác nhận ghim → thanh toán không hỏi ghim lại; sửa một chữ trong địa chỉ → bị hỏi lại.
5. Đường lui: chặn mạng tới `tile.openstreetmap.org` (DevTools → Network → Block request domain) → hiện ô "Bản đồ đang không dùng được…", đặt được (chỉ COD) → admin thấy "⚠ CẦN GỌI XÁC NHẬN VỊ TRÍ"; chuyển "Đang giao" bị chặn cho tới khi bấm "Đã gọi xác nhận" (sửa phí được, tổng tiền đổi theo).
6. Log máy chủ không có `column ... does not exist`.
7. Xóa đơn thử theo quy trình xóa đơn test.

### Bước 6. Deploy production (server công ty)

Merge vào nhánh chính theo quy trình phát hành, kéo về server, `npm ci && npm run build`, khởi động lại dịch vụ web. Ghi lại commit đang chạy trước đó để quay lại khi cần.

### Bước 7. Theo dõi 3 ngày

Mỗi ngày một lần:
- Log dịch vụ web trên server: lọc `LOCATION_UNCONFIRMED`, `NEEDS_CALL_COD_ONLY`, `[Geo Autocomplete]`, `[Photon]`, `429`, `column`.
- Quét chỉ đọc (chỉ in số đếm): `PROD_SCAN_DATABASE_URL=... npx tsx scripts/scan_address_mismatch.mjs --prod`. Số đơn lệch phường, (0,0) và thiếu tọa độ không được tăng bất thường.
- Admin: đơn "Cần gọi xác nhận vị trí" đều đã được gọi trong ngày.
- Lịch dọn hằng ngày trả 200, log có `addressEventsDeleted`.

## Hoàn tác

- **Chỉ code:** trên server, checkout commit đang chạy trước đó, build và khởi động lại. Cột mới để lại không ảnh hưởng bản cũ. Đây là cách nên dùng.
- **Cả lược đồ** (chỉ khi thật cần, sau khi đã hoàn tác code), ngược thứ tự:
  ```bash
  DATABASE_URL="$PROD_DATABASE_URL" node scripts/apply_address_round3_migration.mjs --round catchup --rollback
  DATABASE_URL="$PROD_DATABASE_URL" node scripts/apply_address_round3_migration.mjs --round 4 --rollback
  DATABASE_URL="$PROD_DATABASE_URL" node scripts/apply_address_round3_migration.mjs --round 3 --rollback
  ```
  Mất dữ liệu ở các cột/bảng đó (lịch sử trạng thái, giờ hẹn giao, kiểm tra phường, xác nhận ghim, `address_events`); đơn vẫn còn. Bản cũ 04/11 tự tạo lại bảng lịch sử khi chạy, nên thường không cần hoàn tác `catchup`.
- Hỏng nặng: khôi phục bản sao lưu bước 1 (`pg_restore --clean`), chỉ làm khi đã dừng nhận đơn.

## Ảnh bản đồ

- **Đường phố:** `https://tile.openstreetmap.org` (máy chủ tình nguyện của OSM). Đã có ghi công "© OpenStreetMap" ở cả 3 bản đồ; trình duyệt gửi Referer là tên miền site (`strict-origin-when-cross-origin`). OSM không cam kết hoạt động và có thể chặn site lưu lượng lớn; bản đồ lỗi thì khách vẫn đặt được qua đường lui. Khi đơn tăng: MapTiler / Stadia Maps (có gói miễn phí) hoặc tự dựng tile, đổi URL ở 3 chỗ `L.tileLayer`.
- **Vệ tinh (Esri World Imagery):** điều khoản Esri cho phép miễn phí chỉ với dùng phi thương mại; dùng thương mại "requires a separate license and license fee" (Esri Web Site and Service Terms of Use, mục 2.2–2.2.1). Site bán hàng là thương mại nên **nút Vệ tinh đã ẩn mặc định**. Muốn bật: mua gói ArcGIS Location Platform / giấy phép Esri, đặt `NEXT_PUBLIC_MAP_SATELLITE=1`, giữ dòng ghi công "Tiles © Esri — Source: Esri, …" và thêm "Powered by Esri" theo hướng dẫn ghi công của Esri.

## Lịch dọn trên server công ty

Gọi mỗi ngày một lần (vd 7:00), khóa lấy từ biến môi trường của server, không ghi vào lệnh lưu trong lịch:

```bash
curl -fsS -X GET -H "Authorization: Bearer $CRON_SECRET" https://thaisonfood.tsf.com.vn/api/cron/cleanup-reservations
```

Windows: Task Scheduler chạy PowerShell `Invoke-RestMethod -Uri https://thaisonfood.tsf.com.vn/api/cron/cleanup-reservations -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }`. Route nhận GET.
