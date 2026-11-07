# Khung chung của mọi trang (đầu trang, chân trang)

| File | Là phần nào |
|---|---|
| `AppLayout.tsx` | Bọc mọi trang: chọn header/footer nào (trang chủ mới dùng bản Amazon, /2010 không có header/footer) |
| `Header.tsx` | **Đầu trang** các trang thường: logo, menu, ô tìm kiếm, giỏ hàng, tài khoản |
| `BranchTopBar.tsx` | Dải trên cùng: chi nhánh đang chọn |
| `HeaderAmazon.tsx` | Đầu trang riêng của trang chủ mới |
| `Footer.tsx` | **Chân trang** các trang thường |
| `FooterAmazon.tsx` | Chân trang của trang chủ mới |
| `FooterLegal.tsx` | Thông tin pháp lý ở chân trang (dữ liệu `src/config/legal.ts`) |
| `SavingsBagButton.tsx` | Nút "Túi tiết kiệm" cạnh giỏ hàng |
| `LogoPreloader.tsx` | Logo chờ khi mở web lần đầu |
