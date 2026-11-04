/**
 * src/lib/storeRecommender.ts
 *
 * Thuật toán xếp hạng và đề xuất chi nhánh cửa hàng tối ưu (Mục 18.3)
 * - Tối ưu quãng đường thực tế xe máy (Road matrix) & thời gian giao hàng (ETA)
 * - Lọc bán kính giao hàng thực tế (mặc định 10km) & kiểm tra giờ mở cửa
 * - Tính toán phí vận chuyển chính xác và tự động áp dụng chính sách Freeship
 * - Tự động đề xuất chi nhánh tối ưu nhất với nhãn "Đề xuất"
 */

import { query } from '@/lib/db';
import { calculateHaversineDistance } from '@/lib/geo';
import { getSellableQuantity } from '@/lib/inventory';
import { calculateShippingFee as calculatePolicyShippingFee } from '@/config/inventory';

export interface RecommenderInput {
  lat: number;
  lng: number;
  mode?: 'delivery' | 'pickup';
  cartItems?: Array<{ productId: string; quantity: number; price?: number }>;
  previousStoreCode?: string | null;
  scheduledAt?: string | null;
}

export interface StoreRecommendationItem {
  id: string;
  code: string;
  name: string;
  areaLabel: string | null;
  addressNew: string;
  addressOld: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  straightKm: number;
  roadKm: number;
  etaMinutes: number;
  shippingFee: number;
  canDeliver: boolean;
  rejectReason?: string;
  isOpen: boolean;
  closesAt: string | null;
  isClosingSoon: boolean;
  stockStatus: 'full' | 'partial' | 'out_of_stock' | 'unknown';
  missingItemsCount: number;
  badges: string[];
  score: number;
}

export interface RecommendationResult {
  recommended: StoreRecommendationItem | null;
  alternatives: StoreRecommendationItem[];
  others: StoreRecommendationItem[];
  unavailable: Array<{ store: Partial<StoreRecommendationItem>; reason: string }>;
  userCoords: { lat: number; lng: number };
}

// Bộ nhớ đệm Matrix khoảng cách/thời gian đường đi thực tế (Key: store_code:lat_4:lng_4, TTL: 24 giờ)
const matrixCache = new Map<
  string,
  { roadKm: number; durationMin: number; timestamp: number; isFallback?: boolean }
>();
// Kết quả ước lượng (OSRM lỗi/timeout) chỉ giữ 2 phút để lần sau thử lại đường đi thật
const FALLBACK_CACHE_TTL_MS = 2 * 60 * 1000;

/** Thời gian chạy xe máy: không nhanh hơn 20 km/h trong đô thị (OSRM tính theo ô tô đường trống) */
function motorbikeMinutes(roadKm: number, osrmSeconds?: number): number {
  const byCitySpeed = Math.round((roadKm / 20) * 60);
  const byOsrm = typeof osrmSeconds === 'number' ? Math.round(osrmSeconds / 60) : 0;
  return Math.max(1, byCitySpeed, byOsrm);
}

/**
 * Lấy quãng đường thực tế từ khách tới nhiều cửa hàng trong 1 lần gọi (OSRM Table API),
 * ghi vào bộ nhớ đệm để getRoadDistanceAndDuration dùng lại. Lỗi thì bỏ qua (từng cửa hàng tự xử lý).
 */
