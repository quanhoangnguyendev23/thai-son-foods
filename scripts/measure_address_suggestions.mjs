/**
 * Đo gợi ý địa chỉ THẬT qua app (web phải đang chạy), nhẹ tay với nhà cung cấp công cộng:
 *   - tối đa 1 lượt hỏi app mỗi 2 giây (mỗi lượt app gọi Photon 1–2 câu),
 *   - dừng ngay khi app trả 429, hoặc khi Photon quá hạn / lỗi 3 lần liên tiếp,
 *   - có User-Agent định danh.
 * In bảng Markdown: top 3 mỗi chuỗi kèm phường, tọa độ, độ chính xác (nhà / đường / gần đúng) và nguồn.
 *
 * Chạy: node scripts/measure_address_suggestions.mjs [chuỗi 1] [chuỗi 2] ...   (không có tham số = bộ chuỗi mặc định)
 * Biến: BASE_URL (mặc định http://localhost:3000), OUT_JSON=đường dẫn file để lưu kết quả thô.
 */
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const UA = `ThaiSonFoodsMeasure/1.0 (${process.env.GEO_CONTACT_EMAIL || 'contact@thaisonfoods.vn'})`;
const DEFAULT_QUERIES = [
  '101 Lê Lợi, Hạnh Thông',
  '101 Lê Lợi, Gò Vấp',
  '101 Lê Lợi, Hạnh Thông, Gò Vấp',
  '101 le loi go vap',
  'Lê Lợi',
  '197 Trần Phú',
  '197 Trần Phú, Chợ Quán',
  '197 Trần Phú, Thủ Dầu Một',
  '101 Lê Lợi, Vũng Tàu',
  'Lê Lai',
  'Phạm Ngũ Lão',
  'Lê Hồng Phong',
  'Đường số 1',
  '12/34/5 Lê Lợi',
  'Hẻm 76 Lê Lợi',
];
const queries = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_QUERIES;
const PRECISION = { house: 'nhà', street: 'đường', area: 'gần đúng' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = [];
let badStreak = 0;
let stopped = '';
for (const [i, q] of queries.entries()) {
  if (i > 0) await sleep(2000);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${BASE}/api/geo/autocomplete?input=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    rows.push({ q, error: String(e.message) });
    badStreak++;
    if (badStreak >= 3) { stopped = '3 lần liên tiếp không gọi được app'; break; }
    continue;
  }
  if (res.status === 429) {
    rows.push({ q, error: 'HTTP 429' });
    stopped = 'app trả 429';
    break;
  }
  const data = await res.json().catch(() => ({}));
  const ms = Date.now() - t0;
  const photon = data.meta?.photon || '?';
  // Chuỗi không gõ khu (không dấu phẩy, không tên khu ở cuối) báo top 5; có khu báo top 3
  const n = /,|go vap|gò vấp/i.test(q) ? 3 : 5;
  rows.push({ q, ms, photon, outOfZone: !!data.meta?.outOfZone, top: (data.predictions || []).slice(0, n), total: (data.predictions || []).length });
  if (photon === 'timeout' || photon === 'error' || photon === 'limited') badStreak++;
  else badStreak = 0;
  if (badStreak >= 3) { stopped = `Photon ${photon} 3 lần liên tiếp`; break; }
}

console.log('| Chuỗi | Photon | # | Gợi ý (nguồn) | Phường mới (quận cũ) | Tọa độ | Độ chính xác |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  if (r.error) { console.log(`| \`${r.q}\` | - | - | LỖI: ${r.error} | - | - | - |`); continue; }
  if (!r.top.length) { console.log(`| \`${r.q}\` | ${r.photon} (${r.ms} ms) | - | ${r.outOfZone ? 'NGOÀI VÙNG GIAO (hiện thông báo)' : 'không có gợi ý'} | - | - | - |`); continue; }
  r.top.forEach((p, k) => {
    const ward = [p.ward, p.district ? `(${p.district} cũ)` : ''].filter(Boolean).join(' ') || '-';
    const at = typeof p.lat === 'number' ? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` : '-';
    console.log(`| ${k === 0 ? `\`${r.q}\`` : ''} | ${k === 0 ? `${r.photon} (${r.ms} ms)` : ''} | ${k + 1} | ${p.main_text} (${p.source}) | ${ward} | ${at} | ${PRECISION[p.precision] || p.precision || '-'} |`);
  });
}
if (stopped) console.log(`\nDỪNG SỚM: ${stopped}. Đã đo ${rows.length}/${queries.length} chuỗi.`);
if (process.env.OUT_JSON) fs.writeFileSync(process.env.OUT_JSON, JSON.stringify(rows, null, 2));
