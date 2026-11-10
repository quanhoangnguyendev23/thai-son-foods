import crypto from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { isCookieSecure } from '@/lib/runtimeConfig';
import { query } from '@/lib/db';
import { invalidateUserSessionCache } from '@/lib/auth';

/**
 * Tiện ích dùng chung cho đăng nhập Google / Facebook (OAuth 2.0 Authorization Code).
 *  - state ngẫu nhiên lưu trong cookie httpOnly → chống tấn công CSRF khi đăng nhập
 *  - returnUrl chỉ nhận đường dẫn nội bộ → chống chuyển hướng ra trang ngoài (open redirect)
 */

export type OAuthProvider = 'google' | 'facebook';

// Phiên bản Graph API của Facebook; đổi bằng biến môi trường khi Meta ngừng hỗ trợ bản cũ
export const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v22.0';

export const OAUTH_STATE_COOKIE = 'tsf_oauth_state';
export const OAUTH_RETURN_COOKIE = 'tsf_oauth_return';
const OAUTH_COOKIE_MAX_AGE_SECONDS = 600; // 10 phút để hoàn tất đăng nhập

const PLACEHOLDER_RE = /your_(google|facebook)_(client|app)_id|your_.*_secret/i;

function isRealValue(v: string | undefined): v is string {
  return Boolean(v && v.trim() !== '' && !PLACEHOLDER_RE.test(v));
}

/** Nhà cung cấp đã được cấu hình đủ ID + Secret (khóa thật) chưa */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === 'google') {
    return isRealValue(process.env.GOOGLE_CLIENT_ID) && isRealValue(process.env.GOOGLE_CLIENT_SECRET);
  }
  return isRealValue(process.env.FACEBOOK_CLIENT_ID) && isRealValue(process.env.FACEBOOK_CLIENT_SECRET);
}

/**
 * Google chỉ chấp nhận địa chỉ quay về là http://localhost hoặc tên miền https (không nhận địa chỉ IP,
 * không nhận http với tên miền khác) — gặp các địa chỉ đó Google báo "Lỗi 400: invalid_request".
 */
export function isGoogleAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost') return true;
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
    return u.protocol === 'https:' && !isIp;
  } catch {
    return false;
  }
}

/** Chế độ đăng nhập giả lập chỉ dành cho máy phát triển (không bao giờ bật ở production) */
export function isMockOAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_OAUTH === 'true';
}

/** Chỉ chấp nhận đường dẫn nội bộ dạng "/abc" (không "//host", không "\\", không ký tự xuống dòng) */
export function sanitizeReturnUrl(value: string | null | undefined, fallback = '/tai-khoan'): string {
  if (!value) return fallback;
  const v = value.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || /[\r\n\t]/.test(v)) return fallback;
  return v.length > 500 ? fallback : v;
}

export function newOAuthState(): string {
  return crypto.randomBytes(24).toString('hex');
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: 'lax' as const, // callback là điều hướng cấp cao từ nhà cung cấp → cookie lax vẫn được gửi
    path: '/',
    maxAge,
  };
}

/** Gắn state + returnUrl vào phản hồi chuyển hướng sang nhà cung cấp */
export function setOAuthCookies(res: NextResponse, provider: OAuthProvider, state: string, returnUrl: string) {
  res.cookies.set({ name: OAUTH_STATE_COOKIE, value: `${provider}:${state}`, ...cookieOptions(OAUTH_COOKIE_MAX_AGE_SECONDS) });
  res.cookies.set({ name: OAUTH_RETURN_COOKIE, value: returnUrl, ...cookieOptions(OAUTH_COOKIE_MAX_AGE_SECONDS) });
}

export function clearOAuthCookies(res: NextResponse) {
  res.cookies.set({ name: OAUTH_STATE_COOKIE, value: '', ...cookieOptions(0) });
  res.cookies.set({ name: OAUTH_RETURN_COOKIE, value: '', ...cookieOptions(0) });
}

