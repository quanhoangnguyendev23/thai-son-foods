/**
 * Kiểm thử luồng đăng nhập Google / Facebook (OAuth 2.0) — giả lập phản hồi của nhà cung cấp.
 * Chạy: npx tsx tests/test_oauth_social_login.mjs   (cần CSDL cục bộ; tự dọn dữ liệu thử)
 */
import 'dotenv/config';

process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.FACEBOOK_CLIENT_ID = 'test-facebook-app-id';
process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-app-secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

const { NextRequest } = await import('next/server');
const { query, pool } = await import('@/lib/db');
const googleStart = await import('@/app/api/auth/google/route');
const facebookStart = await import('@/app/api/auth/facebook/route');
const googleCb = await import('@/app/api/auth/callback/google/route');
const facebookCb = await import('@/app/api/auth/callback/facebook/route');
const providersRoute = await import('@/app/api/auth/providers/route');
const { sanitizeReturnUrl } = await import('@/lib/oauth');

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

const TEST_EMAILS = ['oauth-test-google@example.test', 'oauth-test-google-unverified@example.test', 'oauth-test-fb@example.test', 'oauth-test-disabled@example.test'];
async function cleanup() {
  await query(`DELETE FROM users WHERE email = ANY($1) OR email LIKE 'fb_990001%@facebook.user' OR id LIKE 'usr_oauth_test_%';`, [TEST_EMAILS]);
}

const realFetch = globalThis.fetch;
function mockProviders({ google, facebook } = {}) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    const json = (body, ok = true) => ({ ok, json: async () => body });
    if (u.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'g-token' });
    if (u.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) return json(google);
    if (u.includes('graph.facebook.com') && u.includes('/oauth/access_token')) return json({ access_token: 'f-token' });
    if (u.includes('graph.facebook.com') && u.includes('/me')) return json(facebook);
    return realFetch(url);
  };
}

function cbRequest(path, { state, cookies } = {}) {
  const qs = state === undefined ? '' : `&state=${state}`;
  const headers = cookies ? { cookie: cookies } : {};
  return new NextRequest(`http://localhost:3000${path}${path.includes('?') ? '' : '?'}${qs}`.replace('?&', '?'), { headers });
}

function location(res) {
  return res.headers.get('location') || '';
}
function setCookies(res) {
  return res.headers.getSetCookie ? res.headers.getSetCookie().join(' | ') : res.headers.get('set-cookie') || '';
}
function cookiePair(res, name) {
  const m = setCookies(res).match(new RegExp(`${name}=([^;]*)`));
  return m ? m[1] : '';
}

