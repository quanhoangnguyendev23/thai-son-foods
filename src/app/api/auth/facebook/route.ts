import { NextRequest, NextResponse } from 'next/server';
import { getSafeAppOrigin } from '@/lib/auth';
import {
  FACEBOOK_GRAPH_VERSION,
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

  // Chưa cấu hình App ID/Secret thật từ Meta for Developers
  if (!isProviderConfigured('facebook')) {
    if (isMockOAuthEnabled()) {
      const mockUrl = new URL('/api/auth/mock-oauth', origin);
      mockUrl.searchParams.set('provider', 'facebook');
      mockUrl.searchParams.set('returnUrl', returnUrl);
      return NextResponse.redirect(mockUrl.toString());
    }
    const errorUrl = new URL('/?auth=login', origin);
    errorUrl.searchParams.set('error', 'oauth_not_configured');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Luồng OAuth Facebook chính thức, state ngẫu nhiên chống CSRF
  const state = newOAuthState();
  const fbAuthUrl = new URL(`https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
  fbAuthUrl.searchParams.set('client_id', process.env.FACEBOOK_CLIENT_ID as string);
  fbAuthUrl.searchParams.set('redirect_uri', `${origin}/api/auth/callback/facebook`);
  fbAuthUrl.searchParams.set('state', state);
  fbAuthUrl.searchParams.set('scope', 'email,public_profile');

  const res = NextResponse.redirect(fbAuthUrl.toString());
  setOAuthCookies(res, 'facebook', state, returnUrl);
  return res;
}
