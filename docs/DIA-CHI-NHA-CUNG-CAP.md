# Gợi ý địa chỉ: nhà cung cấp, tự host Photon, tích hợp Goong / VietMap

Tài liệu ngắn cho người triển khai. Code liên quan: `src/lib/address/` (thư viện), `src/lib/address/providers/` (adapter),
`src/app/api/geo/*` (route). Chưa tự dựng server hay đăng ký dịch vụ nào.

## 1. Chọn nhà cung cấp bằng biến môi trường

| Biến | Ý nghĩa |
| --- | --- |
| `GEO_PROVIDER` | `photon` (mặc định) hoặc `google`. `goong`, `vietmap` chưa có adapter nên tạm dùng Photon |
| `PHOTON_BASE_URL` | Máy chủ Photon tự host. Để trống = bản công cộng `photon.komoot.io`, chỉ dùng khi phát triển |
| `GEO_APP_NAME`, `GEO_SITE_URL`, `GEO_CONTACT_EMAIL` | Danh tính gửi trong User-Agent / Referer tới Photon, Nominatim, Overpass. Chạy thật phải có email liên hệ của shop |
| `GEO_TIMEOUT_MS` | Hạn chờ nhà cung cấp, mặc định 2000 |
| `PHOTON_CACHE_TTL_MS`, `PHOTON_BREAKER_FAILURES`, `PHOTON_BREAKER_PAUSE_MS` | Đệm (60 giây) và cầu dao (3 lần lỗi → nghỉ 30 giây; HTTP 429 → nghỉ ngay ít nhất 60 giây). Đặt 0 để tắt |

Giao diện chung `AddressProvider` (`providers/types.ts`): `suggest()` → danh sách gợi ý; `details(placeId)` → tọa độ khi nhà
cung cấp trả gợi ý chưa có tọa độ; `reverse()` → địa chỉ tại tọa độ (hiện đi qua `/api/geo/reverse`).

## 2. Vì sao không nên dựa vào Photon công cộng khi bán thật

- Đo ngày 05/11/2026: khoảng 25 lượt dồn dập từ một IP thì Photon công cộng ngừng trả lời hơn 15 phút.
- Web chạy trên Vercel dùng chung IP ra ngoài với nhiều site khác, nên giới hạn theo IP càng dễ chạm.
- Đệm, cầu dao và giới hạn lượt của app nằm trong bộ nhớ từng instance (xem `photonClient.ts`, `osmQueue.ts`,
  `middleware.ts`). Nhiều instance chạy song song thì tổng lượt gọi ra ngoài vẫn có thể vượt giới hạn. Muốn chính xác cần kho
  dùng chung (Redis / Upstash); việc đó thêm một dịch vụ nên cần chủ dự án đồng ý trước.

## 3. Tự host Photon cho dữ liệu Việt Nam

Số liệu dưới đây là ước lượng để lên kế hoạch; kiểm lại README của Photon (`github.com/komoot/photon`) trước khi dựng.

- **Phần mềm:** Photon là một file `.jar` chạy bằng Java (bản mới kèm OpenSearch nhúng), mặc định cổng 2322.
- **Dữ liệu:** dùng chỉ mục dựng sẵn theo quốc gia (Photon công bố bản tải về theo mã nước, ví dụ `vn`) hoặc tự dựng chỉ mục
  từ Nominatim. Chỉ mục riêng Việt Nam nhỏ hơn nhiều so với cả thế giới.
- **Tài nguyên tham khảo:** 1 máy ảo 2 vCPU, 4 GB RAM (JVM 2–3 GB), ổ đĩa 10–20 GB trống cho chỉ mục và bản giải nén.
- **Cập nhật dữ liệu:** tải chỉ mục mới theo lịch (hàng tháng là đủ cho địa chỉ), giải nén cạnh bản cũ, dừng dịch vụ, đổi thư mục,
  chạy lại. Nên giữ bản cũ 1 phiên bản để quay lại.
- **Vận hành:** chạy bằng systemd / Docker, chỉ cho web gọi (tường lửa hoặc mạng nội bộ), giám sát `/api?q=test`.
- **Nối vào app:** đặt `PHOTON_BASE_URL=http://<máy-photon>:2322`, giữ `GEO_PROVIDER=photon`, chạy
  `node scripts/measure_address_suggestions.mjs` rồi `npm run test:address` để kiểm.
- **Lưu ý:** dữ liệu vẫn là OpenStreetMap nên số nhà thiếu như hiện nay; chỉ hết giới hạn lượt gọi và chủ động được độ trễ.

## 4. Tích hợp Goong hoặc VietMap khi có khóa API

Cả hai theo luồng: gợi ý (có `place_id`, chưa chắc có tọa độ) → chi tiết theo `place_id` → tọa độ. Đường dẫn dưới đây theo hiểu
biết hiện tại, phải đối chiếu với tài liệu chính thức của nhà cung cấp khi có khóa.

1. Có khóa API; ghi vào biến môi trường riêng (ví dụ `GOONG_API_KEY` hoặc `VIETMAP_API_KEY`), không để lộ ra trình duyệt.
2. Viết `providers/goong.ts` hoặc `providers/vietmap.ts` theo `AddressProvider`, mẫu là `providers/google.ts`:
   - `suggest`: gọi API gợi ý với `input` nguyên văn của khách và bias vị trí nếu có; đổi mỗi kết quả thành `AddressSuggestion`
     (`place_id` của nhà cung cấp, `main_text` = số nhà + đường khách thấy, chưa có `lat/lng`); chạy phần phường/quận qua
     `resolveAdminFromProvider` ở `admin.ts` để ra phường mới + quận cũ.
   - `details(placeId)`: gọi API chi tiết đúng 1 lần khi khách chọn, trả `lat/lng` và các cấp hành chính.
3. Đăng ký adapter trong `providers/index.ts` (thêm `goong` / `vietmap` vào bảng chọn theo `GEO_PROVIDER`).
4. Trang thanh toán đã có nhánh "gợi ý chưa có tọa độ → lấy chi tiết theo id một lần" (hiện gắn với Google: hàm
   `resolveGoogleSuggestion` gọi `/api/geo/geocode?place_id=`). Khi thêm nhà cung cấp mới, cho route đó gọi
   `getAddressProvider().details(placeId)` để dùng chung cho mọi nhà cung cấp.
5. Đo lại bằng `scripts/measure_address_suggestions.mjs`, bổ sung test bằng dữ liệu thật của nhà cung cấp mới, rồi mới bật.
6. Kiểm điều khoản: lưu cache kết quả, hiển thị bản đồ, ghi nguồn. Mỗi nhà cung cấp có quy định riêng.

## 5. Dịch vụ OSM công cộng còn lại

- **Nominatim** (đảo ngược tọa độ ở bước ghim / GPS): mọi lời gọi qua `osmQueue.ts`, tối đa 1 lượt/giây trong mỗi instance, có
  đệm 10 phút, nghỉ 60 giây khi gặp 429. Không dùng cho gợi ý khi gõ.
- **Overpass** (tìm số nhà gần điểm ghim): chỉ gọi ở bước ghim, hạn chờ 2,5 giây, có User-Agent định danh.
- **Ghi nguồn:** khung gợi ý và các bản đồ đều hiện "© OpenStreetMap contributors".
