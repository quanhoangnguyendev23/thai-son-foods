/**
 * Tạo src/data/hcm-admin-units-2025.ts từ văn bản gốc Nghị quyết 1685/NQ-UBTVQH15 (sắp xếp đơn vị hành chính cấp xã của
 * TP.HCM, hiệu lực 16/06/2025, đơn vị mới hoạt động từ 01/07/2025).
 *
 * Cách dùng: node scripts/build_hcm_admin_units.mjs <file-văn-bản.txt> [đường-dẫn-nguồn]
 *   file văn bản = nội dung Điều 1 của Nghị quyết (đã chuyển thành chữ thuần). Script chỉ ĐỌC văn bản và trích ra
 *   danh sách; không tự thêm đơn vị nào ngoài văn bản. Kết quả có kiểm tra tự động ở tests/address_admin_data_test.mjs.
 */
import fs from 'node:fs';

const file = process.argv[2];
const sourceUrl = process.argv[3] || 'https://luatvietnam.vn/hanh-chinh/nghi-quyet-1685-nq-ubtvqh15-2025-sap-xep-don-vi-hanh-chinh-cap-xa-tp-ho-chi-minh-403012-d1.html';
if (!file) {
  console.error('Thiếu đường dẫn file văn bản.');
  process.exit(1);
}
const text = fs.readFileSync(file, 'utf8').normalize('NFC').replace(/\s*Đang theo dõi\s*/g, ' ').replace(/\s+/g, ' ');
const start = text.indexOf('1. Sắp xếp toàn bộ diện tích tự nhiên, quy mô dân số của phường Bến Nghé');
if (start < 0) throw new Error('Không thấy mục 1 của Điều 1');
const body = text.slice(start);

// Tách các khoản đánh số liên tiếp 1..N
const marks = [...body.matchAll(/(?:^|\s)(\d{1,3})\.\s+(?=Sắp xếp|Nhập|Giữ nguyên|Thành lập)/g)].map((m) => ({ n: Number(m[1]), i: m.index }));
const seq = [];
let want = 1;
for (const m of marks) if (m.n === want) { seq.push(m); want++; }
const rawItems = seq.map((m, k) => {
  const end = k + 1 < seq.length ? seq[k + 1].i : body.length;
  return body.slice(m.i, end).trim();
});
// Khoản cuối dính phần "Điều 2": cắt tại chữ "Điều 2"
rawItems[rawItems.length - 1] = rawItems[rawItems.length - 1].split(/\s164\.\s|\sĐiều 2\./)[0];

const TYPE = { 'phường': 'phuong', 'xã': 'xa', 'đặc khu': 'dac-khu', 'thị trấn': 'thi-tran' };
const units = [];
const problems = [];
for (const [k, raw] of rawItems.entries()) {
  const no = k + 1;
  const m = raw.match(/có tên gọi là (phường|xã|đặc khu)\s+(.+?)\.?$/i);
  if (!m) { problems.push(`Khoản ${no}: không đọc được tên đơn vị mới`); continue; }
  const type = TYPE[m[1].toLowerCase()];
  const name = m[2].replace(/\.$/, '').trim();
  // Phần liệt kê đơn vị cũ: từ "của" đầu tiên đến "thành (phường|xã|đặc khu) mới"
  const head = raw.replace(/^\d+\.\s+/, '');
  const listPart = head.split(/\s+thành\s+(?:phường|xã|đặc khu)\s+mới/i)[0].replace(/sau khi sắp xếp theo quy định tại khoản[^,;]*?Điều này/gi, ' ');
  // Tách danh sách đơn vị cũ theo dấu phẩy / chữ "và" (dấu ngoặc có thể chứa dấu phẩy nên che trước)
  const masked = listPart.replace(/\([^)]*\)/g, (s) => s.replace(/,/g, '\u0001'));
  const sources = [];
  let pending = [];
  let lastType = null;
  for (let tok of masked.split(/,|\svà\s/)) {
    tok = tok.replace(/\u0001/g, ',').trim();
    if (!tok) continue;
    // Bỏ phần mở đầu "Sắp xếp toàn bộ diện tích tự nhiên, quy mô dân số của", "một phần ... của", "phần còn lại của"
    if (/\bcủa\s+/i.test(tok)) tok = tok.replace(/^.*\bcủa\s+/i, '');
    else if (/diện tích tự nhiên|quy mô dân số|^(sắp xếp|nhập|toàn bộ|một phần|phần còn lại)\b/i.test(tok)) continue;
    // Ghi chú quận/huyện cũ trong ngoặc: áp cho các đơn vị đứng trước chưa có ghi chú
    let note = null;
    tok = tok.replace(/\(\s*(quận|huyện|thành phố|thị xã)\s+([^)]+?)\s*\)/i, (_, kind, nm) => {
      note = `${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()} ${nm.trim()}`;
      return ' ';
    }).trim();
    tok = tok.replace(/^các\s+/i, '').trim();
    if (tok) {
      const tm = tok.match(/^(phường|xã|thị trấn)\s+(.+)$/i);
      const entry = tm
        ? { type: TYPE[tm[1].toLowerCase()], name: tm[2].trim(), district: null }
        : { type: lastType || type, name: tok, district: null };
      lastType = entry.type;
      sources.push(entry);
      pending.push(entry);
    }
    if (note) {
      for (const p of pending) p.district = note;
      pending = [];
    }
  }
  units.push({ no, type, name, sources, text: raw.replace(/^\d+\.\s+/, '') });
}

