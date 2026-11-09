/**
 * Kiểm tra log ẩn danh về chất lượng gợi ý địa chỉ: không mã đơn / mã khách / IP, chuỗi bỏ hết chữ số, tọa độ và giờ làm tròn.
 * Chạy: npx tsx tests/address_anonymous_log_test.mjs
 */
import { buildAddressEvent, logAddressEvent, moveBucket, setAddressEventSink, stripQuery } from '@/lib/address/anonymousLog';

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

console.log('\n── Ẩn danh hóa');
check('chuỗi khách gõ bỏ hết chữ số (số nhà, số hẻm, 12/34/5)', stripQuery('12/34/5 Lê Lợi, Hạnh Thông') === 'Lê Lợi, Hạnh Thông' && stripQuery('Hẻm 76 Lê Lợi') === 'Hẻm Lê Lợi');
check('chuỗi chỉ có số hoặc quá ngắn thì bỏ', stripQuery('101') === null && stripQuery('') === null && stripQuery(null) === null);
check('chuỗi dài bị cắt còn 80 ký tự', (stripQuery('Lê Lợi '.repeat(40)) || '').length <= 80);
check('số điện thoại gõ lẫn vào chuỗi cũng bị bỏ chữ số', !/\d/.test(stripQuery('0901234567 Lê Lợi') || ''));
const e = buildAddressEvent({
  query: '101 Lê Lợi, Hạnh Thông',
  resultCount: 5,
  rank: 0,
  source: 'photon',
  precision: 'street',
  addressSource: 'autocomplete',
  locationTrusted: true,
  check: 'ok',
  pinMovedMeters: 130,
  pinChoice: 'keep',
  lat: 10.82104,
  lng: 106.68819,
  now: new Date('2026-11-05T06:47:31.123Z'),
});
check('giờ làm tròn xuống đầu giờ', e.hour === '2026-11-05T06:00:00.000Z', e.hour);
check('tọa độ làm tròn 3 số lẻ (≈ 100 m)', e.pin?.[0] === 10.821 && e.pin?.[1] === 106.688, JSON.stringify(e.pin));
check('khoảng ghim dời chỉ ghi theo nhóm', e.pinMoved === '100-500m' && moveBucket(5) === '<20m' && moveBucket(50) === '20-100m' && moveBucket(900) === '>500m' && moveBucket(null) === null);
check('giữ các số đo cần cho đánh giá chất lượng', e.resultCount === 5 && e.rank === 0 && e.source === 'photon' && e.precision === 'street' && e.check === 'ok' && e.pinChoice === 'keep' && e.locationTrusted === true);
check('sự kiện KHÔNG có mã đơn, mã khách, IP, tên, điện thoại, email, địa chỉ đầy đủ', (() => {
  const keys = Object.keys(e).join(',');
  const text = JSON.stringify(e);
  return !/order|customer|user|ip|phone|email|name|address(?!Source)/i.test(keys.replace('addressSource', '')) && !/\d{9,}/.test(text) && !/101/.test(text.replace(/10\.821|106\.688|2026|T06/g, ''));
})());
check('giá trị lạ / chèn mã bị làm sạch', (() => {
  const x = buildAddressEvent({ source: 'photon<script>alert(1)</script>', check: '../etc/passwd', rank: 9999, pinChoice: 'hack' });
  return !/[<>/.]/.test(`${x.source}${x.check}`) && x.rank === 50 && x.pinChoice === null;
})());

console.log('\n── Nơi ghi log');
{
  let got = null;
  setAddressEventSink((ev) => {
    got = ev;
  });
  logAddressEvent({ query: 'Lê Lợi', resultCount: 3 });
  check('sink thay được (ví dụ ghi bảng DB sau khi được duyệt)', got?.query === 'Lê Lợi' && got?.resultCount === 3);
  setAddressEventSink(() => {
    throw new Error('lỗi ghi');
  });
  let threw = false;
  try {
    logAddressEvent({ query: 'Lê Lợi' });
  } catch {
    threw = true;
  }
  check('lỗi khi ghi log không làm hỏng đặt hàng', !threw);
  setAddressEventSink(null);
}

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
