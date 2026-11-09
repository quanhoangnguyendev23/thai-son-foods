/**
 * Kiểm thử đầu-cuối (trình duyệt thật) cho ô nhập địa chỉ ở trang thanh toán: gõ nhanh, chọn bằng chuột / phím / chạm,
 * rời ô, bộ gõ tiếng Việt (IME), phản hồi về lộn thứ tự, lỗi mạng, sửa địa chỉ sang đường khác, ghim bản đồ, GPS,
 * và màn hình điện thoại. Các API địa chỉ được GIẢ bằng page.route nên không cần Photon/Nominatim.
 *
 * Cần: web đang chạy (mặc định http://localhost:3000; nên chạy `NEXT_DIST_DIR=.next-build npm run dev` nếu thư mục .next
 *   đang hỏng), gói `playwright-core` (đã có trong devDependencies; hoặc đặt PLAYWRIGHT_CORE_PATH), và Chrome hoặc Edge đã cài.
 *   - Chỉ chạy một nhóm: E2E_ONLY="10." node tests/address_e2e_test.mjs
 *   - Chỉ định trình duyệt (nếu không tự tìm thấy): CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
 *   - Địa chỉ web khác: BASE_URL=http://localhost:3000
 * Chạy: node tests/address_e2e_test.mjs
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require('playwright-core');
  } catch (e) {
    const base = process.env.PLAYWRIGHT_CORE_PATH;
    if (base) return require(require.resolve('playwright-core', { paths: [base] }));
    throw new Error('Thiếu gói playwright-core. Cài bằng: npm i -D playwright-core (hoặc đặt PLAYWRIGHT_CORE_PATH). ' + e.message);
  }
}
const { chromium } = loadPlaywright();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = BROWSER_CANDIDATES.find((p) => fs.existsSync(p));

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mỗi nhóm kiểm thử chạy riêng: một nhóm lỗi bất ngờ không làm mất kết quả các nhóm sau. */
async function section(title, fn) {
  // E2E_ONLY="10." chỉ chạy các nhóm có tiêu đề chứa chuỗi đó (chạy nhanh khi sửa một nhóm)
  if (process.env.E2E_ONLY && !title.includes(process.env.E2E_ONLY)) return;
  console.log(`\n── ${title}`);
  try {
    await fn();
  } catch (e) {
    fail++;
    console.log(`  ✗ LỖI KHÔNG MONG ĐỢI: ${String(e && e.message).split('\n')[0]}`);
  }
}

