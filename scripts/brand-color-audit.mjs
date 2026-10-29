// Kiểm tra màu thương hiệu: mọi màu trong CSS đã build (.next/static) và email phải là 1 trong 7 màu công ty,
// trắng/ngà, màu pha trắng (tint) của 7 màu, hoặc logo bên thứ ba. Chạy: npm run build && node scripts/brand-color-audit.mjs
// Thoát mã 1 nếu còn màu ngoài bảng.
import fs from 'node:fs';
import path from 'node:path';
const BRAND = { forest: '#22544C', emerald: '#236E45', leaf: '#7CA250', amber: '#E09245', copper: '#B56322', chestnut: '#82422D', crimson: '#EE355C' };
const EXTRA_OK = { white: '#FFFFFF', ivory: '#FAF7F0', 'ivory-dark': '#F0EBE0', 'cream-badge': '#FFFDF8' };
// Màu nhận diện bên thứ ba bắt buộc giữ (logo Google/Facebook/Zalo)
const THIRD = ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#1877F2', '#0068FF'];
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function classify([r, g, b]) {
  for (const [n, h] of Object.entries({ ...BRAND, ...EXTRA_OK })) {
    const [R, G, B] = hex2rgb(h);
    if (Math.abs(r - R) <= 2 && Math.abs(g - G) <= 2 && Math.abs(b - B) <= 2) return 'exact:' + n;
  }
  for (const h of THIRD) { const [R, G, B] = hex2rgb(h); if (r === R && g === G && b === B) return 'third-party'; }
  for (const [n, h] of Object.entries(BRAND)) {
    const base = hex2rgb(h);
    // t theo kênh có khoảng lớn nhất
    const ts = base.map((c, i) => (255 - c === 0 ? null : ([r, g, b][i] - c) / (255 - c))).filter((x) => x !== null);
    const t = ts.reduce((a, x) => a + x, 0) / ts.length;
    if (t < 0 || t > 1) continue;
    const ok = base.every((c, i) => Math.abs(c + (255 - c) * t - [r, g, b][i]) <= 4);
    if (ok) return `tint:${n}:${Math.round(t * 100)}%`;
  }
  return 'OFF';
}
function parseColors(css) {
  const out = [];
  for (const m of css.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g)) {
    let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    out.push(['#' + h.toUpperCase(), hex2rgb('#' + h)]);
  }
  for (const m of css.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) out.push([m[0], [+m[1], +m[2], +m[3]]]);
  return out;
}
function walk(d, acc = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, acc) : acc.push(p); } return acc; }
const root = process.argv[2] || '.next/static';
const files = walk(root).filter((f) => f.endsWith('.css'));
files.push(...(process.argv.length > 3 ? process.argv.slice(3) : ['src/lib/email/templates.ts']));
const off = new Map(); const stat = {};
for (const f of files) {
  const css = fs.readFileSync(f, 'utf8');
  for (const [raw, rgb] of parseColors(css)) {
    const c = classify(rgb); const k = c.split(':')[0]; stat[k] = (stat[k] || 0) + 1;
    if (c === 'OFF') { const key = raw + ' @' + path.basename(f); off.set(key, (off.get(key) || 0) + 1); }
  }
}
console.log('Tổng theo loại:', stat);
console.log('Màu NGOÀI bảng:', off.size);
for (const [k, n] of [...off.entries()].sort()) console.log('  ' + k + ' x' + n);
if (off.size > 0) process.exit(1);
