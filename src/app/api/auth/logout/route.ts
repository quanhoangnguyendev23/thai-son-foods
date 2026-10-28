import { NextResponse } from 'next/server';
import { USER_COOKIE_NAME } from '@/lib/auth';
import { isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Đăng xuất thành công!',
  });

  response.cookies.set({
    name: USER_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
