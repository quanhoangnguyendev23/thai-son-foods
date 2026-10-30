import { NextRequest, NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { verifyPassword, signUserToken, USER_COOKIE_NAME, TOKEN_EXPIRY_DAYS } from '@/lib/auth';
import { checkRateLimit, recordFailedLogin, resetLoginRateLimit } from '@/lib/rateLimit';
import { isCookieSecure, getClientIp, UNKNOWN_CLIENT_IP } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await initDatabase();
    const body = await req.json();
    const { email, password } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập email đăng nhập' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập mật khẩu' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    // IP đáng tin theo TRUSTED_PROXY_COUNT (không tin X-Forwarded-For do khách tự gửi)
    const ip = getClientIp(req.headers) ?? undefined;

    // 0. Rate Limiting chống Brute-force (5 lần sai / 15 phút)
    // Khóa theo cặp email + IP: không ai khóa được tài khoản của người khác từ IP khác
    const emailKey = `cust:${cleanEmail}:${ip ?? UNKNOWN_CLIENT_IP}`;
    const ipKey = ip ? `userip:${ip}` : null;

    const emailLimit = checkRateLimit(emailKey);
    const ipLimit = ipKey ? checkRateLimit(ipKey) : { isBlocked: false, remainingSeconds: 0 };

    if (emailLimit.isBlocked || ipLimit.isBlocked) {
      const waitSeconds = Math.max(emailLimit.remainingSeconds, ipLimit.remainingSeconds);
      const waitMinutes = Math.ceil(waitSeconds / 60);
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

    // 1. Find user by email
    const res = await query(
      `SELECT id, email, password_hash, full_name, phone, address, province, district, ward, is_active
       FROM users
       WHERE email = $1
       LIMIT 1;`,
      [cleanEmail]
    );

    if (res.rows.length === 0) {
      recordFailedLogin(emailKey);
      if (ipKey) recordFailedLogin(ipKey);
      return NextResponse.json(
        { success: false, error: 'Email hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    const user = res.rows[0];

    // 2. Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      recordFailedLogin(emailKey);
      if (ipKey) recordFailedLogin(ipKey);
      return NextResponse.json(
        { success: false, error: 'Email hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    // Mật khẩu đúng nhưng tài khoản đã bị admin khóa → từ chối (chỉ nói rõ khi đã chứng minh biết mật khẩu)
    if (user.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ Thái Sơn Foods để được hỗ trợ.', code: 'ACCOUNT_LOCKED' },
        { status: 403 }
      );
    }

    // Đăng nhập thành công -> Reset bộ đếm rate limit
    resetLoginRateLimit(emailKey);
    if (ipKey) resetLoginRateLimit(ipKey);

    // 3. Sign JWT
    const payload = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
    };
    const token = await signUserToken(payload);

    const userProfile = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone || '',
      address: user.address || '',
      province: user.province || '',
      district: user.district || '',
      ward: user.ward || '',
    };

    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: userProfile,
    });

    const maxAgeSeconds = TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
    response.cookies.set({
      name: USER_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (error: any) {
    console.error('Error logging in customer:', error);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
