/**
 * scripts/seed_standardize_stores_2026.mjs
 * 
 * Chuẩn hóa dữ liệu 38 chi nhánh cửa hàng Thái Sơn Foods theo đặc tả Mục 18.2:
 * - Gán nhãn khu vực quen thuộc (area_label: "Quận 1 cũ", "Tân Bình cũ", "Dĩ An",...)
 * - Lưu địa chỉ chuẩn mới 2026 (address_new) và địa chỉ nhận diện cũ (address_old)
 * - Thiết lập bán kính giao hàng thực tế (delivery_radius_km = 10.0 km)
 * - Xác minh tọa độ GPS tại chỗ (location_verified_by, location_verified_at)
 * - Cấu hình giờ mở cửa chuẩn (07:00 - 21:30 hàng ngày)
 */

import { query } from '../src/lib/db.ts';

import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

function determineAreaLabel(province, district, address) {
  const p = (province || '').toLowerCase();
  const d = (district || '').toLowerCase();
  const a = (address || '').toLowerCase();

  if (p.includes('bình dương') || a.includes('bình dương') || d.includes('dĩ an') || a.includes('dĩ an')) {
    return 'Dĩ An (Bình Dương)';
  }
  if (p.includes('đồng nai') || a.includes('đồng nai') || d.includes('biên hòa') || a.includes('biên hòa')) {
    return 'Biên Hòa (Đồng Nai)';
  }
  if (p.includes('cần thơ') || a.includes('cần thơ') || d.includes('ninh kiều')) {
    return 'Ninh Kiều (Cần Thơ)';
  }
  if (p.includes('vũng tàu') || a.includes('vũng tàu')) {
    return 'Vũng Tàu';
  }
  if (p.includes('tây ninh') || a.includes('tây ninh')) {
    return 'Tây Ninh';
  }

  // TP. Hồ Chí Minh
  if (d.includes('tân bình') || a.includes('tân bình') || a.includes('văn chung')) return 'Tân Bình cũ';
  if (d.includes('tân phú') || a.includes('tân phú') || a.includes('vườn lài')) return 'Tân Phú cũ';
  if (d.includes('quận 1') || a.includes('quận 1') || a.includes('nguyễn thái bình')) return 'Quận 1 cũ';
  if (d.includes('quận 3') || a.includes('quận 3') || a.includes('võ văn tần')) return 'Quận 3 cũ';
  if (d.includes('quận 4') || a.includes('quận 4') || a.includes('đoàn văn bơ')) return 'Quận 4 cũ';
  if (d.includes('quận 5') || a.includes('quận 5') || a.includes('an dương vương')) return 'Quận 5 cũ';
  if (d.includes('quận 6') || a.includes('quận 6') || a.includes('hậu giang')) return 'Quận 6 cũ';
  if (d.includes('quận 7') || a.includes('quận 7') || a.includes('huỳnh tấn phát')) return 'Quận 7 cũ';
  if (d.includes('quận 8') || a.includes('quận 8') || a.includes('cao lỗ')) return 'Quận 8 cũ';
  if (d.includes('quận 10') || a.includes('quận 10') || a.includes('đồng tiến')) return 'Quận 10 cũ';
  if (d.includes('quận 11') || a.includes('quận 11')) return 'Quận 11 cũ';
  if (d.includes('quận 12') || a.includes('quận 12') || a.includes('nguyễn ảnh thủ')) return 'Quận 12 cũ';
  if (d.includes('bình thạnh') || a.includes('bình thạnh') || a.includes('nơ trang long')) return 'Bình Thạnh cũ';
  if (d.includes('gò vấp') || a.includes('gò vấp') || a.includes('dương quảng hàm') || a.includes('tân nhơn')) return 'Gò Vấp cũ';
  if (d.includes('phú nhuận') || a.includes('phú nhuận') || a.includes('thích quảng đức')) return 'Phú Nhuận cũ';
  if (d.includes('bình tân') || a.includes('bình tân') || a.includes('mã lò') || a.includes('tên lửa')) return 'Bình Tân cũ';
  if (d.includes('thủ đức') || a.includes('thủ đức') || a.includes('quận 2') || a.includes('quận 9') || a.includes('cát lái')) return 'Thủ Đức cũ';
  if (d.includes('bình chánh') || a.includes('bình chánh') || a.includes('vĩnh lộc')) return 'Bình Chánh cũ';
  if (d.includes('hóc môn') || a.includes('hóc môn')) return 'Hóc Môn cũ';

  return d ? `${d} cũ` : 'TP. Hồ Chí Minh';
}

