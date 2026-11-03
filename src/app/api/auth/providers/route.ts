import { NextRequest, NextResponse } from 'next/server';
import { getSafeAppOrigin } from '@/lib/auth';
import { isGoogleAllowedOrigin, isMockOAuthEnabled, isProviderConfigured } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

// GET /api/auth/providers → nhà cung cấp đăng nhập mạng xã hội nào đang khả dụng (để ẩn nút chưa cấu hình)
export async function GET(req: NextRequest) {
  const mock = isMockOAuthEnabled();
  // Ẩn nút Google khi web mở bằng địa chỉ IP / http (Google sẽ chặn), trừ chế độ giả lập
  const googleReady = isProviderConfigured('google') && isGoogleAllowedOrigin(getSafeAppOrigin(req));
  return NextResponse.json(
    {
      success: true,
      google: googleReady || mock,
      facebook: isProviderConfigured('facebook') || mock,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
