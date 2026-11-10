import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import { signUserToken, USER_COOKIE_NAME, TOKEN_EXPIRY_DAYS, getSafeAppOrigin } from '@/lib/auth';
import { clearOAuthCookies, resolveOAuthAccount, verifyOAuthCallback } from '@/lib/oauth';
import { isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

function fail(origin: string, code: string) {
  const res = NextResponse.redirect(`${origin}/?auth=login&error=${code}`);
  clearOAuthCookies(res);
  return res;
}

export async function GET(req: NextRequest) {
  const origin = getSafeAppOrigin(req);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  // Khách bấm "Hủy" / từ chối cấp quyền ở màn hình Google
  if (searchParams.get('error')) return fail(origin, 'oauth_cancelled');

  // Kiểm tra state khớp cookie → chống CSRF; returnUrl đã được làm sạch
  const verified = verifyOAuthCallback(req, 'google', searchParams.get('state'));
  if (!verified.ok) return fail(origin, 'oauth_state_invalid');
  const returnUrl = verified.returnUrl;

  if (!code) return fail(origin, 'google_no_code');

  try {
    await initDatabase();
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${origin}/api/auth/callback/google`;

    if (!googleClientId || !googleClientSecret) return fail(origin, 'google_missing_credentials');

    // 1. Đổi authorization code lấy access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token exchange error:', tokenData);
      return fail(origin, 'google_token_failed');
    }

    // 2. Lấy hồ sơ người dùng từ Google
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userinfoRes.json();

    if (!profile.email) return fail(origin, 'google_no_email');
    // Chỉ tin email đã được Google xác minh (tránh chiếm tài khoản bằng email chưa xác minh)
    if (profile.email_verified !== true && profile.email_verified !== 'true') {
      return fail(origin, 'google_email_unverified');
    }

    const email = String(profile.email).toLowerCase().trim();
    const fullName = profile.name || email.split('@')[0];
    const avatarUrl = profile.picture || null;
    const googleSub = profile.sub || null;

    // 3. Tạo mới / nhận tài khoản theo email đã được Google xác minh (mật khẩu cũ, nếu có, bị vô hiệu)
    const account = await resolveOAuthAccount({
      provider: 'google',
      providerId: googleSub ? String(googleSub) : null,
      email,
      emailVerified: true,
      fullName,
      avatarUrl,
    });
    if (!account.ok) return fail(origin, account.code);
    const userId = account.userId;

    // 4. Ký JWT & đặt cookie đăng nhập
    const token = await signUserToken({
      id: userId,
      email,
      fullName,
      avatarUrl,
      provider: 'google',
    });

    const response = NextResponse.redirect(new URL(returnUrl, origin).toString());
    response.cookies.set({
      name: USER_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    });
    clearOAuthCookies(response);
    return response;
  } catch (error: any) {
    console.error('Google callback exception:', error);
    return fail(origin, 'google_auth_exception');
  }
}
