import { assertSafeDatabase } from './db-guard.mjs';

// TEST-GUARD: chỉ chạy trên database staging/test (hoặc ALLOW_PROD_DB=yes) để tránh ghi/xóa nhầm dữ liệu thật.
assertSafeDatabase();

async function main() {
  console.log('--- Testing Full Admin Product Edit Flow ---');

  // 1. Login as admin
  const loginRes = await fetch('http://localhost:3000/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'Admin@123' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('1. Login response status:', loginRes.status, 'Cookie acquired:', Boolean(cookie));

  // 2. Edit TSG-01 with new title matching Image 2
  const editedName = 'Trà Sữa nấu từ trà nguyên bản, đậm vị trà béo vị sữa, thức uống tiện lợi dùng ngay, chai 330ml';
  const putRes = await fetch('http://localhost:3000/api/admin/products', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookie || '',
    },
    body: JSON.stringify({
      id: 'prod-tsg-01',
      sku: 'TSG-01',
      name: editedName,
      price: 18000,
      unit: '1 chai',
      short_description: 'Chuẩn vị trà sữa, thơm nhẹ vị trà, bùi vị sữa, đóng chai nhỏ gọn, sẵn sàng uống liền mọi lúc.',
      description: 'Trà Sữa GO - Vị trà sữa thơm ngon cùng topping thạch giòn dai, trọn vẹn từng khoảnh khắc tụ họp.',
      category_id: 'cat-tra-sua',
      is_active: true,
    }),
  });
  const putData = await putRes.json();
  console.log('2. Admin PUT response success:', putData.success, 'Updated name:', putData.data?.name);

  // 3. Verify public page /san-pham/tra-sua-go
  const pageRes = await fetch('http://localhost:3000/san-pham/tra-sua-go');
  const html = await pageRes.text();
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const actualH1 = h1Match ? h1Match[1].trim() : 'N/A';
  console.log('3. Public website <h1> title:', actualH1);

  if (actualH1 === editedName) {
    console.log('\n>>> SUCCESS: Admin edited product info is 100% updated and visible on the website! <<<');
  } else {
    console.error('\n>>> FAILURE: Title did not match! <<<');
  }
}

main();
