import crypto from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { isCookieSecure } from '@/lib/runtimeConfig';

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
