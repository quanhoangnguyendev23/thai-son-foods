import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyCustomerOtp } from '@/lib/membership/otp';
import { signUserToken, USER_COOKIE_NAME, TOKEN_EXPIRY_DAYS } from '@/lib/auth';
import { isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, otpCode, fullName } = body;

    if (!phone || !otpCode) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp số điện thoại và mã OTP.' },
        { status: 400 }
      );
    }

    const cleanPhone = phone.toString().replace(/[\s\-\.]/g, '');
    const otpRes = verifyCustomerOtp(cleanPhone, otpCode.toString());
    if (!otpRes.success) {
      return NextResponse.json(
        { success: false, error: otpRes.error },
        { status: 400 }
      );
    }

    // Kiểm tra xem số điện thoại đã có tài khoản trong users chưa
    const userRes = await query(
      `SELECT id, email, full_name, phone, avatar_url, provider 
       FROM users 
       WHERE phone = $1 
       LIMIT 1;`,
      [cleanPhone]
    );

    let user: any;
    if (userRes.rows.length > 0) {
      user = userRes.rows[0];
    } else {
      // Khởi tạo tài khoản mới cho khách hàng
      const userId = `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const defaultName = fullName && fullName.trim() ? fullName.trim() : `Khách hàng ${cleanPhone.slice(-4)}`;
      const placeholderEmail = `${cleanPhone}@phone.thaisonfoods.vn`;

      const insertRes = await query(
        `INSERT INTO users (id, email, password_hash, full_name, phone, provider, is_active)
         VALUES ($1, $2, $3, $4, $5, 'phone', true)
         RETURNING id, email, full_name, phone, avatar_url, provider;`,
        [userId, placeholderEmail, '', defaultName, cleanPhone]
      );
      user = insertRes.rows[0];
    }

    // Ký JWT session cho người dùng
    const token = await signUserToken({
      id: user.id,
      email: user.email,
      fullName: user.full_name || '',
      phone: user.phone || cleanPhone,
      avatarUrl: user.avatar_url || null,
      provider: user.provider || 'phone',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Xác thực số điện thoại và đăng nhập thành công!',
      user: {
        id: user.id,
        fullName: user.full_name,
        phone: user.phone,
        email: user.email,
      },
    });

    // Thiết lập cookie phiên đăng nhập
    response.cookies.set(USER_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Error in customer OTP verification:', error);
    return NextResponse.json({ success: false, error: 'Lỗi xác thực OTP. Vui lòng thử lại.' }, { status: 500 });
  }
}
