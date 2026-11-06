/**
 * Kiểm thử API gợi ý địa chỉ (/api/geo/autocomplete) với Photon GIẢ: không cần mạng, không cần CSDL.
 * Chứng minh ở cấp API: gửi nguyên chuỗi khách gõ, không bias Quận 1, ca "101 Lê Lợi, Hạnh Thông, Gò Vấp" ra Gò Vấp,
 * chuỗi mơ hồ hiện nhiều lựa chọn, bỏ kết quả ngoài vùng, id ổn định, Photon chậm/lỗi vẫn có gợi ý.
 * Chạy: npx tsx tests/address_autocomplete_api_test.mjs
 */
delete process.env.GOOGLE_MAPS_API_KEY;
delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
delete process.env.DISABLE_PHOTON_GEOCODER;
// Các nhóm 1–5 kiểm từng lượt gọi Photon nên tắt đệm và cầu dao; nhóm 6 bật lại để kiểm riêng
process.env.PHOTON_CACHE_TTL_MS = '0';
process.env.PHOTON_BREAKER_FAILURES = '0';

process.env.GEO_CONTACT_EMAIL = 'lien-he@example.vn';
process.env.GEO_APP_NAME = 'TestShop';

const { NextRequest } = await import('next/server');
const route = await import('@/app/api/geo/autocomplete/route');
// Vùng giao cố định (cửa hàng ở trung tâm TP và Vũng Tàu, bán kính 20 km) để test không cần CSDL
const { createServiceZone, setServiceZoneOverride } = await import('@/lib/address/serviceZone');
setServiceZoneOverride(createServiceZone([{ lat: 10.7769, lng: 106.7009 }, { lat: 10.35, lng: 107.07 }], 20));

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

// ─── Photon giả ───
const GVprops = { city: 'Thành phố Hồ Chí Minh', countrycode: 'VN' };
const f = (props, lat, lng) => ({ type: 'Feature', properties: { ...GVprops, ...props }, geometry: { type: 'Point', coordinates: [lng, lat] } });
const FIX = {
  q1: f({ osm_type: 'W', osm_id: 4, type: 'street', name: 'Lê Lợi', district: 'Bến Thành' }, 10.7727, 106.6994),
  gvStreet: f({ osm_type: 'W', osm_id: 3, type: 'street', name: 'Đường Lê Lợi', district: 'Hạnh Thông', locality: 'Khu phố 24' }, 10.8208, 106.6874),
  gvAlley: f({ osm_type: 'W', osm_id: 1, type: 'street', name: 'Hẻm 116 Đường Lê Lợi', district: 'Hạnh Thông' }, 10.8193, 106.6853),
  gvAlley2: f({ osm_type: 'W', osm_id: 2, type: 'street', name: 'Hẻm 142/8 Đường Lê Lợi', district: 'Hạnh Thông' }, 10.8191, 106.6844),
  gvHouse: f({ osm_type: 'N', osm_id: 5, type: 'house', housenumber: '101', street: 'Lê Lợi', name: 'Tiệm Tạp Hóa A', district: 'Hạnh Thông' }, 10.8201, 106.6862),
  school: f({ osm_type: 'N', osm_id: 6, type: 'house', housenumber: '5', street: 'Lê Lợi', name: 'Trường Tiểu học Lê Lợi', district: 'Hạnh Thông' }, 10.8212, 106.6881),
  busStop: f({ osm_type: 'N', osm_id: 7, type: 'house', name: 'Lê Lợi', street: 'Phạm Văn Đồng', district: 'Hạnh Thông' }, 10.8176, 106.6852),
  hanoi: f({ osm_type: 'W', osm_id: 8, type: 'street', name: 'Ngõ 197 Đường Trần Phú', district: 'Hà Đông', city: 'Hà Nội' }, 20.976, 105.7846),
  chq: f({ osm_type: 'W', osm_id: 11, type: 'street', name: 'Trần Phú', district: 'Chợ Quán' }, 10.7629, 106.6793),
  vungtau: f({ osm_type: 'N', osm_id: 9, type: 'house', housenumber: '197', street: 'Trần Phú', name: 'Tạp hóa Diễm Trâm', district: 'Vũng Tàu', city: 'Thành phố Vũng Tàu', state: 'Tỉnh Bà Rịa - Vũng Tàu' }, 10.3824, 107.066),
};