const out = `/**
 * DANH MỤC ĐƠN VỊ HÀNH CHÍNH CẤP XÃ CỦA TP. HỒ CHÍ MINH SAU SẮP XẾP (từ 01/07/2025)
 * File này được TẠO TỰ ĐỘNG bởi scripts/build_hcm_admin_units.mjs từ văn bản gốc, KHÔNG sửa tay.
 *
 * Nguồn: Nghị quyết 1685/NQ-UBTVQH15 của Ủy ban Thường vụ Quốc hội, Điều 1 (hiệu lực 16/06/2025; đơn vị mới hoạt động
 *        từ 01/07/2025). Bản chữ lấy từ: ${sourceUrl}
 * Ngày lấy dữ liệu: ${new Date().toISOString().slice(0, 10)}
 * Số khoản trong Điều 1 đọc được: ${units.length}. Cùng 5 đơn vị giữ nguyên (không sắp xếp) nêu trong Đề án 356/ĐA-CP:
 * phường Thới Hòa, xã Long Sơn, xã Hòa Hiệp, xã Bình Châu, xã Thạnh An => tổng 168 đơn vị (xem tests/address_admin_data_test.mjs).
 * Đơn vị cũ ghi đúng như văn bản; "district" chỉ có khi văn bản ghi rõ (quận/huyện/thành phố/thị xã trong ngoặc).
 * Danh mục và mã số 34 tỉnh, 3.321 xã theo QĐ 19/2025/QĐ-TTg: chưa nạp (xem báo cáo).
 */
export interface OfficialSourceUnit {
  type: 'phuong' | 'xa' | 'thi-tran' | 'dac-khu';
  name: string;
  /** Quận/huyện/thành phố/thị xã cũ, chỉ khi văn bản ghi rõ trong ngoặc */
  district: string | null;
}

export interface OfficialAdminUnit {
  /** Số khoản trong Điều 1 */
  no: number;
  type: 'phuong' | 'xa' | 'thi-tran' | 'dac-khu';
  name: string;
  sources: OfficialSourceUnit[];
}

export const HCM_OFFICIAL_SOURCE = {
  document: 'Nghị quyết 1685/NQ-UBTVQH15',
  effective: '2025-06-16',
  operatesFrom: '2025-07-01',
  fetchedAt: '${new Date().toISOString().slice(0, 10)}',
  url: ${JSON.stringify(sourceUrl)},
} as const;

/** 5 đơn vị giữ nguyên, không sắp xếp (Đề án 356/ĐA-CP) */
export const HCM_UNCHANGED_UNITS: ReadonlyArray<{ type: OfficialAdminUnit['type']; name: string }> = [
  { type: 'phuong', name: 'Thới Hòa' },
  { type: 'xa', name: 'Long Sơn' },
  { type: 'xa', name: 'Hòa Hiệp' },
  { type: 'xa', name: 'Bình Châu' },
  { type: 'xa', name: 'Thạnh An' },
];

export const HCM_OFFICIAL_UNITS: ReadonlyArray<OfficialAdminUnit> = ${JSON.stringify(
  units.map(({ no, type, name, sources }) => ({ no, type, name, sources })),
  null,
  1
)};
`;
fs.writeFileSync(new URL('../src/data/hcm-admin-units-2025.ts', import.meta.url), out);
console.log(`Đã ghi ${units.length} đơn vị.`);
if (problems.length) console.log('CẦN XEM:\n' + problems.join('\n'));
