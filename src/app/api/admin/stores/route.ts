import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission, getStoreScope } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

// GET: Lấy danh sách thông tin cửa hàng cho Admin
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const storeCode = searchParams.get('storeCode');

    let sql = `
      SELECT 
        s.id,
        s.code,
        s.name,
        s.address,
        s.phone,
        s.province,
        s.district,
        s.ward,
        s.map_url,
        s.latitude,
        s.longitude,
        s.region,
        s.group_code,
        s.status,
        s.notes,
        s.is_active,
        s.updated_at
      FROM stores s
      WHERE 1=1
    `;
    const params: any[] = [];

    // Nếu là STORE_STAFF thì chỉ xem được cửa hàng của mình
    const storeScope = getStoreScope(session);
    if (storeScope) {
      params.push(storeScope);
      sql += ` AND s.code = $${params.length}`;
    } else if (storeCode) {
      params.push(storeCode);
      sql += ` AND s.code = $${params.length}`;
    }

    sql += ` ORDER BY s.code ASC;`;

    const res = await query(sql, params);

    return NextResponse.json({
      success: true,
      stores: res.rows,
      currentUserStore: storeScope,
      isSuperAdmin: hasPermission(session, 'stores.edit_all'),
    });
  } catch (error: any) {
    console.error('Error fetching admin stores:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// PUT: Cập nhật thông tin địa chỉ cửa hàng
export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập quản trị' }, { status: 401 });
    }

    const canEditAll = hasPermission(session, 'stores.edit_all');
    const canEditOwn = hasPermission(session, 'stores.edit_own');

    if (!canEditAll && !canEditOwn) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền chỉnh sửa thông tin cửa hàng.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    let { code } = body;
    const { name, address, phone, province, district, ward, map_url, mapUrl, latitude, longitude, region, group_code, status: storeStatus, notes } = body;

    // Quyền: Cửa hàng chỉ được sửa thông tin của chính mình
    const storeScope = getStoreScope(session);
    if (storeScope) {
      code = storeScope;
    }

    if (!code) {
      return NextResponse.json({ success: false, error: 'Thiếu mã cửa hàng (code)' }, { status: 400 });
    }

    const checkRes = await query(`SELECT * FROM stores WHERE code = $1 LIMIT 1;`, [code]);
    const beforeStore = checkRes.rows[0] || null;

    // Chỉ quyền chỉnh sửa toàn hệ thống mới được TẠO cửa hàng mới / đổi trạng thái, khu vực, nhóm
    if (!beforeStore && !canEditAll) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy cửa hàng của bạn để cập nhật.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Chuẩn hóa đầu vào: trường KHÔNG gửi lên (undefined) nghĩa là "giữ nguyên", không phải "xóa"
    const text = (v: unknown, max: number): string | undefined | null => {
      if (v === undefined || v === null) return undefined;
      if (typeof v !== 'string') return null; // sai kiểu → báo lỗi
      const t = v.trim();
      return t.length > max ? null : t;
    };
    const fields = {
      name: text(name, 255),
      address: text(address, 500),
      phone: text(phone, 50),
      province: text(province, 100),
      district: text(district, 100),
      ward: text(ward, 100),
      notes: text(notes, 1000),
    };
    for (const [k, v] of Object.entries(fields)) {
      if (v === null) {
        return NextResponse.json({ success: false, error: `Giá trị "${k}" không hợp lệ (sai kiểu hoặc quá dài).` }, { status: 400 });
      }
    }
    if (fields.name === '' || fields.address === '') {
      return NextResponse.json({ success: false, error: 'Tên và địa chỉ cửa hàng không được để trống.' }, { status: 400 });
    }

    let lat: number | undefined;
    let lng: number | undefined;
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      lat = Number(latitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return NextResponse.json({ success: false, error: 'Vĩ độ không hợp lệ (-90 đến 90).' }, { status: 400 });
      }
    }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      lng = Number(longitude);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return NextResponse.json({ success: false, error: 'Kinh độ không hợp lệ (-180 đến 180).' }, { status: 400 });
      }
    }

    // Liên kết bản đồ chỉ nhận http(s) — chặn javascript:/data: được hiển thị thành thẻ <a>
    const rawMap = map_url ?? mapUrl;
    let mapUrlValue: string | undefined;
    if (typeof rawMap === 'string' && rawMap.trim()) {
      try {
        const u = new URL(rawMap.trim());
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol');
        mapUrlValue = u.toString();
      } catch {
        return NextResponse.json({ success: false, error: 'Liên kết bản đồ phải là địa chỉ http(s) hợp lệ.' }, { status: 400 });
      }
    } else if (typeof rawMap === 'string' && fields.address) {
      // Để trống khi đang đổi địa chỉ → tự tạo liên kết tìm kiếm theo địa chỉ mới
      mapUrlValue = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fields.address)}`;
    }

    // Trạng thái / khu vực / nhóm: chỉ quyền chỉnh sửa toàn hệ thống; không gửi lên = giữ nguyên
    let statusValue: number | undefined;
    if (canEditAll && storeStatus !== undefined && storeStatus !== null) {
      if (storeStatus !== 0 && storeStatus !== 1) {
        return NextResponse.json({ success: false, error: 'Trạng thái cửa hàng chỉ nhận 0 (tạm ngưng) hoặc 1 (hoạt động).' }, { status: 400 });
      }
      statusValue = storeStatus;
    }
    const regionValue = canEditAll ? text(region, 100) : undefined;
    const groupValue = canEditAll ? text(group_code, 50) : undefined;

    let res;
    if (beforeStore) {
      // Cửa hàng đã có: chỉ ghi đè các trường được gửi lên (COALESCE giữ nguyên giá trị cũ khi $n = NULL)
      res = await query(
        `UPDATE stores SET
           name = COALESCE($2, name),
           address = COALESCE($3, address),
           phone = COALESCE($4, phone),
           province = COALESCE($5, province),
           district = COALESCE($6, district),
           ward = COALESCE($7, ward),
           map_url = COALESCE($8, map_url),
           latitude = COALESCE($9, latitude),
           longitude = COALESCE($10, longitude),
           region = COALESCE($11, region),
           group_code = COALESCE($12, group_code),
           status = COALESCE($13, status),
           is_active = COALESCE($14, is_active),
           notes = COALESCE($15, notes),
           updated_at = CURRENT_TIMESTAMP
         WHERE code = $1
         RETURNING *;`,
        [
          code,
          fields.name ?? null,
          fields.address ?? null,
          fields.phone ?? null,
          fields.province ?? null,
          fields.district ?? null,
          fields.ward ?? null,
          mapUrlValue ?? null,
          lat ?? null,
          lng ?? null,
          regionValue ?? null,
          groupValue ?? null,
          statusValue ?? null,
          statusValue === undefined ? null : statusValue === 1,
          fields.notes ?? null,
        ]
      );
    } else {
      // Cửa hàng mới (chỉ quyền chỉnh sửa toàn hệ thống)
      const newStatus = statusValue ?? 1;
      res = await query(
        `INSERT INTO stores (id, code, name, address, phone, province, district, ward, map_url, latitude, longitude, region, group_code, status, notes, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
         RETURNING *;`,
        [
          `store_${code}`,
          code,
          fields.name || `Cửa hàng ${code}`,
          fields.address || '',
          fields.phone || '',
          fields.province || 'Hồ Chí Minh',
          fields.district || '',
          fields.ward || '',
          mapUrlValue ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fields.address || '')}`,
          lat ?? null,
          lng ?? null,
          regionValue ?? null,
          groupValue ?? null,
          newStatus,
          fields.notes ?? null,
          newStatus === 1,
        ]
      );
    }
    const updatedStore = res.rows[0];
    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'STORE_UPDATE',
      entityType: 'STORE',
      entityId: code,
      storeCode: code,
      beforeJson: beforeStore,
      afterJson: updatedStore,
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật thông tin địa chỉ cho cửa hàng ${code} thành công!`,
      store: updatedStore,
    });
  } catch (error: any) {
    console.error('Error updating store info:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
