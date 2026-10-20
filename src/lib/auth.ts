import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import { query } from '@/lib/db';

import { getJwtSecretBytes, INSECURE_DEFAULT_JWT_SECRET } from '@/lib/jwtSecret';

/**
 * Validate required environment variables in production mode (fail-closed principle).
 * Checks CRON_SECRET, strong JWT_SECRET, ENABLE_MOCK_OAUTH disablement, and database configuration.
 */
export function validateProductionEnvironment(): { isValid: boolean; errors: string[] } {
  const isProd = process.env.NODE_ENV === 'production';
  const errors: string[] = [];

  if (isProd) {
    if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 16) {
      errors.push('CRON_SECRET is required and must be at least 16 characters in production.');
    }
    const jwt = process.env.JWT_SECRET;
    if (!jwt || jwt === INSECURE_DEFAULT_JWT_SECRET || jwt.length < 32) {
      errors.push('JWT_SECRET must be set to a secure, unique string (min 32 chars) in production.');
    }
    if (process.env.ENABLE_MOCK_OAUTH === 'true') {
      errors.push('ENABLE_MOCK_OAUTH must NOT be true in production.');
    }
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      errors.push('DATABASE_URL or POSTGRES_URL is required in production.');
    }
  }

  if (errors.length > 0) {
    console.error('CRITICAL PRODUCTION CONFIGURATION ERRORS DETECTED:\n' + errors.join('\n'));
  }

  return { isValid: errors.length === 0, errors };
}

export const ADMIN_COOKIE_NAME = 'tsf_admin_token';
export const TOKEN_EXPIRY_DAYS = 7; // For customer users
export const ADMIN_TOKEN_EXPIRY = '24h'; // Admin token strictly 24 hours
export const ADMIN_TOKEN_MAX_AGE_SECONDS = 24 * 60 * 60; // 86400s

export interface AdminJWTPayload {
  id: string;
  userId: string;
  username: string;
  email: string;
  fullName?: string | null;
  role: string;
  storeCode?: string | null;
  mustChangePassword?: boolean;
  /** Thời điểm token được ký (ms) — dùng để vô hiệu token cũ sau khi đổi mật khẩu */
  issuedAtMs?: number;
}

/**
 * Hash a plain text password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain text password with hashed password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Sign a JWT token containing admin information (24h lifespan)
 */
export async function signAdminToken(payload: Partial<AdminJWTPayload> & { id: string; username: string; email: string; role: string }): Promise<string> {
  return new SignJWT({ ...payload, userId: payload.userId || payload.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ADMIN_TOKEN_EXPIRY)
    .sign(getJwtSecretBytes());
}

/**
 * Verify and decode an admin JWT token
 */
export async function verifyAdminToken(token: string): Promise<AdminJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    const id = payload.id as string;
    return {
      id,
      userId: (payload.userId as string) || id,
      username: payload.username as string,
      email: payload.email as string,
      fullName: (payload.fullName as string) || null,
      role: (payload.role as string) || 'STORE_STAFF',
      storeCode: (payload.storeCode as string) || null,
      mustChangePassword: Boolean(payload.mustChangePassword),
      issuedAtMs: typeof payload.iat === 'number' ? payload.iat * 1000 : undefined,
    };
  } catch {
    return null;
  }
}

interface CachedAdminSession {
  session: AdminJWTPayload | null;
  expiresAt: number;
  /** Mốc đổi mật khẩu gần nhất (ms) của tài khoản — token ký trước mốc này bị từ chối */
  passwordChangedAtMs: number | null;
}
const adminSessionCache = new Map<string, CachedAdminSession>();
const ADMIN_SESSION_CACHE_TTL_MS = 5000;
const PASSWORD_CHANGE_CLOCK_SKEW_MS = 5000;

export function invalidateAdminSessionCache(id?: string) {
  if (id) {
    adminSessionCache.delete(id);
  } else {
    adminSessionCache.clear();
  }
}

/**
 * Get current admin session from server components or route handlers.
 * Real-time verification against DB admin_users to ensure deactivated accounts
 * or altered roles take effect immediately, protected with a 5s in-memory cache.
 */