let photonLog = [];
let photonMode = 'ok'; // ok | timeout | http500
let photonHandler = () => [];
const realFetch = globalThis.fetch;
let photonHeaders = [];
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url));
  if (u.hostname === 'photon.komoot.io' || u.hostname === 'photon.example.vn') {
    photonLog.push(u);
    photonHeaders.push(init?.headers || {});
    if (photonMode === 'timeout') {
      const e = new Error('The operation was aborted due to timeout');
      e.name = 'TimeoutError';
      throw e;
    }
    if (photonMode === 'http500') return { ok: false, status: 500, json: async () => ({}) };
    if (photonMode === 'http429') return { ok: false, status: 429, headers: { get: () => '90' }, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ features: photonHandler(u) }) };
  }
  return realFetch(url, init);
};

async function ask(query) {
  photonLog = [];
  photonHeaders = [];
  const res = await route.GET(new NextRequest(`http://localhost/api/geo/autocomplete?${query}`));
  return { res, data: await res.json() };
}
const input = (text, extra = '') => `input=${encodeURIComponent(text)}${extra}`;

// ────────────────────────────────────────────────────────────────────────────
section('1. Ca lỗi: "101 Lê Lợi, Hạnh Thông, Gò Vấp"');
photonHandler = () => [FIX.q1, FIX.gvAlley, FIX.gvAlley2, FIX.gvStreet, FIX.gvHouse, FIX.school, FIX.busStop, FIX.hanoi];
{
  const text = '101 Lê Lợi, Hạnh Thông, Gò Vấp';
  const { data } = await ask(input(text));
  const p = data.predictions;
  check('thành công, có gợi ý', data.success === true && p.length >= 2, JSON.stringify(p.map((s) => s.main_text)));
  check('Photon nhận NGUYÊN chuỗi khách gõ ở câu đầu', photonLog[0].searchParams.get('q') === text, photonLog[0]?.searchParams.get('q'));
  check('câu chính đã có kết quả đúng đường + đúng khu nên KHÔNG gửi câu bổ sung (1 lượt cho cả phiên gõ)', photonLog.length === 1);
  check('câu chính bias vào khu khách gõ (Gò Vấp), không phải Quận 1 (10.7769, 106.7009)', Math.abs(Number(photonLog[0].searchParams.get('lat')) - 10.821) < 0.01 && photonLog.every((u) => u.searchParams.get('lat') !== '10.77690'));
  check('User-Agent định danh lấy từ biến môi trường (tên web + email liên hệ)', /TestShop/.test(photonHeaders[0]['User-Agent']) && /lien-he@example.vn/.test(photonHeaders[0]['User-Agent']), JSON.stringify(photonHeaders[0]));
  check('giới hạn vùng phục vụ bằng bbox và chỉ lấy đường + nhà (layer)', photonLog[0].searchParams.has('bbox') && photonLog[0].searchParams.getAll('layer').join() === 'street,house');
  check('GỢI Ý ĐẦU TIÊN LÀ PHƯỜNG HẠNH THÔNG (Gò Vấp), không phải Quận 1', p[0].ward === 'Phường Hạnh Thông' && p[0].district === 'Quận Gò Vấp', JSON.stringify(p[0]));
  check('nhà đúng số 101 (OSM) đứng đầu với độ chính xác "house"', p[0].precision === 'house' && p[0].place_id === 'ph:N5');
  const q1 = p.findIndex((s) => s.district === 'Quận 1');
  check('Quận 1 mâu thuẫn bị loại vì đã có kết quả đúng Hạnh Thông', q1 === -1, `vị trí ${q1}/${p.length}`);
  check('không có kết quả Hà Nội', !p.some((s) => /Hà Đông|Hà Nội/.test(s.description)));
  check('không có hẻm bị dính số nhà khách gõ ("101 Hẻm 116 ...")', !p.some((s) => /Hẻm/.test(s.main_text)));
  check('không có "Khu phố ..." trong dòng địa chỉ', !p.some((s) => /khu ph/i.test(s.description) || /khu ph/i.test(s.secondary_text)));
  check('hẻm 116 và hẻm 142/8 cùng phường được gộp (không lặp)', new Set(p.map((s) => s.place_id)).size === p.length);
  check('dòng phụ đúng định dạng "P. Hạnh Thông (Gò Vấp cũ), TP.HCM"', p[0].secondary_text === 'P. Hạnh Thông (Gò Vấp cũ), TP.HCM');
  check('tương thích ngược: có đủ place_id, description, main_text, secondary_text, source, lat, lng', ['place_id', 'description', 'main_text', 'secondary_text', 'source', 'lat', 'lng'].every((k) => k in p[0]));
  check('meta cho biết Photon ổn', data.meta?.photon === 'ok');
  const again = (await ask(input(text))).data.predictions;
  check('gọi lại cho cùng thứ tự và cùng id (ổn định, không nhảy)', JSON.stringify(again.map((s) => s.place_id)) === JSON.stringify(p.map((s) => s.place_id)));
}

