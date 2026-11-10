import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import { signUserToken, USER_COOKIE_NAME, TOKEN_EXPIRY_DAYS, getSafeAppOrigin } from '@/lib/auth';
import { clearOAuthCookies, FACEBOOK_GRAPH_VERSION, resolveOAuthAccount, verifyOAuthCallback } from '@/lib/oauth';
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

  // Khách bấm "Hủy" / từ chối cấp quyền ở màn hình Facebook
  if (searchParams.get('error')) return fail(origin, 'oauth_cancelled');

  // Kiểm tra state khớp cookie → chống CSRF; returnUrl đã được làm sạch
  const verified = verifyOAuthCallback(req, 'facebook', searchParams.get('state'));
  if (!verified.ok) return fail(origin, 'oauth_state_invalid');
  const returnUrl = verified.returnUrl;

  if (!code) return fail(origin, 'facebook_no_code');

  try {
    await initDatabase();
    const fbClientId = process.env.FACEBOOK_CLIENT_ID;
    const fbClientSecret = process.env.FACEBOOK_CLIENT_SECRET;
    const redirectUri = `${origin}/api/auth/callback/facebook`;

    if (!fbClientId || !fbClientSecret) return fail(origin, 'facebook_missing_credentials');

    // 1. Đổi code lấy access token
    const tokenUrl = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', fbClientId);
    tokenUrl.searchParams.set('client_secret', fbClientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Facebook token exchange error:', tokenData);
      return fail(origin, 'facebook_token_failed');
    }

    // 2. Lấy hồ sơ từ Graph API
    const userUrl = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me`);
    userUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
    userUrl.searchParams.set('access_token', tokenData.access_token);

    const userRes = await fetch(userUrl.toString());
    const profile = await userRes.json();

    const fbId = profile.id ? String(profile.id) : '';
    if (!fbId) return fail(origin, 'facebook_no_profile');

    // Facebook không bắt buộc có email: nếu thiếu, dùng địa chỉ nội bộ theo ID (tài khoản vẫn đăng nhập được,
    // nhưng không nhận được email đơn hàng cho đến khi khách bổ sung email trong hồ sơ)
    const email = profile.email ? String(profile.email).toLowerCase().trim() : `fb_${fbId}@facebook.user`;
    const fullName = profile.name || `Facebook User ${fbId.slice(-4)}`;
    const avatarUrl = profile.picture?.data?.url || null;

    // 3. Tạo mới / đăng nhập theo ID Facebook. Facebook không cam kết email đã xác minh,
    //    nên KHÔNG gộp vào tài khoản khác chỉ vì trùng email (trả lỗi email_in_use).
    const account = await resolveOAuthAccount({
      provider: 'facebook',
      providerId: fbId,
      email,
      emailVerified: false,
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
      provider: 'facebook',
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
    console.error('Facebook callback exception:', error);
    return fail(origin, 'facebook_auth_exception');
  }
}
