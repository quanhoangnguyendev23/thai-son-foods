/**
 * Kiểm thử bộ điều khiển ô nhập địa chỉ với NHÀ CUNG CẤP GIẢ (chậm, về lộn thứ tự, lỗi mạng, rỗng) và timer giả.
 * Chứng minh: không tự chọn khi rời ô / Enter, không đổi chữ khách gõ, chống phản hồi cũ, giữ danh sách cũ khi tải,
 * không gợi ý lại sau khi chọn, bộ gõ tiếng Việt (IME) không bị phá.
 * Chạy: npx tsx tests/address_controller_test.mjs
 */
import {
  createAddressSearchController,
  createAutocompleteFetcher,
  sameStreetLine,
} from '@/lib/address/searchController';

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

// ─── Timer giả ───
function makeTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let best = null;
        for (const [id, t] of pending) if (t.at <= target && (!best || t.at < best.t.at)) best = { id, t };
        if (!best) break;
        pending.delete(best.id);
        now = best.t.at;
        best.t.fn();
      }
      now = target;
    },
    count: () => pending.size,
  };
}
const flush = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};

// ─── Gợi ý mẫu ───
const sug = (id, street, ward, district, extra = {}) => ({
  place_id: id,
  description: `${street}, ${ward}, ${district}`,
  main_text: street,
  secondary_text: `${ward}, ${district}`,
  source: 'photon',
  street,
  ward,
  district,
  province: 'TP. Hồ Chí Minh',
  precision: 'street',
  lat: 10.8,
  lng: 106.68,
  ...extra,
});
const GV = (n = '101') => sug('ph:gv', `${n} Lê Lợi`, 'Phường Hạnh Thông', 'Quận Gò Vấp', { houseNumber: n });
const Q1 = (n = '101') => sug('ph:q1', `${n} Lê Lợi`, 'Phường Bến Thành', 'Quận 1', { houseNumber: n });