// ────────────────────────────────────────────────────────────────────────────
section('2. Các kiểu gõ khác của cùng địa chỉ');
for (const text of ['101 Lê Lợi, Gò Vấp', '101 le loi go vap', '101 Lê Lợi, Phường 1, Quận Gò Vấp', '101 Lê Lợi, P.1, Gò Vấp', '101 Lê Lợi, P. Hạnh Thông, TP.HCM']) {
  const { data } = await ask(input(text));
  const first = data.predictions[0];
  check(`"${text}" → đầu danh sách ở Gò Vấp`, first?.district === 'Quận Gò Vấp', JSON.stringify(data.predictions.map((s) => `${s.ward}`)));
}

// ────────────────────────────────────────────────────────────────────────────
section('3. Chuỗi mơ hồ: hiện nhiều lựa chọn, không chọn hộ, không bias');
{
  const { data } = await ask(input('Lê Lợi'));
  const wards = new Set(data.predictions.map((s) => s.ward));
  check('"Lê Lợi" cho cả Quận 1 lẫn Gò Vấp', wards.has('Phường Hạnh Thông') && wards.has('Phường Bến Thành'), [...wards].join(' | '));
  check('không gửi lat/lon khi không có tín hiệu vị trí nào', !photonLog[0].searchParams.has('lat') && !photonLog[0].searchParams.has('lon'));
  check('chỉ 1 câu hỏi Photon (không có địa danh để bổ sung)', photonLog.length === 1);
}
{
  const { data } = await ask(input('Lê Lợi', '&lat=10.82&lng=106.68'));
  check('có GPS (lat/lng hợp lệ) thì dùng làm bias', photonLog[0].searchParams.get('lat') === '10.82000');
  check('có bias thì Gò Vấp (gần) lên đầu nhưng Quận 1 vẫn còn trong danh sách', data.predictions[0].ward === 'Phường Hạnh Thông' && data.predictions.some((s) => s.ward === 'Phường Bến Thành'));
}
{
  await ask(input('Lê Lợi', '&lat=21.03&lng=105.85'));
  check('lat/lng ngoài vùng phục vụ (Hà Nội) bị bỏ qua', !photonLog[0].searchParams.has('lat'));
}
{
  const { data } = await ask(input('Lê Lợi', '&ward=' + encodeURIComponent('Phường Hạnh Thông') + '&district=' + encodeURIComponent('Quận Gò Vấp')));
  check('ô chọn phường chỉ cộng nhẹ, không biến thành bộ lọc', data.predictions.length >= 2 && data.predictions[0].ward === 'Phường Hạnh Thông' && !photonLog[0].searchParams.has('lat'));
}

// ────────────────────────────────────────────────────────────────────────────
section('4. Trùng tên khác tỉnh / nhà cung cấp lỗi');
photonHandler = (u) => (/ch[oợ]/i.test(u.searchParams.get('q') || '') ? [FIX.chq, FIX.hanoi, FIX.vungtau] : [FIX.hanoi, FIX.vungtau]);
{
  const { data } = await ask(input('197 Trần Phú'));
  check('"197 Trần Phú": không còn gợi ý Đà Nẵng của bảng nội bộ', !data.predictions.some((s) => /Đà Nẵng|Hải Châu/.test(s.description)));
  check('Vũng Tàu (nay thuộc TP.HCM) vẫn hiện, ghi tỉnh TP. Hồ Chí Minh', data.predictions.some((s) => s.ward === 'Phường Vũng Tàu' && s.province === 'TP. Hồ Chí Minh'));
  const { data: d2 } = await ask(input('197 Trần Phú, Chợ Quán'));
  check('thêm "Chợ Quán": Chợ Quán lên đầu', d2.predictions[0]?.ward === 'Phường Chợ Quán', JSON.stringify(d2.predictions.map((s) => s.ward)));
}
photonHandler = () => [FIX.q1, FIX.gvStreet];
{
  photonMode = 'timeout';
  const { res, data } = await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('Photon quá hạn: vẫn trả 200, meta timeout', res.status === 200 && data.meta.photon === 'timeout');
  check('Photon quá hạn: vẫn có gợi ý "vị trí gần đúng" ở Hạnh Thông, xếp đầu', data.predictions[0]?.source === 'area' && data.predictions[0].ward === 'Phường Hạnh Thông' && data.predictions[0].main_text === '101 Lê Lợi');
  photonMode = 'http500';
  const r2 = await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('Photon HTTP 500: meta error, không làm sập API', r2.res.status === 200 && r2.data.meta.photon === 'error');
  photonMode = 'ok';
}

