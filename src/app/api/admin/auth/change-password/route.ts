import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  getAdminSession,
  verifyPassword,
  hashPassword,
  signAdminToken,
  ADMIN_COOKIE_NAME,
  ADMIN_TOKEN_MAX_AGE_SECONDS,
  invalidateAdminSessionCache,
} from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { isCookieSecure, getClientIp } from '@/lib/runtimeConfig';
import { checkRateLimit, recordFailedLogin, resetLoginRateLimit } from '@/lib/rateLimit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers) ?? undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    // 1. Kiểm tra session hiện tại
    const session = await getAdminSession();
    if (!session || !session.id) {
      return NextResponse.json(
        { success: false, error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    // 2. Validation
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập mật khẩu hiện tại' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu mới phải có ít nhất 8 ký tự' },
        { status: 400 }
      );
    }

    // Yêu cầu độ phức tạp: có cả chữ cái và chữ số
    const complexityRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
    if (!complexityRegex.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu mới phải bao gồm cả chữ cái và chữ số để đảm bảo an toàn' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu xác nhận không khớp' },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' },
        { status: 400 }
      );
    }

    // 3. Lấy thông tin user và hash hiện tại từ CSDL
    const userRes = await query(
      `SELECT id, username, email, full_name, role, store_code, password_hash, is_active
       FROM admin_users
       WHERE id = $1
       LIMIT 1;`,
      [session.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản không tồn tại hoặc đã bị khóa', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const user = userRes.rows[0];

    // 4. Đối chiếu mật khẩu hiện tại — tối đa 5 lần sai / 15 phút cho mỗi tài khoản (chống dò mật khẩu bằng phiên bị chiếm)
    const pwKey = `pwchange:${user.id}`;
    const pwLimit = checkRateLimit(pwKey);
    if (pwLimit.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          error: `Nhập sai mật khẩu hiện tại quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(pwLimit.remainingSeconds / 60)} phút.`,
          code: 'RATE_LIMITED',
        },
        { status: 429, headers: { 'Retry-After': String(pwLimit.remainingSeconds) } }
      );
    }
    const isCurrentValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isCurrentValid) {
      recordFailedLogin(pwKey);
      await writeAuditLog({
        adminId: user.id,
        adminUsername: user.username,
        role: user.role,
        action: 'AUTH_PASSWORD_CHANGE_FAILED',
        entityType: 'ADMIN_USER',
        entityId: user.id,
        storeCode: user.store_code,
        afterJson: { reason: 'CURRENT_PASSWORD_INCORRECT' },
        ip,
        userAgent,
      });

      return NextResponse.json(
        { success: false, error: 'Mật khẩu hiện tại không chính xác' },
        { status: 400 }
      );
    }

    // 5. Hash mật khẩu mới và lưu vào DB
    const newHash = await hashPassword(newPassword);

    await query(
      `UPDATE admin_users
       SET password_hash = $1,
           must_change_password = false,
           password_changed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2;`,
      [newHash, user.id]
    );
    resetLoginRateLimit(pwKey);

    // Xóa bộ nhớ cache phiên
    invalidateAdminSessionCache(user.id);

    // 6. Ghi Audit Log thành công
    await writeAuditLog({
      adminId: user.id,
      adminUsername: user.username,
      role: user.role,
      action: 'AUTH_PASSWORD_CHANGE',
      entityType: 'ADMIN_USER',
      entityId: user.id,
      storeCode: user.store_code,
      afterJson: {
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      },
      ip,
      userAgent,
    });

    // 7. Cấp mới JWT Token với mustChangePassword = false
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      storeCode: user.store_code || null,
      mustChangePassword: false,
    };

    const token = await signAdminToken(payload);

    const response = NextResponse.json({
      success: true,
      message: 'Đổi mật khẩu thành công! Mật khẩu mới đã được cập nhật an toàn.',
      user: payload,
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_TOKEN_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: any) {
    console.error('Error in change-password API:', error);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(error, 'Lỗi máy chủ khi đổi mật khẩu.') },
      { status: 500 }
    );
  }
}
