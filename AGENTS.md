<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

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