// ────────────────────────────────────────────────────────────────────────────
section('5. Số nhà, hẻm và đầu vào ngắn');
photonHandler = () => [FIX.gvAlley, FIX.gvStreet];
{
  const { data } = await ask(input('Hẻm 76 Lê Lợi, Hạnh Thông'));
  check('khách gõ "Hẻm 76": giữ nguyên "Hẻm 76 Lê Lợi" (không hiểu 76 là số nhà)', data.predictions[0]?.main_text === 'Hẻm 76 Lê Lợi', data.predictions[0]?.main_text);
}
{
  const { data } = await ask(input('12/34/5 Lê Lợi, Hạnh Thông'));
  check('"12/34/5" được giữ nguyên số nhà nhiều cấp', data.predictions[0]?.main_text === '12/34/5 Lê Lợi');
}
{
  const a = await ask(input('1'));
  const b = await ask(input('101'));
  check('đầu vào quá ngắn hoặc chỉ có số: không gọi Photon, trả danh sách rỗng', a.data.predictions.length === 0 && b.data.predictions.length === 0 && photonLog.length === 0);
}
{
  const { data } = await ask(input('Đường số 1'));
  check('"Đường số 1" không làm API lỗi', data.success === true);
}

// ────────────────────────────────────────────────────────────────────────────
section('6. Đệm 60 giây và cầu dao khi Photon quá tải (đo thực tế: im lặng sau ~25 lượt dồn dập)');
const photonClient = await import('@/lib/address/photonClient');
photonHandler = () => [FIX.q1, FIX.gvStreet];
{
  process.env.PHOTON_CACHE_TTL_MS = '60000';
  photonClient.resetPhotonClient();
  const a = await ask(input('101 Lê Lợi, Hạnh Thông'));
  const firstCalls = photonLog.length;
  const b = await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('gõ lại đúng chuỗi cũ: lần sau lấy từ đệm, không gọi Photon thêm', firstCalls === 1 && photonLog.length === 0, `lần 1: ${firstCalls}, lần 2: ${photonLog.length}`);
  check('đệm cho cùng kết quả, cùng thứ tự', JSON.stringify(a.data.predictions.map((s) => s.place_id)) === JSON.stringify(b.data.predictions.map((s) => s.place_id)));
  check('kết quả lấy từ đệm vẫn báo Photon ổn', b.data.meta.photon === 'ok');

  photonClient.resetPhotonClient();
  photonLog = [];
  const get = () => route.GET(new NextRequest(`http://localhost/api/geo/autocomplete?${input('101 Lê Lợi, Hạnh Thông')}`));
  await Promise.all([get(), get()]);
  check('hai khách gõ cùng chuỗi cùng lúc: gộp lượt đang bay (1 câu hỏi, không phải 2)', photonLog.length === 1, `đã gọi ${photonLog.length}`);
  process.env.PHOTON_CACHE_TTL_MS = '0';
}
{
  process.env.PHOTON_BREAKER_FAILURES = '3';
  process.env.PHOTON_BREAKER_PAUSE_MS = '60000';
  photonClient.resetPhotonClient();
  photonMode = 'timeout';
  const metas = [];
  for (let i = 0; i < 3; i++) metas.push((await ask(input(`101 Lê Lợi, Hạnh Thông ${i}`))).data.meta.photon);
  check('3 lần liên tiếp Photon quá hạn: đều báo timeout', metas.every((m) => m === 'timeout'), JSON.stringify(metas));
  check('3 lần liên tiếp không dùng được thì cầu dao mở', photonClient.isPhotonPaused());
  photonMode = 'ok';
  const t0 = Date.now();
  const open = await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('cầu dao mở: KHÔNG gọi Photon, trả ngay (không chờ hết thời hạn)', photonLog.length === 0 && Date.now() - t0 < 1500, `gọi ${photonLog.length} lượt`);
  check('cầu dao mở: báo meta error để trình duyệt hiện "dịch vụ bản đồ đang chậm"', open.data.meta.photon === 'error' && open.res.status === 200);
  check('cầu dao mở: vẫn có gợi ý "vị trí gần đúng" ở Hạnh Thông', open.data.predictions[0]?.source === 'area' && open.data.predictions[0].ward === 'Phường Hạnh Thông');
  check('sau thời gian nghỉ cầu dao tự đóng', !photonClient.isPhotonPaused(Date.now() + 61_000));
  photonClient.recordPhotonOutcome(true);
  const closed = await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('một lần thành công đóng cầu dao: Photon được gọi lại và báo ok', photonLog.length === 1 && closed.data.meta.photon === 'ok');
  // Lỗi lẻ tẻ (chưa đủ 3 lần liên tiếp) không làm cầu dao mở
  photonClient.resetPhotonClient();
  photonMode = 'http500';
  await ask(input('101 Lê Lợi, Hạnh Thông a'));
  photonMode = 'ok';
  await ask(input('101 Lê Lợi, Hạnh Thông b'));
  photonMode = 'http500';
  await ask(input('101 Lê Lợi, Hạnh Thông c'));
  check('lỗi lẻ tẻ xen kẽ lần thành công không làm cầu dao mở', !photonClient.isPhotonPaused());
  photonMode = 'ok';
  process.env.PHOTON_BREAKER_FAILURES = '0';
  photonClient.resetPhotonClient();
}

