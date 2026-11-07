# Website Thái Sơn Foods (WebTSF)

Hệ thống Website Thương mại Điện tử và Quản trị Bán hàng Đa chi nhánh cho Thương hiệu Nước Đóng Chai Thái Sơn Foods (Sữa Bắp Nếp, Nha Đam Đường Phèn, v.v.).

---

## 🏬 Kiến trúc Quản lý Tồn kho Đa Chi Nhánh (Multi-Branch Inventory)

Hệ thống quản lý kho của dự án được thiết kế chuyên biệt để chống bán lố (overselling) tuyệt đối trong môi trường concurrency cao:

### 1. Cơ chế Giữ chỗ & Khóa hàng (Stock Reservation & Concurrency Control)
- **Đơn hàng Chờ xác nhận (PENDING):** Tăng chỉ số `reserved` tại chi nhánh tương ứng và sinh bản ghi trong bảng `stock_reservations`.
- **Tồn khả dụng (Available):** `available_quantity = GREATEST(0, stock_quantity - reserved - safety_stock)`.
- **Đơn hàng Xác nhận (CONFIRMED):** Giảm `stock_quantity` thật, trừ `reserved`, và đổi trạng thái reservation thành `confirmed`. Thao tác hoàn toàn Idempotent.
- **Hủy đơn (CANCELLED) hoặc Quá hạn:** Tự động nhả `reserved` về kho khả dụng và chuyển reservation sang `released`/`expired`.
- **Bóc combo tự động:** Mọi combo (combo cố định từ DB, combo tự chọn 4 chai, combo văn phòng, combo siêu hời) đều được quy đổi ra từng chai thành phần để kiểm tra tồn và giữ chỗ chính xác.

### 2. Công nghệ Lưu trữ & Giao dịch
- **Raw SQL Transaction Locking:** Toàn bộ thao tác kiểm tra tồn, giữ chỗ, xác nhận và chuyển kho được thực thi thông qua Raw SQL trên PostgreSQL (`pg.Pool` tại `@/lib/db`) sử dụng `SELECT ... FOR UPDATE` (sắp xếp tăng dần theo `product_id` để ngăn ngừa deadlock).
- **Đồng bộ Prisma Schema:** Tệp `prisma/schema.prisma` phản chiếu 100% cấu trúc các bảng: `stores`, `store_inventory`, `stock_reservations`, `inventory_logs`, `orders`, `order_items`.

---

## 🚀 Khởi chạy Dự án

```bash
# Cài đặt thư viện
npm install

# Khởi chạy môi trường phát triển (Dev server)
npm run dev
```

Truy cập: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Bộ Kiểm thử Nghiệp vụ Kho Tự động (Automated Test Suites)

Hệ thống cung cấp các bộ kịch bản kiểm thử độc lập kiểm tra toàn diện logic kho:

```bash
# Kiểm thử Giai đoạn 1: Nền tảng dữ liệu & Chống bán lố (29 assertions)
node scripts/test_inventory_phase1.mjs

# Kiểm thử Giai đoạn 4: Checkout chặn thiếu hàng, Admin 3 cột, Chuyển kho & Logs (32 assertions)
node scripts/test_inventory_phase4.mjs
```

---

## Tìm nhanh mã nguồn

- Phần nào trên web nằm ở file nào: [docs/BAN-DO-MA-NGUON.md](docs/BAN-DO-MA-NGUON.md)
- Mở các thư mục `src/app`, `src/app/api`, `src/components` (và `home`, `layout`, `product`), `src/lib`, `src/data`, `src/config` trên GitHub để xem bảng chú thích từng file.
