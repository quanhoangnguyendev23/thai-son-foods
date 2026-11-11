/**
 * Bộ dựng PHIÊN ĐĂNG NHẬP GIẢ cho test route trên DB test riêng (gọi thẳng hàm GET/POST/PUT của route).
 * - Phiên admin / STORE_STAFF / MARKETING: tạo dòng trong admin_users rồi ký token bằng signAdminToken THẬT; getAdminSession THẬT
 *   đọc cookie qua next/headers và kiểm tra lại với DB. Ở đây chỉ thay `cookies()` của Next (vốn chỉ chạy trong phạm vi request của
 *   máy chủ Next) bằng một "hũ cookie" giả. Logic xác thực, phân quyền (rbac) và phạm vi cửa hàng vẫn là mã thật.
 * - Phiên đối tác / đại lý: tạo users + partner_profiles rồi ký token bằng signUserToken THẬT, gửi qua header Authorization: Bearer
 *   (getPartnerSession đọc header này trước, không cần cookies()).
 * Chỉ dùng sau setupReviewTestEnv() và khi DB là webtsf_review_test.
 *
 * Cách dùng:
 *   installFakeNextHeaders();                       // một lần, trước khi gọi route
 *   await loginAdmin(pool, { role: 'SUPER_ADMIN' }); // đặt cookie admin cho các lần gọi route tiếp theo
 *   logoutAdmin();
 *   const { headers } = await partnerBearer(pool, { type: 'DEALER', tierId: 'tier_zero' });
 */
import { createRequire } from 'node:module';

const requireCjs = createRequire(import.meta.url);
const jar = {};

export function installFakeNextHeaders() {
  const h = requireCjs('next/headers');
  const store = () => ({
    get: (name) => (jar[name] ? { name, value: jar[name] } : undefined),
    has: (name) => Boolean(jar[name]),
    getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
  });
  h.cookies = async () => store();
  h.headers = async () => new Headers();
}

export function logoutAdmin() {
  delete jar['tsf_admin_token'];
}

export function logoutUser() {
  delete jar['tsf_user_session'];
}

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(++seq).toString(36)}`;

/** Tạo tài khoản admin trong DB test và đặt cookie phiên cho các lần gọi route tiếp theo */
export async function loginAdmin(pool, { role = 'SUPER_ADMIN', storeCode = null, username } = {}) {
  const { signAdminToken, invalidateAdminSessionCache } = await import('@/lib/auth');
  const id = `adm_${uniq()}`;
  const name = username || `${role.toLowerCase()}_${id}`;
  const email = `${name}@example.com`;
  await pool.query(
    `INSERT INTO admin_users (id, username, email, password_hash, full_name, role, is_active, store_code, must_change_password)
     VALUES ($1, $2, $3, 'x', $4, $5, true, $6, false);`,
    [id, name, email, `Test ${role}`, role, storeCode]
  );
  invalidateAdminSessionCache();
  jar['tsf_admin_token'] = await signAdminToken({ id, userId: id, username: name, email, role, storeCode });
  return { id, username: name, email, role, storeCode };
}

/** Tạo khách (users) và trả về header Authorization Bearer của khách đó */
export async function userBearer(pool, { email, fullName = 'Khách Test', phone = null } = {}) {
  const { signUserToken } = await import('@/lib/auth');
  const id = `usr_${uniq()}`;
  const mail = email || `${id}@example.com`;
  await pool.query(`INSERT INTO users (id, email, password_hash, full_name, phone) VALUES ($1, $2, 'x', $3, $4);`, [id, mail, fullName, phone]);
  const token = await signUserToken({ id, email: mail, fullName, phone });
  return { id, email: mail, headers: { authorization: `Bearer ${token}` } };
}

/**
 * Tạo đối tác (CTV) hoặc đại lý (DEALER) kèm khách và trả về header Bearer.
 * tierId phải là một dòng có sẵn trong dealer_tiers (hoặc null).
 */
export async function partnerBearer(pool, { type = 'CTV', status = 'ACTIVE', tierId = null, code } = {}) {
  const u = await userBearer(pool, { fullName: `Đối tác ${type}` });
  const id = `ptn_${uniq()}`;
  await pool.query(
    `INSERT INTO partner_profiles (id, user_id, partner_code, partner_type, lifecycle_status, phone, full_name, email, tier_id)
     VALUES ($1, $2, $3, $4, $5, '0922222222', $6, $7, $8);`,
    [id, u.id, code || `TSF-${type}-${id}`.slice(0, 48), type, status, `Đối tác ${type}`, u.email, tierId]
  );
  return { partnerId: id, userId: u.id, email: u.email, headers: u.headers };
}

/** Request giả gửi tới hàm route */
export function jsonRequest(url, { method = 'GET', body, headers = {} } = {}) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