// ────────────────────────────────────────────────────────────────────────────
section('7. Câu bổ sung chỉ khi cần, số nhà nhiều cấp, HTTP 429, máy chủ Photon tự host, vùng giao');
{
  // Câu chính chỉ trả Quận 1: chưa có kết quả đúng Hạnh Thông → gửi 1 câu bổ sung (số nhà + đường, bias Gò Vấp)
  photonHandler = (u) => (u.searchParams.get('q') === '101 Lê Lợi' ? [FIX.gvStreet] : [FIX.q1]);
  const { data } = await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('câu chính chưa đúng khu → gửi đúng 1 câu bổ sung "101 Lê Lợi" bias Gò Vấp', photonLog.length === 2 && photonLog[1].searchParams.get('q') === '101 Lê Lợi' && Math.abs(Number(photonLog[1].searchParams.get('lat')) - 10.821) < 0.01, JSON.stringify(photonLog.map((u) => u.searchParams.get('q'))));
  check('sau câu bổ sung, đầu danh sách là Hạnh Thông và Quận 1 bị loại', data.predictions[0]?.ward === 'Phường Hạnh Thông' && !data.predictions.some((s) => s.ward === 'Phường Bến Thành'), JSON.stringify(data.predictions.map((s) => s.ward)));
}
{
  photonHandler = (u) => (u.searchParams.get('q') === 'Lê Lợi' ? [FIX.q1, FIX.gvStreet] : []);
  const { data } = await ask(input('12/34/5 Lê Lợi'));
  check('số nhà nhiều cấp: câu chính không ra gì → hỏi lại chỉ tên đường "Lê Lợi"', photonLog.length === 2 && photonLog[1].searchParams.get('q') === 'Lê Lợi', JSON.stringify(photonLog.map((u) => u.searchParams.get('q'))));
  check('vẫn giữ nguyên "12/34/5 Lê Lợi" khách gõ ở mọi gợi ý, mức đường', data.predictions.length >= 2 && data.predictions.every((s) => s.main_text === '12/34/5 Lê Lợi' && s.precision === 'street'), JSON.stringify(data.predictions.map((s) => s.main_text)));
}
{
  photonHandler = () => [FIX.gvStreet];
  photonMode = 'http429';
  process.env.PHOTON_BREAKER_FAILURES = '3';
  photonClient.resetPhotonClient();
  const a = await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('Photon trả 429: meta "limited", vẫn trả 200 với gợi ý nội bộ / gần đúng', a.res.status === 200 && a.data.meta.photon === 'limited' && a.data.predictions.length >= 1);
  photonMode = 'ok';
  const b = await ask(input('101 Lê Lợi, Gò Vấp'));
  check('sau 429 cầu dao mở NGAY (không chờ đủ 3 lần): lượt sau không gọi Photon', photonLog.length === 0 && b.data.meta.photon === 'limited');
  process.env.PHOTON_BREAKER_FAILURES = '0';
  photonClient.resetPhotonClient();
}
{
  process.env.PHOTON_BASE_URL = 'https://photon.example.vn/';
  photonHandler = () => [FIX.gvStreet];
  await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('PHOTON_BASE_URL trỏ tới máy chủ Photon tự host', photonLog.length >= 1 && photonLog[0].hostname === 'photon.example.vn' && photonLog[0].pathname === '/api/', photonLog[0]?.href);
  delete process.env.PHOTON_BASE_URL;
  process.env.GEO_PROVIDER = 'goong';
  const r = await ask(input('101 Lê Lợi, Hạnh Thông'));
  check('GEO_PROVIDER chưa tích hợp: cảnh báo và dùng Photon, không sập', r.res.status === 200 && r.data.meta.provider === 'photon');
  delete process.env.GEO_PROVIDER;
}
{
  // Điểm ngoài vùng giao (cách mọi cửa hàng > 20 km, giống "Lê Lợi" ở Bình Chánh cũ) bị loại
  const farStreet = f({ osm_type: 'W', osm_id: 77, type: 'street', name: 'Lê Lợi', district: 'Bình Chánh' }, 10.3554, 106.3666);
  photonHandler = () => [FIX.q1, farStreet];
  const { data } = await ask(input('Lê Lợi'));
  check('điểm ngoài vùng giao bị loại khỏi gợi ý', !data.predictions.some((s) => Math.abs(s.lat - 10.3554) < 0.01), JSON.stringify(data.predictions.map((s) => s.lat)));
  check('bbox gửi Photon lấy từ vùng giao (không phải hộp cố định trong code)', photonLog[0].searchParams.has('bbox') && photonLog[0].searchParams.get('bbox') !== '106.3,10.25,107.6,11.55', photonLog[0]?.searchParams.get('bbox'));
}

