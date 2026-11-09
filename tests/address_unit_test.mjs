/**
 * Kiểm thử đơn vị cho ô nhập địa chỉ giao hàng (chuẩn hóa chữ, tách số nhà/tên đường/phường/quận,
 * đổi tên cũ ↔ mới, xếp hạng, ánh xạ kết quả Photon, so sánh phường tại ghim).
 * Không cần mạng, không cần CSDL.
 * Chạy: npx tsx tests/address_unit_test.mjs
 */
import {
  normalizeForMatch,
  expandAbbreviations,
  splitHouseAndStreet,
  splitAlleyName,
  streetKeyOf,
  cleanStreetDisplay,
  sameHouseNumber,
  distanceMeters,
} from '@/lib/address/normalize';
import {
  canonicalWardKey,
  detectLocationMismatch,
  resolveAdminFromProvider,
  matchAdminSegment,
  formatAdminLine,
  isHcmRegionText,
} from '@/lib/address/admin';
import { createServiceZone } from '@/lib/address/serviceZone';
import {
  parseAddressInput,
  hasSearchableText,
  mapPhotonFeature,
  mapLocalStreet,
  buildAreaFallback,
  buildPhotonRequests,
  photonUrl,
  dedupeSuggestions,
  rankSuggestions,
  finalizeSuggestions,
} from '@/lib/address/suggest';
import { findStreetCoordinates } from '@/data/vietnam-streets';
import { matchStandardAdministrative, estimateCoordinatesFromAddress } from '@/lib/geo';

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
const section = (t) => console.log(`\n── ${t}`);

// ────────────────────────────────────────────────────────────────────────────
section('1. Chuẩn hóa chữ để so khớp');
check('bỏ dấu, đ → d, gộp khoảng trắng', normalizeForMatch('  Đường  Hạnh   Thông ') === 'duong hanh thong');
check('NFC và NFD cho cùng kết quả', normalizeForMatch('Hạnh Thông'.normalize('NFD')) === normalizeForMatch('Hạnh Thông'.normalize('NFC')));
check('P. → phường', expandAbbreviations(normalizeForMatch('P. Hạnh Thông')) === 'phuong hanh thong');
check('p5 / p 5 → phường 5', expandAbbreviations('p5') === 'phuong 5' && expandAbbreviations('p 5') === 'phuong 5');
check('Q.1 / q1 → quận 1', expandAbbreviations(normalizeForMatch('Q.1')) === 'quan 1' && expandAbbreviations('q1') === 'quan 1');
check('TP.HCM → thành phố hồ chí minh', expandAbbreviations(normalizeForMatch('TP.HCM')) === 'thanh pho ho chi minh');
check('tp hcm / sg / hcm', expandAbbreviations('tp hcm') === 'thanh pho ho chi minh' && expandAbbreviations('sg') === 'ho chi minh');
check('đ. Lê Lợi → đường Lê Lợi', expandAbbreviations(normalizeForMatch('Đ. Lê Lợi')) === 'duong le loi');
check('"D2" không bị đổi thành đường', expandAbbreviations('d2') === 'd2');
check('khóa tên đường bỏ chữ Đường', streetKeyOf('Đường Lê Lợi') === 'le loi' && streetKeyOf('Lê Lợi') === 'le loi');
check('Đường số 1 giữ phần "số 1"', streetKeyOf('Đường số 1') === 'so 1');
check('Đường D2 giữ "d2"', streetKeyOf('Đường D2') === 'd2');

