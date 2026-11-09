/**
 * Kiểm tra phụ ở backend: phường tại tọa độ đơn có khớp phường khách đã chọn không (không theo km), tính cả tên cũ / mới.
 * Dùng bộ tra phường GIẢ nên không cần mạng. Chạy: npx tsx tests/address_order_check_test.mjs
 */
import { checkOrderLocation } from '@/lib/address/orderLocationCheck';
import { wardLimitM } from '@/lib/address/admin';

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL: ${name} ${extra}`);
  }
}

const HANH_THONG = { ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' };
const Q1_PIN = { lat: 10.7727, lng: 106.6994 }; // Lê Lợi, Quận 1 (cách Hạnh Thông khoảng 5 km)
const GV_PIN = { lat: 10.8208, lng: 106.6874 };

console.log('\n── So phường tại tọa độ với phường đã chọn');
{
  const r = await checkOrderLocation(HANH_THONG, Q1_PIN, async () => ({ ward: 'Phường Bến Thành', district: 'Quận 1' }));
  check('chọn Hạnh Thông nhưng tọa độ nằm ở Bến Thành → ward_mismatch (đúng lỗi tester báo, chỉ cách ~5 km)', r.status === 'ward_mismatch', JSON.stringify(r));
}
{
  const r = await checkOrderLocation(HANH_THONG, GV_PIN, async () => ({ ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' }));
  check('đúng phường → ok', r.status === 'ok', JSON.stringify(r));
}
{
  const r = await checkOrderLocation(HANH_THONG, GV_PIN, async () => ({ ward: 'Phường 1', district: 'Quận Gò Vấp' }));
  check('nhà cung cấp trả tên CŨ (Phường 1, Gò Vấp) vẫn khớp Phường Hạnh Thông mới → ok', r.status === 'ok', JSON.stringify(r));
}
{
  const r = await checkOrderLocation({ ward: 'Phường 1', district: 'Quận Gò Vấp' }, GV_PIN, async () => ({ ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp' }));
  check('khách chọn tên cũ, tọa độ trả tên mới → ok', r.status === 'ok', JSON.stringify(r));
}

console.log('\n── Không tra được phường tại tọa độ: chỉ còn kiểm tra khoảng cách theo cỡ phường');
{
  const r = await checkOrderLocation(HANH_THONG, Q1_PIN, async () => {
    throw new Error('Nominatim bị giới hạn');
  });
  check('bộ tra lỗi nhưng ghim cách tâm Hạnh Thông ~5 km (vượt cỡ phường) → far_from_area, không ném lỗi', r.status === 'far_from_area', JSON.stringify(r));
}
{
  const r = await checkOrderLocation(HANH_THONG, GV_PIN, async () => null);
  check('không tra được và ghim sát tâm phường → unknown (không báo nhầm)', r.status === 'unknown', JSON.stringify(r));
}
{
  const limit = wardLimitM('Phường Hạnh Thông', 'Quận Gò Vấp');
  check('ngưỡng khoảng cách theo cỡ phường: nhỏ hơn 12 km cũ, nằm trong 2,5–10 km', limit >= 2500 && limit <= 10000 && limit < 12000, String(limit));
}

console.log('\n── Chạy sau khi tạo đơn (after): lưu location_check và ghi log ẩn danh');
{
  const { runOrderAddressChecks } = await import('@/lib/address/orderLocationCheck');
  const sql = [];
  const fakeQuery = async (q, p) => {
    sql.push([q, p]);
    return { rowCount: 1 };
  };
  let emitted = 'chưa gọi';
  const st = await runOrderAddressChecks({
    orderId: 'ORD-TEST', ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp', lat: Q1_PIN.lat, lng: Q1_PIN.lng,
    emit: async (c) => {
      emitted = c;
    },
    query: fakeQuery,
    resolver: async () => ({ ward: 'Phường Bến Thành', district: 'Quận 1' }),
  });
  check('lệch phường → lưu location_check = ward_mismatch vào đúng đơn', st === 'ward_mismatch' && sql.length === 1 && sql[0][1][0] === 'ward_mismatch' && sql[0][1][1] === 'ORD-TEST', JSON.stringify(sql));
  check('log ẩn danh được ghi kèm kết quả kiểm tra', emitted === 'ward_mismatch');
  const slow = await runOrderAddressChecks({
    orderId: 'ORD-2', ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp', lat: GV_PIN.lat, lng: GV_PIN.lng,
    emit: async () => {}, query: fakeQuery, timeoutMs: 50,
    resolver: () => new Promise((r) => setTimeout(() => r({ ward: 'Phường Hạnh Thông' }), 1000)),
  });
  check('nhà cung cấp chậm: hết hạn ngắn, không giữ hàm lâu (kết quả unknown)', slow === 'unknown');
}

console.log('\n── Bảng address_events: lưu và tự xóa sau 30 ngày');
{
  const { saveAddressEvent, purgeOldAddressEvents } = await import('@/lib/address/addressEventStore');
  const { buildAddressEvent } = await import('@/lib/address/anonymousLog');
  const sql = [];
  const fakeQuery = async (q, p) => {
    sql.push([q, p]);
    return { rowCount: 7 };
  };
  await saveAddressEvent(buildAddressEvent({ query: '101 Lê Lợi', check: 'ok', lat: 10.82104, lng: 106.68819 }), fakeQuery);
  const cols = sql[0][0].replace('address_events', '');
  check('lưu sự kiện: không có cột mã đơn / mã khách / IP; chuỗi đã bỏ số; tọa độ làm tròn', /INSERT INTO address_events/.test(sql[0][0]) && !/order|user_id|\bip\b/i.test(cols) && sql[0][1][1] === 'Lê Lợi' && sql[0][1][12] === 10.821, JSON.stringify(sql[0][1]));
  const n = await purgeOldAddressEvents(30, fakeQuery);
  check('tác vụ xóa: DELETE bản ghi quá 30 ngày, trả số dòng đã xóa', n === 7 && /DELETE FROM address_events WHERE hour < NOW\(\)/.test(sql[1][0]) && sql[1][1][0] === 30);
}

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
