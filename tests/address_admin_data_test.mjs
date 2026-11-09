/**
 * Kiểm tra danh mục đơn vị hành chính cấp xã của TP.HCM lấy từ văn bản gốc (Nghị quyết 1685/NQ-UBTVQH15) và đối chiếu
 * với dữ liệu nội bộ đang dùng cho gợi ý địa chỉ. Không cần mạng, không cần CSDL.
 * Chạy: npx tsx tests/address_admin_data_test.mjs   (đặt VERBOSE=1 để in danh sách chênh lệch)
 */
import { HCM_OFFICIAL_UNITS, HCM_UNCHANGED_UNITS, HCM_OFFICIAL_SOURCE } from '@/data/hcm-admin-units-2025';
import { VIETNAM_ADDRESSES } from '@/data/vietnam-addresses';

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL: ${name} ${extra}`);
  }
}
const key = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/^(phuong|xa|thi tran|dac khu)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

console.log('\n── Danh mục chính thức (NQ 1685/NQ-UBTVQH15, Điều 1)');
const all = [...HCM_OFFICIAL_UNITS, ...HCM_UNCHANGED_UNITS];
const count = (type) => all.filter((u) => u.type === type).length;
check('có 163 đơn vị hình thành mới + 5 đơn vị giữ nguyên = 168 đơn vị cấp xã của TP.HCM', HCM_OFFICIAL_UNITS.length === 163 && HCM_UNCHANGED_UNITS.length === 5 && all.length === 168, String(all.length));
check('cơ cấu 113 phường, 54 xã, 1 đặc khu (theo Đề án 356/ĐA-CP)', count('phuong') === 113 && count('xa') === 54 && count('dac-khu') === 1, JSON.stringify({ phuong: count('phuong'), xa: count('xa'), dacKhu: count('dac-khu') }));
check('các khoản đánh số liên tục từ 1 đến 163', HCM_OFFICIAL_UNITS.every((u, i) => u.no === i + 1));
{
  const seen = new Map();
  // So khớp CÓ DẤU: "xã Thanh An" (Bình Dương) và "xã Thạnh An" (Cần Giờ) là hai đơn vị khác nhau
  for (const u of all) {
    const k = `${u.type}:${u.name.normalize('NFC').toLowerCase()}`;
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const dups = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  check('không trùng tên đơn vị (cùng loại)', dups.length === 0, dups.join(', '));
}
check('mỗi đơn vị mới có ít nhất một đơn vị cũ và không có tên rỗng', HCM_OFFICIAL_UNITS.every((u) => u.sources.length > 0 && u.sources.every((s) => s.name.trim().length > 0)));
check('ghi rõ nguồn, ngày hiệu lực và ngày lấy dữ liệu', HCM_OFFICIAL_SOURCE.document === 'Nghị quyết 1685/NQ-UBTVQH15' && HCM_OFFICIAL_SOURCE.effective === '2025-06-16' && /^\d{4}-\d{2}-\d{2}$/.test(HCM_OFFICIAL_SOURCE.fetchedAt));
const find = (name) => HCM_OFFICIAL_UNITS.find((u) => key(u.name) === key(name));
check('Hạnh Thông hình thành từ Phường 1 và Phường 3 (quận Gò Vấp)', (() => {
  const u = find('Hạnh Thông');
  return !!u && u.sources.length === 2 && u.sources.every((s) => s.district === 'Quận Gò Vấp') && u.sources.map((s) => s.name).sort().join() === '1,3';
})());
check('Cần Giờ hình thành từ xã Long Hòa (huyện Cần Giờ) và thị trấn Cần Thạnh', (() => {
  const u = find('Cần Giờ');
  return !!u && u.type === 'xa' && u.sources.some((s) => s.name === 'Cần Thạnh' && s.type === 'thi-tran');
})());

console.log('\n── Đối chiếu với dữ liệu nội bộ (src/data/vietnam-addresses.ts)');
const SRC = new Set(['TP. Hồ Chí Minh', 'Bình Dương', 'Bà Rịa - Vũng Tàu']);
const internal = new Map();
for (const p of VIETNAM_ADDRESSES) {
  if (!SRC.has(p.name)) continue;
  for (const d of p.districts) for (const w of d.wards) if (!/^\d+$/.test(key(w.name))) internal.set(key(w.name), `${w.name} (${d.name})`);
}
const officialKeys = new Set(all.map((u) => key(u.name)));
const missing = all.filter((u) => !internal.has(key(u.name))).map((u) => u.name);
const extra = [...internal.keys()].filter((k) => !officialKeys.has(k)).map((k) => internal.get(k));
console.log(`  (thông tin) đơn vị chính thức: ${all.length}; tên phường/xã trong dữ liệu nội bộ: ${internal.size}`);
console.log(`  (thông tin) CHÍNH THỨC mà dữ liệu nội bộ chưa có: ${missing.length}; dữ liệu nội bộ không có trong danh sách chính thức: ${extra.length}`);
if (process.env.VERBOSE) {
  console.log('  thiếu trong dữ liệu nội bộ:', missing.join(', '));
  console.log('  thừa/lạ trong dữ liệu nội bộ:', extra.join(' ; '));
}
check('Hạnh Thông, Bến Thành, Chợ Quán là đơn vị chính thức', ['Hạnh Thông', 'Bến Thành', 'Chợ Quán'].every((n) => officialKeys.has(key(n))));

console.log('\n── Đơn vị chính thức thiếu trong dữ liệu nội bộ nay đã được nhận ra');
const { matchAdminSegment, resolveAdminFromProvider } = await import('@/lib/address/admin');
check('"Phường Sài Gòn" (mới, chưa có trong dữ liệu nội bộ) được nhận ra là phường', (matchAdminSegment('Phường Sài Gòn')?.wards.length || 0) >= 1);
{
  const r = resolveAdminFromProvider({ ward: 'Sài Gòn', lat: 10.7744, lng: 106.7005 });
  check('Photon trả "Sài Gòn" → Phường Sài Gòn, quận cũ suy từ phường cũ Bến Nghé = Quận 1', r.exact && r.ward === 'Phường Sài Gòn' && r.district === 'Quận 1', JSON.stringify(r));
}
{
  const r = resolveAdminFromProvider({ ward: 'Chợ Quán', lat: 10.7629, lng: 106.6793 });
  check('Phường Chợ Quán (hình thành từ Phường 1, 2, 4 quận 5 theo văn bản gốc) → quận cũ là Quận 5, không phải Quận 10', r.ward === 'Phường Chợ Quán' && r.district === 'Quận 5', JSON.stringify(r));
}
{
  const r = resolveAdminFromProvider({ ward: 'Bình Trung', lat: 10.7998, lng: 106.7384 });
  check('trùng tên với xã ở nơi khác (Bình Trung, Châu Đức, cách ~50 km) không bị gán nhầm', !(r.district && /Châu Đức/.test(r.district)), JSON.stringify(r));
}

console.log('\n── Tên phường trùng nhau khi bỏ dấu (Thành/Thạnh, Trung/Trưng...): mỗi cặp phải tách đúng');
{
  const { canonicalWardKey, accentKey, adminKey } = await import('@/lib/address/admin');
  const SRC2 = new Set(['TP. Hồ Chí Minh', 'Bình Dương', 'Bà Rịa - Vũng Tàu']);
  const names = new Map(); // khóa không dấu → tên có dấu khác nhau
  const add = (n) => {
    if (/^\d+$/.test(adminKey(n))) return;
    const k = adminKey(n);
    if (!names.has(k)) names.set(k, new Set());
    names.get(k).add(accentKey(n));
  };
  for (const p of VIETNAM_ADDRESSES) if (SRC2.has(p.name)) for (const d of p.districts) for (const w of d.wards) add(w.name);
  for (const u of all) add(u.name);
  const pairs = [...names].filter(([, set]) => set.size > 1);
  console.log(`  (thông tin) ${pairs.length} nhóm tên trùng khi bỏ dấu: ${pairs.map(([, s]) => [...s].join(' / ')).join(' ; ')}`);
  for (const [, set] of pairs) {
    const list = [...set];
    const keys = list.map((n) => canonicalWardKey(n).key);
    check(`"${list.join('" và "')}" là các phường khác nhau (khóa so sánh khác nhau)`, new Set(keys).size === list.length, JSON.stringify(keys));
    for (const n of list) {
      const r = resolveAdminFromProvider({ ward: n });
      check(`nhà cung cấp trả "${n}" → đúng "${n}", không lẫn tên kia`, accentKey(r.ward) === n, JSON.stringify(r));
    }
  }
}

console.log('\n── Tỉnh khác TP.HCM không bao giờ gán vào phường TP.HCM');
{
  const r = resolveAdminFromProvider({ ward: 'Long Thành', lat: 10.7827, lng: 106.944, city: 'Long Thành', state: 'Đồng Nai' });
  check('Long Thành, Đồng Nai (10.7827, 106.9440) không bị ghi "Long Thành (Q.9 cũ)" của TP.HCM', r.province !== 'TP. Hồ Chí Minh' && r.district === '', JSON.stringify(r));
}

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
