import { NextResponse } from 'next/server';
import { trackReferralClick, signReferralCookie } from '@/lib/partner/referral';
import { PARTNER_CONFIG } from '@/config/partner';
import { getClientIp, UNKNOWN_CLIENT_IP, isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const refCode = searchParams.get('ref') || searchParams.get('code');

    if (!refCode || !refCode.trim()) {
      return NextResponse.json({ success: false, error: 'Thiếu mã đối tác (ref)' }, { status: 400 });
    }

    const ipAddress = getClientIp(request.headers) ?? UNKNOWN_CLIENT_IP;
    const userAgent = request.headers.get('user-agent') || null;
    const refererUrl = request.headers.get('referer') || null;

    const trackResult = await trackReferralClick({
      referralCode: refCode,
      ipAddress,
      userAgent,
      refererUrl,
      landingPage: '/dai-ly',
    });

    if (!trackResult.success || !trackResult.partnerCode) {
      return NextResponse.json({ success: false, error: 'Mã đối tác không tồn tại hoặc đã hết hạn' }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      partnerCode: trackResult.partnerCode,
      message: 'Ghi nhận click giới thiệu thành công',
    });

    // Ký cookie chống can thiệp và lưu 30 ngày
    const signedVal = signReferralCookie(trackResult.partnerCode);
    const maxAgeSeconds = PARTNER_CONFIG.REFERRAL.COOKIE_EXPIRY_DAYS * 24 * 60 * 60;

    response.cookies.set({
      name: PARTNER_CONFIG.REFERRAL.COOKIE_NAME,
      value: signedVal,
      path: '/',
      maxAge: maxAgeSeconds,
      sameSite: 'lax',
      secure: isCookieSecure(),
    });

    return response;
  } catch (error: any) {
    console.error('Error tracking referral click:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi hệ thống' }, { status: 500 });
  }
}
