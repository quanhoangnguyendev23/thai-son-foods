// Kiểm tra CỠ CHỮ trong mã nguồn (src/): chỉ được dùng thang cỡ chữ cố định
//   text-2xs 11 · text-xs 12 · text-sm 14 · text-base 16 · text-lg 18 · text-xl 20
//   text-2xl 24 · text-3xl 30 · text-4xl 36 (px)  + text-emph (1.125em, nhấn mạnh trong câu)
// Chạy: npm run lint:font-sizes. Thoát mã 1 nếu còn cỡ chữ tuỳ ý. Quy tắc: .agents/rules/font-sizes.md
import fs from 'node:fs';
import path from 'node:path';

const SCALE = [11, 12, 14, 16, 18, 20, 24, 30, 36];
const TOKEN = { 11: 'text-2xs', 12: 'text-xs', 14: 'text-sm', 16: 'text-base', 18: 'text-lg', 20: 'text-xl', 24: 'text-2xl', 30: 'text-3xl', 36: 'text-4xl' };
// Ngoại lệ được chủ dự án cho phép: trang quà tặng riêng, trang giả lập đăng nhập (chỉ dùng khi phát triển), email gửi khách (không dùng được class)
const EXEMPT_DIRS = ['src/app/2010/', 'src/app/api/auth/mock-oauth/', 'src/lib/email/'];

const nearest = (px) => SCALE.reduce((a, b) => (Math.abs(b - px) <= Math.abs(a - px) ? b : a));
const hint = (px) => `→ dùng ${TOKEN[nearest(px)]} (${nearest(px)}px)`;
const okValue = (v) => {
  v = v.trim().replace(/^[`'"]|[`'"]$/g, '').trim();
  if (/^(inherit|initial|unset|1em|100%|var\(--text-[a-z0-9-]+\))$/.test(v)) return true;
  const m = v.match(/^(\d+(?:\.\d+)?)(px)?$/);
  return Boolean(m && SCALE.includes(parseFloat(m[1])));
};
const toPx = (v) => { const m = v.match(/(\d+(?:\.\d+)?)\s*(px|rem|em)?/); if (!m) return 16; const n = parseFloat(m[1]); return m[2] === 'rem' || m[2] === 'em' ? n * 16 : n; };

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
  const isCss = rel.endsWith('.css');
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const bad = [];
    if (!isCss) {
      // lớp Tailwind cỡ tuỳ ý: text-[13px], text-[0.8rem], text-[1.2em], text-[clamp(...)], text-[length:...]
      for (const m of line.matchAll(/text-\[(?:length:)?(?:\d|\.|clamp|calc|min\(|max\()[^\]]*\]/g)) {
        if (m[0] === 'text-[1.125em]') { bad.push(`${m[0]} → dùng text-emph`); continue; }
        bad.push(`${m[0]} ${hint(toPx(m[0].slice(6)))}`);
      }
      // cỡ ngoài thang: text-5xl … text-9xl
      for (const m of line.matchAll(/\btext-([5-9]xl)\b/g)) bad.push(`${m[0]} → dùng text-4xl (36px) hoặc nhỏ hơn`);
      // style={{ fontSize: ... }}  và  fontSize={11}
      for (const m of line.matchAll(/fontSize\s*:\s*([^,}\n]+)/g)) if (!okValue(m[1])) bad.push(`fontSize: ${m[1].trim()} ${hint(toPx(m[1]))}`);
      for (const m of line.matchAll(/fontSize=\{\s*([\d.]+)\s*\}/g)) if (!okValue(m[1])) bad.push(`fontSize={${m[1]}} ${hint(toPx(m[1]))}`);
      // font-size trong chuỗi CSS viết trong component
      for (const m of line.matchAll(/font-size\s*:\s*([^;"'`}]+)/g)) if (!okValue(m[1])) bad.push(`font-size: ${m[1].trim()} ${hint(toPx(m[1]))}`);
    } else {
      for (const m of line.matchAll(/font-size\s*:\s*([^;}]+)/g)) if (!okValue(m[1])) bad.push(`font-size: ${m[1].trim()} ${hint(toPx(m[1]))}`);
    }
    for (const b of bad) { off++; console.log(`${rel}:${i + 1}  ${b}`); }
  });
}
console.log(`\nĐã quét ${files.length} file. Cỡ chữ NGOÀI thang: ${off}` + ` (bỏ qua ngoại lệ: ${EXEMPT_DIRS.join(', ')})`);
process.exit(off ? 1 : 0);
