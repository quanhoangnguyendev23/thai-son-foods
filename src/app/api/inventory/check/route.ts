import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  getAvailability,
  getComboStockDetails,
  getSellableQuantity,
  cleanupExpiredReservationsThrottled,
} from '@/lib/inventory';
import { hcmStoreSql } from '@/config/service-area';
import { calculateHaversineDistance, estimateCoordinatesFromAddress } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeCode, items, lat, lng, latitude, longitude, province, district, address } = body;

    // 0. Quét dọn reservation quá hạn (tự throttle 60s)
    await cleanupExpiredReservationsThrottled();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: true,
        status: 'in_stock',
        maxQuantity: 999,
        lowCount: null,
        isAvailable: true,
        availableStock: 999,
        alternativeStores: [],
      });
    }

    const rawCode = (storeCode || 'NH').trim();
    const targetStoreCode = rawCode.startsWith('store_') ? rawCode.replace(/^store_/i, '') : rawCode;

    // Xác định tọa độ khách hàng (từ GPS hoặc ước tính từ địa chỉ)
    let customerCoords: { lat: number; lng: number } | null = null;
    const rawLat = typeof latitude === 'number' ? latitude : (typeof lat === 'number' ? lat : null);
    const rawLng = typeof longitude === 'number' ? longitude : (typeof lng === 'number' ? lng : null);

    if (rawLat !== null && rawLng !== null) {
      customerCoords = { lat: rawLat, lng: rawLng };
    } else if (province || district || address) {
      customerCoords = estimateCoordinatesFromAddress(province, district, address);
    }

    let status: 'in_stock' | 'low' | 'out' = 'out';
    let maxQuantity = 0;
    let isAvailable = false;

    // 1. Kiểm tra tồn bán được bằng hàm duy nhất getSellableQuantity (bóc tách combo, lốc và trừ safety_stock)
    const isSingleItem = items.length === 1;
    const singleReqQty = Math.max(1, Number(items[0]?.quantity) || 1);

    maxQuantity = await getSellableQuantity(targetStoreCode, isSingleItem ? items[0] : items);
    status = maxQuantity === 0 ? 'out' : maxQuantity <= 10 ? 'low' : 'in_stock';

    if (isSingleItem) {
      isAvailable = maxQuantity >= singleReqQty;
    } else {
      const avail = await getAvailability(targetStoreCode, items);
      isAvailable = avail.isAvailable && maxQuantity >= 1;
    }

    const lowCount = maxQuantity <= 10 && maxQuantity > 0 ? maxQuantity : null;

    // Báo thiếu theo từng dòng giỏ (đơn vị = gói/lốc của chính dòng đó). Chỉ tính khi toàn giỏ chưa đủ hàng.
    const shortItems: Array<{ productId: string; requested: number; maxQuantity: number }> = [];
    if (!isAvailable) {
      for (const it of items.slice(0, 30)) {
        const pid = typeof it?.productId === 'string' ? it.productId.trim() : '';
        if (!pid) continue;
        const requested = Math.max(1, Number(it.quantity) || 1);
        const itemMax = await getSellableQuantity(targetStoreCode, it);
        if (itemMax < requested) shortItems.push({ productId: pid, requested, maxQuantity: itemMax });
      }
    }

    // Giới hạn tối đa từng dòng (đơn vị gói/lốc của dòng đó) để UI chặn nút + / ô nhập ngay từ đầu
    const itemLimits: Array<{ productId: string; maxQuantity: number }> = [];
    for (const it of items.slice(0, 30)) {
      const pid = typeof it?.productId === 'string' ? it.productId.trim() : '';
      if (!pid) continue;
      itemLimits.push({ productId: pid, maxQuantity: await getSellableQuantity(targetStoreCode, it) });
    }

    // Tính khoảng cách chi nhánh hiện tại nếu có tọa độ
    let currentStoreDistanceKm: number | null = null;
    if (customerCoords) {
      const curStoreRes = await query(
        `SELECT latitude, longitude FROM stores WHERE code = $1 LIMIT 1;`,
        [targetStoreCode]
      );
      if (curStoreRes.rows.length > 0 && curStoreRes.rows[0].latitude && curStoreRes.rows[0].longitude) {
        currentStoreDistanceKm = calculateHaversineDistance(
          customerCoords.lat,
          customerCoords.lng,
          Number(curStoreRes.rows[0].latitude),
          Number(curStoreRes.rows[0].longitude)
        );
      }
    }

    // 2. Nếu chi nhánh hiện tại hết hàng hoặc không đủ số lượng, tìm các chi nhánh thay thế
    const alternativeStores: Array<{
      code: string;
      name: string;
      address: string;
      phone?: string;
      status: 'in_stock' | 'low' | 'out';
      distanceKm?: number;
    }> = [];

    if (!isAvailable || status === 'out') {
      const storesRes = await query(
        `SELECT code, name, address, phone, latitude, longitude FROM stores s WHERE s.is_active = true AND ${hcmStoreSql('s')} AND s.code != $1 ORDER BY s.code ASC;`,
        [targetStoreCode]
      );

      for (const store of storesRes.rows) {
        const storeMax = await getSellableQuantity(store.code, isSingleItem ? items[0] : items);
        const storeStatus: 'in_stock' | 'low' | 'out' =
          storeMax === 0 ? 'out' : storeMax <= 10 ? 'low' : 'in_stock';

        if (storeStatus !== 'out' && storeMax >= (isSingleItem ? singleReqQty : 1)) {
          let distKm: number | undefined = undefined;
          if (customerCoords && store.latitude && store.longitude) {
            distKm = calculateHaversineDistance(
              customerCoords.lat,
              customerCoords.lng,
              Number(store.latitude),
              Number(store.longitude)
            );
          }
          alternativeStores.push({
            code: store.code,
            name: store.name,
            address: store.address,
            phone: store.phone,
            status: storeStatus,
            distanceKm: distKm,
          });
        }
      }

      // Sắp xếp các chi nhánh thay thế theo khoảng cách gần nhất
      alternativeStores.sort((a, b) => {
        if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
          return a.distanceKm - b.distanceKm;
        }
        if (typeof a.distanceKm === 'number') return -1;
        if (typeof b.distanceKm === 'number') return 1;
        return 0;
      });
    }

    // 3. Nếu có tọa độ khách hàng, kiểm tra xem có chi nhánh nào GẦN HƠN và CÒN ĐỦ HÀNG để gợi ý
    let suggestedCloserStore: {
      code: string;
      name: string;
      address: string;
      phone?: string;
      distanceKm: number;
    } | null = null;

    if (customerCoords) {
      const otherStoresRes = await query(
        `SELECT code, name, address, phone, latitude, longitude
         FROM stores s
         WHERE s.is_active = true AND ${hcmStoreSql('s')} AND s.code != $1 AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL;`,
        [targetStoreCode]
      );

      // Tính khoảng cách cho từng chi nhánh và sắp xếp từ gần nhất đến xa nhất
      const candidates: Array<{
        code: string;
        name: string;
        address: string;
        phone?: string;
        distanceKm: number;
      }> = [];

      for (const st of otherStoresRes.rows) {
        const d = calculateHaversineDistance(
          customerCoords.lat,
          customerCoords.lng,
          Number(st.latitude),
          Number(st.longitude)
        );
        // Chỉ xét các chi nhánh gần hơn chi nhánh hiện tại (hoặc nếu chi nhánh hiện tại không có tọa độ)
        if (currentStoreDistanceKm === null || d < currentStoreDistanceKm) {
          candidates.push({
            code: st.code,
            name: st.name,
            address: st.address,
            phone: st.phone,
            distanceKm: d,
          });
        }
      }

      candidates.sort((a, b) => a.distanceKm - b.distanceKm);

      // Tìm chi nhánh gần nhất mà CÒN ĐỦ HÀNG cho giỏ hàng
      for (const cand of candidates) {
        const candMax = await getSellableQuantity(cand.code, isSingleItem ? items[0] : items);
        const candAvail = isSingleItem
          ? candMax >= singleReqQty
          : candMax >= 1 && (await getAvailability(cand.code, items)).isAvailable;

        if (candAvail) {
          suggestedCloserStore = cand;
          break; // Đã tìm thấy chi nhánh gần nhất và đủ hàng
        }
      }
    }

    // Response công khai: TUYỆT ĐỐI KHÔNG trả số chai thô, định mức hay chai nút thắt
    return NextResponse.json({
      success: true,
      storeCode: targetStoreCode,
      currentStoreDistanceKm,
      status, // 'in_stock' | 'low' | 'out'
      maxQuantity, // số lượng tối đa có thể đặt
      lowCount, // chỉ trả số khi <= 10
      isAvailable,
      itemLimits, // Tối đa từng dòng giỏ tại chi nhánh (gói/lốc)
      shortItems, // Dòng giỏ vượt số lượng bán được tại chi nhánh (rỗng nếu đủ hàng)
      availableStock: maxQuantity, // Tương thích ngược cho các component hiện có
      alternativeStores, // Chỉ tên, địa chỉ, trạng thái và khoảng cách khi kho hiện tại thiếu hàng
      suggestedCloserStore, // Gợi ý chi nhánh gần hơn & còn đủ hàng (nếu có)
    });
  } catch (error: any) {
    console.error('[Inventory Check API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi kiểm tra tồn kho. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
