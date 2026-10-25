# PHA 1 — patch theo từng mục (branch `fix/inventory-cart-hardening`)

Nền: các patch tạo trên bản code hiện tại của dự án (không đụng DB, không migration chạy tự động).

## Áp dụng
```bash
git checkout -b fix/inventory-cart-hardening
# file CRLF => BẮT BUỘC --keep-cr
git am --keep-cr patches/phase1/000*.patch
# (hoặc áp 1 lần, không commit: git apply --whitespace=nowarn patches/phase1/phase1_all.diff)
```
Thứ tự = thứ tự số. Mỗi patch = 1 commit, message có mã lỗi (V12,V16 / N4 / V13 / V4,V10 / V3 / V8,V14,N1).

## Kiểm tra (chạy trên máy bạn)
```bash
npm run lint
npx tsc --noEmit
npx tsx tests/phase1_inventory_log_tx_test.mjs
npx tsx tests/phase1_inventory_logs_migration_test.mjs
npx tsx tests/phase1_release_stock_log_test.mjs
npx tsx tests/phase1_order_server_total_dealer_test.mjs
npx tsx tests/phase1_order_quantity_validation_test.mjs
npx tsx --import ./tests/helpers/register_next_headers_mock.mjs tests/phase1_admin_inventory_readonly_test.mjs
```
Tất cả test dùng mock/Postgres giả — KHÔNG kết nối DB (DATABASE_URL bị ép về địa chỉ chết trong từng file).
Migration `scripts/migrations/phase1_inventory_logs.sql` CHỈ để bạn chạy tay trên DB riêng/local khi đã duyệt.