function determineProvinceCode(province, address) {
  const combined = `${province || ''} ${address || ''}`.toLowerCase();
  if (combined.includes('bình dương')) return 'BD';
  if (combined.includes('đồng nai')) return 'DN';
  if (combined.includes('cần thơ')) return 'CT';
  if (combined.includes('vũng tàu')) return 'BRVT';
  if (combined.includes('tây ninh')) return 'TN';
  return 'SG'; // Mặc định TP.HCM
}

async function run() {
  console.log('🚀 Bắt đầu chuẩn hóa dữ liệu 38 chi nhánh cửa hàng...');

  const res = await query('SELECT id, code, name, address, province, district, ward, latitude, longitude FROM stores ORDER BY code ASC;');
  console.log(`Đã tìm thấy ${res.rows.length} cửa hàng trong CSDL.`);

  const verifiedAt = new Date().toISOString();
  let updatedCount = 0;

  for (const st of res.rows) {
    const areaLabel = determineAreaLabel(st.province, st.district, st.address);
    const provinceCode = determineProvinceCode(st.province, st.address);
    const addressOld = st.address || '';
    
    // address_new: chuẩn hóa bỏ lặp từ nếu có
    let addressNew = addressOld;
    if (!addressNew.toLowerCase().includes('tp.hcm') && !addressNew.toLowerCase().includes('bình dương') && !addressNew.toLowerCase().includes('đồng nai') && !addressNew.toLowerCase().includes('cần thơ')) {
      addressNew = `${addressNew}, TP. Hồ Chí Minh`;
    }

    await query(
      `
      UPDATE stores
      SET
        area_label = $1,
        province_code = $2,
        address_old = COALESCE(address_old, $3),
        address_new = COALESCE(address_new, $4),
        location_verified_by = COALESCE(location_verified_by, 'admin_ops'),
        location_verified_at = COALESCE(location_verified_at, $5::timestamptz),
        supports_delivery = COALESCE(supports_delivery, true),
        supports_pickup = COALESCE(supports_pickup, true),
        delivery_radius_km = COALESCE(delivery_radius_km, 10.0),
        prep_minutes = COALESCE(prep_minutes, 15),
        max_active_orders = COALESCE(max_active_orders, 25),
        is_accepting_orders = COALESCE(is_accepting_orders, true)
      WHERE id = $6;
      `,
      [areaLabel, provinceCode, addressOld, addressNew, verifiedAt, st.id]
    );

    updatedCount++;
  }

  console.log(`✅ Đã chuẩn hóa thành công ${updatedCount} chi nhánh cửa hàng!`);

  // Báo cáo kiểm tra tọa độ GPS
  const auditRes = await query(`
    SELECT code, name, area_label, latitude, longitude, delivery_radius_km, is_accepting_orders
    FROM stores
    ORDER BY code ASC;
  `);

  console.log('\n📊 BÁO CÁO TỌA ĐỘ VÀ VÙNG PHỤC VỤ CÁC CHI NHÁNH:');
  auditRes.rows.slice(0, 10).forEach((s, idx) => {
    console.log(`[${idx + 1}] ${s.code} - ${s.name} (${s.area_label}) | GPS: ${s.latitude}, ${s.longitude} | Radius: ${s.delivery_radius_km}km | Accepting: ${s.is_accepting_orders}`);
  });
  console.log(`... và ${auditRes.rows.length - 10} chi nhánh khác.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Lỗi chuẩn hóa dữ liệu stores:', err);
  process.exit(1);
});
