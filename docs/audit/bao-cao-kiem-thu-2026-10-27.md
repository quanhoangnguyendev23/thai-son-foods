# Báo cáo kết quả kiểm thử – Thái Sơn Foods

- Ngày chạy: 2026-10-27
- Môi trường: Windows 10, Node 24, DB PostgreSQL `WebTSF_staging` (127.0.0.1:5432), dev server `localhost:3000` đang chạy
- Phạm vi: 17 file test trong `tests/` (8 file thuộc `npm test` và 9 file bổ sung). Chưa chạy `tests/security/`, `admin_*`, `phase0/1/2/4/6`, `reproduce_*`, `test_gps_order_creation`, `test_fresh_db_schema`, `test_reviews_db_offline_resilience`, `test_cron_cleanup_http`.
- Chưa chạy `npm run lint`, `tsc`, `next build`.

## 1. Kết quả tổng hợp

| Kết quả | Số file |
|---|---|
| Đạt | 16 |
| Fail thật | 1 |
| Tổng | 17 |

## 2. Chi tiết từng file test

| # | Test | Loại | Kết quả | Ghi chú |
|---|---|---|---|---|
| 1 | store_recommender.test.mjs | Unit | ✅ Đạt | 5/5 bài test thuật toán đề xuất chi nhánh và phí ship |
| 2 | home_missing_data_render_test.tsx | Unit (render) | ❌ **Fail** | 3 kiểm tra thất bại, xem mục 3 |
| 3 | pdp_missing_data_render_test.tsx | Unit (render) | ✅ Đạt | 6 kiểm tra |
| 4 | test_subscribe_and_save_spec.mjs | Integration | ✅ Đạt | 35 kiểm tra |
| 5 | phase2_membership_step2_test.mjs | Integration | ✅ Đạt | 45 kiểm tra |
| 6 | phase3_member_fullstack_e2e_test.mjs | Integration/E2E | ✅ Đạt | 16 kiểm tra |
| 7 | phase4_reviews_test.mjs | Integration | ✅ Đạt | 10 kiểm tra |
| 8 | phase8_reviews_security_rbac_test.mjs | Integration (bảo mật) | ✅ Đạt | 19 kiểm tra |
| 9 | phase3_golive_revenue_inventory_test.mjs | Integration | ✅ Đạt | 15 kiểm tra |
| 10 | phase4_5_golive_empty_dashboard_test.mjs | Integration | ✅ Đạt | 32 kiểm tra |
| 11 | test_oauth_social_login.mjs | Integration | ✅ Đạt | 30 kiểm tra |
| 12 | test_sellable_quantity_unified.mjs | Integration | ✅ Đạt* | *Chạy lại bằng `tsx` |
| 13 | test_variant_multiplier_required.mjs | Integration | ✅ Đạt* | *Chạy lại bằng `tsx` |
| 14 | test_cron_cleanup_idempotent.mjs | Integration | ✅ Đạt* | *Chạy lại bằng `tsx`. Cleanup đặt trước tồn kho idempotent |
| 15 | phase5_fefo_inventory_test.mjs | Integration | ✅ Đạt* | *Chạy lại bằng `tsx`: 17 PASS, 0 FAIL |
| 16 | golive_order_userid_spoof_test.mjs | Integration (bảo mật) | ✅ Đạt* | *Chạy lại với `--env-file=.env` |
| 17 | golive_order_tamper_test.mjs | Integration (bảo mật) | ✅ Đạt* | *Chạy lại với `--env-file=.env`, ~3 phút vì chờ rate limit. Kết quả "PASS (bỏ qua 1)" |

## 3. Lỗi thật: `home_missing_data_render_test.tsx`

Ba kiểm tra thất bại:
1. `Combo ảnh rỗng: render không lỗi`: HTML không chứa "Deal trong ngày".
2. `Giữ anchor #san-pham, #combo, #kho-si`: thiếu ít nhất một trong ba anchor.
3. `Khối placeholder có nhãn "Bản mẫu"`: HTML không chứa "Bản mẫu".

Các anchor này vẫn có trong mã: `id="combo"` ở `ComboShowcase.tsx`, `id="kho-si"` ở `WarehouseSection.tsx`, `id="san-pham"` ở `HomePage.tsx` và `ProductSection.tsx`. Nên chưa kết luận được đây là lỗi giao diện hay test đã lỗi thời sau lần redesign trang chủ (có cờ `USE_AMAZON_HOMEPAGE`).

Nguyên nhân chưa được xác minh. Cần chạy test cùng giá trị cờ ở cả hai trạng thái và so sánh HTML thực tế với kỳ vọng.

## 4. Vấn đề về cách chạy test (không phải lỗi mã nguồn)

Lần chạy đầu có 5 file fail ngay trong 0–2 giây vì sai runner, không phải vì logic:
- 3 file dùng `node` thuần nhưng import file `.ts` và alias `@/` hoặc `next/headers`. Phải chạy bằng `tsx` (`test_sellable_quantity_unified`, `test_variant_multiplier_required`, `test_cron_cleanup_idempotent`). `phase5_fefo_inventory_test` import `fefo.js` nên cũng phải chạy bằng `tsx`.
- 2 file bảo mật đơn hàng cần biến `DATABASE_URL`, phải chạy với `node --env-file=.env`.

Hệ quả: `npm test` hiện chỉ gọi 8 trong ~35 file test và không có file nào trong nhóm trên. Không có runner chuẩn và không có CI, nên người mới chạy sai cách sẽ thấy fail giả.

## 5. Ghi chú quan trọng

- Test ghi vào DB `WebTSF_staging` thật nhưng đều dọn lại dữ liệu `QA_TEST_`. Các log báo "Đã dọn dẹp". Nên rà lại DB để chắc chắn không còn dữ liệu test dư.
- `golive_order_tamper_test` bỏ qua 1 kiểm tra. Chưa xác định kiểm tra nào, cần đọc log để biết.
- Số lượng kiểm tra tính từ dòng PASS/✅ trong log, có thể lệch vài đơn vị với số đếm nội bộ của từng test. Các file 12–14 không in từng dòng PASS nên chỉ ghi nhận theo thông báo kết thúc và mã thoát 0.

## 6. Đề xuất

1. Xác minh và sửa `home_missing_data_render_test.tsx` (hoặc sửa trang chủ nếu đó là lỗi thật).
2. Gom toàn bộ test vào một lệnh `npm test` dùng đúng runner cho từng file, và thêm CI.
3. Chạy bổ sung các test chưa nằm trong đợt này (`tests/security/pre_golive_security_regression.mjs`, `admin_*`, `phase1_*`, `test_gps_order_creation`).
