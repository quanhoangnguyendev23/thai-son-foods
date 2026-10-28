import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/partner/otp';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json({ success: false, error: 'Thiếu số điện thoại hoặc mã OTP' }, { status: 400 });
    }

    const check = verifyOtp(phone, code);
    if (!check.success) {
      return NextResponse.json({ success: false, error: check.error || 'Xác thực OTP thất bại' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Xác minh OTP thành công!',
    });
  } catch (error: any) {
    console.error('Error in verify OTP API:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi xác minh OTP') }, { status: 500 });
  }
}
