/**
 * tests/store_recommender.test.mjs
 *
 * Unit tests và Integration tests cho thuật toán đề xuất cửa hàng (Mục 18.10)
 */

import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Dùng hàm thật (không chép lại): phí ship theo chính sách hiện hành ở src/config/inventory.ts, giờ cao điểm ở storeRecommender.
// Chạy bằng tsx để nạp được alias "@/": npx tsx tests/store_recommender.test.mjs
import { calculateShippingFee as calculatePolicyShippingFee } from '@/config/inventory';
import { getPeakHourMultiplier } from '@/lib/storeRecommender';

const calculateShippingFee = (roadKm, orderSubtotal = 0) => calculatePolicyShippingFee(orderSubtotal, roadKm).fee;

async function runTests() {
  console.log('🧪 BẮT ĐẦU TEST THUẬT TOÁN ĐỀ XUẤT CHI NHÁNH & BẢNG PHÍ SHIP (MỤC 18)');

  // 1. Kiểm tra tính toán phí vận chuyển
  console.log('\n[TEST 1] Kiểm tra biểu phí vận chuyển chuẩn...');
  // Chính sách chốt 04/11/2026: 30.000đ (miễn phí từ 200.000đ) trong 10 km; từ 11 km +20.000đ; từ 15 km +35.000đ
  assert.strictEqual(calculateShippingFee(2.5, 100000), 30000, 'Đơn dưới 200.000đ trong 10 km phải là 30.000đ');
  assert.strictEqual(calculateShippingFee(8.0, 100000), 30000, '8 km vẫn là 30.000đ (chưa phụ thu)');
  assert.strictEqual(calculateShippingFee(10.0, 100000), 30000, '10 km vẫn là 30.000đ');
  assert.strictEqual(calculateShippingFee(12.0, 100000), 50000, 'Từ 11 km phụ thu +20.000đ');
  assert.strictEqual(calculateShippingFee(16.0, 100000), 65000, 'Từ 15 km phụ thu +35.000đ');
  assert.strictEqual(calculateShippingFee(4.0, 350000), 0, 'Đơn từ 200.000đ trong 10 km phải là Freeship 0đ');
  assert.strictEqual(calculateShippingFee(12.0, 350000), 20000, 'Đơn từ 200.000đ vượt 11 km vẫn phụ thu 20.000đ');
  console.log('  ✅ [PASS] Tất cả các mức phí ship & chính sách Freeship tính toán chính xác 100%!');

  // 2. Kiểm tra hệ số giờ cao điểm
  console.log('\n[TEST 2] Kiểm tra hệ số giờ cao điểm...');
  const morningRush = new Date('2026-10-12T01:30:00Z'); // 8:30 AM VN
  const afternoonRush = new Date('2026-10-12T10:00:00Z'); // 17:00 PM VN
  const noonNormal = new Date('2026-10-12T05:00:00Z'); // 12:00 PM VN

  assert.strictEqual(getPeakHourMultiplier(morningRush), 1.4, '8:30 sáng phải có hệ số 1.4');
  assert.strictEqual(getPeakHourMultiplier(afternoonRush), 1.4, '17:00 chiều phải có hệ số 1.4');
  assert.strictEqual(getPeakHourMultiplier(noonNormal), 1.0, '12:00 trưa phải có hệ số 1.0');
  console.log('  ✅ [PASS] Hệ số giờ cao điểm kích hoạt chuẩn xác!');

  // 3. Kiểm tra API POST /api/stores/recommend với khách tại Chợ Bến Thành (Quận 1)
  console.log('\n[TEST 3] Khách tại Chợ Bến Thành (Quận 1: 10.7725, 106.6981)...');
  const resD1 = await fetch(`${BASE_URL}/api/stores/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: 10.7725, lng: 106.6981 }),
  });
  const dataD1 = await resD1.json();
  assert.strictEqual(dataD1.success, true, 'API recommend phải trả về success: true');
  assert.ok(dataD1.recommended, 'Phải có chi nhánh được đề xuất');
  console.log(`  -> Đề xuất: ${dataD1.recommended.name} (${dataD1.recommended.areaLabel})`);
  console.log(`     Quãng đường: ${dataD1.recommended.roadKm} km | ETA: ${dataD1.recommended.etaMinutes} phút | Phí ship: ${dataD1.recommended.shippingFee}đ`);
  assert.ok(dataD1.recommended.roadKm <= 6.0, 'Chi nhánh đề xuất phải ở gần Quận 1 (< 6km)');
  assert.ok(dataD1.recommended.badges.includes('Đề xuất'), 'Chi nhánh top 1 phải có badge Đề xuất');
  console.log('  ✅ [PASS] Đề xuất chi nhánh chuẩn xác tại Quận 1!');

  // 4. Kiểm tra API POST /api/stores/recommend với khách tại Ninh Kiều (Cần Thơ)
  console.log('\n[TEST 4] Khách tại Ninh Kiều Cần Thơ (10.0402, 105.7501)...');
  const resCT = await fetch(`${BASE_URL}/api/stores/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: 10.0402, lng: 105.7501 }),
  });
  const dataCT = await resCT.json();
  assert.strictEqual(dataCT.success, true);
  assert.ok(dataCT.recommended);
  console.log(`  -> Đề xuất: ${dataCT.recommended.name} (${dataCT.recommended.areaLabel})`);
  assert.strictEqual(dataCT.recommended.code, 'CTH', 'Khách Cần Thơ phải được đề xuất đúng cửa hàng Cần Thơ (CTH)');
  console.log('  ✅ [PASS] Khách Cần Thơ chỉ đề xuất Cần Thơ, không bị nhầm sang TP.HCM!');

  // 5. Kiểm tra API POST /api/stores/recommend với khách tại Biên Hòa (10.9606, 106.8700)
  console.log('\n[TEST 5] Khách tại Biên Hòa Đồng Nai (10.9606, 106.8700)...');
  const resDN = await fetch(`${BASE_URL}/api/stores/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: 10.9606, lng: 106.8700 }),
  });
  const dataDN = await resDN.json();
  assert.strictEqual(dataDN.success, true);
  assert.ok(dataDN.recommended);
  console.log(`  -> Đề xuất: ${dataDN.recommended.name} (${dataDN.recommended.areaLabel})`);
  assert.strictEqual(dataDN.recommended.code, 'AMA', 'Khách Biên Hòa phải được đề xuất chi nhánh Biên Hòa (AMA)');
  console.log('  ✅ [PASS] Khách Biên Hòa đề xuất đúng chi nhánh Biên Hòa!');

  console.log('\n======================================================');
  console.log('🏁 TẤT CẢ 5 BÀI TEST THUẬT TOÁN ĐỀ XUẤT ĐÃ ĐẠT (PASS 100%)');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test thất bại:', err);
  process.exit(1);
});
