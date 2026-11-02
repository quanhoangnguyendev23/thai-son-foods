// Kiểm tra màu trong MÃ NGUỒN (src/): mọi mã HEX / rgb() viết tay phải là 1 trong 7 màu công ty,
// trắng/ngà, màu pha trắng (tint) của 7 màu, hoặc logo bên thứ ba (Google/Facebook/Zalo).
// Chạy: npm run lint:colors   (không cần build). Thoát mã 1 nếu còn màu ngoài bảng.
// Bổ sung cho scripts/brand-color-audit.mjs (kiểm CSS đã build). Quy tắc: .agents/rules/brand-colors.md
import fs from 'node:fs';
import path from 'node:path';

const BRAND = ['#22544C', '#236E45', '#7CA250', '#E09245', '#B56322', '#82422D', '#EE355C'];
const EXTRA_OK = ['#FFFFFF', '#FAF7F0', '#F0EBE0', '#FFFDF8'];
const THIRD = ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#1877F2', '#0068FF'];
// Ngoại lệ được chủ dự án cho phép (không mang nhận diện cửa hàng). Chỉ thêm khi có duyệt.
const EXEMPT_DIRS = ['src/app/2010/'];
// Nguồn khai báo token: được phép có mã HEX
const TOKEN_FILES = ['src/app/brand-tokens.css'];

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function isAllowed([r, g, b]) {
  for (const h of [...BRAND, ...EXTRA_OK]) {
    const [R, G, B] = hex2rgb(h);
    if (Math.abs(r - R) <= 2 && Math.abs(g - G) <= 2 && Math.abs(b - B) <= 2) return true;
  }
  for (const h of THIRD) { const [R, G, B] = hex2rgb(h); if (r === R && g === G && b === B) return true; }
  for (const h of BRAND) {
    const base = hex2rgb(h);
    const ts = base.map((c, i) => (255 - c === 0 ? null : ([r, g, b][i] - c) / (255 - c))).filter((x) => x !== null);
    const t = ts.reduce((a, x) => a + x, 0) / ts.length;
    if (t < 0 || t > 1) continue;
    if (base.every((c, i) => Math.abs(c + (255 - c) * t - [r, g, b][i]) <= 4)) return true;
  }
  return false;
}
// Màu gần nhất trong 7 màu (gợi ý thay thế)
function nearest([r, g, b]) {
  let best = null, bd = Infinity;
  for (const h of BRAND) { const [R, G, B] = hex2rgb(h); const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < bd) { bd = d; best = h; } }
  return best;
}
function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, acc) : acc.push(p);
  }
  return acc;
}

const files = walk('src').filter((f) => /\.(tsx?|jsx?|mjs|css)$/.test(f));
let off = 0, exempt = 0;
for (const f of files) {
  const rel = f.split(path.sep).join('/');
  if (TOKEN_FILES.includes(rel)) continue;
  const isExempt = EXEMPT_DIRS.some((d) => rel.startsWith(d));
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const found = [];
    for (const m of line.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g)) {
      let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      found.push(['#' + h.toUpperCase(), hex2rgb('#' + h)]);
    }
    for (const m of line.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) found.push([m[0] + ')', [+m[1], +m[2], +m[3]]]);
    for (const [label, rgb] of found) {
      if (isAllowed(rgb)) continue;
      if (isExempt) { exempt++; continue; }
      off++;
      console.log(`${rel}:${i + 1}  ${label}  → gần nhất ${nearest(rgb)}`);
    }
  });
}
console.log(`\nĐã quét ${files.length} file. Màu NGOÀI bảng: ${off}` + (exempt ? ` (bỏ qua ${exempt} màu ở trang ngoại lệ: ${EXEMPT_DIRS.join(', ')})` : ''));
process.exit(off ? 1 : 0);