async function prefetchRoadMatrix(
  originLat: number,
  originLng: number,
  stores: Array<{ code: string; sLat: number; sLng: number }>
): Promise<boolean> {
  const pending = stores.filter((s) => {
    const cached = matrixCache.get(`${s.code}:${originLat.toFixed(4)}:${originLng.toFixed(4)}`);
    return !cached || cached.isFallback || Date.now() - cached.timestamp >= CACHE_TTL_MS;
  });
  if (pending.length === 0) return true;
  try {
    const coords = [`${originLng},${originLat}`, ...pending.map((s) => `${s.sLng},${s.sLat}`)].join(';');
    const url = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance,duration`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'ThaiSonFoods-Routing/1.0' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    // OSRM trả code "Ok" (không phải "OK")
    if (String(data?.code).toLowerCase() !== 'ok') return false;
    const distances: Array<number | null> = data.distances?.[0] || [];
    const durations: Array<number | null> = data.durations?.[0] || [];
    pending.forEach((s, i) => {
      const meters = distances[i + 1];
      if (typeof meters !== 'number') return;
      const roadKm = Math.round((meters / 1000) * 10) / 10;
      const sec = durations[i + 1];
      matrixCache.set(`${s.code}:${originLat.toFixed(4)}:${originLng.toFixed(4)}`, {
        roadKm,
        durationMin: motorbikeMinutes(roadKm, typeof sec === 'number' ? sec : undefined),
        timestamp: Date.now(),
      });
    });
    return true;
  } catch {
    // Mạng lỗi / timeout: dùng ước lượng, không gọi lại từng cửa hàng (tránh khách chờ lâu)
    return false;
  }
}
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Lấy hệ số giờ cao điểm tại Việt Nam (UTC+7)
 * Mặc định: 07:00 - 09:00 và 16:30 - 19:00 nhân 1.4
 */
export function getPeakHourMultiplier(date: Date = new Date()): number {
  // Chuyển sang giờ Việt Nam (UTC+7)
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const vnTotalMinutes = ((utcHours + 7) % 24) * 60 + utcMinutes;

  const morningStart = 7 * 60; // 07:00
  const morningEnd = 9 * 60; // 09:00
  const afternoonStart = 16 * 60 + 30; // 16:30
  const afternoonEnd = 19 * 60; // 19:00

  if (
    (vnTotalMinutes >= morningStart && vnTotalMinutes <= morningEnd) ||
    (vnTotalMinutes >= afternoonStart && vnTotalMinutes <= afternoonEnd)
  ) {
    return 1.4;
  }
  return 1.0;
}

/**
 * Tính phí vận chuyển theo quãng đường thực tế & giá trị đơn hàng
 * 0–3 km: 15.000đ; 3–7 km: 25.000đ; trên 7 km: +4.000đ/km; freeship đơn từ 300.000đ trong 5 km
 */
export function calculateShippingFee(roadKm: number, orderSubtotal: number = 0): number {
  if (orderSubtotal >= 300000 && roadKm <= 5.0) {
    return 0; // Freeship theo chính sách
  }

  if (roadKm <= 3.0) {
    return 15000;
  }
  if (roadKm <= 7.0) {
    return 25000;
  }

  const extraKm = Math.ceil(roadKm - 7.0);
  return 25000 + extraKm * 4000;
}

/**
 * Phân giải ma trận khoảng cách đường đi thực tế & thời gian (OSRM Matrix API kèm fallback)
 */
export async function getRoadDistanceAndDuration(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  storeCode: string
): Promise<{ roadKm: number; durationMin: number; isFallback: boolean }> {
  const straightKm = calculateHaversineDistance(originLat, originLng, destLat, destLng);
  const cacheKey = `${storeCode}:${originLat.toFixed(4)}:${originLng.toFixed(4)}`;

  const cached = matrixCache.get(cacheKey);
  if (
    cached &&
    Date.now() - cached.timestamp < (cached.isFallback ? FALLBACK_CACHE_TTL_MS : CACHE_TTL_MS)
  ) {
    return { roadKm: cached.roadKm, durationMin: cached.durationMin, isFallback: !!cached.isFallback };
  }

  // 1. Thử gọi OSRM Driving Matrix (timeout 2500ms)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
    const res = await fetch(osrmUrl, {
      signal: AbortSignal.timeout(2500),
      headers: { 'User-Agent': 'ThaiSonFoods-Routing/1.0' },
    });

    if (res.ok) {
      const data = await res.json();
      // OSRM trả code "Ok" (không phải "OK"): so không phân biệt hoa thường
      if (String(data.code).toLowerCase() === 'ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        const roadKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMin = motorbikeMinutes(roadKm, route.duration);

        matrixCache.set(cacheKey, { roadKm, durationMin, timestamp: Date.now() });
        return { roadKm, durationMin, isFallback: false };
      }
    }
  } catch {
    // Fallback sang công thức nội suy khi timeout / offline
  }

  // 2. Fallback nội suy: Đường chim bay × 1.35 và vận tốc xe máy đô thị 20 km/h
  const roadKm = Math.round(straightKm * 1.35 * 10) / 10;
  const durationMin = motorbikeMinutes(roadKm);

  matrixCache.set(cacheKey, { roadKm, durationMin, timestamp: Date.now(), isFallback: true });
  return { roadKm, durationMin, isFallback: true };
}

/**
 * Kiểm tra trạng thái mở cửa của chi nhánh theo giờ Việt Nam
 */
export function checkStoreOpening(
  openingHours: any,
  prepMinutes: number = 15,
  roadDurationMinutes: number = 15,
  date: Date = new Date()
): { isOpen: boolean; closesAt: string | null; isClosingSoon: boolean; canFulfill: boolean; reason?: string } {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  // Giờ Việt Nam UTC+7
  const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const currentDay = days[vnDate.getUTCDay()];
  const currentTotalMinutes = vnDate.getUTCHours() * 60 + vnDate.getUTCMinutes();

  const defaultHours = { open: '07:00', close: '21:30' };
  const schedule = (openingHours && openingHours[currentDay]) || defaultHours;

  const [openH, openM] = (schedule.open || '07:00').split(':').map(Number);
  const [closeH, closeM] = (schedule.close || '21:30').split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const isOpen = currentTotalMinutes >= openMinutes && currentTotalMinutes < closeMinutes;
  const closesAt = schedule.close || '21:30';

  if (!isOpen) {
    return {
      isOpen: false,
      closesAt,
      isClosingSoon: false,
      canFulfill: false,
      reason: currentTotalMinutes < openMinutes ? `Chưa mở cửa (Mở lúc ${schedule.open})` : 'Đã đóng cửa hôm nay',
    };
  }

  // Cửa hàng phải còn mở đủ lâu: Thời điểm giao + prep + duration <= giờ đóng cửa - 15 phút
  const expectedDeliveryMinutes = currentTotalMinutes + prepMinutes + roadDurationMinutes;
  const remainingMinutes = closeMinutes - currentTotalMinutes;
  const isClosingSoon = remainingMinutes <= 45;

  if (expectedDeliveryMinutes > closeMinutes - 15) {
    return {
      isOpen: true,
      closesAt,
      isClosingSoon,
      canFulfill: false,
      reason: `Sắp đóng cửa lúc ${closesAt} (Không kịp thời gian chuẩn bị và giao hàng)`,
    };
  }

  return {
    isOpen: true,
    closesAt,
    isClosingSoon,
    canFulfill: true,
  };
}

/**
 * Thuật toán xếp hạng toàn diện tất cả chi nhánh để chọn ra chi nhánh tối ưu nhất
 */
export async function recommendStore(input: RecommenderInput): Promise<RecommendationResult> {
  const { lat, lng, mode = 'delivery', cartItems = [], previousStoreCode } = input;

  // 1. Tải danh sách tất cả các cửa hàng đang kích hoạt trong CSDL
  const storesRes = await query(`
    SELECT
      id, code, name, address, phone, province, district, ward,
      latitude, longitude, area_label, province_code, address_new, address_old,
      supports_delivery, supports_pickup, delivery_radius_km, prep_minutes,
      max_active_orders, opening_hours, holiday_overrides, is_accepting_orders,
      paused_until, pause_reason
    FROM stores
    WHERE is_active = true;
  `);

  const stores = storesRes.rows;
  if (stores.length === 0) {
    return { recommended: null, alternatives: [], others: [], unavailable: [], userCoords: { lat, lng } };
  }

  // 2. Tính khoảng cách đường chim bay sơ bộ & lọc K = 6 cửa hàng gần nhất
  const storeDistances = stores.map((s) => {
    const sLat = s.latitude ? Number(s.latitude) : 10.7769;
    const sLng = s.longitude ? Number(s.longitude) : 106.7009;
    const straightKm = calculateHaversineDistance(lat, lng, sLat, sLng);
    return { store: s, sLat, sLng, straightKm };
  });

  storeDistances.sort((a, b) => a.straightKm - b.straightKm);

  // K = 6 cửa hàng gần nhất
  const topCandidates = storeDistances.slice(0, 6);
  const peakMultiplier = getPeakHourMultiplier();

  // Lấy quãng đường thật tới các cửa hàng gần nhất trong 1 lần gọi (thay vì gọi lần lượt từng cửa hàng)
  const roadMatrixOk = await prefetchRoadMatrix(
    lat,
    lng,
    topCandidates.map((c) => ({ code: c.store.code, sLat: c.sLat, sLng: c.sLng }))
  );

  // Tổng tiền giỏ hàng theo giá thật khách gửi lên (thiếu giá thì ước 35.000đ/món)
  const subtotalEstimate = cartItems.reduce(
    (acc, it) =>
      acc + (it.quantity || 1) * (typeof it.price === 'number' && it.price > 0 ? it.price : 35000),
    0
  );

  const processedItems: StoreRecommendationItem[] = [];
  const unavailableItems: Array<{ store: Partial<StoreRecommendationItem>; reason: string }> = [];

  for (const item of storeDistances) {
    const s = item.store;
    const isTopCandidate = topCandidates.some((c) => c.store.id === s.id);

    // Tính quãng đường thực tế (ưu tiên matrix cho top 6, còn lại ước lượng)
    let roadKm: number;
    let durationMin: number;

    if (isTopCandidate && roadMatrixOk) {
      const road = await getRoadDistanceAndDuration(lat, lng, item.sLat, item.sLng, s.code);
      roadKm = road.roadKm;
      durationMin = road.durationMin;
    } else {
      roadKm = Math.round(item.straightKm * 1.35 * 10) / 10;
      durationMin = motorbikeMinutes(roadKm);
    }

    const prepMin = s.prep_minutes ? Number(s.prep_minutes) : 15;
    const openingCheck = checkStoreOpening(s.opening_hours, prepMin, durationMin);
    const maxRadiusKm = s.delivery_radius_km ? Number(s.delivery_radius_km) : 10.0;

    // Kiểm tra hàng tồn kho cho chi nhánh này
    let missingItemsCount = 0;
    let stockStatus: 'full' | 'partial' | 'out_of_stock' | 'unknown' = 'unknown';

    if (cartItems.length > 0) {
      try {
        const stockChecks = await Promise.all(
          cartItems.map(async (ci) => {
            const sellable = await getSellableQuantity(s.code, ci.productId);
            return sellable >= ci.quantity;
          })
        );
        const inStockCount = stockChecks.filter(Boolean).length;
        if (inStockCount === cartItems.length) {
          stockStatus = 'full';
        } else if (inStockCount > 0) {
          stockStatus = 'partial';
          missingItemsCount = cartItems.length - inStockCount;
        } else {
          stockStatus = 'out_of_stock';
          missingItemsCount = cartItems.length;
        }
      } catch {
        stockStatus = 'unknown';
      }
    }

    // Kiểm tra điều kiện phục vụ
    let canDeliver = true;
    let rejectReason: string | undefined = undefined;

    if (!s.is_accepting_orders) {
      canDeliver = false;
      rejectReason = s.pause_reason || 'Chi nhánh đang tạm ngưng nhận đơn';
    } else if (!openingCheck.canFulfill) {
      canDeliver = false;
      rejectReason = openingCheck.reason;
    } else if (mode === 'delivery' && roadKm > maxRadiusKm) {
      canDeliver = false;
      rejectReason = `Vượt quá bán kính giao hàng (${roadKm} km > ${maxRadiusKm} km)`;
    }

    // Tính ETA: prep + duration × hệ số giờ cao điểm
    const etaMinutes = Math.round(prepMin + durationMin * peakMultiplier);
    // Cùng chính sách phí với lúc đặt đơn (/api/orders) để phí khách thấy khi chọn cửa hàng = phí thật bị tính
    // (server tính km theo đường chim bay nên ở đây cũng dùng straightKm)
    const shippingFee = calculatePolicyShippingFee(subtotalEstimate, item.straightKm).fee;

    // Tính điểm xếp hạng (Mục 18.3: Điểm càng thấp càng ưu tiên)
    // Điểm = ETA + 15 × số món thiếu + 2 × đơn quá tải + 10 nếu sắp đóng cửa
    let score = etaMinutes;
    score += missingItemsCount * 15;
    if (openingCheck.isClosingSoon) score += 10;
    if (previousStoreCode && previousStoreCode === s.code) score -= 3; // Ưu tiên nhẹ cửa hàng khách từng chọn

    // Huy hiệu nhận diện thông minh
    const badges: string[] = [];
    if (stockStatus === 'full') badges.push('Đủ hàng');
    if (shippingFee === 0) badges.push('Freeship');

    const storeItem: StoreRecommendationItem = {
      id: s.id,
      code: s.code,
      name: s.name,
      areaLabel: s.area_label || s.district || 'Hệ thống TSF',
      addressNew: s.address_new || s.address,
      addressOld: s.address_old || s.address,
      phone: s.phone || '02871000472',
      lat: item.sLat,
      lng: item.sLng,
      straightKm: item.straightKm,
      roadKm,
      etaMinutes,
      shippingFee,
      canDeliver,
      rejectReason,
      isOpen: openingCheck.isOpen,
      closesAt: openingCheck.closesAt,
      isClosingSoon: openingCheck.isClosingSoon,
      stockStatus,
      missingItemsCount,
      badges,
      score,
    };

    if (canDeliver) {
      processedItems.push(storeItem);
    } else {
      unavailableItems.push({ store: storeItem, reason: rejectReason || 'Không thể phục vụ' });
    }
  }

  // 3. Sắp xếp các cửa hàng hợp lệ theo điểm Score tăng dần
  processedItems.sort((a, b) => a.score - b.score);

  // Gắn nhãn badge cho Top đề xuất
  if (processedItems.length > 0) {
    processedItems[0].badges.unshift('Đề xuất');

    // Tìm cửa hàng gần nhất và nhanh nhất
    const nearest = [...processedItems].sort((a, b) => a.roadKm - b.roadKm)[0];
    const fastest = [...processedItems].sort((a, b) => a.etaMinutes - b.etaMinutes)[0];

    if (nearest && nearest.id !== processedItems[0].id) {
      nearest.badges.push('Gần nhất');
    }
    if (fastest && fastest.id !== processedItems[0].id) {
      fastest.badges.push('Giao nhanh nhất');
    }
  }

  const recommended = processedItems.length > 0 ? processedItems[0] : null;
  const alternatives = processedItems.slice(1, 4); // Tối đa 3 gợi ý thay thế
  const others = processedItems.slice(4);

  return {
    recommended,
    alternatives,
    others,
    unavailable: unavailableItems,
    userCoords: { lat, lng },
  };
}
