import { NextRequest, NextResponse } from 'next/server';
import { query, pool, initDatabase } from '@/lib/db';
import { getAdminSession, invalidateUserSessionCache } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

function maskMember(member: any, hasFullView: boolean) {
  if (hasFullView) return member;
  const rawPhone = member.phone || '';
  const maskedPhone = rawPhone.length > 6 
    ? rawPhone.substring(0, 3) + '****' + rawPhone.substring(rawPhone.length - 3)
    : (rawPhone ? '****' : null);

  return {
    ...member,
    phone: maskedPhone,
    address: null,
    province: null,
    district: null,
    ward: null,
  };
}

function maskOrder(order: any, hasFullView: boolean) {
  if (hasFullView) return order;
  const rawPhone = order.phone || '';
  const maskedPhone = rawPhone.length > 6 
    ? rawPhone.substring(0, 3) + '****' + rawPhone.substring(rawPhone.length - 3)
    : (rawPhone ? '****' : null);

  return {
    ...order,
    phone: maskedPhone,
    shipping_address: null,
  };
}

// GET: Lấy danh sách thành viên hoặc thông tin chi tiết + lịch sử đơn của 1 thành viên
export async function GET(req: NextRequest) {
  try {
    await initDatabase();

    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Yêu cầu đăng nhập tài khoản quản trị' },
        { status: 401 }
      );
    }

    const canViewFull = hasPermission(session, 'members.view_full');
    const canViewMasked = hasPermission(session, 'members.view_masked');

    if (!canViewFull && !canViewMasked) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền truy cập danh sách thành viên.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('id');
    const search = searchParams.get('q') || '';

    // 1. Nếu lấy chi tiết 1 thành viên kèm danh sách đơn hàng đã mua
    if (memberId) {
      const userRes = await query(
        `SELECT 
          u.id,
          u.email,
          u.full_name,
          u.phone,
          u.address,
          u.province,
          u.district,
          u.ward,
          u.provider,
          u.avatar_url,
          COALESCE(u.is_active, true) AS is_active,
          u.created_at,
          u.updated_at,
          COUNT(o.id)::int AS total_orders,
          COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' THEN o.total ELSE 0 END), 0)::int AS total_spent,
          MAX(o.created_at) AS last_order_date
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.id;`,
        [memberId]
      );

      if (userRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy thông tin thành viên' },
          { status: 404 }
        );
      }

      // Lấy lịch sử đơn hàng của thành viên này
      const ordersRes = await query(
        `SELECT 
          id, 
          order_code, 
          full_name, 
          phone, 
          total, 
          status, 
          payment_method, 
          shipping_fee, 
          store_code, 
          created_at
        FROM orders
        WHERE user_id = $1
        ORDER BY created_at DESC;`,
        [memberId]
      );

      return NextResponse.json({
        success: true,
        member: maskMember(userRes.rows[0], canViewFull),
        orders: ordersRes.rows.map((o: any) => maskOrder(o, canViewFull)),
      });
    }

    // 2. Lấy toàn bộ danh sách thành viên (có hỗ trợ tìm kiếm)
    let sql = `
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.address,
        u.province,
        u.district,
        u.ward,
        u.provider,
        u.avatar_url,
        COALESCE(u.is_active, true) AS is_active,
        u.created_at,
        u.updated_at,
        COUNT(o.id)::int AS total_orders,
        COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' THEN o.total ELSE 0 END), 0)::int AS total_spent,
        MAX(o.created_at) AS last_order_date
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
    `;

    const params: any[] = [];
    if (search.trim()) {
      sql += ` WHERE (
        LOWER(u.full_name) LIKE $1 
        OR LOWER(u.email) LIKE $1 
        OR LOWER(COALESCE(u.phone, '')) LIKE $1 
        OR LOWER(COALESCE(u.address, '')) LIKE $1
      )`;
      params.push(`%${search.trim().toLowerCase()}%`);
    }

    sql += ` GROUP BY u.id ORDER BY u.created_at DESC;`;

    const res = await query(sql, params);
    const maskedMembers = res.rows.map((m: any) => maskMember(m, canViewFull));

    return NextResponse.json({
      success: true,
      members: maskedMembers,
      total: maskedMembers.length,
    });
  } catch (error: any) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(error, 'Lỗi máy chủ khi lấy danh sách thành viên') },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật trạng thái khóa/mở hoặc thông tin thành viên