// ────────────────────────────────────────────────────────────────────────────
section('2. Tách số nhà và tên đường');
const cases = [
  ['101 Lê Lợi', '101', '101', 'Lê Lợi', false],
  ['101A Lê Lợi', '101A', '101A', 'Lê Lợi', false],
  ['101/5 Lê Lợi', '101/5', '101/5', 'Lê Lợi', false],
  ['12/34/5 Lê Lợi', '12/34/5', '12/34/5', 'Lê Lợi', false],
  ['12 / 34 / 5 Lê Lợi', '12/34/5', '12/34/5', 'Lê Lợi', false],
  ['Số 101 Lê Lợi', '101', '101', 'Lê Lợi', false],
  ['Nhà số 2C Phổ Quang', '2C', '2C', 'Phổ Quang', false],
  ['Hẻm 76 Lê Lợi', '76', 'Hẻm 76', 'Lê Lợi', true],
  ['ngõ 12/3 Lê Lợi', '12/3', 'Ngõ 12/3', 'Lê Lợi', true],
  ['Lê Lợi', '', '', 'Lê Lợi', false],
  ['Đường số 1', '', '', 'Đường số 1', false],
  ['101 Đường Lê Lợi', '101', '101', 'Lê Lợi', false],
];
for (const [text, house, label, street, alley] of cases) {
  const r = splitHouseAndStreet(text);
  check(
    `"${text}" → số nhà "${house}", đường "${street}"${alley ? ', là số hẻm' : ''}`,
    r.houseNumber === house && r.houseLabel === label && r.street === street && r.isAlley === alley,
    JSON.stringify(r)
  );
}
check('chỉ gõ "101" thì chưa đủ để tìm', hasSearchableText('101') === false && hasSearchableText('101 Lê') === true && hasSearchableText('Lê') === true);
check('sameHouseNumber không phân biệt hoa thường', sameHouseNumber('12/34/5a', '12/34/5A') && !sameHouseNumber('12', '13'));
const alley = splitAlleyName('Hẻm 116 Đường Lê Lợi');
check('tên hẻm của nhà cung cấp gộp về đường chính', alley && alley.baseStreet === 'Lê Lợi' && alley.alleyNumber === '116');
check('"Hẻm 142/8 Đường Lê Lợi" → số hẻm 142/8', splitAlleyName('Hẻm 142/8 Đường Lê Lợi')?.alleyNumber === '142/8');
check('"Lê Lợi" không phải hẻm', splitAlleyName('Lê Lợi') === null);

// ────────────────────────────────────────────────────────────────────────────
section('3. Phường / quận khách gõ (ca lỗi: 101 Lê Lợi, Hạnh Thông, Gò Vấp)');
{
  const p = parseAddressInput('101 Lê Lợi, Hạnh Thông, Gò Vấp');
  check('số nhà 101, đường Lê Lợi', p.houseNumber === '101' && p.street === 'Lê Lợi');
  check('"Hạnh Thông" nhận là phường mới của quận Gò Vấp cũ', p.hints.wards.length === 1 && p.hints.wards[0].ward === 'Phường Hạnh Thông' && p.hints.wards[0].district === 'Quận Gò Vấp');
  check('"Gò Vấp" vừa là quận vừa là phường → ghi nhập nhằng, không tự suy là phường', p.hints.ambiguous.length === 1 && p.hints.ambiguous[0].token === 'Gò Vấp' && !p.hints.wards.some((w) => w.ward === 'Phường Gò Vấp'));
  check('có dấu phẩy nên là gợi ý chắc (không soft)', p.hints.soft === false);
}
{
  const p = parseAddressInput('101 Lê Lợi, Gò Vấp');
  check('"…, Gò Vấp" không bị ép thành Phường Gò Vấp', p.hints.wards.length === 0 && p.hints.ambiguous.length === 1);
  check('nhập nhằng gồm cả quận cũ lẫn phường mới', p.hints.ambiguous[0].districts.includes('Quận Gò Vấp') && p.hints.ambiguous[0].wards.some((w) => w.ward === 'Phường Gò Vấp'));
}
{
  const p = parseAddressInput('101 le loi go vap');
  check('không dấu, không dấu phẩy: vẫn nhận "go vap", đánh dấu soft', p.street === 'le loi' && p.hints.ambiguous.length === 1 && p.hints.soft === true);
}
{
  const p = parseAddressInput('101 le loi hanh thong go vap');
  check('không dấu phẩy: bóc được cả phường lẫn quận', p.hints.wards[0]?.ward === 'Phường Hạnh Thông' && p.hints.ambiguous[0]?.token === 'go vap' && p.street === 'le loi');
}
{
  const p = parseAddressInput('101 Lê Lợi, P.1, Gò Vấp');
  check('kiểu cũ "P.1, Gò Vấp" đổi sang phường mới Hạnh Thông', p.hints.wards.some((w) => w.ward === 'Phường Hạnh Thông'));
}
{
  const p = parseAddressInput('101 Lê Lợi, Phường 1, Quận Gò Vấp');
  check('kiểu cũ đầy đủ: quận Gò Vấp + phường Hạnh Thông', p.hints.districts.includes('Quận Gò Vấp') && p.hints.wards.some((w) => w.ward === 'Phường Hạnh Thông'));
}
{
  const p = parseAddressInput('45 Phạm Ngũ Lão');
  check('"Phạm Ngũ Lão" là tên đường, không bị bóc thành phường', p.street === 'Phạm Ngũ Lão' && p.hints.wards.length === 0 && p.hints.ambiguous.length === 0);
}
{
  const p = parseAddressInput('12 Nguyễn Văn Bảo, Thủ Đức');
  check('"…, Thủ Đức" chỉ là gợi ý nhập nhằng/quận, không ép vào phường', p.hints.wards.length === 0);
}
{
  // "Chợ Quán" trước đây chưa có trong dữ liệu nội bộ; nay đã có (danh mục chính thức), nên dùng một tên giả để kiểm đường "chưa biết"
  const p = parseAddressInput('197 Trần Phú, Xóm Thử Nghiệm');
  check('phường dữ liệu chưa biết vẫn được ghi để so với kết quả', p.hints.unknown.includes('xom thu nghiem'));
}
check('Q.5 nhận là quận 5', matchAdminSegment('Q.5')?.districts[0] === 'Quận 5');
check('số trần "5" không phải địa danh', matchAdminSegment('5') === null);
check('"Việt Nam" không tính là phường/quận', matchAdminSegment('Việt Nam') === null);