try {
  await cleanup();

  console.log('--- NHÓM 1: Tiện ích bảo mật ---');
  check('returnUrl nội bộ hợp lệ được giữ', sanitizeReturnUrl('/san-pham/abc?x=1') === '/san-pham/abc?x=1');
  check('returnUrl "//evil.com" bị chặn', sanitizeReturnUrl('//evil.com') === '/tai-khoan');
  check('returnUrl "https://evil.com" bị chặn', sanitizeReturnUrl('https://evil.com') === '/tai-khoan');
  check('returnUrl "/\\evil.com" bị chặn', sanitizeReturnUrl('/\\evil.com') === '/tai-khoan');
  check('returnUrl rỗng dùng mặc định', sanitizeReturnUrl('') === '/tai-khoan');

  console.log('--- NHÓM 2: Nhà cung cấp & bước bắt đầu ---');
  const prov = await (await providersRoute.GET()).json();
  check('providers báo Google và Facebook khả dụng khi đã có khóa', prov.google === true && prov.facebook === true);

  const gRes = await googleStart.GET(new NextRequest('http://localhost:3000/api/auth/google?returnUrl=//evil.com'));
  const gLoc = new URL(location(gRes));
  const gState = gLoc.searchParams.get('state');
  check('Google: chuyển sang accounts.google.com', gLoc.hostname === 'accounts.google.com');
  check('Google: redirect_uri đúng domain cấu hình', gLoc.searchParams.get('redirect_uri') === 'http://localhost:3000/api/auth/callback/google');
  check('Google: state ngẫu nhiên và có cookie đi kèm', Boolean(gState) && gState.length >= 32 && setCookies(gRes).includes('tsf_oauth_state=google'));
  check('Google: returnUrl độc hại trong cookie bị thay bằng /tai-khoan', decodeURIComponent(cookiePair(gRes, 'tsf_oauth_return')) === '/tai-khoan');
  check('Google: cookie state là httpOnly', /tsf_oauth_state=[^|]*HttpOnly/i.test(setCookies(gRes)));

  const fRes = await facebookStart.GET(new NextRequest('http://localhost:3000/api/auth/facebook?returnUrl=/gio-hang'));
  const fLoc = new URL(location(fRes));
  check('Facebook: chuyển sang facebook.com dialog/oauth', fLoc.hostname === 'www.facebook.com' && fLoc.pathname.endsWith('/dialog/oauth'));
  check('Facebook: returnUrl nội bộ được giữ trong cookie', decodeURIComponent(cookiePair(fRes, 'tsf_oauth_return')) === '/gio-hang');

  console.log('--- NHÓM 3: Callback Google ---');
  const goodCookie = `tsf_oauth_state=google:${gState}; tsf_oauth_return=${encodeURIComponent('/gio-hang')}`;

  let res = await googleCb.GET(cbRequest('/api/auth/callback/google?code=abc', { state: gState }));
  check('Thiếu cookie state → từ chối (oauth_state_invalid)', location(res).includes('error=oauth_state_invalid'));
  check('Từ chối thì KHÔNG cấp phiên đăng nhập', !setCookies(res).includes('tsf_user_session=ey'));

  res = await googleCb.GET(cbRequest('/api/auth/callback/google?code=abc', { state: 'sai-state', cookies: goodCookie }));
  check('State không khớp → từ chối', location(res).includes('error=oauth_state_invalid'));

  res = await googleCb.GET(cbRequest('/api/auth/callback/google?error=access_denied', { state: gState, cookies: goodCookie }));
  check('Khách hủy ở Google → oauth_cancelled', location(res).includes('error=oauth_cancelled'));

  mockProviders({ google: { email: 'oauth-test-google-unverified@example.test', email_verified: false, name: 'Chua Xac Minh', sub: 'g-unverified' } });
  res = await googleCb.GET(cbRequest('/api/auth/callback/google?code=abc', { state: gState, cookies: goodCookie }));
  let u = await query(`SELECT 1 FROM users WHERE email = 'oauth-test-google-unverified@example.test'`);
  check('Email Google chưa xác minh → từ chối, không tạo tài khoản', location(res).includes('error=google_email_unverified') && u.rows.length === 0);

  mockProviders({ google: { email: 'oauth-test-google@example.test', email_verified: true, name: 'Khach Google', sub: 'g-123', picture: 'https://example.test/a.png' } });
  res = await googleCb.GET(cbRequest('/api/auth/callback/google?code=abc', { state: gState, cookies: goodCookie }));
  u = await query(`SELECT full_name, provider, provider_id FROM users WHERE email = 'oauth-test-google@example.test'`);
  check('Đăng nhập Google hợp lệ → chuyển về returnUrl đã lưu', location(res) === 'http://localhost:3000/gio-hang', location(res));
  check('Tạo tài khoản mới với provider=google', u.rows[0]?.provider === 'google' && u.rows[0]?.provider_id === 'g-123');
  check('Cấp cookie phiên đăng nhập httpOnly', /tsf_user_session=ey[^|]*HttpOnly/i.test(setCookies(res)));
  check('Xóa cookie state sau khi dùng', /tsf_oauth_state=;/.test(setCookies(res)));

  res = await googleCb.GET(cbRequest('/api/auth/callback/google?code=abc', { state: gState, cookies: goodCookie }));
  const cnt = await query(`SELECT COUNT(*)::int n FROM users WHERE email = 'oauth-test-google@example.test'`);
  check('Đăng nhập lần 2 dùng lại tài khoản (không tạo trùng)', cnt.rows[0].n === 1);

  const tamper = `tsf_oauth_state=google:${gState}; tsf_oauth_return=${encodeURIComponent('//evil.com')}`;
  res = await googleCb.GET(cbRequest('/api/auth/callback/google?code=abc', { state: gState, cookies: tamper }));
  check('returnUrl bị sửa thành "//evil.com" → đưa về /tai-khoan', location(res) === 'http://localhost:3000/tai-khoan', location(res));

  await query(`INSERT INTO users (id, email, password_hash, full_name, is_active) VALUES ('usr_oauth_test_dis', 'oauth-test-disabled@example.test', 'x', 'Bi Khoa', false)`);
  mockProviders({ google: { email: 'oauth-test-disabled@example.test', email_verified: true, name: 'Bi Khoa', sub: 'g-dis' } });
  res = await googleCb.GET(cbRequest('/api/auth/callback/google?code=abc', { state: gState, cookies: goodCookie }));
  check('Tài khoản bị vô hiệu hóa không đăng nhập được', location(res).includes('error=account_disabled') && !setCookies(res).includes('tsf_user_session=ey'));

  console.log('--- NHÓM 4: Callback Facebook ---');
  const fState = fLoc.searchParams.get('state');
  const fbCookie = `tsf_oauth_state=facebook:${fState}; tsf_oauth_return=${encodeURIComponent('/')}`;

  res = await facebookCb.GET(cbRequest('/api/auth/callback/facebook?code=abc', { state: gState, cookies: fbCookie }));
  check('Facebook: state của nhà cung cấp khác bị từ chối', location(res).includes('error=oauth_state_invalid'));

  mockProviders({ facebook: { id: '990001', name: 'Khach Facebook' } });
  res = await facebookCb.GET(cbRequest('/api/auth/callback/facebook?code=abc', { state: fState, cookies: fbCookie }));
  u = await query(`SELECT email, provider FROM users WHERE provider = 'facebook' AND provider_id = '990001'`);
  check('Facebook không có email → dùng địa chỉ nội bộ theo ID', u.rows[0]?.email === 'fb_990001@facebook.user');
  check('Facebook: đăng nhập thành công và cấp phiên', /tsf_user_session=ey/.test(setCookies(res)) && location(res) === 'http://localhost:3000/');

  mockProviders({ facebook: { id: '990002', name: 'Khach FB Co Email', email: 'OAuth-Test-FB@example.test' } });
  res = await facebookCb.GET(cbRequest('/api/auth/callback/facebook?code=abc', { state: fState, cookies: fbCookie }));
  u = await query(`SELECT email FROM users WHERE email = 'oauth-test-fb@example.test'`);
  check('Facebook có email → chuẩn hóa chữ thường và tạo tài khoản', u.rows.length === 1);

  mockProviders({ facebook: { name: 'Khong ID' } });
  res = await facebookCb.GET(cbRequest('/api/auth/callback/facebook?code=abc', { state: fState, cookies: fbCookie }));
  check('Facebook trả hồ sơ không có ID → từ chối', location(res).includes('error=facebook_no_profile'));
} finally {
  globalThis.fetch = realFetch;
  await query(`DELETE FROM users WHERE email LIKE 'fb_99000%@facebook.user'`).catch(() => {});
  await cleanup().catch(() => {});
  await pool.end().catch(() => {});
}

console.log('\n================================================================');
console.log(`KẾT QUẢ ĐĂNG NHẬP MẠNG XÃ HỘI: ${pass} PASS, ${fail} FAIL`);
console.log('================================================================');
process.exit(fail === 0 ? 0 : 1);