export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'members.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý thành viên.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const body = await req.json();
    const { id, isActive, fullName, phone, address, province, district, ward } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ID thành viên cần cập nhật' },
        { status: 400 }
      );
    }

    const check = await query(`SELECT * FROM users WHERE id = $1;`, [id]);
    if (check.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy thông tin thành viên' },
        { status: 404 }
      );
    }
    const beforeUser = check.rows[0];

    // Nếu cập nhật trạng thái hoạt động (Khóa / Mở khóa)
    if (isActive !== undefined) {
      await query(
        `UPDATE users 
         SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2;`,
        [Boolean(isActive), id]
      );
      invalidateUserSessionCache(id); // khóa có hiệu lực ngay trên máy chủ này

      await writeAuditLog({
        adminId: session.userId,
        adminUsername: session.username,
        role: session.role,
        action: isActive ? 'MEMBER_UNLOCK' : 'MEMBER_LOCK',
        entityType: 'MEMBER',
        entityId: id,
        beforeJson: { is_active: beforeUser.is_active },
        afterJson: { is_active: Boolean(isActive) },
      });

      return NextResponse.json({
        success: true,
        message: isActive ? 'Đã kích hoạt lại tài khoản thành viên' : 'Đã tạm khóa tài khoản thành viên',
      });
    }

    // Nếu cập nhật thông tin liên hệ (whitelist)
    await query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           address = COALESCE($3, address),
           province = COALESCE($4, province),
           district = COALESCE($5, district),
           ward = COALESCE($6, ward),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7;`,
      [fullName, phone, address, province, district, ward, id]
    );

    const afterRes = await query(`SELECT id, full_name, phone, address, province, district, ward, updated_at FROM users WHERE id = $1;`, [id]);

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'MEMBER_UPDATE',
      entityType: 'MEMBER',
      entityId: id,
      beforeJson: {
        full_name: beforeUser.full_name,
        phone: beforeUser.phone,
        address: beforeUser.address,
      },
      afterJson: afterRes.rows[0],
    });

    return NextResponse.json({
      success: true,
      message: 'Cập nhật thông tin thành viên thành công!',
    });
  } catch (error: any) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(error, 'Lỗi khi cập nhật thành viên') },
      { status: 500 }
    );
  }
}

// DELETE: Xóa thành viên
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'members.manage')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền quản lý thành viên.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ID thành viên cần xóa' },
        { status: 400 }
      );
    }

    const check = await query(`SELECT * FROM users WHERE id = $1;`, [id]);
    const beforeUser = check.rows[0] || null;
    if (!beforeUser) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy thành viên' }, { status: 404 });
    }

    // Gỡ liên kết trong orders (giữ lịch sử đơn hàng) và xóa tài khoản trong CÙNG một transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
      await client.query(`UPDATE orders SET user_id = NULL WHERE user_id = $1;`, [id]);
      await client.query(`DELETE FROM users WHERE id = $1;`, [id]);
      await client.query('COMMIT;');
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'MEMBER_DELETE',
      entityType: 'MEMBER',
      entityId: id,
      beforeJson: beforeUser ? { id: beforeUser.id, email: beforeUser.email, full_name: beforeUser.full_name } : null,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã xóa tài khoản thành viên thành công!',
    });
  } catch (error: any) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(error, 'Lỗi khi xóa thành viên') },
      { status: 500 }
    );
  }
}
