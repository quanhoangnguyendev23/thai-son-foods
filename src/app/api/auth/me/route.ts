import { NextRequest, NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';
import { getUserSession } from '@/lib/auth';
import { publicErrorMessage } from '@/lib/apiError';
import { isSavedPinValid, readSavedPin, updateSavedPin } from '@/lib/address/savedAddressPin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initDatabase();
    const session = await getUserSession();

    if (!session || !session.id) {
      return NextResponse.json({ user: null });
    }

    const res = await query(
      `SELECT id, email, full_name, phone, address, province, district, ward, avatar_url, provider, latitude, longitude, created_at
       FROM users
       WHERE id = $1
       LIMIT 1;`,
      [session.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ user: null });
    }

    const row = res.rows[0];
    // Địa chỉ đã lưu có xác nhận ghim còn hiệu lực không (đọc riêng: chưa chạy migration vòng 4 thì coi như chưa)
    const pinRow = await readSavedPin(session.id);
    const locationConfirmed = isSavedPinValid(pinRow, {
      address: row.address,
      ward: row.ward,
      district: row.district,
      province: row.province,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    });
    return NextResponse.json({
      user: {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        phone: row.phone || '',
        address: row.address || '',
        province: row.province || '',
        district: row.district || '',
        ward: row.ward || '',
        latitude: row.latitude ? Number(row.latitude) : null,
        longitude: row.longitude ? Number(row.longitude) : null,
        locationConfirmed,
        avatarUrl: row.avatar_url || null,
        provider: row.provider || 'local',
        createdAt: row.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/auth/me GET:', error);
    return NextResponse.json({ user: null });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await initDatabase();
    const session = await getUserSession();

    if (!session || !session.id) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fullName, phone, address, province, district, ward, latitude, longitude } = body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp họ và tên' },
        { status: 400 }
      );
    }

    const latVal = typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null;
    const lngVal = typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null;

    // Gửi rõ latitude = null và longitude = null: khách đổi địa chỉ mà chưa ghim lại → xóa tọa độ cũ cho khỏi lệch
    const clearLocation = latitude === null && longitude === null;

    if ((latVal !== null && lngVal !== null) || clearLocation) {
      await query(
        `UPDATE users
         SET full_name = $1, phone = $2, address = $3, province = $4, district = $5, ward = $6, latitude = $7, longitude = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9;`,
        [
          fullName.trim(),
          phone ? phone.toString().trim() : null,
          address ? address.toString().trim() : null,
          province ? province.toString().trim() : null,
          district ? district.toString().trim() : null,
          ward ? ward.toString().trim() : null,
          latVal,
          lngVal,
          session.id,
        ]
      );
    } else {
      await query(
        `UPDATE users
         SET full_name = $1, phone = $2, address = $3, province = $4, district = $5, ward = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7;`,
        [
          fullName.trim(),
          phone ? phone.toString().trim() : null,
          address ? address.toString().trim() : null,
          province ? province.toString().trim() : null,
          district ? district.toString().trim() : null,
          ward ? ward.toString().trim() : null,
          session.id,
        ]
      );
    }

    // Xác nhận ghim cho địa chỉ đã lưu: ghi khi khách vừa xác nhận ghim; xóa nếu chữ / Phường / Quận / tọa độ đã đổi
    const savedNow = {
      address: address ? address.toString().trim() : null,
      ward: ward ? ward.toString().trim() : null,
      district: district ? district.toString().trim() : null,
      province: province ? province.toString().trim() : null,
      latitude: latVal,
      longitude: lngVal,
    };
    let locationConfirmed = false;
    if ((latVal !== null && lngVal !== null) || clearLocation) {
      locationConfirmed = await updateSavedPin(session.id, savedNow, body.pinConfirmed === true);
    } else {
      // Không gửi tọa độ: tọa độ cũ giữ nguyên, nhưng chữ có thể đã đổi → kiểm lại với tọa độ đang lưu
      const cur = await query('SELECT latitude, longitude FROM users WHERE id = $1', [session.id]);
      const c = cur.rows[0] || {};
      locationConfirmed = await updateSavedPin(
        session.id,
        { ...savedNow, latitude: c.latitude === null ? null : Number(c.latitude), longitude: c.longitude === null ? null : Number(c.longitude) },
        false
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật thông tin thành công!',
      user: {
        id: session.id,
        email: session.email,
        fullName: fullName.trim(),
        phone: phone ? phone.toString().trim() : '',
        address: address ? address.toString().trim() : '',
        province: province ? province.toString().trim() : '',
        district: district ? district.toString().trim() : '',
        ward: ward ? ward.toString().trim() : '',
        latitude: latVal,
        longitude: lngVal,
        locationConfirmed,
      },
    });
  } catch (error: any) {
    console.error('Error updating customer profile:', error);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(error, 'Lỗi cập nhật, vui lòng thử lại sau.') },
      { status: 500 }
    );
  }
}
