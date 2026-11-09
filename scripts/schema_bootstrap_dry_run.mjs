/**
 * CHẠY THỬ bộ khởi tạo lược đồ cũ (initDatabase trong src/lib/db.ts): in TOÀN BỘ câu SQL theo đúng thứ tự sẽ chạy,
 * KHÔNG kết nối CSDL, KHÔNG thực thi gì.
 *
 *   npx tsx scripts/schema_bootstrap_dry_run.mjs                      → in mọi câu
 *   npx tsx scripts/schema_bootstrap_dry_run.mjs --since b27549b      → chỉ in câu MỚI so với db.ts ở commit đó
 *                                                                         (bản đang chạy trên production)
 *   thêm --out <file.sql> để ghi ra file
 *
 * Câu của src/lib/orderStatusHistory.ts (bảng + trigger lịch sử trạng thái, gọi từ initDatabase và từ trang admin)
 * được đọc thẳng từ mã nguồn của module đó. Câu SELECT (đọc dữ liệu) được ghi chú riêng, không tính là đổi lược đồ.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { collectSchemaBootstrapSql } from '@/lib/db';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const since = arg('--since');
const out = arg('--out');

/** Tách chuỗi nhiều câu thành từng câu; giữ nguyên khối trong dấu đô-la ($$ ... $$, $do$ ... $do$, lồng nhau được). */
function splitSql(text) {
  const res = [];
  let cur = '';
  let open = null; // thẻ đô-la ngoài cùng đang mở, vd "$do$"
  const tagRe = /^\$[A-Za-z_]*\$/;
  for (let i = 0; i < text.length; i++) {
    const m = text.slice(i, i + 40).match(tagRe);
    if (m) {
      if (open === null) open = m[0];
      else if (m[0] === open) open = null;
      cur += m[0];
      i += m[0].length - 1;
      continue;
    }
    const ch = text[i];
    if (open === null && ch === '-' && text[i + 1] === '-') {
      const end = text.indexOf('\n', i);
      i = end < 0 ? text.length : end - 1;
      continue;
    }
    cur += ch;
    if (ch === ';' && open === null) {
      res.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) res.push(cur.trim());
  return res.filter((x) => x && x !== ';');
}

const norm = (s) => s.replace(/\s+/g, ' ').replace(/\s*;\s*$/, '').trim().toLowerCase();

/** Câu SQL tĩnh trong runInitDatabase của một bản db.ts (đọc mã nguồn, không chạy). */
function staticInitSql(source) {
  const start = source.indexOf('async function runInitDatabase');
  const end = source.indexOf('\nasync function restoreDefaultProductGallery');
  const body = source.slice(start, end > start ? end : undefined);
  const list = [];
  for (const m of body.matchAll(/client\.query\(\s*`([\s\S]*?)`/g)) list.push(...splitSql(m[1]));
  return list;
}

/** DDL + BACKFILL của module lịch sử trạng thái, từ mã nguồn (thay tên hàm trigger). */
function statusHistorySqlFrom(src) {
  if (!src) return [];
  const fn = src.match(/const TRIGGER_FN = '([^']+)'/)?.[1] || 'TRIGGER_FN';
  const pick = (name) => {
    const m = src.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`;'));
    return (m ? m[1] : '').split('${TRIGGER_FN}').join(fn);
  };
  return [...splitSql(pick('DDL')), ...splitSql(pick('BACKFILL'))];
}

const gitShow = (ref, path) => {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

const histFile = 'src/lib/orderStatusHistory.ts';
const raw = await collectSchemaBootstrapSql();
let statements = [];
for (const s of raw) {
  if (s.startsWith('-- ensureOrderStatusHistory')) {
    statements.push(...statusHistorySqlFrom(fs.existsSync(histFile) ? fs.readFileSync(histFile, 'utf8') : ''));
  } else {
    statements.push(...splitSql(s));
  }
}

let header = `-- Chạy thử bộ khởi tạo lược đồ (src/lib/db.ts) ngày ${new Date().toISOString().slice(0, 10)}: ${statements.length} câu`;
if (since) {
  const oldSet = new Set([...staticInitSql(gitShow(since, 'src/lib/db.ts')), ...statusHistorySqlFrom(gitShow(since, histFile))].map(norm));
  const before = statements.length;
  statements = statements.filter((s) => !oldSet.has(norm(s)));
  header += `; ${statements.length} câu MỚI so với ${since} (${before - statements.length} câu đã có ở bản đó)`;
}

const reads = statements.filter((s) => /^select\b/i.test(s));
const writes = statements.filter((s) => !/^select\b/i.test(s));
const text =
  `${header}\n-- Đổi lược đồ / dữ liệu: ${writes.length} câu; chỉ đọc (SELECT): ${reads.length} câu (in ở cuối, dạng ghi chú)\n\n` +
  writes.map((s) => (s.endsWith(';') ? s : `${s};`)).join('\n\n') +
  (reads.length ? `\n\n-- ===== Câu chỉ đọc =====\n${reads.map((s) => s.split('\n').map((l) => `-- ${l}`).join('\n')).join('\n\n')}` : '') +
  '\n';
if (out) {
  fs.writeFileSync(out, text);
  console.log(`${header}\nĐã ghi ${out}`);
} else {
  console.log(text);
}
process.exit(0);
