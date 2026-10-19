import { NextResponse } from 'next/server';
import { generateOtp } from '@/lib/partner/otp';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp số điện thoại hợp lệ' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[\s\-\.]/g, '');
    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Số điện thoại không đúng định dạng Việt Nam (VD: 0123456789)' },
        { status: 400 }
      );
    }

    const code = generateOtp(cleanPhone);

    return NextResponse.json({
      success: true,
      message: 'Mã xác thực OTP đã được gửi thành công.',
      // Hỗ trợ kiểm thử tự động trên môi trường phát triển / staging
      ...(process.env.NODE_ENV !== 'production' ? { debugOtp: code } : {}),
    });
  } catch (error: any) {
    console.error('Error in send OTP API:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi gửi mã OTP' }, { status: 500 });
  }
}
