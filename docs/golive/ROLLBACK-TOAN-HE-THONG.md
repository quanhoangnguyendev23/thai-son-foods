# Rollback toàn hệ thống — Thái Sơn Foods

Xử lý F-03 trong `docs/golive/RA-SOAT-GOLIVE-2026-11-14.md`. Áp dụng cho production trên máy chủ công ty (IIS + Next.js + PostgreSQL).
Liên quan: `docs/golive/CUTOVER.md` (dựng production, smoke test mục 7), `HUONG_DAN_TRIEN_KHAI.md` Phần D (rollback cấu hình IIS/proxy/HTTPS).

Công cụ:
- `scripts/sao_luu_db.ps1` — sao lưu DB (pg_dump custom) + ảnh tải lên, giữ 14 bản mới nhất, tự kiểm bản dump đọc được.
- `scripts/khoi_phuc_db.ps1` — khôi phục bản `.dump` sang **DB mới** (không ghi đè DB đang chạy), tuỳ chọn đối soát số dòng từng bảng.
- `scripts/backup_db.sh` — bản cũ cho Linux, giữ nguyên.

---

## 1. Vai trò

| Vai trò | Ai | Việc |
|---|---|---|
| Người quyết định rollback | ❓ (chủ doanh nghiệp hoặc người được uỷ quyền) | Quyết định có rollback hay không, ở cấp nào (mục 3) |
| Người thực hiện | ❓ IT | Chạy các bước rollback trên máy chủ |
| Hỗ trợ kỹ thuật | ❓ Dev | Chẩn đoán, chọn bản code / bản backup, kiểm tra sau rollback |
| Đầu mối cửa hàng | ❓ Quản lý cửa hàng | Nhận đơn qua hotline khi shop tạm dừng, gọi lại khách |

Điền tên + số điện thoại trước ngày golive. Người quyết định phải liên lạc được trong 15 phút suốt giờ bán (07:00–16:30).

---

## 2. Tiêu chí kích hoạt rollback

| # | Tình huống | Ngưỡng kích hoạt | Cấp rollback (mục 3) |
|---|---|---|---|
| T1 | Khách không đặt được đơn (lỗi khi bấm Đặt hàng, trang thanh toán lỗi/trắng) | Kéo dài > 15 phút, hoặc > 3 khách báo trong 30 phút | Cấp 1 ngay; nếu nguyên nhân là bản code mới → Cấp 2 |
| T2 | Sai tiền trên đơn (tổng, giá, phí ship, tiết kiệm khác giá niêm yết) | 1 đơn sai đã xác minh | Cấp 1 ngay; Cấp 2 nếu do bản code mới |
| T3 | Sai tồn kho trên đơn (trừ sai số chai, tồn âm, giữ chỗ không trả) | 1 đơn sai đã xác minh và lặp lại được | Cấp 1; Cấp 2 nếu do bản code mới |
| T4 | Mất / hỏng dữ liệu (đơn biến mất, đơn bị ghi đè, bảng bị xoá, migration lỗi giữa chừng) | Bất kỳ | Cấp 1 ngay, Cấp 3 sau khi Dev xác nhận phạm vi |
| T5 | Lộ dữ liệu hoặc lỗ hổng đang bị khai thác (thấy đơn/thông tin khách người khác, đăng nhập admin lạ) | Bất kỳ | Cấp 1 ngay, đổi secret (`docs/golive/F-02-SECRET-PRODUCTION.md`), rồi xử lý |
| T6 | Web không truy cập được (5xx, quá chậm > 10 giây/trang) | > 15 phút sau khi đã khởi động lại app 1 lần | Cấp 1; xem log trước khi Cấp 2 |
| T7 | Báo đơn Zalo/Telegram không tới | > 30 phút | **Không** rollback: cửa hàng mở trang admin theo dõi đơn, Dev sửa khoá/kết nối |
| T8 | Lỗi giao diện nhỏ, sai chữ, ảnh lệch | — | **Không** rollback, sửa ở bản sau |

Nguyên tắc: nghi ngờ thì làm **Cấp 1** trước (ẩn shop, không mất dữ liệu), rồi mới chẩn đoán.

---

## 3. Các cấp rollback

### Cấp 1 — Tạm dừng bán trên web (≈ 5 phút, không mất dữ liệu)

| # | Bước | Người làm | Kiểm tra đạt |
|---|---|---|---|
| 1.1 | Ẩn/đổi nút "CỬA HÀNG" trên thaisonfoods.vn thành thông báo "Đặt hàng qua hotline …" | Người quản trị web chính | Bấm nút không vào được shop |
| 1.2 | Báo cửa hàng nhận đơn qua hotline/Zalo | Đầu mối cửa hàng | Cửa hàng xác nhận đã nhận tin |
| 1.3 | Xuất Excel đơn hàng hôm nay trong admin (giữ lại bằng chứng, phục vụ gọi lại khách) | Đầu mối cửa hàng | Có file Excel |

