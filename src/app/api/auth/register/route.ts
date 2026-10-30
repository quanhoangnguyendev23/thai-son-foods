import { NextRequest, NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { hashPassword, signUserToken, USER_COOKIE_NAME, TOKEN_EXPIRY_DAYS } from '@/lib/auth';
import { checkRequestRateLimit } from '@/lib/rateLimit';
import { getClientIp, UNKNOWN_CLIENT_IP, isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

// Quy tắc mật khẩu an toàn: >= 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]).{8,}$/;

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>?/gm, '').trim();
}

export async function POST(req: NextRequest) {
  try {
    // Rate Limiting: tối đa 5 lần đăng ký / giờ / IP
    const ip = getClientIp(req.headers) ?? UNKNOWN_CLIENT_IP;
    const rl = checkRequestRateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000);
    if (rl.isBlocked) {
      return NextResponse.json(
        { success: false, error: 'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    await initDatabase();
    const body = await req.json();
    const { email, password, fullName, phone, address, province, district, ward } = body;

    // 1. Validation - Email
    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 320) {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    // 2. Validation - Mật khẩu mạnh
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập mật khẩu' },
        { status: 400 }
      );
    }
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt (VD: MyPass@123)',
        },
        { status: 400 }
      );
    }

    // 3. Validation - Họ tên (chống XSS)
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập họ và tên của bạn' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = stripHtmlTags(fullName).substring(0, 150);
    const cleanPhone = phone ? stripHtmlTags(phone.toString()).substring(0, 15) : null;

    if (!cleanName) {
      return NextResponse.json(
        { success: false, error: 'Họ tên không hợp lệ' },
        { status: 400 }
      );
    }

    // 2. Check if email already exists
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1;',
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập!' },
        { status: 409 }
      );
    }

    // 3. Hash password
    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Insert user (sanitize all text inputs)
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, phone, address, province, district, ward)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
      [
        userId,
        cleanEmail,
        passwordHash,
        cleanName,
        cleanPhone,
        address ? stripHtmlTags(address.toString()).substring(0, 500) : null,
        province ? stripHtmlTags(province.toString()).substring(0, 100) : null,
        district ? stripHtmlTags(district.toString()).substring(0, 100) : null,
        ward ? stripHtmlTags(ward.toString()).substring(0, 100) : null,
      ]
    );

    // 5. Sign JWT & set cookie
    const payload = {
      id: userId,
      email: cleanEmail,
      fullName: cleanName,
      phone: cleanPhone,
    };
    const token = await signUserToken(payload);

    const userProfile = {
      id: userId,
      email: cleanEmail,
      fullName: cleanName,
      phone: cleanPhone,
      address: address ? stripHtmlTags(address.toString()).substring(0, 500) : '',
      province: province ? stripHtmlTags(province.toString()).substring(0, 100) : '',
      district: district ? stripHtmlTags(district.toString()).substring(0, 100) : '',
      ward: ward ? stripHtmlTags(ward.toString()).substring(0, 100) : '',
    };

    const response = NextResponse.json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      user: userProfile,
    });

    const maxAgeSeconds = TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
    response.cookies.set({
      name: USER_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (error: any) {
    console.error('Error registering customer:', error);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}