// ─── Dữ liệu giả ───
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
function fixtureFor(text) {
  const n = norm(text);
  if (!/le loi/.test(n)) return [];
  const m = text.match(/^\s*(\d+[A-Za-z0-9/]*)\s/);
  const main = (m ? m[1] + ' ' : '') + 'Lê Lợi';
  const base = { source: 'photon', street: 'Lê Lợi', province: 'TP. Hồ Chí Minh', precision: 'street', houseNumber: m ? m[1] : undefined, main_text: main };
  const gv = { ...base, place_id: 'ph:gv', ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp', lat: 10.8208, lng: 106.6874, description: `${main}, Phường Hạnh Thông, Quận Gò Vấp, TP. Hồ Chí Minh`, secondary_text: 'P. Hạnh Thông (Gò Vấp cũ), TP.HCM' };
  const q1 = { ...base, place_id: 'ph:q1', ward: 'Phường Bến Thành', district: 'Quận 1', lat: 10.7727, lng: 106.6994, description: `${main}, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh`, secondary_text: 'P. Bến Thành (Q.1 cũ), TP.HCM' };
  return [q1, gv]; // cố ý trả Quận 1 trước: trình duyệt phải xếp lại theo phường khách gõ
}

const GPS_FIX = { latitude: 10.8231, longitude: 106.6297 };

/** Mở trang thanh toán với giỏ có 1 combo và API địa chỉ giả. */
async function openCheckout(browser, { mobile = false, delays = {}, mode = {}, geo = false } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 375, height: 812 } : { width: 1100, height: 900 },
    deviceScaleFactor: 1,
    locale: 'vi-VN',
    ...(mobile ? { hasTouch: true, isMobile: true } : {}),
    ...(geo ? { permissions: ['geolocation'], geolocation: GPS_FIX } : {}),
  });
  const page = await ctx.newPage();
  const calls = [];
  const reverseCalls = [];
  const aborted = [];
  const orderPosts = [];
  page.on('requestfailed', (req) => {
    if (req.url().includes('/api/geo/autocomplete')) aborted.push(new URL(req.url()).searchParams.get('input'));
  });
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/orders')) orderPosts.push(req.url());
  });
  await page.route('**/api/geo/autocomplete**', async (route) => {
    const u = new URL(route.request().url());
    const text = u.searchParams.get('input');
    calls.push({ text, params: Object.fromEntries(u.searchParams) });
    await sleep(delays[text] ?? 120);
    try {
      if (mode.fail) return await route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' });
      // mode.single: chỉ trả đúng 1 gợi ý (Hạnh Thông, Gò Vấp) để kiểm ca danh sách chỉ có 1 mục
      let predictions = mode.single ? fixtureFor(text).filter((p) => p.place_id === 'ph:gv') : fixtureFor(text);
      // mode.precision: 'area' (tâm phường, chưa đáng tin) | 'street' (giữa đường) | 'house' (đúng số nhà)
      if (mode.precision) predictions = predictions.map((p) => ({ ...p, precision: mode.precision, source: mode.precision === 'area' ? 'area' : p.source }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, predictions, meta: { photon: 'ok' } }) });
    } catch {
      // trình duyệt đã hủy câu hỏi (AbortController)
    }
  });
  await page.route('**/api/geo/reverse**', async (route) => {
    const u = new URL(route.request().url());
    reverseCalls.push({ lat: u.searchParams.get('lat'), lng: u.searchParams.get('lng'), light: u.searchParams.get('light') });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        formattedAddress: 'Đường Nguyễn Trung Trực, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
        components: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Thành', street: 'Đường Nguyễn Trung Trực', road: 'Đường Nguyễn Trung Trực' },
      }),
    });
  });
  // Không tạo đơn thật: chặn POST /api/orders và trả lỗi giả (vẫn ghi nhận là có gửi đơn)
  await page.route('**/api/orders', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Đơn thử nghiệm (E2E), không tạo đơn thật' }) });
    } else {
      await route.continue();
    }
  });
  // Bản đồ nền (ảnh) không cần cho kiểm thử
  await page.route('**/*.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/server.arcgisonline.com/**', (route) => route.abort());

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Thêm Combo bữa sáng/ }).first().click();
  await sleep(500);
  await page.goto(BASE_URL + '/thanh-toan', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#address', { timeout: 20000 });
  return { ctx, page, calls, reverseCalls, aborted, orderPosts };
}

async function withCheckout(browser, opts, fn) {
  const env = await openCheckout(browser, opts);
  try {
    await fn(env);
  } finally {
    await env.ctx.close().catch(() => {});
  }
}

const form = (page) =>
  page.evaluate(() => {
    const el = document.getElementById('address');
    return {
      address: el.value,
      district: document.getElementById('district').value,
      ward: document.getElementById('ward').value,
      options: document.querySelectorAll('[role=option]').length,
      expanded: el.getAttribute('aria-expanded'),
      active: el.getAttribute('aria-activedescendant'),
    };
  });
/** Tọa độ ghim đang hiển thị ("GPS: lat, lng", thẻ xác nhận 6 số lẻ hoặc tiêu đề bản đồ nhỏ 5 số lẻ). */
const gpsPair = (page) =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/GPS: (-?[0-9.]+), (-?[0-9.]+)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  });
const samePin = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) < 2e-5 && Math.abs(a[1] - b[1]) < 2e-5;
const bodyHas = (page, re) => page.evaluate((s) => new RegExp(s).test(document.body.innerText), re.source);
const modalOf = (page) => page.locator('div.fixed.inset-0').filter({ hasText: 'Xác nhận vị trí giao hàng chính xác' });

/** Kéo bản đồ trong popup chọn ghim (dừng hẳn trước khi nhả chuột để Leaflet không tạo quán tính). */
async function dragPin(page, dx, dy) {
  const map = modalOf(page).locator('.leaflet-container').first();
  await map.waitFor({ timeout: 10000 });
  await sleep(1200);
  const box = await map.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps);
    await sleep(25);
  }
  await sleep(150);
  await page.mouse.up();
}

if (!executablePath) {
  console.error('Không tìm thấy Chrome/Edge. Đặt CHROME_PATH tới file chạy của trình duyệt.');
  process.exit(2);
}
const browser = await chromium.launch({ executablePath, headless: true });
const TEXT = '101 Lê Lợi, Hạnh Thông, Gò Vấp';

