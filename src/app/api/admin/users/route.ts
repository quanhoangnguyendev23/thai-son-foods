import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession, hashPassword, invalidateAdminSessionCache } from '@/lib/auth';
import { hasPermission, Role } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { validateAdminPassword } from '@/lib/password-policy';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const VALID_ROLES: Role[] = ['SUPER_ADMIN', 'MARKETING', 'STORE_STAFF'];

// GET: Danh sách tất cả tài khoản admin (chỉ dành cho SUPER_ADMIN)
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'users.manage')) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên cấp cao (Super Admin) mới có quyền xem danh sách tài khoản', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const res = await query(
      `SELECT id, username, email, full_name, role, store_code, is_active, must_change_password, password_changed_at, last_login_at, created_at, updated_at
       FROM admin_users
       ORDER BY created_at ASC;`
    );

    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// POST: Tạo mới tài khoản admin (chỉ dành cho SUPER_ADMIN)
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'users.manage')) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên cấp cao (Super Admin) mới có quyền tạo tài khoản quản trị', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const body = await req.json();
    const { username, email, fullName, password, role, storeCode, mustChangePassword } = body;

    // 1. Validation
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim();
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

    const assignedRole = (role as Role) || 'STORE_STAFF';
    if (!VALID_ROLES.includes(assignedRole)) {
      return NextResponse.json(
        { success: false, error: `Vai trò "${role}" không hợp lệ. Chọn một trong: SUPER_ADMIN, MARKETING, STORE_STAFF.` },
        { status: 400 }
      );
    }

    let finalStoreCode: string | null = null;
    if (assignedRole === 'STORE_STAFF') {
      if (!storeCode || typeof storeCode !== 'string' || !storeCode.trim()) {
        return NextResponse.json(
          { success: false, error: 'Tài khoản nhân viên cửa hàng (STORE_STAFF) bắt buộc phải gắn với một cửa hàng cụ thể.' },
          { status: 400 }
        );
      }
      finalStoreCode = storeCode.trim();

      const storeCheck = await query('SELECT code FROM stores WHERE code = $1 LIMIT 1;', [finalStoreCode]);
      if (storeCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: `Mã cửa hàng "${finalStoreCode}" không tồn tại trên hệ thống.` },
          { status: 400 }
        );
      }
    }

    // 2. Check duplicate username or email
    const existing = await query(
      'SELECT id, username, email FROM admin_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1;',
      [cleanUsername, cleanEmail]
    );

    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      if (match.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: `Tên đăng nhập "${cleanUsername}" đã tồn tại trên hệ thống` },
          { status: 409 }
        );
      }
      if (match.email.toLowerCase() === cleanEmail) {
        return NextResponse.json(
          { success: false, error: `Email "${cleanEmail}" đã được sử dụng bởi tài khoản khác` },
          { status: 409 }
        );
      }
    }

    // 3. Hash password and insert
    const hashedPassword = await hashPassword(password);
    const userId = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const defaultMustChange = mustChangePassword !== undefined ? Boolean(mustChangePassword) : true;

    const insertRes = await query(
      `INSERT INTO admin_users (id, username, email, password_hash, full_name, role, store_code, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
       RETURNING id, username, email, full_name, role, store_code, is_active, must_change_password, created_at;`,
      [userId, cleanUsername, cleanEmail, hashedPassword, fullName?.trim() || cleanUsername, assignedRole, finalStoreCode, defaultMustChange]
    );

    const createdUser = insertRes.rows[0];

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'ADMIN_USER_CREATE',
      entityType: 'ADMIN_USER',
      entityId: userId,
      storeCode: finalStoreCode,
      afterJson: createdUser,
    });

    return NextResponse.json({
      success: true,
      message: `Đã tạo tài khoản quản trị viên "${cleanUsername}" thành công!`,
      data: createdUser,
    });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật thông tin/trạng thái/mật khẩu tài khoản admin