// ────────────────────────────────────────────────────────────────────────────
section('8. Vùng giao chỉ trong TP.HCM, khu khách gõ ngoài vùng giao');
{
  // Lê Lợi ở Long Thành (Đồng Nai), nằm trong bán kính 20 km của một cửa hàng TP.HCM nhưng KHÁC TỈNH
  const longThanh = { type: 'Feature', properties: { osm_type: 'W', osm_id: 88, type: 'street', name: 'Lê Lợi', district: 'Long Thành', city: 'Long Thành', state: 'Đồng Nai', countrycode: 'VN' }, geometry: { type: 'Point', coordinates: [106.944, 10.7827] } };
  setServiceZoneOverride(createServiceZone([{ lat: 10.7769, lng: 106.7009 }, { lat: 10.8479, lng: 106.7953 }], 20));
  photonHandler = () => [FIX.q1, longThanh];
  const { data } = await ask(input('101 Lê Lợi'));
  check('kết quả thuộc Đồng Nai bị bỏ dù trong bán kính cửa hàng (không thành "Long Thành (Q.9 cũ)")', !data.predictions.some((s) => Math.abs((s.lat || 0) - 10.7827) < 0.001), JSON.stringify(data.predictions.map((s) => `${s.ward}`)));
  photonHandler = () => [FIX.q1, FIX.vungtau];
  photonLog = [];
  const r = await ask(input('101 Lê Lợi, Vũng Tàu'));
  check('khách gõ "Vũng Tàu" (ngoài vùng giao): báo outOfZone, KHÔNG đưa Quận 1 hay điểm gần nhất', r.data.meta.outOfZone === true && r.data.predictions.length === 0, JSON.stringify(r.data));
  check('khu ngoài vùng giao: không tốn lượt gọi Photon', photonLog.length === 0);
  setServiceZoneOverride(createServiceZone([{ lat: 10.7769, lng: 106.7009 }, { lat: 10.35, lng: 107.07 }], 20));
}

globalThis.fetch = realFetch;
console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