export async function getAdminSession(): Promise<AdminJWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return null;

    const decoded = await verifyAdminToken(token);
    if (!decoded || !decoded.id) return null;

    const now = Date.now();
    let entry = adminSessionCache.get(decoded.id);

    if (!entry || entry.expiresAt <= now) {
      const res = await query(
        `SELECT id, username, email, full_name, role, store_code, is_active, must_change_password, password_changed_at
         FROM admin_users
         WHERE id = $1
         LIMIT 1;`,
        [decoded.id]
      );

      const user = res.rows[0];
      if (!user || !user.is_active) {
        entry = { session: null, expiresAt: now + ADMIN_SESSION_CACHE_TTL_MS, passwordChangedAtMs: null };
      } else {
        entry = {
          session: {
            id: user.id,
            userId: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name || decoded.fullName || null,
            role: user.role,
            storeCode: user.store_code || null,
            mustChangePassword: Boolean(user.must_change_password),
          },
          expiresAt: now + ADMIN_SESSION_CACHE_TTL_MS,
          passwordChangedAtMs: user.password_changed_at ? new Date(user.password_changed_at).getTime() : null,
        };
      }
      adminSessionCache.set(decoded.id, entry);
    }

    if (!entry.session) return null;

    // Đổi / đặt lại mật khẩu → mọi token ký TRƯỚC thời điểm đó mất hiệu lực (sai số 5 giây cho lệch đồng hồ)
    if (
      entry.passwordChangedAtMs !== null &&
      decoded.issuedAtMs !== undefined &&
      decoded.issuedAtMs < entry.passwordChangedAtMs - PASSWORD_CHANGE_CLOCK_SKEW_MS
    ) {
      return null;
    }

    return entry.session;
  } catch (error) {
    console.error('Error in getAdminSession DB verification:', error);
    return null;
  }
}

export const USER_COOKIE_NAME = 'tsf_user_session';

export interface UserJWTPayload {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  provider?: string | null;
}

/**
 * Sign a JWT token containing customer user information
 */
export async function signUserToken(payload: UserJWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY_DAYS}d`)
    .sign(getJwtSecretBytes());
}

/**
 * Verify and decode a customer user JWT token
 */
export async function verifyUserToken(token: string): Promise<UserJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    return {
      id: payload.id as string,
      email: payload.email as string,
      fullName: (payload.fullName as string) || '',
      phone: (payload.phone as string) || null,
      avatarUrl: (payload.avatarUrl as string) || null,
      provider: (payload.provider as string) || 'local',
    };
  } catch {
    return null;
  }
}

const userLockCache = new Map<string, { locked: boolean; expiresAt: number }>();
const USER_LOCK_CACHE_TTL_MS = 10_000;

export function invalidateUserSessionCache(id?: string) {
  if (id) userLockCache.delete(id);
  else userLockCache.clear();
}

/**
 * Tài khoản khách có bị admin KHÓA không (users.is_active = false)?
 * Chỉ coi là khóa khi có dòng và is_active === false; không có dòng / lỗi CSDL → không chặn (giữ hành vi cũ).
 * Cache 10 giây để không truy vấn mỗi request.
 */
async function isUserLocked(id: string): Promise<boolean> {
  const now = Date.now();
  const cached = userLockCache.get(id);
  if (cached && cached.expiresAt > now) return cached.locked;
  try {
    const res = await query(`SELECT is_active FROM users WHERE id = $1 LIMIT 1;`, [id]);
    const locked = res.rows.length > 0 && res.rows[0].is_active === false;
    userLockCache.set(id, { locked, expiresAt: now + USER_LOCK_CACHE_TTL_MS });
    return locked;
  } catch (err) {
    console.error('Error checking customer lock status:', err);
    return false;
  }
}

/**
 * Get current customer user session from server components or route handlers.
 * Tài khoản khách đã bị admin khóa sẽ không còn phiên hợp lệ (có hiệu lực trong vòng ~10 giây).
 */
export async function getUserSession(): Promise<UserJWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USER_COOKIE_NAME)?.value;
    if (!token) return null;
    const session = await verifyUserToken(token);
    if (!session) return null;
    if (session.id && (await isUserLocked(session.id))) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Safely resolve application origin for redirects and OAuth callbacks.
 * Strictly prevents 0.0.0.0 internal binding addresses from leaking into browser redirects, which causes ERR_ADDRESS_INVALID.
 */
export function getSafeAppOrigin(req: { headers: { get: (name: string) => string | null }; nextUrl?: { origin?: string } }): string {
  // Production: dùng URL chính thức đã cấu hình (redirect_uri OAuth phải khớp tuyệt đối, không phụ thuộc header Host)
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NODE_ENV === 'production' && configured && !configured.includes('0.0.0.0')) {
    return configured.replace(/\/+$/, '');
  }

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';

  if (host && !host.includes('0.0.0.0')) {
    return `${proto}://${host}`;
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && !envUrl.includes('0.0.0.0')) {
    return envUrl.replace(/\/+$/, '');
  }

  const nextOrigin = req.nextUrl?.origin;
  if (nextOrigin && !nextOrigin.includes('0.0.0.0')) {
    return nextOrigin;
  }

  return 'http://localhost:3000';
}


