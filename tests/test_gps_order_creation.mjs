import pg from 'pg';

// SEC-02: chuỗi kết nối DB không viết cứng trong mã nguồn; lấy từ DATABASE_URL (.env hoặc biến môi trường).
function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try { process.loadEnvFile(); } catch { /* không có file .env */ }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL: đặt trong file .env hoặc biến môi trường.');
  return url;
}

const pool = new pg.Pool({
  connectionString: requireDatabaseUrl(),
});

async function main() {
  console.log('🧪 BẮT ĐẦU TEST LƯU VẾT GPS ĐƠN HÀNG (MỤC 18.7)...');

  const testOrderCode = `TSF-GPS-TEST-${Date.now().toString().slice(-4)}`;
  const testPayload = {
    orderCode: testOrderCode,
    fullName: 'Test GPS Customer',
    phone: '0987654321',
    email: 'test_gps@thaisonfoods.vn',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận 7',
    ward: 'Phường Tân Hưng',
    address: '701 Trần Xuân Soạn',
    note: 'Đơn test tự động kiểm tra GPS',
    paymentMethod: 'cod',
    shippingFee: 15000,
    subtotal: 150000,
    total: 165000,
    items: [
      {
        productId: 'sua-bap-nep',
        name: 'Sữa Bắp Nếp',
        price: 18000,
        quantity: 10,
        unit: 'Chai',
      },
    ],
    storeCode: 'NH',
    latitude: 10.745678,
    longitude: 106.698765,
    locationConfirmed: true,
    locationConfirmedBy: 'USER_MAP_PIN',
    addressNew: '701 Trần Xuân Soạn, Phường Tân Hưng, Quận 7, TP. Hồ Chí Minh',
    addressOld: null,
    recommendedStoreId: 'NH',
    wasOverridden: false,
    rankingSnapshot: {
      recommended: { code: 'NH', name: 'Chi nhánh Nguyễn Hữu Thọ', roadKm: 2.1, etaMinutes: 20 },
      alternatives: [{ code: 'HTP', name: 'Chi nhánh Huỳnh Tấn Phát', roadKm: 3.5, etaMinutes: 28 }],
    },
  };

  const response = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    },
    body: JSON.stringify(testPayload),
  });

  const resJson = await response.json();
  console.log('API Response status:', response.status, resJson.success);

  if (!resJson.success) {
    console.error('❌ Lỗi tạo đơn hàng:', resJson);
    process.exit(1);
  }

  // Truy vấn database xác nhận
  const dbRes = await pool.query(
    `SELECT id, order_code, latitude, longitude, location_confirmed, location_confirmed_by,
            address_new, recommended_store_id, was_overridden, ranking_snapshot
     FROM orders WHERE order_code = $1;`,
    [testOrderCode]
  );

  if (dbRes.rows.length === 0) {
    console.error('❌ Không tìm thấy đơn hàng trong DB!');
    process.exit(1);
  }

  const row = dbRes.rows[0];
  console.log('DB Order Record:', {
    id: row.id,
    order_code: row.order_code,
    latitude: row.latitude,
    longitude: row.longitude,
    location_confirmed: row.location_confirmed,
    location_confirmed_by: row.location_confirmed_by,
    address_new: row.address_new,
    recommended_store_id: row.recommended_store_id,
    was_overridden: row.was_overridden,
    ranking_snapshot: row.ranking_snapshot ? 'JSONB OK' : 'MISSING',
  });

  if (
    Math.abs(row.latitude - 10.745678) < 0.0001 &&
    Math.abs(row.longitude - 106.698765) < 0.0001 &&
    row.location_confirmed === true &&
    row.location_confirmed_by === 'USER_MAP_PIN' &&
    row.recommended_store_id === 'NH' &&
    row.was_overridden === false &&
    row.ranking_snapshot?.recommended?.code === 'NH'
  ) {
    console.log('✅ [PASS] MỤC 18.7 ĐÃ ĐẠT: Lưu trữ đầy đủ GPS, tọa độ, cờ xác nhận và snapshot vào orders!');
  } else {
    console.error('❌ Dữ liệu lưu trong DB không khớp!');
    process.exit(1);
  }

  // Dọn dẹp đơn test
  await pool.query('DELETE FROM order_items WHERE order_id = $1;', [row.id]);
  await pool.query('DELETE FROM stock_reservations WHERE order_id = $1;', [row.id]);
  await pool.query('DELETE FROM orders WHERE id = $1;', [row.id]);
  console.log('🧹 Đã dọn dẹp đơn test thành công.');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