/** Kiểm tra state trả về từ nhà cung cấp khớp cookie đã đặt lúc bắt đầu; trả về returnUrl đã làm sạch */
export function verifyOAuthCallback(
  req: NextRequest,
  provider: OAuthProvider,
  stateParam: string | null
): { ok: true; returnUrl: string } | { ok: false } {
  const cookieVal = req.cookies.get(OAUTH_STATE_COOKIE)?.value || '';
  if (!stateParam || !cookieVal) return { ok: false };
  const expected = `${provider}:${stateParam}`;
  const a = crypto.createHash('sha256').update(cookieVal).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) return { ok: false };

  let returnUrl = '/tai-khoan';
  try {
    returnUrl = sanitizeReturnUrl(req.cookies.get(OAUTH_RETURN_COOKIE)?.value || '');
  } catch {
    // giữ mặc định
  }
  return { ok: true, returnUrl };
}

export type OAuthAccountResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; code: 'account_disabled' | 'email_in_use' };

/**
 * Tìm hoặc tạo tài khoản khách cho một lần đăng nhập Google / Facebook đã xác thực xong với nhà cung cấp.
 *
 * Email khách tự khai lúc đăng ký bằng mật khẩu CHƯA được xác minh, nên không được gộp bừa theo email:
 *  1. Khớp đúng danh tính mạng xã hội (provider + provider_id) → đăng nhập tài khoản đó.
 *  2. Email đã thuộc một tài khoản khác:
 *     - emailVerified = true (Google đã xác minh email): người đăng nhập là chủ thật của email → nhận tài khoản,
 *       đồng thời VÔ HIỆU mật khẩu cũ. Ai đã đăng ký trước bằng email này sẽ không đăng nhập lại được,
 *       phiên cũ của họ cũng bị từ chối (xem isUserLocked trong lib/auth.ts).
 *     - emailVerified = false (Facebook không cam kết email đã xác minh): từ chối (email_in_use), không gộp.
 *  3. Chưa có tài khoản → tạo mới, không có mật khẩu dùng được.
 */
export async function resolveOAuthAccount(params: {
  provider: OAuthProvider;
  providerId: string | null;
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl: string | null;
}): Promise<OAuthAccountResult> {
  const { provider, providerId, email, emailVerified, fullName, avatarUrl } = params;
  const unusablePassword = `oauth_${provider}_${providerId || Date.now()}`;

  let row: { id: string; is_active: boolean | null; provider: string | null; provider_id: string | null } | undefined;
  if (providerId) {
    const byIdentity = await query(
      'SELECT id, is_active, provider, provider_id FROM users WHERE provider = $1 AND provider_id = $2 LIMIT 1;',
      [provider, providerId]
    );
    row = byIdentity.rows[0];
  }
  if (!row) {
    const byEmail = await query('SELECT id, is_active, provider, provider_id FROM users WHERE email = $1 LIMIT 1;', [email]);
    const found = byEmail.rows[0];
    if (found) {
      // Dòng cũ cùng nhà cung cấp nhưng chưa lưu provider_id vẫn được coi là đúng tài khoản
      const sameProviderLegacy = found.provider === provider && !found.provider_id;
      if (!emailVerified && !sameProviderLegacy) return { ok: false, code: 'email_in_use' };
      row = found;
    }
  }

  if (row) {
    if (row.is_active === false) return { ok: false, code: 'account_disabled' };
    await query(
      `UPDATE users
       SET full_name = COALESCE(NULLIF(full_name, ''), $1),
           avatar_url = COALESCE($2, avatar_url),
           provider = $3,
           provider_id = COALESCE($4, provider_id),
           password_hash = CASE WHEN $5::boolean AND password_hash LIKE '$2%' THEN $6 ELSE password_hash END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7;`,
      // Chỉ vô hiệu mật khẩu cũ khi nhà cung cấp đã xác minh email (Google). Với Facebook giữ nguyên mật khẩu:
      // không đủ căn cứ để coi danh tính Facebook là chủ thật của email.
      [fullName, avatarUrl, provider, providerId, emailVerified, unusablePassword, row.id]
    );
    // Phiên cấp theo cách đăng nhập cũ mất hiệu lực ngay trên tiến trình này (tiến trình khác: tối đa 10 giây)
    invalidateUserSessionCache(row.id);
    return { ok: true, userId: row.id, created: false };
  }

  const prefix = provider === 'google' ? 'gg' : 'fb';
  const userId = `usr_${prefix}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  await query(
    `INSERT INTO users (id, email, password_hash, full_name, avatar_url, provider, provider_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
    [userId, email, unusablePassword, fullName, avatarUrl, provider, providerId]
  );
  return { ok: true, userId, created: true };
}
