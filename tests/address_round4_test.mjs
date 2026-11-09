/**
 * Vòng 4: tọa độ (0, 0) coi như thiếu; xác nhận ghim cho địa chỉ đã lưu (bản chụp); đường lui "needs_call" có hạn mức.
 * Chạy: npx tsx tests/address_round4_test.mjs
 */
import { hasRealCoords, addressSnapshot } from '@/lib/address/normalize';
import { isSavedPinValid, updateSavedPin } from '@/lib/address/savedAddressPin';
import { isFallbackCode, takeFallbackQuota, resetFallbackQuota } from '@/lib/address/locationFallback';

let pass = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ PASS: ${name}`); } else { fail++; console.log(`  ✗ FAIL: ${name} ${extra}`); }
};

console.log('\n── Tọa độ (0, 0) và NULL đều là thiếu');
check('(0, 0) là thiếu', !hasRealCoords(0, 0) && !hasRealCoords('0', '0'));
check('NULL / undefined / rỗng / NaN là thiếu', !hasRealCoords(null, null) && !hasRealCoords(undefined, 106.7) && !hasRealCoords('', '') && !hasRealCoords(NaN, 1));
check('Number(null) = 0 không bị coi là tọa độ', !hasRealCoords(null, 0));
check('tọa độ thật hợp lệ', hasRealCoords(10.8208, 106.6874) && hasRealCoords('10.8', '106.7'));
check('ngoài phạm vi là thiếu', !hasRealCoords(95, 106) && !hasRealCoords(10, 200));

console.log('\n── Xác nhận ghim cho địa chỉ đã lưu');
const saved = { address: '101 Lê Lợi', ward: 'Phường Hạnh Thông', district: 'Quận Gò Vấp', province: 'TP. Hồ Chí Minh', latitude: 10.8208, longitude: 106.6874 };
const row = { address_pin_confirmed_at: new Date(), address_pin_lat: 10.8208, address_pin_lng: 106.6874, address_pin_snapshot: addressSnapshot(saved) };
check('đã xác nhận, chưa sửa → hợp lệ', isSavedPinValid(row, saved));
check('sửa chữ địa chỉ → mất hiệu lực', !isSavedPinValid(row, { ...saved, address: '103 Lê Lợi' }));
check('đổi Phường → mất hiệu lực', !isSavedPinValid(row, { ...saved, ward: 'Phường An Nhơn' }));
check('đổi Quận → mất hiệu lực', !isSavedPinValid(row, { ...saved, district: 'Quận 1' }));
check('đổi tọa độ → mất hiệu lực', !isSavedPinValid(row, { ...saved, latitude: 10.83 }));
check('chưa từng xác nhận → không hợp lệ', !isSavedPinValid({}, saved) && !isSavedPinValid(null, saved));
check('tọa độ (0, 0) → không hợp lệ', !isSavedPinValid({ ...row, address_pin_lat: 0, address_pin_lng: 0 }, { ...saved, latitude: 0, longitude: 0 }));
{
  const sql = [];
  const q = async (s, p) => {
    sql.push([s, p]);
    if (/^SELECT/.test(s)) return { rows: [row] };
    return { rows: [] };
  };
  await updateSavedPin('U1', saved, true, q);
  check('lưu kèm xác nhận ghim → ghi thời điểm, tọa độ, bản chụp', /address_pin_confirmed_at = NOW\(\)/.test(sql[0][0]) && sql[0][1][0] === 10.8208 && sql[0][1][2] === addressSnapshot(saved) && sql[0][1][3] === 'U1');
  sql.length = 0;
  await updateSavedPin('U1', { ...saved, address: '5 Nguyễn Trãi' }, false, q);
  check('lưu địa chỉ đã sửa (không xác nhận lại) → xóa xác nhận', sql.some(([s]) => /address_pin_confirmed_at = NULL/.test(s)));
  sql.length = 0;
  const still = await updateSavedPin('U1', saved, false, q);
  check('lưu lại y nguyên → giữ xác nhận, không xóa', still === true && !sql.some(([s]) => /= NULL/.test(s)));
  const broken = await updateSavedPin('U1', saved, true, async () => { throw new Error('column does not exist'); });
  check('chưa chạy migration → không làm hỏng việc lưu hồ sơ (coi như chưa xác nhận)', broken === false);
}

console.log('\n── Đường lui "needs_call" khi bản đồ lỗi');
resetFallbackQuota();
check('chỉ nhận mã lỗi bản đồ hợp lệ', isFallbackCode('TILES_FAILED') && isFallbackCode('GEO_TIMEOUT') && !isFallbackCode('MUON_NE_PHI') && !isFallbackCode(null));
check('mỗi phiên tối đa 2 lần / 24 giờ', takeFallbackQuota('sid:a') && takeFallbackQuota('sid:a') && !takeFallbackQuota('sid:a'));
check('phiên khác không bị ảnh hưởng', takeFallbackQuota('sid:b'));
check('sau 24 giờ dùng lại được', takeFallbackQuota('sid:a', Date.now() + 25 * 3600 * 1000));
check('không có khóa phiên/IP → không nhận', !takeFallbackQuota(''));

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
