import { NextResponse } from 'next/server';
import { isMockOAuthEnabled, isProviderConfigured } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

// GET /api/auth/providers → nhà cung cấp đăng nhập mạng xã hội nào đang khả dụng (để ẩn nút chưa cấu hình)
export async function GET() {
  const mock = isMockOAuthEnabled();
  return NextResponse.json(
    {
      success: true,
      google: isProviderConfigured('google') || mock,
      facebook: isProviderConfigured('facebook') || mock,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
