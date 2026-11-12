<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# QUY TẮC CỐ ĐỊNH CẤU TRÚC FILE VÀ CÔ LẬP PHẠM VI CHỈNH SỬA
# (FILE STRUCTURE PRESERVATION & COMPONENT ISOLATION RULES)

Tài liệu này là quy tắc bắt buộc (MANDATORY RULE) áp dụng cho mọi tương tác và tác vụ phát triển, bảo trì, nâng cấp mã nguồn website Thái Sơn Foods.

---

## 1. NGUYÊN TẮC CỐ ĐỊNH CẤU TRÚC TỆP (FILE & FOLDER IMMUTABILITY)
- **Bảo toàn 100% cấu trúc thư mục:** Không tự ý thay đổi cây thư mục (`src/app/`, `src/components/`, `src/data/`, `src/types/`, `src/lib/`, `public/`, `prisma/`, v.v.).
- **Không xóa, đổi tên, di chuyển tệp:** Tuyệt đối không xóa file, đổi tên component/tệp hoặc di chuyển tệp sang vị trí khác nếu không có chỉ định trực tiếp từ người dùng.
- **Không tùy tiện tái cấu trúc (No Unsolicited Refactoring):** Không tự ý gộp nhiều file vào một file, hoặc tách nhỏ component ra nhiều file mới nếu không được yêu cầu. Giữ nguyên kiến trúc hiện tại của dự án.
- **Bảo toàn định danh và giao thức:** Giữ nguyên tên component, tên export, tên interface/type và tên route đã có để tránh làm đứt gãy liên kết trong toàn bộ hệ thống.

---

## 2. NGUYÊN TẮC CÔ LẬP PHẠM VI (STRICT COMPONENT ISOLATION)
- **Khoanh vùng chính xác (Single Component Focus):** Khi người dùng yêu cầu chỉnh sửa một phân đoạn cụ thể (ví dụ: *Footer*, *HeroSlider*, *BrandShowcase*, *ProductSection*, *WarehouseSection*, *Header*,...):
  - **CHỈ ĐƯỢC PHÉP** chỉnh sửa đúng file component chịu trách nhiệm cho phân đoạn đó.
  - **TUYỆT ĐỐI KHÔNG** đụng chạm hay thay đổi bất kỳ thuộc tính nào của các phân đoạn khác.
- **Không gây tác dụng phụ (Zero Side-Effects):** 
  - Mọi thay đổi ở phân đoạn A không được phép làm lệch layout, đổi margin/padding, nhảy font chữ, vỡ responsive, méo ảnh hay ảnh hưởng logic của phân đoạn B, C, D.
- **Bảo vệ nghiêm ngặt các tệp dùng chung (Global Scope Protection):**
  - Hạn chế tối đa chỉnh sửa các file toàn cục như `src/app/globals.css`, `src/app/layout.tsx`, `tailwind.config.*`.
  - Nếu phân đoạn cần CSS đặc thù, hãy dùng Tailwind utility classes hoặc CSS cục bộ scoped bên trong component đó, **không** viết đè class toàn cục gây ảnh hưởng dây chuyền.

---

## 3. NGUYÊN TẮC CHỈNH SỬA CỤC BỘ & TỐI THIỂU (SURGICAL & MINIMAL DIFFS)
- **Chỉnh sửa vi phẫu (Surgical Edits):** Chỉ thay thế đúng đoạn mã cần sửa. Tuyệt đối không viết lại (rewrite) toàn bộ file hoặc toàn bộ component vì sẽ vô tình xóa mất các chi tiết tinh chỉnh trước đó.
- **Bảo tồn mã nguồn sẵn có:** Giữ nguyên các hàm, hook, biến, props, comment và đoạn mã hiện có không liên quan đến yêu cầu chỉnh sửa.
- **Tránh xáo trộn định dạng (No Unnecessary Reformatting):** Không chạy format toàn file gây xáo trộn git diff của các khối mã không liên quan.

---

## 4. QUY TRÌNH KIỂM TRA HỒI QUY (REGRESSION & IMPACT VERIFICATION)
Trước và sau mỗi lần chỉnh sửa:
1. **Trước khi sửa:** Xác định rõ ràng:
   - File nào là đối tượng duy nhất cần chỉnh sửa?
   - Các file/phân đoạn nào lân cận cần được giữ nguyên 100%?
2. **Sau khi sửa:** Kiểm tra lại:
   - Các phân đoạn khác trên trang có bị dịch chuyển, đổi màu, đổi font hay mất nội dung không?
   - Dev server (`npm run dev`) có tiếp tục chạy mượt mà, không sinh lỗi biên dịch/TypeScript nào không?

---

