import { NextRequest, NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { validateAdminPassword } from '@/lib/password-policy';
import { checkRequestRateLimit } from '@/lib/rateLimit';
import { getClientIp, UNKNOWN_CLIENT_IP } from '@/lib/runtimeConfig';
import crypto from 'node:crypto';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await initDatabase();
    const ip = getClientIp(req.headers) ?? undefined;
    // Tối đa 5 lần / giờ / IP (chống dò ADMIN_REGISTER_KEY khi CSDL còn trống)
    const regLimit = checkRequestRateLimit(`admin_register:ip:${ip ?? UNKNOWN_CLIENT_IP}`, 5, 60 * 60 * 1000);
    if (regLimit.isBlocked) {
      return NextResponse.json(
        { success: false, error: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }
    const userAgent = req.headers.get('user-agent') || undefined;

    // Check total admins in database first
    const countRes = await query('SELECT COUNT(*) AS total FROM admin_users;');
    const totalAdmins = parseInt(countRes.rows[0]?.total || '0', 10);

    // Vô hiệu hóa hoàn toàn đăng ký công khai nếu hệ thống đã có tài khoản quản trị
    if (totalAdmins > 0) {
      await writeAuditLog({
        action: 'AUTH_REGISTER_BLOCKED',
        entityType: 'AUTH',
        afterJson: { reason: 'PUBLIC_REGISTRATION_DISABLED', ip },
        ip,
        userAgent,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Cổng đăng ký tài khoản tự do đã bị vô hiệu hóa vì lý do an toàn bảo mật. Vui lòng liên hệ Quản trị viên cấp cao (Super Admin) để được cấp tài khoản qua menu Quản lý tài khoản.',
          code: 'REGISTRATION_DISABLED',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { username, email, password, fullName, registerKey } = body;

    // Khởi tạo Super Admin đầu tiên bắt buộc có mã bảo mật (ADMIN_REGISTER_KEY) — tránh bị chiếm quyền khi CSDL mới trống
    const expectedKey = process.env.ADMIN_REGISTER_KEY;
    if (!expectedKey) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { success: false, error: 'Máy chủ chưa cấu hình ADMIN_REGISTER_KEY nên không thể khởi tạo Super Admin đầu tiên.', code: 'REGISTER_KEY_NOT_CONFIGURED' },
          { status: 403 }
        );
      }
    } else {
      const digest = (v: string) => crypto.createHash('sha256').update(v).digest();
      const provided = typeof registerKey === 'string' ? registerKey : '';
      if (!crypto.timingSafeEqual(digest(provided), digest(expectedKey))) {
        await writeAuditLog({
          action: 'AUTH_REGISTER_BLOCKED',
          entityType: 'AUTH',
          afterJson: { reason: 'INVALID_REGISTER_KEY', ip },
          ip,
          userAgent,
        });
        return NextResponse.json(
          { success: false, error: 'Mã bảo mật đăng ký không đúng.', code: 'INVALID_REGISTER_KEY' },
          { status: 403 }
        );
      }
    }

    // 1. Validation
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      return NextResponse.json(
        { success: false, error: 'Tên đăng nhập chỉ chứa chữ cái, số, dấu gạch ngang hoặc gạch dưới' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }
    const cleanEmail = email.trim().toLowerCase();

    const passwordError = validateAdminPassword(password);
    if (passwordError) {
      return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
    }

    const assignedRole = 'SUPER_ADMIN';

    // 3. Check for existing username or email
    const existing = await query(
      'SELECT id, username, email FROM admin_users WHERE username = $1 OR email = $2 LIMIT 1;',
      [cleanUsername, cleanEmail]
    );

    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      if (match.username === cleanUsername) {
        return NextResponse.json(
          { success: false, error: 'Tên đăng nhập này đã được sử dụng' },
          { status: 409 }
        );
      }
      if (match.email === cleanEmail) {
        return NextResponse.json(
          { success: false, error: 'Email này đã được đăng ký' },
          { status: 409 }
        );
      }
    }

    // 4. Hash password and save
    const hashedPassword = await hashPassword(password);
    const userId = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await query(
      `INSERT INTO admin_users (id, username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        userId,
        cleanUsername,
        cleanEmail,
        hashedPassword,
        fullName ? fullName.trim() : null,
        assignedRole,
        true,
      ]
    );

    return NextResponse.json({
      success: true,
      message:
        totalAdmins === 0
          ? 'Đã khởi tạo tài khoản Quản trị viên cấp cao (Super Admin) thành công!'
          : 'Đăng ký tài khoản Quản trị viên thành công!',
      role: assignedRole,
    });
  } catch (error: any) {
    console.error('Error in admin register API:', error);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(error, 'Lỗi máy chủ khi đăng ký.') },
      { status: 500 }
    );
  }
}
