import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { hashPassword, signUserToken, USER_COOKIE_NAME, TOKEN_EXPIRY_DAYS } from '@/lib/auth';
import { verifyOtp } from '@/lib/partner/otp';
import { generatePartnerCode } from '@/lib/partner/referral';
import { writeAuditLog } from '@/lib/audit';

import { checkRequestRateLimit } from '@/lib/rateLimit';
import { isCookieSecure } from '@/lib/runtimeConfig';

export const dynamic = 'force-dynamic';

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>?/gm, '').trim();
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimit = checkRequestRateLimit(`partner_reg:${ip}`, 5, 3600 * 1000);
    if (rateLimit.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          error: `Bạn đã thực hiện quá nhiều lượt đăng ký. Vui lòng thử lại sau ${Math.ceil(rateLimit.resetInSeconds / 60)} phút.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { fullName, phone, email, password, otpCode } = body;

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập họ và tên' }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập số điện thoại' }, { status: 400 });
    }

    const cleanFullName = stripHtml(fullName).slice(0, 100);
    const cleanPhone = phone.replace(/[\s\-\.]/g, '').slice(0, 20);
    const cleanEmail = stripHtml((email || '').trim().toLowerCase()).slice(0, 100) || `${cleanPhone}@partner.thaisonfoods.vn`;

    // 1. Xác minh mã OTP
    const otpCheck = verifyOtp(cleanPhone, otpCode || '');
    if (!otpCheck.success) {
      return NextResponse.json({ success: false, error: otpCheck.error || 'Mã OTP không hợp lệ' }, { status: 400 });
    }

    // 2. Kiểm tra xem số điện thoại hoặc email đã đăng ký Partner chưa
    const existingPartner = await query(
      `SELECT id, partner_code, lifecycle_status FROM partner_profiles WHERE phone = $1 LIMIT 1;`,
      [cleanPhone]
    );

    if (existingPartner.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Số điện thoại này đã được đăng ký làm đối tác trên hệ thống. Vui lòng đăng nhập.',
          code: 'PARTNER_EXISTS',
        },
        { status: 409 }
      );
    }

    if (email && email.trim()) {
      const existingPartnerByEmail = await query(
        `SELECT id, partner_code, lifecycle_status FROM partner_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
        [cleanEmail]
      );
      if (existingPartnerByEmail.rows.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Địa chỉ email này đã được liên kết với một hồ sơ đối tác. Vui lòng đăng nhập.',
            code: 'PARTNER_EXISTS',
          },
          { status: 409 }
        );
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      // 3. Tìm hoặc tạo tài khoản trong bảng users
      let userId: string;
      const userRes = await client.query(
        `SELECT id, full_name, email, phone FROM users WHERE phone = $1 OR email = $2 LIMIT 1;`,
        [cleanPhone, cleanEmail]
      );

      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;

        // Kiểm tra an toàn: Tài khoản này đã có hồ sơ đối tác hay chưa (ngăn chặn duplicate key partner_profiles_user_id_key)
        const existingProfileByUser = await client.query(
          `SELECT id, partner_code, lifecycle_status FROM partner_profiles WHERE user_id = $1 LIMIT 1;`,
          [userId]
        );
        if (existingProfileByUser.rows.length > 0) {
          await client.query('ROLLBACK;');
          return NextResponse.json(
            {
              success: false,
              error: `Tài khoản này đã được đăng ký làm đối tác trên hệ thống (Mã đối tác: ${existingProfileByUser.rows[0].partner_code}). Vui lòng đăng nhập Cổng đối tác.`,
              code: 'PARTNER_EXISTS',
            },
            { status: 409 }
          );
        }
      } else {
        userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const pwdHash = await hashPassword(password || `P@ss${cleanPhone.slice(-4)}`);
        await client.query(
          `INSERT INTO users (id, email, password_hash, full_name, phone)
           VALUES ($1, $2, $3, $4, $5);`,
          [userId, cleanEmail, pwdHash, cleanFullName, cleanPhone]
        );
      }

      // 4. Sinh mã đối tác duy nhất
      let partnerCode = generatePartnerCode('CTV');
      let isCodeUnique = false;
      while (!isCodeUnique) {
        const checkCode = await client.query(`SELECT 1 FROM partner_profiles WHERE partner_code = $1;`, [partnerCode]);
        if (checkCode.rows.length === 0) {
          isCodeUnique = true;
        } else {
          partnerCode = generatePartnerCode('CTV');
        }
      }

      // 5. Tạo hồ sơ Đối tác (Trạng thái khởi đầu: LITE)
      const partnerId = `ptn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO partner_profiles (
          id, user_id, partner_code, partner_type, lifecycle_status, phone, full_name, email
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          partnerId,
          userId,
          partnerCode,
          'CTV',
          'LITE',
          cleanPhone,
          fullName.trim(),
          cleanEmail,
        ]
      );

      await client.query('COMMIT;');

      // Ghi audit log
      await writeAuditLog({
        action: 'PARTNER_REGISTER_LITE',
        entityType: 'PARTNER',
        entityId: partnerId,
        afterJson: { partnerCode, phone: cleanPhone, fullName: fullName.trim() },
      });

      // 6. Ký phiên đăng nhập người dùng (Cookie)
      const sessionPayload = {
        id: userId,
        email: cleanEmail,
        fullName: fullName.trim(),
        phone: cleanPhone,
      };
      const token = await signUserToken(sessionPayload);

      const response = NextResponse.json({
        success: true,
        message: 'Đăng ký đối tác thành công! Bạn đã được cấp mã giới thiệu.',
        partner: {
          id: partnerId,
          partnerCode,
          partnerType: 'CTV',
          lifecycleStatus: 'LITE',
          fullName: fullName.trim(),
          phone: cleanPhone,
        },
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
    } catch (txErr: any) {
      await client.query('ROLLBACK;');
      // Xử lý race condition / vi phạm ràng buộc unique chống sập 500
      if (txErr?.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            error: 'Thông tin tài khoản hoặc số điện thoại này đã được đăng ký làm đối tác trên hệ thống. Vui lòng đăng nhập.',
            code: 'PARTNER_EXISTS',
          },
          { status: 409 }
        );
      }
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error registering partner:', error);
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi khi đăng ký đối tác. Vui lòng thử lại sau.' }, { status: 500 });
  }
}