### Cấp 2 — Quay về bản code trước (≈ 20–30 phút, không đụng DB)

Dùng khi lỗi do bản code mới và bản mới **không** chạy migration làm đổi DB (hoặc migration chỉ thêm cột/bảng — bản cũ vẫn chạy được).

| # | Bước | Người làm | Kiểm tra đạt |
|---|---|---|---|
| 2.1 | Ghi lại commit đang chạy: `git log -1 --format="%h %s"` | IT | Có mã commit |
| 2.2 | Lấy commit đã chạy ổn trước đó (ghi ở sổ triển khai, hoặc tag `release-yyyymmdd`) | Dev | Dev xác nhận mã commit |
| 2.3 | Dừng dịch vụ app (NSSM/PM2) | IT | `http://127.0.0.1:3000` không phản hồi |
| 2.4 | `git checkout <commit-cũ>` → `npm ci` → `npm run build` | IT | Build không lỗi |
| 2.5 | Khởi động lại dịch vụ (`npm run start:prod`) | IT | Log không có `[DBG-01]` / `CRITICAL PRODUCTION CONFIGURATION ERRORS` |
| 2.6 | Smoke test `CUTOVER.md` mục 7.1–7.3 | Dev + cửa hàng | Đạt |
| 2.7 | Mở lại nút "CỬA HÀNG" (gỡ Cấp 1) | Người quyết định | Khách đặt được đơn |

Rút ngắn còn ≈ 5 phút: mỗi lần triển khai, build vào thư mục riêng theo commit (ví dụ `C:\inetpub\tsf-releases\<commit>`) và giữ bản trước; rollback chỉ cần trỏ dịch vụ về thư mục cũ rồi khởi động lại.

### Cấp 3 — Khôi phục DB từ bản sao lưu (≈ 30–60 phút, **mất dữ liệu sau thời điểm sao lưu**)

Chỉ dùng cho T4 (dữ liệu hỏng) khi Dev xác nhận không sửa tại chỗ được. Luôn khôi phục sang **DB mới** rồi đổi `DATABASE_URL`; DB hỏng giữ nguyên để điều tra.

| # | Bước | Người làm | Kiểm tra đạt |
|---|---|---|---|
| 3.1 | Cấp 1 (tạm dừng bán) phải đang có hiệu lực | IT | — |
| 3.2 | Xuất Excel toàn bộ đơn từ lúc sao lưu gần nhất đến giờ (nếu admin còn mở được); giữ tin báo đơn Zalo/Telegram | Đầu mối cửa hàng | Có danh sách đơn sẽ bị mất sau khôi phục |
| 3.3 | Sao lưu DB hỏng ngay (bằng chứng): `scripts\sao_luu_db.ps1 -BackupDir D:\Backup\webtsf-su-co -SkipUploads` | IT | `OK DB` trong log |
| 3.4 | Dừng dịch vụ app | IT | — |
| 3.5 | Chọn bản `.dump` trước thời điểm sự cố (tên có ngày giờ) trong `D:\Backup\webtsf\database` | Dev | Dev xác nhận tên file |
| 3.6 | Khôi phục sang DB mới (chạy bằng tài khoản quản trị `postgres`, đặt `$env:DATABASE_URL` tạm trong cửa sổ):<br>`scripts\khoi_phuc_db.ps1 -BackupFile <file.dump> -TargetDb WebTSF_production_r<yyyymmdd> -AppOwner tsf_app` | IT | "Khôi phục xong" |
| 3.7 | Sửa `DATABASE_URL` trong `.env` sang DB mới (giữ user `tsf_app`), khởi động lại app | IT | Log khởi động sạch |
| 3.8 | Smoke test `CUTOVER.md` mục 7.1–7.4 | Dev + cửa hàng | Đạt |
| 3.9 | Nhập lại / gọi lại khách cho các đơn ở bước 3.2 | Cửa hàng | Mọi đơn bị mất đã được xử lý |
| 3.10 | Mở lại bán (gỡ Cấp 1) | Người quyết định | Khách đặt được đơn |

Nếu bản code mới có migration mà bản backup chưa có: khôi phục DB **và** quay code (Cấp 2) về đúng commit tương ứng với bản backup.

### Cấp 3b — Hoàn tác một migration

