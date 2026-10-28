import { NextRequest, NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { verifyPassword, signAdminToken, ADMIN_COOKIE_NAME, ADMIN_TOKEN_MAX_AGE_SECONDS } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { checkRateLimit, recordFailedLogin, resetLoginRateLimit } from '@/lib/rateLimit';
import { isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await initDatabase();
    const body = await req.json();
    const { identifier, password } = body;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập tên đăng nhập hoặc email' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập mật khẩu' },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const ipKey = ip ? `ip:${ip}` : null;
    const userKey = `user:${cleanIdentifier}`;

    // 0. Kiểm tra Rate Limiting chống Brute-force
    const userLimit = checkRateLimit(userKey);
    const ipLimit = ipKey ? checkRateLimit(ipKey) : { isBlocked: false, remainingSeconds: 0 };

    if (userLimit.isBlocked || ipLimit.isBlocked) {
      const waitSeconds = Math.max(userLimit.remainingSeconds, ipLimit.remainingSeconds);
      const waitMinutes = Math.ceil(waitSeconds / 60);

      await writeAuditLog({
        adminUsername: cleanIdentifier,
        action: 'AUTH_RATE_LIMITED',
        entityType: 'AUTH',
        afterJson: {
          reason: 'TOO_MANY_FAILED_ATTEMPTS',
          identifier: cleanIdentifier,
          waitSeconds,
        },
        ip,
        userAgent,
      });

      return NextResponse.json(
        {
          success: false,
          error: `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.`,
          code: 'RATE_LIMITED',
          retryAfter: waitSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(waitSeconds) },
        }
      );
    }

    // 1. Search by username or email
    const res = await query(
      `SELECT id, username, email, password_hash, full_name, role, store_code, is_active, must_change_password
       FROM admin_users
       WHERE LOWER(username) = $1 OR LOWER(email) = $1
       LIMIT 1;`,
      [cleanIdentifier]
    );

    if (res.rows.length === 0) {
      recordFailedLogin(userKey);
      if (ipKey) recordFailedLogin(ipKey);

      await writeAuditLog({
        adminUsername: cleanIdentifier,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'AUTH',
        afterJson: { reason: 'USER_NOT_FOUND', identifier: cleanIdentifier },
        ip,
        userAgent,
      });

      return NextResponse.json(
        { success: false, error: 'Tài khoản hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    const user = res.rows[0];

    // 2. Check if active
    if (!user.is_active) {
      await writeAuditLog({
        adminId: user.id,
        adminUsername: user.username,
        role: user.role,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'AUTH',
        storeCode: user.store_code,
        afterJson: { reason: 'ACCOUNT_LOCKED' },
        ip,
        userAgent,
      });

      return NextResponse.json(
        { success: false, error: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên.' },
        { status: 403 }
      );
    }

    // 3. Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      recordFailedLogin(userKey);
      if (ipKey) recordFailedLogin(ipKey);

      await writeAuditLog({
        adminId: user.id,
        adminUsername: user.username,
        role: user.role,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'AUTH',
        storeCode: user.store_code,
        afterJson: { reason: 'INVALID_PASSWORD' },
        ip,
        userAgent,
      });

      return NextResponse.json(
        { success: false, error: 'Tài khoản hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    // Đăng nhập thành công -> Reset bộ đếm rate limit
    resetLoginRateLimit(userKey);
    if (ipKey) resetLoginRateLimit(ipKey);

    // Update last_login_at in background
    query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [user.id]).catch(err => {
      console.error('Failed to update last_login_at:', err);
    });

    // 4. Sign JWT (24-hour expiration)
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      storeCode: user.store_code || null,
      mustChangePassword: Boolean(user.must_change_password),
    };
    const token = await signAdminToken(payload);

    await writeAuditLog({
      adminId: user.id,
      adminUsername: user.username,
      role: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'AUTH',
      storeCode: user.store_code,
      afterJson: { role: user.role, storeCode: user.store_code },
      ip,
      userAgent,
    });

    // 5. Response with HttpOnly cookie
    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: payload,
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_TOKEN_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: any) {
    console.error('Error in admin login API:', error);
    const msg = error?.message || '';
    let errorMessage = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
    if (msg.includes('ECONNREFUSED') || msg.includes('connect') || msg.includes('timeout') || msg.includes('ENOTFOUND')) {
      errorMessage = 'Không thể kết nối đến cơ sở dữ liệu PostgreSQL. Vui lòng kiểm tra biến môi trường DATABASE_URL trên Vercel.';
    } else if (msg.includes('JWT_SECRET')) {
      errorMessage = 'Chưa cấu hình biến môi trường JWT_SECRET hợp lệ (tối thiểu 32 ký tự) trên Vercel.';
    }
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