// ─── Nhà cung cấp giả có thể điều khiển ───
function makeProvider() {
  const calls = [];
  const fetchSuggestions = (req) =>
    new Promise((resolve, reject) => {
      const call = { text: req.text, bias: req.bias, signal: req.signal, aborted: false, resolve: null, reject: null };
      calls.push(call);
      call.resolve = (suggestions, degraded) => resolve({ suggestions, degraded });
      call.reject = (e) => reject(e);
      req.signal.addEventListener('abort', () => {
        call.aborted = true;
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  return { calls, fetchSuggestions };
}

function setup(extra = {}) {
  const timers = makeTimers();
  const provider = makeProvider();
  const selected = [];
  const controller = createAddressSearchController({
    fetchSuggestions: provider.fetchSuggestions,
    timers,
    onSelect: (s) => selected.push(s),
    ...extra,
  });
  let emits = 0;
  controller.subscribe(() => emits++);
  controller.setFocused(true);
  return { controller, timers, provider, selected, emits: () => emits };
}

async function typeAndLoad(t, text, results) {
  t.controller.setText(text);
  t.timers.advance(300);
  await flush();
  const call = t.provider.calls[t.provider.calls.length - 1];
  call.resolve(results);
  await flush();
  return call;
}

// ────────────────────────────────────────────────────────────────────────────
section('1. Debounce và điều kiện tối thiểu');
{
  const t = setup();
  for (const text of ['l', 'le', 'le l', 'le lo', 'le loi']) {
    t.controller.setText(text);
    t.timers.advance(100);
  }
  check('gõ nhanh (mỗi 100 ms) chưa gọi nhà cung cấp lần nào', t.provider.calls.length === 0);
  t.timers.advance(300);
  await flush();
  check('ngừng gõ 280 ms mới gọi, đúng 1 lần, với chữ cuối', t.provider.calls.length === 1 && t.provider.calls[0].text === 'le loi');
}
{
  const t = setup();
  t.controller.setText('10');
  t.controller.setText('101');
  t.timers.advance(1000);
  await flush();
  check('chỉ có số ("101") thì không gọi nhà cung cấp', t.provider.calls.length === 0 && t.controller.getState().status === 'idle');
  t.controller.setText('101 Lê');
  t.timers.advance(300);
  await flush();
  check('"101 Lê" thì gọi', t.provider.calls.length === 1);
}

// ────────────────────────────────────────────────────────────────────────────
section('2. Không bao giờ tự chọn hay đổi chữ khách gõ');
{
  const t = setup();
  await typeAndLoad(t, '101 Lê Lợi, Hạnh Thông, Gò Vấp', [Q1(), GV()]);
  const s = t.controller.getState();
  check('có gợi ý nhưng chưa tô sáng mục nào (activeIndex = -1)', s.suggestions.length === 2 && s.activeIndex === -1 && s.open === true);
  t.controller.setFocused(false);
  t.timers.advance(5000);
  await flush();
  const after = t.controller.getState();
  check('rời ô (blur): chỉ đóng khung, không chọn gì, chữ giữ nguyên', after.open === false && t.selected.length === 0 && after.inputText === '101 Lê Lợi, Hạnh Thông, Gò Vấp' && after.selected === null);
  t.controller.setFocused(true);
  check('quay lại ô: khung mở lại với danh sách cũ', t.controller.getState().open === true && t.controller.getState().suggestions.length === 2);
}
{
  const t = setup();
  await typeAndLoad(t, '101 Lê Lợi, Gò Vấp', [Q1(), GV()]);
  const enter1 = t.controller.handleKey({ key: 'Enter' });
  check('Enter khi chưa dùng phím mũi tên: không chọn, chỉ đóng khung, vẫn chặn gửi form', t.selected.length === 0 && enter1.preventDefault === true && t.controller.getState().open === false);
  t.controller.setFocused(false);
  t.controller.setFocused(true);
  t.controller.handleKey({ key: 'ArrowDown' });
  check('mũi tên xuống: tô sáng mục đầu', t.controller.getState().activeIndex === 0);
  t.controller.handleKey({ key: 'ArrowDown' });
  check('mũi tên xuống lần 2: mục thứ hai', t.controller.getState().activeIndex === 1);
  t.controller.handleKey({ key: 'ArrowDown' });
  check('hết danh sách thì quay về mục đầu', t.controller.getState().activeIndex === 0);
  t.controller.handleKey({ key: 'ArrowUp' });
  check('mũi tên lên từ mục đầu: nhảy về mục cuối', t.controller.getState().activeIndex === 1);
  t.controller.handleKey({ key: 'Enter' });
  check('Enter sau khi dùng mũi tên: chọn đúng mục đang tô sáng (mục thứ hai = Quận 1)', t.selected.length === 1 && t.selected[0].suggestion.place_id === 'ph:q1' && t.controller.getState().inputText === '101 Lê Lợi');
}
{
  const t = setup();
  await typeAndLoad(t, '101 Lê Lợi', [GV(), Q1()]);
  t.controller.handleKey({ key: 'ArrowDown' });
  const r = t.controller.handleKey({ key: 'Escape' });
  check('Esc đóng khung, không chọn', r.handled && t.controller.getState().open === false && t.selected.length === 0 && t.controller.getState().inputText === '101 Lê Lợi');
}

// ────────────────────────────────────────────────────────────────────────────
section('3. Bộ gõ tiếng Việt (IME)');
{
  const t = setup();
  await typeAndLoad(t, '101 Lê Lợi', [GV(), Q1()]);
  t.controller.setComposing(true);
  const down = t.controller.handleKey({ key: 'ArrowDown' });
  const enter = t.controller.handleKey({ key: 'Enter' });
  check('đang gõ dở (composing): mũi tên và Enter không bị hiểu là thao tác với gợi ý', !down.handled && !enter.handled && t.selected.length === 0 && t.controller.getState().activeIndex === -1);
  check('Enter có isComposing=true hoặc keyCode 229 cũng bỏ qua', !t.controller.handleKey({ key: 'Enter', isComposing: true }).handled && !t.controller.handleKey({ key: 'Enter', keyCode: 229 }).handled);
  check('đang composing không chọn được bằng chuột', t.controller.select(0) === null && t.selected.length === 0);
  const before = t.controller.getState().inputText;
  t.controller.setText('101 Lê Lợi, Hạnh T');
  t.timers.advance(300);
  await flush();
  t.provider.calls[t.provider.calls.length - 1].resolve([GV()]);
  await flush();
  check('kết quả về trong lúc composing không làm đổi chữ trong ô', t.controller.getState().inputText === '101 Lê Lợi, Hạnh T' && before !== t.controller.getState().inputText);
  t.controller.setComposing(false);
  t.controller.handleKey({ key: 'ArrowDown' });
  check('hết composing thì dùng phím bình thường', t.controller.getState().activeIndex === 0);
}

// ────────────────────────────────────────────────────────────────────────────
section('4. Phản hồi về lộn thứ tự, chậm, lỗi, rỗng');
{
  const t = setup();
  t.controller.setText('le l');
  t.timers.advance(300);
  await flush();
  const slow = t.provider.calls[0];
  t.controller.setText('le loi');
  t.timers.advance(300);
  await flush();
  const fast = t.provider.calls[1];
  check('câu cũ bị hủy (AbortController) khi khách gõ tiếp', slow.aborted === true && fast.aborted === false);
  fast.resolve([GV()]);
  await flush();
  slow.resolve([Q1()]);
  await flush();
  const s = t.controller.getState();
  check('kết quả câu mới thắng, câu cũ về muộn bị bỏ', s.suggestions.length === 1 && s.suggestions[0].place_id === 'ph:gv' && s.status === 'ready');
}
{
  const t = setup();
  t.controller.setText('le loi');
  t.timers.advance(300);
  await flush();
  const first = t.provider.calls[0];
  t.controller.setText('le loi, go vap');
  first.resolve([Q1()]);
  await flush();
  check('phản hồi của chữ cũ về khi chữ trong ô đã khác thì bị bỏ', t.controller.getState().suggestions.length === 0);
}
{
  const t = setup();
  await typeAndLoad(t, '101 Lê Lợi', [GV(), Q1()]);
  t.controller.setText('101 Lê Lợi, Gò');
  t.timers.advance(300);
  await flush();
  const s = t.controller.getState();
  check('đang tải câu mới: vẫn giữ danh sách cũ, trạng thái loading (không nháy)', s.status === 'loading' && s.suggestions.length === 2);
  check('đang tải: không tô sáng, không đóng khung', s.open === true && s.activeIndex === -1);
}
{
  const t = setup();
  t.controller.setText('101 Lê Lợi');
  t.timers.advance(300);
  await flush();
  t.timers.advance(2800);
  const s1 = t.controller.getState();
  check('nhà cung cấp chậm 3 giây: vẫn loading, ô vẫn gõ được', s1.status === 'loading' && s1.inputText === '101 Lê Lợi');
  t.provider.calls[0].resolve([GV()], true);
  await flush();
  const s2 = t.controller.getState();
  check('về muộn vẫn hiển thị, đánh dấu degraded', s2.status === 'ready' && s2.degraded === true && s2.suggestions.length === 1);
}
{
  const t = setup();
  t.controller.setText('101 Lê Lợi');
  t.timers.advance(300);
  await flush();
  t.provider.calls[0].reject(new Error('network down'));
  await flush();
  const s = t.controller.getState();
  check('lỗi mạng: trạng thái error, khung mở để hiện thông báo + nút chọn trên bản đồ, chữ giữ nguyên', s.status === 'error' && s.open === true && s.suggestions.length === 0 && s.inputText === '101 Lê Lợi');
}
{
  const t = setup();
  await typeAndLoad(t, 'zzzzzz', []);
  const s = t.controller.getState();
  check('rỗng: trạng thái empty và khung mở để hiện hướng dẫn', s.status === 'empty' && s.open === true);
}
{
  const t = setup();
  t.controller.setText('101 Lê Lợi');
  t.controller.setFocused(false);
  t.timers.advance(300);
  await flush();
  t.provider.calls[0].resolve([GV()]);
  await flush();
  check('kết quả về sau khi khách đã rời ô: lưu lại nhưng không tự bật khung', t.controller.getState().open === false && t.controller.getState().suggestions.length === 1);
}

// ────────────────────────────────────────────────────────────────────────────
section('5. Chọn một gợi ý rồi không hiện thêm gợi ý nào');
{
  const t = setup();
  await typeAndLoad(t, '101 Lê Lợi, Hạnh Thông, Gò Vấp', [GV(), Q1()]);
  const callsBefore = t.provider.calls.length;
  const picked = t.controller.select(0);
  const s = t.controller.getState();
  check('chọn: onSelect gọi đúng 1 lần, ô điền dòng của gợi ý đã chọn', t.selected.length === 1 && picked?.text === '101 Lê Lợi' && s.inputText === '101 Lê Lợi');
  check('chọn xong: danh sách trống, khung đóng, trạng thái idle', s.suggestions.length === 0 && s.open === false && s.status === 'idle');
  t.timers.advance(5000);
  await flush();
  check('sau khi chọn không có thêm bất kỳ request nào (cả 0 request chi tiết)', t.provider.calls.length === callsBefore);
  t.controller.setFocused(false);
  t.controller.setFocused(true);
  check('focus lại ô: không hiện lại gợi ý', t.controller.getState().open === false);
  t.controller.setText('101 Lê Lợi');
  check('gõ lại đúng dòng đã chọn: vẫn không gợi ý', t.provider.calls.length === callsBefore && t.timers.count() === 0);
}
{
  const t = setup();
  await typeAndLoad(t, '101 Lê Lợi', [GV()]);
  t.controller.select(0);
  t.controller.setText('103 Lê Lợi');
  check('chỉ đổi số nhà trên cùng đường: địa chỉ đã chốt vẫn còn hiệu lực (matched)', t.controller.getState().anchor === 'matched');
  t.controller.setText('5 Nguyễn Trãi');
  check('đổi sang đường khác: đánh dấu stale (ghim cũ không còn khớp chữ)', t.controller.getState().anchor === 'stale');
  t.timers.advance(300);
  await flush();
  check('gõ chữ khác thì tìm lại bình thường', t.provider.calls.length === 2 && t.provider.calls[1].text === '5 Nguyễn Trãi');
}
{
  const t = setup();
  t.controller.commitText('63 Lý Tự Trọng', 'pin');
  t.timers.advance(1000);
  await flush();
  check('trang chủ động ghi chữ (ghim/GPS): không gọi gợi ý, khung đóng', t.provider.calls.length === 0 && t.controller.getState().open === false && t.controller.getState().anchorText === '63 Lý Tự Trọng');
}
check('so hai dòng cùng đường (khác số nhà, khác phần đuôi)', sameStreetLine('101 Lê Lợi', '5 Đường Lê Lợi, Gò Vấp') && !sameStreetLine('101 Lê Lợi', '101 Lê Lai'));

// ────────────────────────────────────────────────────────────────────────────
section('6. Xếp hạng lại phía trình duyệt và bias');
{
  const t = setup();
  await typeAndLoad(t, '101 Lê Lợi, Hạnh Thông, Gò Vấp', [Q1(), GV()]);
  const s = t.controller.getState();
  check('server trả Quận 1 trước nhưng trình duyệt xếp lại: Hạnh Thông đứng đầu', s.suggestions[0].ward === 'Phường Hạnh Thông' && s.suggestions[1].ward === 'Phường Bến Thành');
}
{
  const t = setup({ getBias: () => ({ lat: 10.9, lng: 106.7 }) });
  t.controller.setText('Lê Lợi');
  t.timers.advance(300);
  await flush();
  check('bias do trang cung cấp được chuyển cho nhà cung cấp', t.provider.calls[0].bias?.lat === 10.9);
}
{
  const t = setup();
  t.controller.setText('Lê Lợi');
  t.timers.advance(300);
  await flush();
  check('không có tín hiệu thật thì bias là null (không đoán Quận 1)', t.provider.calls[0].bias === null);
}
{
  const t = setup();
  await typeAndLoad(t, 'Lê Lợi', [GV(), Q1()]);
  const n0 = t.emits();
  t.timers.advance(10000);
  await flush();
  check('sau khi ngừng gõ và có kết quả: không còn thay đổi nào nữa (danh sách đứng yên)', t.emits() === n0 && t.timers.count() === 0);
}

// ────────────────────────────────────────────────────────────────────────────
section('7. Hàm gọi API gợi ý');
{
  const seen = [];
  const fakeFetch = async (url, init) => {
    seen.push({ url, signal: init?.signal });
    return { ok: true, json: async () => ({ success: true, predictions: [GV()], meta: { photon: 'timeout' } }) };
  };
  const f = createAutocompleteFetcher('/api/geo/autocomplete', fakeFetch);
  const ac = new AbortController();
  const r = await f({ text: '101 Lê Lợi, Hạnh Thông, Gò Vấp', signal: ac.signal, bias: null });
  const u = new URL(seen[0].url, 'http://x');
  check('gửi NGUYÊN chuỗi khách gõ, không kèm lat/lng khi không biết vị trí', u.searchParams.get('input') === '101 Lê Lợi, Hạnh Thông, Gò Vấp' && !u.searchParams.has('lat') && !u.searchParams.has('lng'));
  check('Photon timeout → degraded', r.degraded === true && r.suggestions.length === 1);
  await f({ text: 'Lê Lợi', signal: ac.signal, bias: { lat: 10.82, lng: 106.68 }, context: { ward: 'Phường Hạnh Thông' } });
  const u2 = new URL(seen[1].url, 'http://x');
  check('có bias thì gửi lat/lng, có ô chọn thì gửi ward', u2.searchParams.get('lat') === '10.82000' && u2.searchParams.get('ward') === 'Phường Hạnh Thông');
  const bad = createAutocompleteFetcher('/x', async () => ({ ok: false, status: 500, json: async () => ({}) }));
  let threw = false;
  try {
    await bad({ text: 'abc', signal: ac.signal, bias: null });
  } catch {
    threw = true;
  }
  check('HTTP lỗi thì ném lỗi (để hiện trạng thái error)', threw);
}

console.log('\n── Ghim cũ còn đúng không khi khách sửa chữ (cùng tên đường, khác khu)');
{
  const t = setup();
  t.controller.commitText('103 Lê Lợi', 'saved');
  t.controller.setText('101 Lê Lợi');
  check('đổi số nhà, cùng đường → ghim vẫn tính là khớp', t.controller.getState().anchor === 'matched');
  t.controller.setText('101 Lê Lợi, Vũng Tàu');
  check('gõ thêm khu khác ("…, Vũng Tàu") → ghim cũ không còn đúng (stale)', t.controller.getState().anchor === 'stale');
  t.controller.setText('101 Lê Lợi, Quận 1');
  check('gõ thêm "Quận 1" → stale', t.controller.getState().anchor === 'stale');
}
{
  const t = setup();
  t.controller.commitText('101 Lê Lợi, Hạnh Thông', 'pin');
  t.controller.setText('103 Lê Lợi, Hạnh Thông');
  check('khu gõ thêm trùng khu đã chốt → vẫn khớp', t.controller.getState().anchor === 'matched');
}

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
