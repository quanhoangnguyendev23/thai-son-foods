import { NextRequest, NextResponse } from 'next/server';
import { getSafeAppOrigin } from '@/lib/auth';
import {
  isGoogleAllowedOrigin,
  isMockOAuthEnabled,
  isProviderConfigured,
  newOAuthState,
  sanitizeReturnUrl,
  setOAuthCookies,
} from '@/lib/oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnUrl = sanitizeReturnUrl(searchParams.get('returnUrl'));
  const origin = getSafeAppOrigin(req);

  // Chưa cấu hình Client ID/Secret thật từ Google Cloud Console
  if (!isProviderConfigured('google')) {
    if (isMockOAuthEnabled()) {
      const mockUrl = new URL('/api/auth/mock-oauth', origin);
      mockUrl.searchParams.set('provider', 'google');
      mockUrl.searchParams.set('returnUrl', returnUrl);
      return NextResponse.redirect(mockUrl.toString());
    }
    const errorUrl = new URL('/?auth=login', origin);
    errorUrl.searchParams.set('error', 'oauth_not_configured');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Web đang mở bằng địa chỉ IP / http: Google sẽ chặn với "Lỗi 400" → báo lỗi tại web thay vì đưa khách sang trang lỗi của Google
  if (!isGoogleAllowedOrigin(origin)) {
    const errorUrl = new URL('/?auth=login', origin);
    errorUrl.searchParams.set('error', 'oauth_not_configured');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Luồng OAuth 2.0 Google chính thức, state ngẫu nhiên chống CSRF
  const state = newOAuthState();
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID as string);
  googleAuthUrl.searchParams.set('redirect_uri', `${origin}/api/auth/callback/google`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(googleAuthUrl.toString());
  setOAuthCookies(res, 'google', state, returnUrl);
  return res;
}