// ────────────────────────────────────────────────────────────────────────────
section('4. Đổi tên cũ ↔ mới và so sánh phường tại ghim');
check('Phường 1 (Gò Vấp) ≡ Phường Hạnh Thông', canonicalWardKey('Phường 1', 'Quận Gò Vấp').key === canonicalWardKey('Phường Hạnh Thông', 'Quận Gò Vấp').key);
check('Phường 3 (Gò Vấp) cũng về Hạnh Thông', canonicalWardKey('P.3', 'Quận Gò Vấp').key === 'hanh thong');
{
  const r = resolveAdminFromProvider({ ward: 'Hạnh Thông', lat: 10.8208, lng: 106.6874 });
  check('Photon trả "Hạnh Thông" → phường mới + quận cũ chính xác', r.ward === 'Phường Hạnh Thông' && r.district === 'Quận Gò Vấp' && r.exact === true && r.province === 'TP. Hồ Chí Minh');
}
{
  const r = resolveAdminFromProvider({ ward: 'Xóm Thử Nghiệm', lat: 10.7629, lng: 106.6793 });
  check('phường chưa có trong dữ liệu: giữ tên phường của nhà cung cấp, quận cũ suy theo vị trí', r.ward === 'Phường Xóm Thử Nghiệm' && r.exact === false && !!r.district);
}
check('cùng phường (tên cũ vs mới) thì không lệch', detectLocationMismatch({ ward: 'Phường 1', district: 'Quận Gò Vấp' }, { ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' }).mismatch === false);
check('khác phường thì cảnh báo (Hạnh Thông vs Bến Thành)', detectLocationMismatch({ ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' }, { ward: 'Phường Bến Thành', district: 'Quận 1' }).reason === 'ward');
check('không so được phường thì so quận cũ', detectLocationMismatch({ ward: 'Phường Zzz', district: 'Quận 1' }, { ward: 'Phường Yyy', district: 'Quận Gò Vấp' }).reason === 'district');
check('ghim cách xa khu vực đã chọn thì cảnh báo "far"', detectLocationMismatch({ ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' }, { ward: 'Phường Lạ', district: undefined }, { lat: 10.85, lng: 106.77 }).reason === 'far');
check('ghim trong khu vực thì không cảnh báo', detectLocationMismatch({ ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' }, { ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' }, { lat: 10.8208, lng: 106.6874 }).mismatch === false);
check('hiển thị "P. Hạnh Thông (Gò Vấp cũ), TP.HCM"', formatAdminLine({ ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp', province: 'TP. Hồ Chí Minh' }) === 'P. Hạnh Thông (Gò Vấp cũ), TP.HCM');
check('hiển thị "P. Bến Thành (Q.1 cũ), TP.HCM"', formatAdminLine({ ward: 'Phường Bến Thành', district: 'Quận 1', province: 'TP. Hồ Chí Minh' }) === 'P. Bến Thành (Q.1 cũ), TP.HCM');
// Vùng giao: hợp các vòng tròn bán kính giao quanh cửa hàng (cấu hình), không có danh sách vùng riêng
const ZONE = createServiceZone([{ lat: 10.7769, lng: 106.7009 }, { lat: 10.35, lng: 107.07 }], 20);
check('vùng giao từ cửa hàng + bán kính: Gò Vấp trong; Hà Nội, Đà Nẵng ngoài', !!ZONE && ZONE.contains(10.82, 106.68) && !ZONE.contains(21.03, 105.85) && !ZONE.contains(16.07, 108.22));
check('vùng giao: điểm cách mọi cửa hàng quá 20 km bị loại (Bình Chánh cũ 10.355, 106.367)', !!ZONE && !ZONE.contains(10.355, 106.367));
check('không có cửa hàng thì không có vùng (không lọc theo vị trí)', createServiceZone([], 20) === null);
check('cổng tỉnh thô theo chữ nhà cung cấp', isHcmRegionText('Thành phố Hồ Chí Minh') && isHcmRegionText('Thành phố Vũng Tàu Tỉnh Bà Rịa - Vũng Tàu') && !isHcmRegionText('Hà Nội') && !isHcmRegionText('Thành phố Đà Nẵng'));
check('khoảng cách ~ 1 km', Math.abs(distanceMeters({ lat: 10.8, lng: 106.7 }, { lat: 10.809, lng: 106.7 }) - 1000) < 10);

// ────────────────────────────────────────────────────────────────────────────
section('5. Ánh xạ kết quả Photon');
const feat = (props, lat, lng) => ({ properties: props, geometry: { coordinates: [lng, lat] } });
const GV = { city: 'Thành phố Hồ Chí Minh', countrycode: 'VN' };
const photon = {
  hem116: feat({ ...GV, osm_type: 'W', osm_id: 1, type: 'street', name: 'Hẻm 116 Đường Lê Lợi', district: 'Hạnh Thông', locality: 'Khu phố 25' }, 10.8193, 106.6853),
  hem142: feat({ ...GV, osm_type: 'W', osm_id: 2, type: 'street', name: 'Hẻm 142/8 Đường Lê Lợi', district: 'Hạnh Thông' }, 10.8191, 106.6844),
  streetGV: feat({ ...GV, osm_type: 'W', osm_id: 3, type: 'street', name: 'Đường Lê Lợi', district: 'Hạnh Thông' }, 10.8208, 106.6874),
  streetQ1: feat({ ...GV, osm_type: 'W', osm_id: 4, type: 'street', name: 'Lê Lợi', district: 'Bến Thành' }, 10.7727, 106.6994),
  house101: feat({ ...GV, osm_type: 'N', osm_id: 5, type: 'house', housenumber: '101', street: 'Lê Lợi', name: 'Tiệm Tạp Hóa A', district: 'Hạnh Thông' }, 10.8201, 106.6862),
  school5: feat({ ...GV, osm_type: 'N', osm_id: 6, type: 'house', housenumber: '5', street: 'Lê Lợi', name: 'Trường Tiểu học Lê Lợi', district: 'Hạnh Thông' }, 10.8212, 106.6881),
  busStop: feat({ ...GV, osm_type: 'N', osm_id: 7, type: 'house', name: 'Lê Lợi', street: 'Phạm Văn Đồng', district: 'Hạnh Thông' }, 10.8176, 106.6852),
  hanoi: feat({ countrycode: 'VN', osm_type: 'W', osm_id: 8, type: 'street', name: 'Ngõ 197 Đường Trần Phú', district: 'Hà Đông', city: 'Hà Nội' }, 20.976, 105.7846),
  vungtau: feat({ osm_type: 'N', osm_id: 9, type: 'house', housenumber: '197', street: 'Trần Phú', name: 'Tạp hóa Diễm Trâm', district: 'Vũng Tàu', city: 'Thành phố Vũng Tàu', state: 'Tỉnh Bà Rịa - Vũng Tàu', countrycode: 'VN' }, 10.3824, 107.066),
  poi: feat({ ...GV, osm_type: 'N', osm_id: 10, type: 'district', name: 'Hạnh Thông' }, 10.82, 106.68),
};
const p101 = parseAddressInput('101 Lê Lợi, Hạnh Thông, Gò Vấp');
{
  const s = mapPhotonFeature(photon.hem116, p101);
  check('hẻm 116 gộp về "101 Lê Lợi" (không còn "101 Hẻm 116 Đường Lê Lợi")', s?.main_text === '101 Lê Lợi' && s.street === 'Lê Lợi' && s.precision === 'street');
  check('phường mới + quận cũ đúng, "Khu phố 25" không lọt vào địa chỉ', s?.ward === 'Phường Hạnh Thông' && s.district === 'Quận Gò Vấp' && !/khu ph/i.test(s.description));
  check('dòng phụ 2 hàng đúng định dạng', s?.secondary_text === 'P. Hạnh Thông (Gò Vấp cũ), TP.HCM');
  check('hẻm 116 và hẻm 142/8 cùng phường cho cùng một id (sẽ được gộp)', mapPhotonFeature(photon.hem142, p101)?.place_id === s?.place_id);
}
{
  const s = mapPhotonFeature(photon.house101, p101);
  check('nhà có đúng số 101 → precision "house", id ổn định theo OSM', s?.precision === 'house' && s.place_id === 'ph:N5' && s.label === 'Tiệm Tạp Hóa A');
  const t = mapPhotonFeature(photon.school5, p101);
  check('nhà số 5 khác số khách gõ → chỉ là mức đường, số nhà vẫn là 101', t?.precision === 'street' && t.main_text === '101 Lê Lợi' && !t.label);
}
check('địa điểm không có số nhà (trạm xe buýt) bị bỏ', mapPhotonFeature(photon.busStop, p101) === null);
check('kết quả mức quận/phường (type=district) bị bỏ', mapPhotonFeature(photon.poi, p101) === null);
check('kết quả ngoài vùng phục vụ (Hà Nội) bị bỏ', mapPhotonFeature(photon.hanoi, p101) === null);
{
  const s = mapPhotonFeature(photon.vungtau, parseAddressInput('197 Trần Phú'));
  check('Vũng Tàu (đã sáp nhập TP.HCM) vẫn nhận, ghi tỉnh TP. Hồ Chí Minh', s?.province === 'TP. Hồ Chí Minh' && s.precision === 'house' && s.ward === 'Phường Vũng Tàu');
}
{
  const a = mapPhotonFeature(photon.streetGV, parseAddressInput('Lê Lợi'));
  const b = mapPhotonFeature(photon.streetGV, parseAddressInput('Lê Lợi'));
  check('cùng đầu vào cho cùng id (không dùng Math.random)', a?.place_id === b?.place_id && !!a?.place_id);
  check('không gõ số nhà thì dòng chính chỉ có tên đường', a?.main_text === 'Lê Lợi');
}
{
  const alleyInput = parseAddressInput('Hẻm 76 Lê Lợi, Hạnh Thông');
  const s = mapPhotonFeature(photon.hem116, alleyInput);
  check('khách gõ hẻm 76 thì giữ "Hẻm 76 Lê Lợi" (không đổi thành hẻm 116)', s?.main_text === 'Hẻm 76 Lê Lợi');
}

// ────────────────────────────────────────────────────────────────────────────
section('6. Xếp hạng: không bao giờ ép sang Quận 1, mơ hồ thì hiện nhiều lựa chọn');
const local = (parsed) => mapLocalStreet({ place_id: 'x', main_text: `${parsed.houseNumber} Lê Lợi`.trim(), houseNumber: parsed.houseNumber, lat: 10.7735, lng: 106.6995, district: 'Quận 1', province: 'TP. Hồ Chí Minh', wardHint: 'Phường Bến Thành' }, parsed);
const feats = (parsed) =>
  [photon.streetQ1, photon.streetGV, photon.hem116, photon.house101, photon.school5].map((f) => mapPhotonFeature(f, parsed)).filter(Boolean);
{
  const cands = [local(p101), ...feats(p101)];
  const out = finalizeSuggestions(cands, p101);
  check('"…, Hạnh Thông, Gò Vấp": gợi ý đầu ở Phường Hạnh Thông', out[0]?.ward === 'Phường Hạnh Thông', JSON.stringify(out.map((s) => `${s.main_text}|${s.ward}`)));
  check('nhà đúng số 101 ở Hạnh Thông đứng trên đường chung', out[0]?.precision === 'house');
  const q1 = out.findIndex((s) => s.district === 'Quận 1');
  check('kết quả Quận 1 mâu thuẫn bị loại khi đã có kết quả đúng Hạnh Thông', q1 === -1, `vị trí ${q1}/${out.length}`);
}
{
  const p = parseAddressInput('101 Lê Lợi, Gò Vấp');
  const cands = [local(p), ...[photon.streetQ1, photon.streetGV].map((f) => mapPhotonFeature(f, p))];
  const out = finalizeSuggestions(cands, p);
  check('"…, Gò Vấp": Gò Vấp lên đầu, Quận 1 bị loại', out[0]?.district === 'Quận Gò Vấp' && !out.some((s) => s.district === 'Quận 1'));
}
{
  const p = parseAddressInput('101 le loi go vap');
  const out = finalizeSuggestions([local(p), mapPhotonFeature(photon.streetGV, p)], p);
  check('không dấu "101 le loi go vap": vẫn đưa Gò Vấp lên trên Quận 1', out[0]?.district === 'Quận Gò Vấp');
}
{
  const p = parseAddressInput('Lê Lợi');
  const cands = [local(p), mapPhotonFeature(photon.streetQ1, p), mapPhotonFeature(photon.streetGV, p)];
  const out = finalizeSuggestions(cands, p);
  const wards = new Set(out.map((s) => s.ward));
  check('chỉ gõ "Lê Lợi": hiện cả Quận 1 lẫn Gò Vấp, không tự chọn hộ', wards.has('Phường Bến Thành') && wards.has('Phường Hạnh Thông'));
  check('Quận 1 trùng (nội bộ + Photon) được gộp thành 1', out.filter((s) => s.ward === 'Phường Bến Thành').length === 1);
  check('trùng thì giữ nguồn Photon, không phải bảng nội bộ', out.find((s) => s.ward === 'Phường Bến Thành')?.source === 'photon');
}
{
  const p = parseAddressInput('197 Trần Phú, Chợ Quán');
  const chq = mapPhotonFeature(feat({ ...GV, osm_id: 11, osm_type: 'W', type: 'street', name: 'Trần Phú', district: 'Chợ Quán' }, 10.7629, 106.6793), p);
  const vt = mapPhotonFeature(photon.vungtau, p);
  const out = rankSuggestions([vt, chq], p);
  check('"197 Trần Phú, Chợ Quán": Chợ Quán lên trước dù Vũng Tàu trùng đúng số nhà', out[0]?.ward === 'Phường Chợ Quán', JSON.stringify(out.map((s) => `${s.ward}:${s.score}`)));
}
{
  const p = parseAddressInput('101 Lê Lợi, Hạnh Thông');
  const out = finalizeSuggestions([local(p)], p);
  check('chỉ còn kết quả Quận 1 (nhà cung cấp lỗi): thêm gợi ý "vị trí gần đúng" ở Hạnh Thông và xếp đầu', out[0]?.source === 'area' && out[0].ward === 'Phường Hạnh Thông' && out[0].main_text === '101 Lê Lợi' && out[0].precision === 'area');
  check('gợi ý gần đúng có tọa độ tâm phường', typeof out[0]?.lat === 'number' && ZONE.contains(out[0].lat, out[0].lng));
}
check('không có gợi ý hành chính thì không tạo gợi ý gần đúng', buildAreaFallback(parseAddressInput('101 Lê Lợi')) === null);
{
  const a = [photon.hem116, photon.hem142, photon.streetGV].map((f) => mapPhotonFeature(f, p101));
  check('ba kết quả cùng đường + phường gộp còn 1', dedupeSuggestions(a).length === 1);
}
{
  const out = rankSuggestions([mapPhotonFeature(photon.streetGV, parseAddressInput('Lê Lợi'))], parseAddressInput('Lê Lợi'));
  check('rank không sửa mảng đầu vào và thêm điểm', out.length === 1 && typeof out[0].score === 'number');
}
{
  const p = parseAddressInput('Lê Lợi');
  const base = [mapPhotonFeature(photon.streetQ1, p), mapPhotonFeature(photon.streetGV, p)];
  const near = rankSuggestions(base, p, { bias: { lat: 10.82, lng: 106.68 } });
  const none = rankSuggestions(base, p, {});
  check('bias vị trí chỉ đổi thứ tự khi có tín hiệu thật, không loại kết quả', near.length === 2 && near[0].ward === 'Phường Hạnh Thông' && none.length === 2);
  const ctx = rankSuggestions(base, p, { context: { ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' } });
  check('ô chọn phường chỉ cộng nhẹ, không loại ai', ctx.length === 2 && ctx[0].ward === 'Phường Hạnh Thông');
}

// Ca thật từ Photon (05/11): số nhà trùng ở một đường khác, hoặc nhà đúng số ở khu khác, không được đứng trên đúng đường + đúng khu
const hoangPhai = (p) =>
  mapPhotonFeature(feat({ ...GV, osm_type: 'N', osm_id: 21, type: 'house', housenumber: '101', street: 'Lê Hoàng Phái', district: 'Gò Vấp' }, 10.8411, 106.6753), p);
const vungTauLoi = (p) =>
  mapPhotonFeature(
    feat({ osm_type: 'N', osm_id: 22, type: 'house', housenumber: '101', street: 'Lê Lợi', district: 'Vũng Tàu', city: 'Thành phố Vũng Tàu', state: 'Tỉnh Bà Rịa - Vũng Tàu', countrycode: 'VN' }, 10.3637, 107.0747),
    p
  );
const dump = (out) => JSON.stringify(out.map((s) => `${s.source}|${s.main_text}|${s.ward}|${s.score}`));
{
  const p = parseAddressInput('101 Lê Lợi, Gò Vấp');
  const hp = hoangPhai(p);
  check('nhận "101 Lê Hoàng Phái" ở phường Gò Vấp (mức nhà) từ Photon', hp?.ward === 'Phường Gò Vấp' && hp.precision === 'house', JSON.stringify(hp));
  const out = finalizeSuggestions([hp, mapPhotonFeature(photon.streetGV, p), local(p)], p);
  check('"101 Lê Lợi, Gò Vấp": đúng đường Lê Lợi (Hạnh Thông) đứng trên "101 Lê Hoàng Phái" cùng số nhà', out[0]?.street === 'Lê Lợi' && out[0].ward === 'Phường Hạnh Thông', dump(out));
}
{
  const p = parseAddressInput('101 le loi go vap');
  const out = finalizeSuggestions([vungTauLoi(p), mapPhotonFeature(photon.streetGV, p), local(p)], p);
  check('"101 le loi go vap" (không dấu phẩy): Gò Vấp đứng trên nhà đúng số nhưng ở Vũng Tàu', out[0]?.district === 'Quận Gò Vấp', dump(out));
}
{
  const p = parseAddressInput('101 le loi go vap');
  const out = finalizeSuggestions([vungTauLoi(p)], p);
  check('chỉ còn kết quả Vũng Tàu: thêm gợi ý "vị trí gần đúng" ở Gò Vấp và xếp đầu', out[0]?.source === 'area' && out[0].district === 'Quận Gò Vấp', dump(out));
}
{
  const p = parseAddressInput('101 Lê Lợi');
  const lqd = mapPhotonFeature(feat({ ...GV, osm_type: 'N', osm_id: 23, type: 'house', housenumber: '101', street: 'Lê Quang Định', district: 'Hạnh Thông' }, 10.8167, 106.6888), p);
  const out = rankSuggestions([lqd, mapPhotonFeature(photon.streetGV, p)], p);
  check('chỉ chung một từ ("Lê") không phải cùng đường: "Lê Quang Định" nằm dưới "Lê Lợi"', out[0]?.street === 'Lê Lợi', dump(out));
}

// Ca đo thật 05/11: đã có kết quả đúng đường + đúng khu thì bỏ kết quả khác đường / khác khu (nhiễu của tìm kiếm mờ)
{
  const p = parseAddressInput('101 Lê Lợi, Hạnh Thông');
  const out = finalizeSuggestions([vungTauLoi(p), mapPhotonFeature(photon.streetGV, p), local(p), hoangPhai(p)], p);
  check('"101 Lê Lợi, Hạnh Thông": chỉ còn kết quả đúng Lê Lợi + đúng Hạnh Thông (bỏ Vũng Tàu, Quận 1, Lê Hoàng Phái)',
    out.length === 1 && out[0].ward === 'Phường Hạnh Thông' && out[0].street === 'Lê Lợi', dump(out));
}
{
  const p = parseAddressInput('Lê Lợi');
  const lqd = mapPhotonFeature(feat({ ...GV, osm_type: 'N', osm_id: 23, type: 'house', housenumber: '101', street: 'Lê Quang Định', district: 'Hạnh Thông' }, 10.8167, 106.6888), p);
  const out = finalizeSuggestions([lqd, mapPhotonFeature(photon.streetQ1, p), mapPhotonFeature(photon.streetGV, p)], p);
  check('"Lê Lợi" (không gõ khu): giữ mọi khu có đường Lê Lợi, bỏ đường khác tên', out.length === 2 && out.every((s) => s.street === 'Lê Lợi'), dump(out));
}
{
  const p = parseAddressInput('101 Lê Lợi, Chợ Quán');
  const out = finalizeSuggestions([local(p), mapPhotonFeature(photon.streetGV, p)], p);
  check('khách gõ nhầm khu (chưa có kết quả đúng khu): vẫn giữ các kết quả để khách chọn', out.length >= 2, dump(out));
}
{
  const p = parseAddressInput('197 Trần Phú');
  const strictZone = createServiceZone([{ lat: 10.7769, lng: 106.7009 }], 20);
  check('vùng giao loại điểm Vũng Tàu khi cửa hàng chỉ ở trung tâm TP', mapPhotonFeature(photon.vungtau, p, strictZone) === null && !!mapPhotonFeature(photon.vungtau, p, ZONE));
}

// ────────────────────────────────────────────────────────────────────────────
// Chưa gõ khu: gộp đoạn cùng đường cách < 1 km, 4 mục đầu thuộc 4 khu khác nhau
{
  const p = parseAddressInput('Lê Lợi');
  const mk = (id, ward, district, lat, lng) => ({ place_id: id, main_text: 'Lê Lợi', secondary_text: '', description: '', source: 'photon', street: 'Lê Lợi', ward, district, lat, lng, precision: 'street' });
  const out = finalizeSuggestions([
    mk('a', 'Phường Bến Thành', 'Quận 1', 10.7733, 106.7),
    mk('b', 'Phường Sài Gòn', 'Quận 1', 10.774, 106.7005),
    mk('c', 'Phường Bình Dương', 'TP. Bến Cát', 11.1023, 106.669),
    mk('d', 'Phường Hạnh Thông', 'Quận Gò Vấp', 10.8208, 106.6874),
    mk('e', 'Phường Vũng Tàu', 'TP. Vũng Tàu', 10.36, 107.07),
  ], p);
  check('"Lê Lợi": Bến Thành và Sài Gòn (cách ~95 m, cùng đại lộ) gộp thành 1 mục', out.filter((s) => s.district === 'Quận 1').length === 1, dump(out));
  check('"Lê Lợi": 4 mục đầu thuộc 4 khu khác nhau, có Gò Vấp', new Set(out.slice(0, 4).map((s) => s.district)).size === 4 && out.slice(0, 4).some((s) => s.district === 'Quận Gò Vấp'), dump(out));
}

section('7. Câu hỏi gửi Photon');
{
  const reqs = buildPhotonRequests(p101, null);
  check('luôn gửi NGUYÊN chuỗi khách gõ', reqs[0].q === '101 Lê Lợi, Hạnh Thông, Gò Vấp');
  check('có địa danh thì kế hoạch có 1 câu bổ sung chỉ số nhà + đường kèm bias khu vực (chỉ gửi khi câu chính chưa tốt)', reqs.length === 2 && reqs[1].q === '101 Lê Lợi' && !!reqs[1].bias);
  check('câu nguyên văn dùng bias khu vực khách gõ, không phải Quận 1', Math.abs(reqs[0].bias.lat - 10.821) < 0.01);
  const none = buildPhotonRequests(parseAddressInput('Lê Lợi'), null);
  check('không địa danh, không GPS: không bias (không mặc định về Quận 1)', none.length === 1 && none[0].bias === null);
  const gps = buildPhotonRequests(parseAddressInput('Lê Lợi'), { lat: 10.9, lng: 106.7 });
  check('có GPS thì dùng làm bias', gps[0].bias?.lat === 10.9);
  const url = photonUrl(reqs[0], ZONE);
  check('URL có layer=street&house, bbox lấy từ vùng giao và lat/lon', /layer=street/.test(url) && /layer=house/.test(url) && /bbox=/.test(url) && /lat=/.test(url));
  check('chưa có vùng giao thì bỏ bbox', !/bbox=/.test(photonUrl(reqs[0], null)));
  check('PHOTON_BASE_URL đổi được máy chủ Photon', photonUrl(reqs[0], null, 'https://photon.example.vn').startsWith('https://photon.example.vn/api/?'));
  const multi = buildPhotonRequests(parseAddressInput('12/34/5 Lê Lợi'), null);
  check('số nhà nhiều cấp: câu bổ sung chỉ có tên đường (OSM không có số nhà dạng đó)', multi.length === 2 && multi[1].q === 'Lê Lợi');
  check('chuẩn hóa chữ Ð/ð của OSM về Đ/đ khi so khớp và hiển thị', streetKeyOf('Trần Hưng Ðạo') === streetKeyOf('Trần Hưng Đạo') && cleanStreetDisplay('Trần Hưng Ðạo') === 'Trần Hưng Đạo');
}

// ────────────────────────────────────────────────────────────────────────────
section('8. Hàm dữ liệu cũ không còn ghi đè sang quận khác (backend ước tọa độ khi thiếu lat/lng)');
{
  const gv = findStreetCoordinates('101 Lê Lợi', 'Quận Gò Vấp', 'TP. Hồ Chí Minh');
  check('"101 Lê Lợi" + Quận Gò Vấp: không trả đường Lê Lợi của Quận 1', gv === null);
  const q1 = findStreetCoordinates('101 Lê Lợi', 'Quận 1', 'TP. Hồ Chí Minh');
  check('"101 Lê Lợi" + Quận 1: vẫn ra đúng đường Quận 1', q1?.matchedStreet.district === 'Quận 1');
  const q12 = findStreetCoordinates('101 Lê Lợi', 'Quận 12', 'TP. Hồ Chí Minh');
  check('Quận 12 không bị khớp nhầm thành Quận 1 (so theo từ nguyên vẹn)', q12 === null);
  const none = findStreetCoordinates('157 Nguyễn Thái Bình', undefined, 'TP. Hồ Chí Minh');
  check('không nêu quận: giữ cách cũ (trả ứng viên đã biết)', !!none);
  const est = estimateCoordinatesFromAddress('TP. Hồ Chí Minh', 'Quận Gò Vấp', '101 Lê Lợi');
  check('ước tọa độ "101 Lê Lợi" + Gò Vấp rơi về tâm Quận Gò Vấp, không phải Quận 1', !!est && Math.abs(est.lat - 10.8388) < 0.05 && Math.abs(est.lng - 106.6658) < 0.05, JSON.stringify(est));
  const m = matchStandardAdministrative(undefined, undefined, undefined, '101 Lê Lợi, Hạnh Thông, Gò Vấp');
  check('không còn tổ hợp "Quận Gò Vấp + Phường Bến Thành"', !(m.district === 'Quận Gò Vấp' && m.ward === 'Phường Bến Thành'), JSON.stringify(m));
}

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