export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'users.manage')) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên cấp cao (Super Admin) mới có quyền chỉnh sửa tài khoản', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const body = await req.json();
    const { id, fullName, email, role, storeCode, isActive, password, mustChangePassword } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID tài khoản cần chỉnh sửa' }, { status: 400 });
    }

    const targetUserRes = await query('SELECT * FROM admin_users WHERE id = $1 LIMIT 1;', [id]);
    if (targetUserRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tài khoản quản trị viên' }, { status: 404 });
    }
    const targetUser = targetUserRes.rows[0];

    // Không cho phép tự đổi role của chính mình
    const isSelf = session.userId === id || session.id === id;
    if (isSelf && role !== undefined && role !== targetUser.role) {
      return NextResponse.json(
        { success: false, error: 'Bạn không thể tự thay đổi vai trò của chính mình' },
        { status: 400 }
      );
    }

    // Không cho phép tự khóa tài khoản của chính mình
    if (isSelf && isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Bạn không thể tự khóa tài khoản Super Admin của chính mình' },
        { status: 400 }
      );
    }

    // Bảo vệ SUPER_ADMIN cuối cùng: không cho hạ quyền hoặc khóa SUPER_ADMIN đang hoạt động duy nhất
    if (targetUser.role === 'SUPER_ADMIN') {
      const isDemoting = role !== undefined && role !== 'SUPER_ADMIN';
      const isDeactivating = isActive === false && targetUser.is_active === true;

      if (isDemoting || isDeactivating) {
        const superAdminsCountRes = await query(
          "SELECT COUNT(*)::int AS count FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active = true;"
        );
        const superAdminCount = superAdminsCountRes.rows[0]?.count || 0;
        if (superAdminCount <= 1) {
          return NextResponse.json(
            { success: false, error: 'Không thể hạ quyền hoặc khóa Quản trị viên cấp cao (Super Admin) cuối cùng đang hoạt động của hệ thống' },
            { status: 400 }
          );
        }
      }
    }

    // Whitelist updates
    const updates: string[] = [];
    const params: any[] = [id];

    if (fullName !== undefined) {
      params.push(fullName.trim());
      updates.push(`full_name = $${params.length}`);
    }

    if (email !== undefined && typeof email === 'string' && email.includes('@')) {
      const dupEmail = await query(
        'SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1;',
        [email.trim(), id]
      );
      if (dupEmail.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: `Email "${email.trim().toLowerCase()}" đã được sử dụng bởi tài khoản khác` },
          { status: 409 }
        );
      }
      params.push(email.trim().toLowerCase());
      updates.push(`email = $${params.length}`);
    }

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json(
          { success: false, error: `Vai trò "${role}" không hợp lệ. Chọn một trong: SUPER_ADMIN, MARKETING, STORE_STAFF.` },
          { status: 400 }
        );
      }
      params.push(role);
      updates.push(`role = $${params.length}`);
    }

    const effectiveRole = role !== undefined ? role : targetUser.role;
    // Nhân viên cửa hàng luôn phải gắn một chi nhánh (kể cả khi chỉ đổi vai trò mà không gửi storeCode)
    if (effectiveRole === 'STORE_STAFF' && storeCode === undefined && !targetUser.store_code) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản nhân viên cửa hàng (STORE_STAFF) bắt buộc phải gắn với mã cửa hàng.' },
        { status: 400 }
      );
    }

    if (storeCode !== undefined) {
      if (effectiveRole === 'STORE_STAFF') {
        if (!storeCode || !storeCode.trim()) {
          return NextResponse.json(
            { success: false, error: 'Tài khoản nhân viên cửa hàng (STORE_STAFF) bắt buộc phải gắn với mã cửa hàng.' },
            { status: 400 }
          );
        }
        const storeCheck = await query('SELECT code FROM stores WHERE code = $1 LIMIT 1;', [storeCode.trim()]);
        if (storeCheck.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: `Mã cửa hàng "${storeCode}" không tồn tại.` },
            { status: 400 }
          );
        }
        params.push(storeCode.trim());
        updates.push(`store_code = $${params.length}`);
      } else {
        params.push(null);
        updates.push(`store_code = $${params.length}`);
      }
    } else if (role !== undefined && role !== 'STORE_STAFF') {
      // Nếu đổi sang SUPER_ADMIN hoặc MARKETING mà không truyền storeCode, tự động set store_code = NULL
      params.push(null);
      updates.push(`store_code = $${params.length}`);
    }

    if (isActive !== undefined) {
      params.push(Boolean(isActive));
      updates.push(`is_active = $${params.length}`);
    }

    const hasNewPassword = password !== undefined && password !== null && password !== '';
    // Khi đặt mật khẩu mới, must_change_password đã được bật ở dưới — không gán cột này 2 lần trong cùng câu UPDATE
    if (mustChangePassword !== undefined && !hasNewPassword) {
      params.push(Boolean(mustChangePassword));
      updates.push(`must_change_password = $${params.length}`);
      // Bật bắt buộc đổi mật khẩu → token đang dùng (ký khi chưa bị bắt buộc) hết hiệu lực, phải đăng nhập lại
      if (Boolean(mustChangePassword)) updates.push(`password_changed_at = CURRENT_TIMESTAMP`);
    }

    let passwordChanged = false;
    if (hasNewPassword) {
      const resetError = validateAdminPassword(password);
      if (resetError) {
        return NextResponse.json({ success: false, error: resetError }, { status: 400 });
      }
      const hashedPassword = await hashPassword(password.trim());
      params.push(hashedPassword);
      updates.push(`password_hash = $${params.length}`);
      updates.push(`password_changed_at = CURRENT_TIMESTAMP`);
      updates.push(`must_change_password = true`);
      passwordChanged = true;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `UPDATE admin_users SET ${updates.join(', ')} WHERE id = $1 RETURNING id, username, email, full_name, role, store_code, is_active, must_change_password, password_changed_at, updated_at;`;

    const updateRes = await query(sql, params);
    const updatedUser = updateRes.rows[0];
    // Khóa / đổi quyền / đổi chi nhánh có hiệu lực ngay, không chờ cache phiên 5 giây
    invalidateAdminSessionCache(String(id));

    // Ghi audit log
    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: passwordChanged ? 'ADMIN_PASSWORD_RESET' : 'ADMIN_USER_UPDATE',
      entityType: 'ADMIN_USER',
      entityId: id,
      storeCode: updatedUser.store_code,
      beforeJson: {
        username: targetUser.username,
        email: targetUser.email,
        full_name: targetUser.full_name,
        role: targetUser.role,
        store_code: targetUser.store_code,
        is_active: targetUser.is_active,
      },
      afterJson: {
        username: updatedUser.username,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        role: updatedUser.role,
        store_code: updatedUser.store_code,
        is_active: updatedUser.is_active,
        password_reset: passwordChanged,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Cập nhật tài khoản quản trị viên thành công!',
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating admin user:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// DELETE: Xóa tài khoản admin
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'users.manage')) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên cấp cao (Super Admin) mới có quyền xóa tài khoản', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id');

    if (!targetId) {
      return NextResponse.json({ success: false, error: 'Thiếu ID tài khoản' }, { status: 400 });
    }

    // Không cho phép tự xóa tài khoản của chính mình
    if (session.userId === targetId || session.id === targetId) {
      return NextResponse.json(
        { success: false, error: 'Bạn không thể tự xóa tài khoản đang đăng nhập' },
        { status: 400 }
      );
    }

    const targetUserRes = await query('SELECT * FROM admin_users WHERE id = $1 LIMIT 1;', [targetId]);
    if (targetUserRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tài khoản để xóa' }, { status: 404 });
    }
    const targetUser = targetUserRes.rows[0];

    // Không cho phép xóa SUPER_ADMIN cuối cùng
    // Chỉ tính Super Admin ĐANG HOẠT ĐỘNG: xóa tài khoản đã khóa thì không ảnh hưởng, còn xóa Super Admin
    // hoạt động cuối cùng (dù còn tài khoản Super Admin đã khóa) sẽ làm hệ thống không ai quản trị được.
    if (targetUser.role === 'SUPER_ADMIN' && targetUser.is_active === true) {
      const superAdminsCountRes = await query(
        "SELECT COUNT(*)::int AS count FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active = true;"
      );
      const superAdminCount = superAdminsCountRes.rows[0]?.count || 0;
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { success: false, error: 'Không thể xóa Quản trị viên cấp cao (Super Admin) duy nhất của hệ thống' },
          { status: 400 }
        );
      }
    }

    await query('DELETE FROM admin_users WHERE id = $1;', [targetId]);
    invalidateAdminSessionCache(targetId);

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'ADMIN_USER_DELETE',
      entityType: 'ADMIN_USER',
      entityId: targetId,
      storeCode: targetUser.store_code,
      beforeJson: {
        username: targetUser.username,
        email: targetUser.email,
        full_name: targetUser.full_name,
        role: targetUser.role,
        store_code: targetUser.store_code,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa tài khoản "${targetUser.username}" thành công!`,
    });
  } catch (error: any) {
    console.error('Error deleting admin user:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
