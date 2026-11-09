/**
 * Đoạn đường trùng tên: "Lê Lợi" chưa gõ khu phải có Gò Vấp trong 4 gợi ý đầu (dữ liệu OSM nội bộ, không gọi mạng).
 * Chạy: npx tsx tests/address_street_segments_test.mjs
 */
import { parseAddressInput, mapLocalStreet, finalizeSuggestions, streetRelation } from '@/lib/address/suggest';
import { streetSegmentCandidates } from '@/lib/address/streetSegments';
import { HCM_STREET_SEGMENTS, HCM_STREET_SEGMENTS_SOURCE } from '@/data/hcm-street-segments';

let pass = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ PASS: ${name}`); } else { fail++; console.log(`  ✗ FAIL: ${name} ${extra}`); }
};
const top = (input, photonLike = [], ctx = {}) => {
  const parsed = parseAddressInput(input);
  const cands = [...photonLike.map((x) => mapLocalStreet(x, parsed)).filter(Boolean)];
  for (const it of streetSegmentCandidates(parsed)) { const m = mapLocalStreet(it, parsed); if (m) cands.push(m); }
  return finalizeSuggestions(cands, parsed, ctx);
};

console.log('\n── Dữ liệu');
check('có nguồn OSM + ngày lấy', /OpenStreetMap/.test(HCM_STREET_SEGMENTS_SOURCE.source) && /^\d{4}-\d{2}-\d{2}$/.test(HCM_STREET_SEGMENTS_SOURCE.fetchedAt));
check('Lê Lợi có đoạn ở Gò Vấp', HCM_STREET_SEGMENTS.some((s) => s.street === 'Lê Lợi' && s.district === 'Quận Gò Vấp'));
check('mọi đoạn có tọa độ trong TP.HCM mở rộng', HCM_STREET_SEGMENTS.every((s) => s.lat > 10.3 && s.lat < 11.3 && s.lng > 106.3 && s.lng < 107.1));

console.log('\n── Gợi ý khi chưa gõ khu');
for (const q of ['Lê Lợi', '101 Lê Lợi', 'le loi']) {
  const list = top(q);
  const t4 = list.slice(0, 4).map((s) => s.district);
  check(`"${q}": Gò Vấp trong 4 mục đầu`, t4.includes('Quận Gò Vấp'), JSON.stringify(t4));
  check(`"${q}": 4 mục đầu ở 4 quận cũ khác nhau`, new Set(t4).size === t4.length && t4.length === 4, JSON.stringify(t4));
}
{
  // Photon chỉ trả Quận 1 (như khi không có điểm ưu tiên) → vẫn có Gò Vấp
  const photonQ1 = [{ place_id: 'p1', main_text: 'Lê Lợi', lat: 10.7733, lng: 106.7, district: 'Quận 1', province: 'TP. Hồ Chí Minh', wardHint: 'Phường Bến Thành' }];
  const t4 = top('Lê Lợi', photonQ1).slice(0, 4).map((s) => s.district);
  check('Photon chỉ có Quận 1 → vẫn có Gò Vấp', t4[0] === 'Quận 1' && t4.includes('Quận Gò Vấp'), JSON.stringify(t4));
}
{
  const list = top('101 Lê Lợi');
  check('số nhà khách gõ được giữ nguyên', list.slice(0, 4).every((s) => /^101 /.test(s.main_text)), JSON.stringify(list.slice(0, 4).map((s) => s.main_text)));
  check('độ chính xác mức đường (bắt chấm ghim)', list.every((s) => s.precision !== 'house'));
}
console.log('\n── Đã gõ khu thì không thêm');
check('"Lê Lợi, Gò Vấp" không lấy thêm đoạn', streetSegmentCandidates(parseAddressInput('Lê Lợi, Gò Vấp')).length === 0);
{
  const list = top('Lê Lợi', [], { bias: { lat: 11.07, lng: 106.6 } });
  check('có vị trí gần khách (Bến Cát) → không ép nội thành', list.slice(0, 4).some((s) => /Bến Cát|Thủ Dầu Một/.test(s.district || '')), JSON.stringify(list.slice(0, 4).map((s) => s.district)));
}

console.log('\n── Khác dấu là khác đường (khi cả hai có dấu); đúng tên đứng trước tên bắt đầu giống');
{
  const rel = (typed, st) => streetRelation({ street: st, main_text: st }, parseAddressInput(typed));
  check('"Nguyễn Du" ≠ "Nguyễn Dữ"', !rel('Nguyễn Du', 'Nguyễn Dữ').same);
  check('"Nguyễn Du" = "Đường Nguyễn Du"', rel('Nguyễn Du', 'Đường Nguyễn Du').points === 100);
  check('gõ không dấu "nguyen du" vẫn khớp cả hai', rel('nguyen du', 'Nguyễn Dữ').same && rel('nguyen du', 'Nguyễn Du').same);
  const photon = [
    { place_id: 'a', main_text: 'Nguyễn Du', lat: 10.7789, lng: 106.6999, district: 'Quận 1', province: 'TP. Hồ Chí Minh', wardHint: 'Phường Sài Gòn' },
    { place_id: 'b', main_text: 'Nguyễn Duy nối dài', lat: 10.7497, lng: 106.6812, district: 'Quận 8', province: 'TP. Hồ Chí Minh', wardHint: 'Phường Chánh Hưng' },
  ];
  const t4 = top('Nguyễn Du', photon).slice(0, 4).map((s) => s.street);
  const all = top('Nguyễn Du', photon);
  const duy = all.find((s) => s.street === 'Nguyễn Duy nối dài');
  check('"Nguyễn Duy nối dài" có nhãn tên gần giống', !!duy && duy.nameMatch === 'similar', JSON.stringify(duy && duy.nameMatch));
  check('đúng tên thì không có nhãn gần giống', all.filter((s) => s.street === 'Nguyễn Du').every((s) => s.nameMatch === 'exact'));
  check('đang gõ dở "Lê L" → chưa gắn nhãn', top('Lê L').every((s) => s.nameMatch === undefined));
  check('4 mục đầu đúng tên "Nguyễn Du", không lẫn "Nguyễn Duy nối dài"', t4.every((x) => x === 'Nguyễn Du'), JSON.stringify(t4));
}
{
  const photon = [
    { place_id: 'x1', main_text: 'Phan Văn Trị', lat: 10.825, lng: 106.6907, district: 'Quận Gò Vấp', province: 'TP. Hồ Chí Minh', wardHint: 'Phường An Nhơn' },
    { place_id: 'x2', main_text: 'Phan Văn Trị', lat: 10.7574, lng: 106.6834, district: 'Quận 5', province: 'TP. Hồ Chí Minh', wardHint: 'Phường Chợ Quán' },
    { place_id: 'x3', main_text: 'Phan Văn Trị', lat: 10.8071, lng: 106.6977, district: 'Quận Bình Thạnh', province: 'TP. Hồ Chí Minh', wardHint: 'Phường Bình Thạnh' },
    { place_id: 'x4', main_text: 'Phan Văn Trị', lat: 10.8336, lng: 106.6698, district: 'Quận Gò Vấp', province: 'TP. Hồ Chí Minh', wardHint: 'Phường Gò Vấp' },
  ];
  const t4 = top('Phan Văn Trị', photon).slice(0, 4).map((s) => s.district);
  check('Phan Văn Trị: cùng đường cùng quận cũ gộp một mục (Gò Vấp không lặp)', t4.filter((d) => d === 'Quận Gò Vấp').length === 1, JSON.stringify(t4));
}

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
