import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSellableQuantity } from '@/lib/inventory';
import { INVENTORY_CONFIG } from '@/config/inventory';
import { hcmStoreSql } from '@/config/service-area';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const province = searchParams.get('province');
    const district = searchParams.get('district');

    let sql = `
      SELECT 
        s.id,
        s.code,
        s.name,
        s.address,
        s.phone,
        s.province,
        s.district,
        s.ward,
        s.map_url,
        s.latitude,
        s.longitude,
        s.region,
        s.status,
        s.area_label,
        s.province_code,
        s.address_new,
        s.address_old,
        s.supports_delivery,
        s.supports_pickup,
        s.delivery_radius_km,
        s.prep_minutes,
        s.is_accepting_orders,
        s.opening_hours,
        s.holiday_overrides
      FROM stores s
      WHERE s.is_active = true AND ${hcmStoreSql('s')}
    `;
    const params: any[] = [];

    if (province && province !== 'ALL') {
      params.push(province);
      sql += ` AND s.province = $${params.length}`;
    }

    if (district && district !== 'ALL') {
      params.push(district);
      sql += ` AND s.district = $${params.length}`;
    }

    sql += ` ORDER BY s.code ASC;`;

    const res = await query(sql, params);

    // Tính tồn bán được bằng hàm chuẩn duy nhất getSellableQuantity (bóc tách combo và lốc theo bottle_multiplier)
    const sellableMap = new Map<string, number>();
    if (productId) {
      await Promise.all(
        res.rows.map(async (row) => {
          try {
            const sellable = await getSellableQuantity(row.code, productId);
            sellableMap.set(row.code, sellable);
          } catch (err) {
            console.warn(`[stores/route] Không thể tính tồn cho store ${row.code}, productId ${productId}:`, err);
            sellableMap.set(row.code, 0);
          }
        })
      );
    }

    const stores = res.rows.map((row) => {
      let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | undefined = undefined;
      let sellableQuantity: number | undefined = undefined;

      if (productId) {
        const available = sellableMap.get(row.code) ?? 0;
        sellableQuantity = available;

        if (available <= 0) {
          stockStatus = 'out_of_stock';
        } else if (available <= INVENTORY_CONFIG.LOW_STOCK_THRESHOLD) {
          stockStatus = 'low_stock';
        } else {
          stockStatus = 'in_stock';
        }
      }

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        address: row.address,
        phone: row.phone || '02871000472',
        province: row.province || 'Hồ Chí Minh',
        district: row.district || '',
        ward: row.ward || '',
        mapUrl:
          row.map_url ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.address)}`,
        latitude: row.latitude ? Number(row.latitude) : null,
        longitude: row.longitude ? Number(row.longitude) : null,
        region: row.region || null,
        status: row.status ?? 1,
        areaLabel: row.area_label || null,
        provinceCode: row.province_code || null,
        addressNew: row.address_new || row.address,
        addressOld: row.address_old || row.address,
        supportsDelivery: row.supports_delivery ?? true,
        supportsPickup: row.supports_pickup ?? true,
        deliveryRadiusKm: row.delivery_radius_km ? Number(row.delivery_radius_km) : 10.0,
        prepMinutes: row.prep_minutes ? Number(row.prep_minutes) : 15,
        isAcceptingOrders: row.is_accepting_orders ?? true,
        openingHours: row.opening_hours || null,
        holidayOverrides: row.holiday_overrides || null,
        // Trạng thái kho và số lượng bán được hợp nhất
        stockStatus,
        sellableQuantity,
        availableQuantity: sellableQuantity,
      };
    });

    const hasStock = productId ? stores.some((s) => s.stockStatus !== 'out_of_stock') : undefined;

    return NextResponse.json({
      success: true,
      stores,
      hasStock,
      count: stores.length,
    });
  } catch (error: any) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tải danh sách cửa hàng. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}