## 5. BẢNG MÀU THƯƠNG HIỆU (BRAND COLORS) — KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI
- Chỉ dùng 7 màu chính thức của công ty: `#22544C` (forest, màu chính), `#236E45` (emerald), `#7CA250` (leaf), `#E09245` (amber), `#B56322` (copper), `#82422D` (chestnut), `#EE355C` (crimson).
- Nguồn duy nhất khai báo màu: `src/app/brand-tokens.css`. Trong component chỉ dùng class/biến token, **không** viết mã HEX/rgb/hsl hay `bg-[#...]`.
- **Không** thêm, bớt, đổi, pha hay tinh chỉnh màu; không dùng màu đen và màu tím. Chỉ đổi khi chủ dự án yêu cầu rõ ràng bằng mã HEX mới.
- Chi tiết, ngoại lệ (logo Google/Facebook/Zalo) và lệnh kiểm tra: `.agents/rules/brand-colors.md`.
- **Màu chữ** chỉ được là đúng 1 trong 7 màu gốc hoặc trắng: không dùng màu pha nhạt (tint), không làm chữ trong suốt (`text-x/80`). Plugin `postcss-brand-colors.cjs` tự ép lớp `text-*` về màu gốc gần nhất; không viết `style={{ color: ... }}` với màu pha nhạt.
- Trước khi bàn giao thay đổi giao diện: chạy `npm run lint:colors` (phải báo "Màu NGOÀI bảng: 0"). Thấy màu ngoài bảng thì thay bằng màu gần nhất trong 7 màu (script có gợi ý), không tự thêm màu mới.

---

## 6. PHÔNG CHỮ CÔNG TY — KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI
- Chỉ dùng 2 phông: **Roboto** cho chữ thường (`font-body`, `font-sans`, `var(--font-roboto)`) và **Fira Sans** cho tiêu đề (`font-heading`, `var(--font-fira-sans)`). Cả hai đã nạp sẵn trong `src/app/layout.tsx`.
- **Không** thêm phông mới (Google Fonts, `@font-face`, `font-[...]`, `fontFamily` viết tay). Các lớp `font-serif`, `font-mono` đã được trỏ về 2 phông này trong `src/app/globals.css`.
- Trước khi bàn giao thay đổi giao diện: chạy `npm run lint:fonts` (phải báo "Phông NGOÀI quy định: 0").

---

## 7. THANG CỠ CHỮ CỐ ĐỊNH — KHÔNG ĐƯỢC TỰ ĐẶT CỠ CHỮ
- Chỉ dùng 9 cỡ: `text-2xs` 11px (chỉ nhãn/huy hiệu nhỏ) · `text-xs` 12 (chú thích) · `text-sm` 14 (chữ phụ, bảng quản trị) · `text-base` 16 (chữ thường, ô nhập) · `text-lg` 18 (tên SP, giá trong danh sách) · `text-xl` 20 (tiêu đề nhỏ) · `text-2xl` 24 (tiêu đề mục) · `text-3xl` 30 (tiêu đề trang) · `text-4xl` 36 (tiêu đề lớn). Nhấn mạnh trong câu dùng `text-emph` (1.125em) thay cho chữ đậm.
- **Không** viết `text-[13px]`, `text-[0.8rem]`, `text-[clamp(...)]`, `text-5xl` trở lên, `style={{ fontSize: ... }}` hay `font-size` ngoài thang. Cần to hơn ở màn hình rộng thì dùng tiền tố (`text-2xl md:text-3xl`), không dùng `clamp`.
- Ô nhập trên điện thoại luôn >= 16px (đã ép trong `src/app/globals.css`); không gỡ quy tắc đó.
- Chi tiết: `.agents/rules/font-sizes.md`. Trước khi bàn giao thay đổi giao diện: chạy `npm run lint:font-sizes` (phải báo "Cỡ chữ NGOÀI thang: 0").

---

## 8. TRANG CHI TIẾT SẢN PHẨM ↔ TRANG CHI TIẾT COMBO — LUÔN SỬA ĐỒNG BỘ
- Mọi thay đổi ở trang chi tiết sản phẩm (`src/app/san-pham/[slug]/page.tsx` và các component nó dùng: bố cục, lề, thẻ, hàng cuộn, box gợi ý, hộp mua, đánh giá…) **phải rà soát và áp dụng y như vậy** cho trang chi tiết combo (`src/app/combo/[slug]/page.tsx`, `ComboDetailView` và các component của nó), trong phạm vi hợp lý với combo — và ngược lại.
- Nếu component dùng chung với trang khác (trang chủ…), bật thay đổi bằng tuỳ chọn (prop) chỉ cho 2 trang này, không làm đổi các trang còn lại.
- Báo cáo thay đổi phải ghi rõ: đã áp dụng cho cả 2 trang, hoặc phần nào không áp dụng cho trang kia và lý do.