Migration chạy lỗi giữa chừng hoặc làm hỏng một bảng: chạy file `scripts/migrations/<tên>_rollback.sql` tương ứng (Dev xác nhận trước, vì nhiều bản rollback **xoá cột/bảng** kèm dữ liệu trong đó), rồi xoá dòng tương ứng trong `schema_migrations`. Không chắc → dùng Cấp 3.

---

## 4. Lịch sao lưu

| Khi nào | Lệnh / cách làm | Giữ |
|---|---|---|
| Hằng ngày 23:30 (sau giờ bán, trước cron dọn giữ chỗ 00:05) | Task Scheduler gọi `scripts\sao_luu_db.ps1` (lệnh dưới) | 14 bản mới nhất |
| Ngay trước mỗi lần triển khai / chạy migration | Chạy tay `scripts\sao_luu_db.ps1` | Như trên |
| Hằng tuần | Chép thư mục `D:\Backup\webtsf` sang ổ / máy khác (không để bản sao lưu duy nhất trên cùng máy chủ) | ❓ IT chọn nơi lưu |
| Hằng tháng | Diễn tập khôi phục (mục 5) trên bản sao lưu mới nhất | Ghi kết quả vào sổ |

```powershell
$app = 'C:\inetpub\thai-son-foods'
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$app\scripts\sao_luu_db.ps1`" -AppDir `"$app`" -BackupDir D:\Backup\webtsf -Keep 14"
$trigger = New-ScheduledTaskTrigger -Daily -At 23:30
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'TSF sao luu DB' -Action $action -Trigger $trigger -Settings $settings `
  -User 'NT AUTHORITY\SYSTEM' -RunLevel Highest
```

Kiểm tra hằng ngày: `D:\Backup\webtsf\sao-luu.log` có dòng `OK DB` của đêm trước; Task Scheduler "Last Run Result" = `0x0`. Script trả mã thoát 1 khi pg_dump lỗi hoặc bản dump không đọc được.

Cần trên máy chủ: `pg_dump`, `pg_restore`, `psql` (PostgreSQL client, cùng bản hoặc mới hơn server) trong PATH. `DATABASE_URL` của `tsf_app` đủ quyền đọc để sao lưu; khôi phục cần tài khoản có quyền `CREATE DATABASE`.

---

## 5. Diễn tập khôi phục — kết quả 14/11/2026 (máy dev, DB local)

Lệnh: `sao_luu_db.ps1` trên `WebTSF_staging` → `khoi_phuc_db.ps1 -CompareWith WebTSF_staging` sang DB mới → đối soát → xoá DB tạm.

| Kiểm tra | Kết quả |
|---|---|
| Sao lưu DB | Đạt: 0,4 MB, 46 bảng có dữ liệu, `pg_restore --list` đọc được |
| Giữ N bản | Đạt: chạy 3 lần với `-Keep 2` → còn 2 bản mới nhất, bản cũ nhất bị xoá |
| Sao lưu ảnh | Đạt: `public/uploads` nén 4,01 MB |
| Thời gian khôi phục | 1,2–2,4 giây (DB 19 MB) |
| Số dòng 46 bảng | 46/46 khớp |
| `orders` / `order_items` / `products` / `combos` | 27 / 48 / 12 / 17 ở cả hai bên |
| Tổng tiền đơn, tổng tiền dòng hàng | 14.762.000đ / 14.322.000đ, hai bên bằng nhau |
| Tồn kho / giữ chỗ (`store_inventory`) | 71.564 / 191, hai bên bằng nhau |
| Index / trigger / ràng buộc | 133 / 1 / 358, hai bên bằng nhau |
| Mã băm nội dung `orders` và `combos` | Trùng nhau |
| Xoá DB tạm | Đã xoá |

Ghi chú:
- Đề bài yêu cầu khôi phục sang DB tên `webtsf_restore_test`. Trên máy dev **đã có sẵn** một DB tên này từ trước (19 bảng, đơn mới nhất 01/10/2026). Script từ chối ghi đè đúng như thiết kế, nên diễn tập dùng tên `webtsf_restore_test_f03`. DB cũ `webtsf_restore_test` để nguyên, chờ chủ dự án quyết định có xoá không.
- Chưa diễn tập trên máy chủ thật, chưa thử đăng ký Task Scheduler, chưa thử khôi phục ảnh từ file zip (chỉ là giải nén vào `public\uploads`).

---

## 6. Sau mỗi lần rollback

1. Ghi sổ sự cố: thời điểm phát hiện, tiêu chí (mục 2), cấp rollback, thời gian dừng bán, số đơn bị ảnh hưởng, nguyên nhân.
2. Báo cửa hàng và (nếu có) khách bị ảnh hưởng.
3. Sửa lỗi, kiểm trên staging, triển khai lại theo `CUTOVER.md`, có bản sao lưu ngay trước khi triển khai.
