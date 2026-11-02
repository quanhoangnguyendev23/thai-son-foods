// Kiểm tra phông chữ trong MÃ NGUỒN (src/): chỉ được dùng 2 phông công ty
//   Roboto    — chữ thường (biến --font-roboto, lớp font-body / font-sans)
//   Fira Sans — tiêu đề (biến --font-fira-sans, lớp font-heading / font-serif)
// Chạy: npm run lint:fonts. Thoát mã 1 nếu còn phông khác. Quy tắc: .agents/rules/brand-colors.md (mục Phông chữ)
import fs from 'node:fs';
import path from 'node:path';

// Tên phông / từ khoá dự phòng được phép xuất hiện trong font-family
const ALLOWED = /^(roboto|fira sans|var\(--font-(roboto|fira-sans|fira|body|heading|sans|mono|serif)\)|sans-serif|system-ui|monospace|inherit|initial|unset|-apple-system|blinkmacsystemfont|'segoe ui'|"segoe ui"|segoe ui|helvetica|arial)$/i;
// Ngoại lệ được chủ dự án cho phép (trang quà tặng riêng, không mang tên cửa hàng)
const EXEMPT_DIRS = ['src/app/2010/'];
const FONT_DECL_FILES = ['src/app/globals.css']; // nơi khai báo @font-face / token phông

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, acc) : acc.push(p);
  }
  return acc;
}

const files = walk('src').filter((f) => /\.(tsx?|jsx?|mjs|css)$/.test(f));
let off = 0;
for (const f of files) {
  const rel = f.split(path.sep).join('/');
  if (EXEMPT_DIRS.some((d) => rel.startsWith(d))) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const bad = [];
    // font-family: ...;  hoặc  fontFamily: '...'
    for (const m of line.matchAll(/(?:font-family\s*:|fontFamily\s*[:=]\s*\{?)\s*([^;}\n]+)/gi)) {
      if (FONT_DECL_FILES.includes(rel) && /@font-face/.test(lines.slice(Math.max(0, i - 3), i + 1).join(' '))) continue;
      const raw = m[1].replace(/^[`'"]|[`'"],?\s*$/g, '').trim();
      for (const part of raw.split(',')) {
        const name = part.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim();
        if (!name || /^\$\{/.test(name)) continue;
        if (!ALLOWED.test(name) && !ALLOWED.test(`'${name}'`)) bad.push(name);
      }
    }
    // next/font/google: chỉ được import Roboto, Fira_Sans
    const g = line.match(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/);
    if (g) for (const n of g[1].split(',').map((s) => s.trim()).filter(Boolean)) if (!['Roboto', 'Fira_Sans'].includes(n)) bad.push(n);
    // lớp Tailwind phông tuỳ ý: font-['...'] / font-[family-name:...]
    for (const m of line.matchAll(/font-\[(?:family-name:)?['"_]?[A-Za-z][^\]]*\]/g)) bad.push(m[0]);
    for (const b of bad) { off++; console.log(`${rel}:${i + 1}  ${b}  → dùng Roboto (chữ thường) hoặc Fira Sans (tiêu đề)`); }
  });
}
console.log(`\nĐã quét ${files.length} file. Phông NGOÀI quy định: ${off}` + ` (bỏ qua trang ngoại lệ: ${EXEMPT_DIRS.join(', ')})`);
process.exit(off ? 1 : 0);
