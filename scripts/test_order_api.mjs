import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

async function test() {
  const res = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderCode: 'TSF-TEST-888888',
      fullName: 'Khách Hàng Thái Sơn',
      phone: '0901234567',
      email: 'khachhang@tsf.com.vn',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận Tân Bình',
      ward: 'Phường Tân Sơn Hòa',
      address: '2C Phổ Quang',
      note: 'Kiểm tra kết nối PostgreSQL pgAdmin 4 WebTSF',
      paymentMethod: 'cod',
      shippingFee: 0,
      subtotal: 108000,
      total: 108000,
      items: [
        {
          productId: 'sua-bap-nep',
          name: 'Sữa Bắp Nếp Thái Sơn (6 chai)',
          price: 108000,
          quantity: 1,
          unit: '6 chai',
          thumbnail: '/images/products/sua-bap-nep.png',
        },
      ],
    }),
  });

  const data = await res.json();
  console.log('Order API response:', data);
}

test().catch(console.error);