try {
  // ──────────────────────────────────────────────────────────────────────
  await section('1. Gõ nhanh, gợi ý hai dòng, ARIA, không tự chọn, rời ô không chọn gì', () =>
    withCheckout(browser, {}, async ({ page, calls }) => {
      await page.click('#address');
      await page.type('#address', 'a', { delay: 20 });
      await sleep(700);
      check('gõ 1 chữ: chưa gọi nhà cung cấp (tối thiểu 2 ký tự)', calls.length === 0, JSON.stringify(calls.map((c) => c.text)));
      await page.fill('#address', '');
      await page.type('#address', TEXT, { delay: 35 });
      await page.waitForSelector('[role=option]', { timeout: 8000 });
      await sleep(600);
      check('gõ liên tục cả chuỗi chỉ gọi đúng 1 request', calls.length === 1, JSON.stringify(calls.map((c) => c.text)));
      check('request mang NGUYÊN chuỗi khách gõ, không có lat/lng (không bias Quận 1)', calls[0]?.text === TEXT && !('lat' in calls[0].params) && !('lng' in calls[0].params));
      const aria = await page.evaluate(() => {
        const el = document.getElementById('address');
        const lb = document.querySelector('[role=listbox]');
        return { role: el.getAttribute('role'), expanded: el.getAttribute('aria-expanded'), controls: el.getAttribute('aria-controls'), listboxId: lb && lb.id, autocomplete: el.getAttribute('aria-autocomplete'), autocompleteAttr: el.getAttribute('autocomplete') };
      });
      check('ô nhập là combobox ARIA: aria-expanded=true, aria-controls trỏ đúng listbox, aria-autocomplete=list', aria.role === 'combobox' && aria.expanded === 'true' && aria.controls === aria.listboxId && aria.autocomplete === 'list', JSON.stringify(aria));
      check('tắt gợi ý của trình duyệt (autocomplete=off) để không che khung gợi ý', aria.autocompleteAttr === 'off', JSON.stringify(aria));
      const opts = await page.$$eval('[role=option]', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' | ')));
      check('mỗi gợi ý có 2 dòng: số nhà + đường / phường mới (quận cũ)', /101 Lê Lợi \| P\. Hạnh Thông \(Gò Vấp cũ\), TP\.HCM/.test(opts[0] || ''), JSON.stringify(opts));
      check('Hạnh Thông (Gò Vấp) đứng đầu dù server trả Quận 1 trước', /Hạnh Thông/.test(opts[0] || '') && /Bến Thành/.test(opts[1] || ''));
      const s = await form(page);
      check('không có mục nào tự tô sáng, các ô Quận/Phường chưa bị điền', s.active === null && s.district === '' && s.ward === '');
      await page.click('#note');
      await sleep(900);
      const after = await form(page);
      check('rời ô (blur): đóng khung, KHÔNG tự chọn, chữ giữ nguyên', after.options === 0 && after.address === TEXT && after.ward === '' && after.district === '');
      check('rời ô không phát sinh request nào thêm', calls.length === 1);
    })
  );

  // ──────────────────────────────────────────────────────────────────────
  await section('2. Enter, Esc và phím mũi tên', () =>
    withCheckout(browser, {}, async ({ page, calls, orderPosts }) => {
      await page.click('#address');
      await page.type('#address', TEXT, { delay: 20 });
      await page.waitForSelector('[role=option]');
      await page.keyboard.press('Escape');
      await sleep(200);
      let s = await form(page);
      check('Esc đóng khung gợi ý, chữ giữ nguyên, không chọn gì', s.options === 0 && s.address === TEXT && s.ward === '' && s.expanded === 'false', JSON.stringify(s));
      await page.fill('#address', '');
      await page.type('#address', TEXT, { delay: 20 });
      await page.waitForSelector('[role=option]');
      await page.keyboard.press('Enter');
      await sleep(500);
      s = await form(page);
      check('Enter khi chưa dùng phím mũi tên: không chọn, chỉ đóng khung, KHÔNG gửi đơn', s.address === TEXT && s.ward === '' && s.options === 0 && orderPosts.length === 0 && /thanh-toan/.test(page.url()), JSON.stringify({ s, orderPosts }));
      await page.click('#note');
      await page.click('#address');
      await page.waitForSelector('[role=option]');
      await page.keyboard.press('ArrowDown');
      s = await form(page);
      check('ArrowDown tô sáng mục đầu (aria-activedescendant)', !!s.active);
      const before = calls.length;
      await page.keyboard.press('Enter');
      await sleep(600);
      s = await form(page);
      check('ArrowDown + Enter chọn đúng gợi ý: điền Quận Gò Vấp, Phường Hạnh Thông, dòng "101 Lê Lợi"', s.district === 'Quận Gò Vấp' && s.ward === 'Phường Hạnh Thông' && s.address === '101 Lê Lợi', JSON.stringify(s));
      const pin = await gpsPair(page);
      check('ghim bản đồ nhảy tới tọa độ gợi ý đã chọn (Gò Vấp)', samePin(pin, [10.8208, 106.6874]), JSON.stringify(pin));
      await sleep(1500);
      check('chọn xong: không có thêm request nào (0 request chi tiết) và không hiện gợi ý lại', calls.length === before && (await form(page)).options === 0);
      await page.click('#note');
      await page.click('#address');
      await sleep(500);
      check('focus lại ô sau khi chọn: không hiện gợi ý', (await form(page)).options === 0);
    })
  );

  // ──────────────────────────────────────────────────────────────────────
  await section('3. Chọn bằng chuột (mousedown không làm mất lựa chọn)', () =>
    withCheckout(browser, {}, async ({ page }) => {
      await page.click('#address');
      await page.type('#address', '101 le loi go vap', { delay: 20 });
      await page.waitForSelector('[role=option]');
      await page.locator('[role=option]').nth(1).click();
      await sleep(700);
      const s = await form(page);
      check('bấm mục thứ hai (Quận 1) chọn đúng mục đó, không bị blur "chọn mục đầu" đè lên', s.district === 'Quận 1' && s.ward === 'Phường Bến Thành' && s.address === '101 Lê Lợi', JSON.stringify(s));
    })
  );

  // ──────────────────────────────────────────────────────────────────────
  await section('4a. Phản hồi chậm / về lộn thứ tự', () =>
    withCheckout(browser, { delays: { '101 le l': 1800, '101 le loi go vap': 100 } }, async ({ page, calls, aborted }) => {
      await page.click('#address');
      await page.type('#address', '101 le l', { delay: 20 });
      await sleep(450); // đủ debounce: câu 1 bay đi (chậm)
      await page.type('#address', 'oi go vap', { delay: 20 });
      await sleep(2600);
      const opts = await page.$$eval('[role=option]', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' | ')));
      check('câu cũ chậm bị hủy, chỉ hiện kết quả của chữ cuối', calls.length >= 2 && aborted.includes('101 le l'), JSON.stringify({ calls: calls.map((c) => c.text), aborted }));
      check('danh sách cuối đúng và Gò Vấp đứng đầu', opts.length === 2 && /Hạnh Thông/.test(opts[0]), JSON.stringify(opts));
      check('chữ trong ô không bị đổi', (await form(page)).address === '101 le loi go vap');
    })
  );
  await section('4b. Đang tải câu mới thì GIỮ danh sách cũ (không nhấp nháy)', () =>
    withCheckout(browser, { delays: { '101 Lê Lợi, Hạnh Thông': 1600 } }, async ({ page }) => {
      await page.click('#address');
      await page.type('#address', '101 Lê Lợi', { delay: 20 });
      await page.waitForSelector('[role=option]');
      await page.type('#address', ', Hạnh Thông', { delay: 20 });
      await sleep(900); // đã qua debounce, câu mới đang chờ server
      const during = await form(page);
      check('câu mới đang chờ: danh sách cũ vẫn còn, không bị xóa trống', during.options > 0 && during.expanded === 'true', JSON.stringify(during));
      await sleep(1500);
      const after = await form(page);
      check('có kết quả mới thì danh sách được thay, chữ khách gõ nguyên vẹn', after.options > 0 && after.address === '101 Lê Lợi, Hạnh Thông', JSON.stringify(after));
    })
  );
  await section('4c. API lỗi', () =>
    withCheckout(browser, { mode: { fail: true } }, async ({ page }) => {
      await page.click('#address');
      await page.type('#address', TEXT, { delay: 20 });
      await sleep(1200);
      check('API lỗi: hiện thông báo + nút "Chọn trên bản đồ", không làm mất chữ', (await bodyHas(page, /Gợi ý địa chỉ đang chậm/)) && (await bodyHas(page, /Chọn trên bản đồ/)) && (await form(page)).address === TEXT);
    })
  );

  // ──────────────────────────────────────────────────────────────────────
  await section('5. Bộ gõ tiếng Việt (IME): Enter/mũi tên khi đang gõ dở không chọn gợi ý', () =>
    withCheckout(browser, {}, async ({ page }) => {
      await page.click('#address');
      const res = await page.evaluate(async () => {
        const sl = (ms) => new Promise((r) => setTimeout(r, ms));
        const el = document.getElementById('address');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        const setVal = (v, composing) => {
          setter.call(el, v);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: composing ? 'insertCompositionText' : 'insertText', data: v.slice(-1), isComposing: !!composing }));
        };
        const key = (k, extra = {}) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
        el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        for (const t of ['101 l', '101 lê', '101 lê l', '101 lê lợ', '101 lê lợi']) {
          setVal(t, true);
          await sl(50);
        }
        await sl(700);
        key('ArrowDown', { isComposing: true, keyCode: 229 });
        key('Enter', { isComposing: true, keyCode: 229 });
        await sl(200);
        return {
          address: el.value,
          ward: document.getElementById('ward').value,
          options: document.querySelectorAll('[role=option]').length,
          active: el.getAttribute('aria-activedescendant'),
        };
      });
      check('đang composing: chữ giữ nguyên, danh sách có nhưng không bị chọn, không tô sáng', res.address === '101 lê lợi' && res.ward === '' && res.options === 2 && res.active === null, JSON.stringify(res));
    })
  );

  // ──────────────────────────────────────────────────────────────────────
  await section('6. Sửa địa chỉ sau khi chọn: cảnh báo, KHÔNG tự dời ghim', () =>
    withCheckout(browser, {}, async ({ page }) => {
      await page.click('#address');
      await page.type('#address', TEXT, { delay: 20 });
      await page.waitForSelector('[role=option]');
      await page.locator('[role=option]').first().click();
      await sleep(500);
      const pin = await gpsPair(page);
      check('chọn gợi ý đầu (Hạnh Thông, Gò Vấp đã được xếp trước): ghim ở Gò Vấp', samePin(pin, [10.8208, 106.6874]), JSON.stringify(pin));
      await page.fill('#address', '103 Lê Lợi');
      await sleep(600);
      check('chỉ đổi số nhà trên cùng đường: không cảnh báo', !(await bodyHas(page, /ghim bên dưới chưa đổi theo/)));
      check('chỉ đổi số nhà trên cùng đường: ghim giữ nguyên', samePin(await gpsPair(page), pin));
      await page.fill('#address', '5 Nguyễn Trãi');
      await sleep(600);
      check('đổi sang đường khác: có cảnh báo vàng "ghim bên dưới chưa đổi theo"', await bodyHas(page, /ghim bên dưới chưa đổi theo/));
      check('đổi sang đường khác: ghim KHÔNG tự dời', samePin(await gpsPair(page), pin), JSON.stringify(await gpsPair(page)));
      const s = await form(page);
      check('đổi sang đường khác: chữ đúng như khách gõ, Quận/Phường không bị đổi', s.address === '5 Nguyễn Trãi' && s.district === 'Quận Gò Vấp' && s.ward === 'Phường Hạnh Thông', JSON.stringify(s));
      await page.fill('#address', '101 Lê Lợi');
      await sleep(600);
      check('gõ lại đúng dòng đã chọn: cảnh báo biến mất', !(await bodyHas(page, /ghim bên dưới chưa đổi theo/)));
    })
  );

  // ──────────────────────────────────────────────────────────────────────
  for (const choice of ['use', 'keep']) {
    await section(`7. Ghim bản đồ: hỏi "Dùng địa chỉ này?", không tự ghi đè (khách bấm "${choice === 'use' ? 'Dùng địa chỉ này' : 'Giữ địa chỉ của tôi'}")`, () =>
      withCheckout(browser, {}, async ({ page, reverseCalls }) => {
        await page.click('#address');
        await page.type('#address', '5 Nguyễn Trãi', { delay: 20 });
        await sleep(600);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Chỉnh pin bản đồ' }).click();
        const modal = modalOf(page);
        await modal.waitFor({ timeout: 10000 });
        await dragPin(page, 72, -48);
        await sleep(1000);
        check('kéo ghim: reverse chỉ gọi 1 lần sau khi dừng kéo (không gọi mỗi lần di chuyển)', reverseCalls.length === 1, `đã gọi ${reverseCalls.length} lần`);
        await modal.locator('.leaflet-control-zoom-in').click();
        await sleep(1000);
        check('bấm nút zoom (ghim không dời): không gọi reverse thêm', reverseCalls.length === 1, `đã gọi ${reverseCalls.length} lần`);
        check('popup hiện "Vị trí ghim: …" theo địa chỉ tại ghim', /Vị trí ghim:\s*Đường Nguyễn Trung Trực/.test(await modal.innerText()));
        await modal.getByRole('button', { name: /Xác nhận vị trí/ }).click();
        await sleep(800);
        let s = await form(page);
        check('xác nhận ghim: chữ khách gõ KHÔNG bị đổi, ô Quận/Phường chưa bị điền', s.address === '5 Nguyễn Trãi' && s.district === '' && s.ward === '', JSON.stringify(s));
        check('hiện câu hỏi "Dùng địa chỉ này?" kèm địa chỉ tại ghim và chữ khách đã nhập', (await bodyHas(page, /Dùng địa chỉ này/)) && (await bodyHas(page, /Vị trí ghim: Đường Nguyễn Trung Trực/)) && (await bodyHas(page, /Bạn đã nhập: 5 Nguyễn Trãi/)));
        const pinAfterConfirm = await gpsPair(page);
        if (choice === 'use') {
          await page.getByRole('button', { name: 'Dùng địa chỉ này' }).click();
          await sleep(600);
          s = await form(page);
          check('bấm "Dùng địa chỉ này": chữ đổi theo ghim, điền Quận 1 / Bến Thành, hết câu hỏi', s.address === 'Đường Nguyễn Trung Trực' && s.district === 'Quận 1' && s.ward === 'Phường Bến Thành' && !(await bodyHas(page, /Vị trí ghim cho ra địa chỉ khác/)), JSON.stringify(s));
        } else {
          await page.getByRole('button', { name: 'Giữ địa chỉ của tôi' }).click();
          await sleep(600);
          s = await form(page);
          check('bấm "Giữ địa chỉ của tôi": chữ giữ nguyên, ô Quận/Phường còn trống được điền theo vị trí ghim', s.address === '5 Nguyễn Trãi' && s.district === 'Quận 1' && s.ward === 'Phường Bến Thành', JSON.stringify(s));
        }
        check('chọn xong thì ghim giữ đúng chỗ khách đã ghim', samePin(await gpsPair(page), pinAfterConfirm));
      })
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  await section('8. GPS: có quyền vị trí thì làm bias (không phải ràng buộc); bấm "Lấy vị trí GPS" cũng hỏi, không tự đè', () =>
    withCheckout(browser, { geo: true }, async ({ page, calls }) => {
      await sleep(800); // chờ trang đọc vị trí đã được cấp quyền
      await page.click('#address');
      await page.type('#address', '12 Nguyễn Văn Bảo', { delay: 20 });
      await sleep(900);
      const p = calls[0]?.params || {};
      check('request kèm lat/lng GPS làm bias, vẫn là chữ nguyên văn của khách', calls[0]?.text === '12 Nguyễn Văn Bảo' && Math.abs(parseFloat(p.lat) - GPS_FIX.latitude) < 1e-3 && Math.abs(parseFloat(p.lng) - GPS_FIX.longitude) < 1e-3, JSON.stringify(calls[0]));
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Lấy vị trí GPS/ }).click();
      await sleep(1500);
      const s = await form(page);
      check('GPS cho ra địa chỉ khác chữ khách gõ: giữ nguyên chữ, chưa điền Quận/Phường', s.address === '12 Nguyễn Văn Bảo' && s.district === '' && s.ward === '', JSON.stringify(s));
      check('hiện câu hỏi "Dùng địa chỉ này?" với địa chỉ tại vị trí GPS', (await bodyHas(page, /Dùng địa chỉ này/)) && (await bodyHas(page, /Bạn đã nhập: 12 Nguyễn Văn Bảo/)));
    })
  );

  // ──────────────────────────────────────────────────────────────────────
  await section('9. Màn hình điện thoại 375 px: không cuộn ngang, chạm vào gợi ý chọn được', () =>
    withCheckout(browser, { mobile: true }, async ({ page }) => {
      await page.click('#address');
      await page.type('#address', TEXT, { delay: 20 });
      await page.waitForSelector('[role=option]');
      const m = await page.evaluate(() => {
        const panel = document.querySelector('[role=listbox]').parentElement.getBoundingClientRect();
        return { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, left: Math.round(panel.left), right: Math.round(panel.right) };
      });
      check('không cuộn ngang, khung gợi ý nằm gọn trong màn hình', m.scrollW <= m.innerW && m.left >= 0 && m.right <= m.innerW, JSON.stringify(m));
      await page.locator('[role=option]').first().tap();
      await sleep(700);
      const s = await form(page);
      check('chạm vào gợi ý đầu (Gò Vấp): chọn đúng, điền Quận/Phường', s.district === 'Quận Gò Vấp' && s.ward === 'Phường Hạnh Thông' && s.address === '101 Lê Lợi', JSON.stringify(s));
    })
  );

  // ──────────────────────────────────────────────────────────────────────
  // Lỗi cũ: chọn xong một gợi ý (đổi Quận/Phường/ghim) thì danh sách gợi ý lại bật lên. Theo dõi liên tục 4 giây sau khi chọn.
  for (const single of [false, true]) {
    for (const how of ['chuột', 'phím']) {
      await section(`10. Chọn xong thì danh sách KHÔNG bật lại (${single ? 'chỉ 1 gợi ý' : 'nhiều gợi ý'}, chọn bằng ${how})`, () =>
        withCheckout(browser, { mode: { single } }, async ({ page, calls }) => {
          await page.click('#address');
          await page.type('#address', TEXT, { delay: 25 });
          await page.waitForSelector('[role=option]');
          const shown = (await form(page)).options;
          check(single ? 'danh sách có đúng 1 gợi ý' : 'danh sách có nhiều gợi ý', single ? shown === 1 : shown >= 2, String(shown));
          const before = calls.length;
          // Từ lúc bấm chọn trở đi, đếm số lần ô địa chỉ báo "đang mở danh sách" (aria-expanded=true)
          await page.evaluate(() => {
            window.__reopened = 0;
            window.__picked = false;
            const input = document.getElementById('address');
            const arm = () => {
              window.__picked = true;
            };
            document.addEventListener('click', arm, true);
            document.addEventListener('keydown', (e) => e.key === 'Enter' && arm(), true);
            new MutationObserver(() => {
              if (window.__picked && input.getAttribute('aria-expanded') === 'true') window.__reopened++;
            }).observe(input, { attributes: true, attributeFilter: ['aria-expanded'] });
          });
          if (how === 'chuột') {
            await page.locator('[role=option]').first().click();
          } else {
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
          }
          await sleep(4000);
          let s = await form(page);
          const reopened = await page.evaluate(() => window.__reopened);
          check('chọn xong: Quận/Phường đã điền, ô địa chỉ là "101 Lê Lợi"', s.district === 'Quận Gò Vấp' && s.ward === 'Phường Hạnh Thông' && s.address === '101 Lê Lợi', JSON.stringify(s));
          check('4 giây sau khi chọn: danh sách không bật lại lần nào', reopened === 0 && s.options === 0 && s.expanded === 'false', JSON.stringify({ reopened, s }));
          check('chọn xong không phát sinh thêm câu hỏi gợi ý nào', calls.length === before, `trước ${before}, sau ${calls.length}`);
          check('chọn xong cũng không hiện khung vàng nào ("Dùng địa chỉ này?", "ghim chưa đổi theo", "không khớp với ghim")', !(await bodyHas(page, /Dùng địa chỉ này|ghim bên dưới chưa đổi theo|không khớp với ghim/)));
          await page.click('#note');
          await page.click('#address');
          await sleep(1000);
          s = await form(page);
          check('bấm ra ngoài rồi bấm lại vào ô: vẫn không hiện gợi ý', s.options === 0 && s.expanded === 'false' && calls.length === before, JSON.stringify(s));
          await page.keyboard.press('End');
          await sleep(600);
          check('đặt con trỏ / bấm End trong ô: không hiện gợi ý', (await form(page)).options === 0 && calls.length === before);
          // Khách tự gõ thêm thì mới được gợi ý lại (đúng chủ ý)
          await page.keyboard.type(' x', { delay: 20 });
          await sleep(900);
          check('khách gõ thêm chữ thì danh sách mới được hỏi lại', calls.length === before + 1, `trước ${before}, sau ${calls.length}`);
        })
      );
    }
  }
  // ──────────────────────────────────────────────────────────────────────
  // Không giao theo tọa độ "gần đúng": chọn gợi ý mức khu vực / giữa đường thì phải xác nhận ghim mới đặt được
  for (const precision of ['area', 'street', 'house']) {
    await section(`11. Đặt hàng khi vị trí là mức "${precision}"${precision === 'house' ? ' (đáng tin: không bắt xác nhận ghim)' : ' (chưa đáng tin: bắt xác nhận ghim)'}`, () =>
      withCheckout(browser, { mode: { precision } }, async ({ page, orderPosts }) => {
        await page.fill('[name="fullName"]', 'Khách Thử Nghiệm');
        await page.fill('[name="phone"]', '0901234567');
        await page.click('#address');
        await page.type('#address', TEXT, { delay: 20 });
        await page.waitForSelector('[role=option]');
        await page.locator('[role=option]').first().click();
        await sleep(700);
        const notice = await bodyHas(page, /Đây mới là vị trí gần đúng|Hãy xác nhận ghim đúng nhà bạn/);
        check(precision === 'house' ? 'gợi ý đúng số nhà: không hiện khung "xác nhận ghim"' : 'hiện khung nhắc xác nhận ghim (vị trí chưa đáng tin)', precision === 'house' ? !notice : notice);
        await page.locator('form button[type=submit]').last().click();
        await sleep(1200);
        if (precision === 'house') {
          check('vị trí đáng tin: đơn được gửi đi (không bị chặn, không mở bản đồ)', orderPosts.length === 1 && (await modalOf(page).count()) === 0, JSON.stringify({ posts: orderPosts.length }));
          return;
        }
        check('bấm Đặt hàng: KHÔNG gửi đơn, tự mở bản đồ để xác nhận ghim', orderPosts.length === 0 && (await modalOf(page).count()) === 1, JSON.stringify({ posts: orderPosts.length }));
        const confirmBtn = modalOf(page).getByRole('button', { name: /Xác nhận vị trí/ });
        if (precision === 'area') {
          check('mức "gần đúng": nút Xác nhận bị khóa cho tới khi kéo ghim đi chỗ khác', await confirmBtn.isDisabled());
          await dragPin(page, 40, -30);
          await sleep(1200);
          check('kéo ghim xong thì nút Xác nhận mở', await confirmBtn.isEnabled());
        } else {
          check('mức "giữa đường": xác nhận ngay được (chỉ cần bấm xác nhận một lần)', await confirmBtn.isEnabled());
        }
        await confirmBtn.click();
        await sleep(900);
        if (await bodyHas(page, /Giữ địa chỉ của tôi/)) await page.getByRole('button', { name: 'Giữ địa chỉ của tôi' }).click();
        await sleep(500);
        check('sau khi xác nhận ghim: hết khung nhắc, vị trí đáng tin', !(await bodyHas(page, /Đây mới là vị trí gần đúng|Hãy xác nhận ghim đúng nhà bạn/)));
      })
    );
  }

  // Chưa có tọa độ: bản đồ mở ở tâm khu khách đã gõ (Gò Vấp), không phải Quận 1
  await section('12. Bản đồ mở ở tâm khu khách đã gõ khi chưa có tọa độ', () =>
    withCheckout(browser, {}, async ({ page }) => {
      await page.click('#address');
      await page.type('#address', TEXT, { delay: 20 });
      await sleep(600);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Chỉnh pin bản đồ' }).click();
      const modal = modalOf(page);
      await modal.waitFor({ timeout: 10000 });
      await sleep(1500);
      const text = await modal.innerText();
      const m = text.match(/Tọa độ xác nhận:\s*(-?[0-9.]+),\s*(-?[0-9.]+)/);
      const lat = m ? parseFloat(m[1]) : NaN;
      const lng = m ? parseFloat(m[2]) : NaN;
      check('tọa độ mở bản đồ nằm ở Gò Vấp (≈ 10.82, 106.68), không phải trung tâm Quận 1 (10.7769, 106.7009)', Math.abs(lat - 10.82) < 0.03 && Math.abs(lng - 106.68) < 0.03, JSON.stringify({ lat, lng }));
    })
  );
} finally {
  await browser.close();
}

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
