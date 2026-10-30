import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, getAdminSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getAdminSession();
  if (session) {
    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'AUTH_LOGOUT',
      entityType: 'AUTH',
      storeCode: session.storeCode,
    });
  }

  const response = NextResponse.json({
    success: true,
    message: 'Đã đăng xuất khỏi hệ thống quản trị',
  });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
