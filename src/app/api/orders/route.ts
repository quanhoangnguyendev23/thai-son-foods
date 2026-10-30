import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { query, initDatabase, pool } from '@/lib/db';
import { getUserSession } from '@/lib/auth';
import { SERVICE_AREA, isHcmProvince, hcmStoreSql } from '@/config/service-area';
import { sendOrderEmail } from '@/lib/email/service';
import { ENABLE_COMBOS, ENABLE_CUSTOM_COMBOS } from '@/config/features';
import { checkRequestRateLimit, isTrackingCodeBlocked, recordFailedTrackingAttempt } from '@/lib/rateLimit';
import { getClientIp, UNKNOWN_CLIENT_IP } from '@/lib/runtimeConfig';

/** Số dòng sản phẩm tối đa trong 1 đơn (sau đó mới gộp dòng trùng) */
const MAX_ORDER_LINES = 50;

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>?/gm, '').trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 0. Nhận diện tài khoản người dùng nếu có đăng nhập (Không bắt buộc)
    // userId CHỈ lấy từ session cookie, không tin body.userId/body.user_id (tránh giả mạo tài khoản khác)
    let userId: string | null = null;
    try {
      const userSession = await getUserSession();
      if (userSession?.id) {
        userId = userSession.id;
      }
    } catch {
      // Guest checkout
    }

    // 1. Mã đơn hàng LUÔN do server sinh (bỏ qua body.orderCode/body.order_code để chống chèn HTML/giả mạo mã)
    const initialOrderCode = `TSF-${Date.now().toString().slice(-4)}${crypto.randomInt(1000, 9999)}`;
    let orderCode = initialOrderCode;

    // 2. Chuẩn hóa thông tin người nhận
    const customerObj = body.customer || {};
    const rawFullName = (body.fullName || body.customerName || body.full_name || customerObj.fullName || customerObj.full_name || 'Khách hàng').toString();
    const fullName = stripHtml(rawFullName).slice(0, 100) || 'Khách hàng';
    const phone = (body.phone || body.customerPhone || customerObj.phone || '').toString().trim().slice(0, 20);
    const rawEmail = body.email || body.customerEmail || customerObj.email || null;
    const email = rawEmail ? stripHtml(rawEmail.toString()).slice(0, 100) : null;

    // 3. Chuẩn hóa địa chỉ giao hàng
    const uncleanedAddress = (body.address || body.shippingAddress || customerObj.address || '').toString();
    const rawAddress = stripHtml(uncleanedAddress).slice(0, 255);
    const address = rawAddress || 'Địa chỉ liên hệ qua điện thoại';
    const province = stripHtml((body.province || customerObj.province || 'Đặt hàng nhanh').toString()).slice(0, 100);
    if (!isHcmProvince(province)) {
      return NextResponse.json({ success: false, error: SERVICE_AREA.MESSAGE_VI }, { status: 400 });
    }
    const district = stripHtml((body.district || customerObj.district || '').toString()).slice(0, 100);
    const ward = stripHtml((body.ward || customerObj.ward || '').toString()).slice(0, 100);
    const rawNote = body.note || customerObj.note || (body.shippingAddress ? 'Đơn đặt hàng nhanh COD' : null);
    const note = rawNote ? stripHtml(rawNote.toString()).slice(0, 500) : null;
    const storeCode = body.storeCode || body.store_code || customerObj.storeCode || customerObj.store_code || null;
    const storeAddress = body.storeAddress || body.store_address || customerObj.storeAddress || customerObj.store_address || null;
    // Backend kiểm tra tọa độ hữu hạn: latitude [-90, 90], longitude [-180, 180], cả hai phải hợp lệ đồng thời
    const rawLatInput = typeof body.latitude === 'number' ? body.latitude : (typeof body.lat === 'number' ? body.lat : null);
    const rawLngInput = typeof body.longitude === 'number' ? body.longitude : (typeof body.lng === 'number' ? body.lng : null);

    let rawLat: number | null = null;
    let rawLng: number | null = null;

    if (
      typeof rawLatInput === 'number' &&
      typeof rawLngInput === 'number' &&
      Number.isFinite(rawLatInput) &&
      Number.isFinite(rawLngInput) &&
      rawLatInput >= -90 &&
      rawLatInput <= 90 &&
      rawLngInput >= -180 &&
      rawLngInput <= 180
    ) {
      rawLat = rawLatInput;
      rawLng = rawLngInput;
    }

    const clientConfirmed = Boolean(body.locationConfirmed ?? body.location_confirmed);
    const clientConfirmedBy = (body.locationConfirmedBy || body.location_confirmed_by)?.toString().slice(0, 50) || null;

    // Chỉ coi là xác nhận ghim nếu tọa độ hợp lệ VÀ khách hàng xác nhận thực tế qua modal ghim bản đồ
    const locationConfirmed = Boolean(rawLat !== null && rawLng !== null && clientConfirmed && clientConfirmedBy === 'USER_MAP_PIN');
    const locationConfirmedBy = rawLat !== null && rawLng !== null
      ? (locationConfirmed ? 'USER_MAP_PIN' : (clientConfirmedBy || 'USER_GEOCODE'))
      : null;
    const saveDefaultAddress = Boolean(body.saveDefaultAddress);
    const addressNew = body.addressNew || body.address_new || null;
    const addressOld = body.addressOld || body.address_old || null;
    const recommendedStoreId = (body.recommendedStoreId || body.recommended_store_id || null)?.toString().slice(0, 50) || null;
    const wasOverridden = Boolean(body.wasOverridden ?? body.was_overridden ?? (recommendedStoreId && storeCode && recommendedStoreId !== storeCode));
    const rankingSnapshot = body.rankingSnapshot ? JSON.stringify(body.rankingSnapshot) : null;

    // 4. Chuẩn hóa phương thức & phí
    // Trang thanh toán khách hàng hiện chỉ hỗ trợ COD (chuyển khoản chỉ có ở luồng đại lý /api/dealer/orders).
    // Phương thức lạ bị từ chối để không lách được các kiểm tra riêng của COD (độ dài địa chỉ, giá trị tối đa).
    const SUPPORTED_PAYMENT_METHODS = ['cod'];
    const paymentMethod = String(body.paymentMethod || customerObj.paymentMethod || 'cod').trim().toLowerCase();
    if (!SUPPORTED_PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Phương thức thanh toán không được hỗ trợ. Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).' },
        { status: 400 }
      );
    }
    const shippingFee = Math.round(Number(body.shippingFee) || 0);

    // 5. Chuẩn hóa danh sách sản phẩm
    const rawItems = Array.isArray(body.items) ? body.items : [];
    // Giỏ hàng phải có 1–50 dòng: chặn đơn rỗng và mảng items khổng lồ làm nghẽn giao dịch đặt hàng
    if (rawItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Giỏ hàng trống, vui lòng chọn sản phẩm.' }, { status: 400 });
    }
    if (rawItems.length > MAX_ORDER_LINES) {
      return NextResponse.json(
        { success: false, error: `Mỗi đơn hàng tối đa ${MAX_ORDER_LINES} dòng sản phẩm. Vui lòng gộp hoặc tách đơn.` },
        { status: 400 }
      );
    }
    let itemsCalculatedSubtotal = 0;
    const parsedItems = rawItems.map((item: any) => {
      const name = (item.name || item.productName || item.title || 'Sản phẩm').toString();
      const price = Math.round(Number(item.price) || 0);
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
      const unit = item.unit || 'Lốc';
      const thumbnail = item.thumbnail || null;
      const productId = item.productId || item.id || null;
      itemsCalculatedSubtotal += price * quantity;
      return {
        productId,
        name,
        price,
        quantity,
        unit,
        thumbnail,
      };
    });
    // Gộp các dòng trùng productId (productId đã gồm quy cách, vd "<id>-<variantId>") thành 1 dòng cộng số lượng
    const normalizedItems: typeof parsedItems = [];
    const lineByProduct = new Map<string, (typeof parsedItems)[number]>();
    for (const it of parsedItems) {
      const key = it.productId ? String(it.productId) : null;
      const existing = key ? lineByProduct.get(key) : undefined;
      if (existing) {
        existing.quantity += it.quantity;
      } else {
        const line = { ...it };
        normalizedItems.push(line);
        if (key) lineByProduct.set(key, line);
      }
    }

    const subtotal = Math.round(
      Number(body.subtotal ?? (body.totalAmount ?? itemsCalculatedSubtotal)) || 0
    );
    const total = Math.round(
      Number(body.total ?? (subtotal + shippingFee)) || (subtotal + shippingFee)
    );

    if (!fullName || !phone) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp đầy đủ họ tên và số điện thoại!' },
        { status: 400 }
      );
    }

    // ── COD VALIDATION & ANTI-ABUSE ──────────────────────────────
    const { INVENTORY_CONFIG: INV_CFG } = await import('@/config/inventory');
    const codConfig = INV_CFG.COD_VALIDATION;

    // V1: Kiểm tra định dạng số điện thoại Việt Nam
    const cleanPhone = phone.replace(/[\s\-\.]/g, '');
    if (!codConfig.PHONE_REGEX.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Số điện thoại không hợp lệ. Vui lòng nhập SĐT Việt Nam (VD: 0123456789)' },
        { status: 400 }
      );
    }

    // V2: Kiểm tra địa chỉ tối thiểu (COD bắt buộc có địa chỉ giao hàng)
    if (paymentMethod === 'cod' && rawAddress.length < codConfig.MIN_ADDRESS_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Địa chỉ giao hàng quá ngắn (tối thiểu ${codConfig.MIN_ADDRESS_LENGTH} ký tự). Vui lòng nhập địa chỉ chi tiết để shipper giao hàng.` },
        { status: 400 }
      );
    }

    // V3: Kiểm tra giá trị đơn COD tối đa (chặn sớm theo tổng client gửi; kiểm tra chính thức theo serverTotal ở bước tính giá)
    if (paymentMethod === 'cod' && total > codConfig.MAX_ORDER_VALUE) {
      return NextResponse.json(
        {
          success: false,
          error: `Đơn hàng COD không được vượt quá ${codConfig.MAX_ORDER_VALUE.toLocaleString('vi-VN')} ₫. Vui lòng liên hệ hotline để đặt đơn lớn hoặc chọn phương thức thanh toán khác.`,
          maxValue: codConfig.MAX_ORDER_VALUE,
        },
        { status: 400 }
      );
    }

    // V4: Kiểm tra số đơn PENDING cùng SĐT (chống spam)
    const pendingCheck = await query(
      `SELECT COUNT(*) AS cnt FROM orders WHERE phone = $1 AND status = 'PENDING';`,
      [cleanPhone]
    );
    if (Number(pendingCheck.rows[0]?.cnt) >= codConfig.MAX_PENDING_ORDERS_PER_PHONE) {
      return NextResponse.json(
        {
          success: false,
          error: `Bạn đang có ${codConfig.MAX_PENDING_ORDERS_PER_PHONE} đơn hàng đang chờ xử lý. Vui lòng chờ đơn hiện tại được xác nhận trước khi đặt thêm.`,
        },
        { status: 429 }
      );
    }

    // V5: Kiểm tra khoảng cách thời gian giữa 2 đơn cùng SĐT
    const recentCheck = await query(
      `SELECT created_at FROM orders WHERE phone = $1 ORDER BY created_at DESC LIMIT 1;`,
      [cleanPhone]
    );
    if (recentCheck.rows.length > 0) {
      const lastOrderTime = new Date(recentCheck.rows[0].created_at);
      const nowMs = Date.now();
      const diffMinutes = (nowMs - lastOrderTime.getTime()) / 60000;
      if (diffMinutes < codConfig.MIN_ORDER_INTERVAL_MINUTES) {
        const waitSec = Math.ceil((codConfig.MIN_ORDER_INTERVAL_MINUTES - diffMinutes) * 60);
        return NextResponse.json(
          {
            success: false,
            error: `Vui lòng chờ ${waitSec} giây trước khi đặt đơn tiếp theo.`,
          },
          { status: 429 }
        );
      }
    }

    // Đảm bảo bảng và cấu trúc schema tồn tại
    await initDatabase();

    const client = await pool.connect();
    try {
      // 1. Tự động dọn dẹp các reservation đã quá hạn trước khi kiểm tra tồn
      const {
        cleanupExpiredReservations,
        expandComboItems,
        reserveStock,
        resolveProductCanonical,
        InsufficientStockError,
      } = await import('@/lib/inventory');
      const { INVENTORY_CONFIG } = await import('@/config/inventory');

      await cleanupExpiredReservations(client);

      // 2. Xác định chi nhánh phục vụ
      let targetStoreCode = storeCode;
      let targetStoreAddress = storeAddress;
      let targetStoreLat: number | null = null;
      let targetStoreLng: number | null = null;

      const { estimateCoordinatesFromAddress, calculateHaversineDistance, findNearestStore } = await import('@/lib/geo');
      let customerCoords: { lat: number; lng: number } | null = null;
      if (rawLat !== null && rawLng !== null) {
        customerCoords = { lat: rawLat, lng: rawLng };
      } else if (province || district || address) {
        customerCoords = estimateCoordinatesFromAddress(province, district, address);
      }

      if (targetStoreCode) {
        // Chi nhánh khách chọn phải tồn tại, đang hoạt động và thuộc khu vực phục vụ (TP.HCM)
        const storeRes = await client.query(
          `SELECT code, name, address, latitude, longitude FROM stores s
            WHERE s.code = $1 AND s.is_active = true AND ${hcmStoreSql('s')} LIMIT 1;`,
          [targetStoreCode]
        );
        if (storeRes.rows.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'Chi nhánh đã chọn không còn phục vụ. Vui lòng chọn lại chi nhánh giao hàng.',
              code: 'INVALID_STORE',
            },
            { status: 400 }
          );
        }
        targetStoreCode = storeRes.rows[0].code;
        if (!targetStoreAddress) targetStoreAddress = storeRes.rows[0].address;
        targetStoreLat = storeRes.rows[0].latitude ? Number(storeRes.rows[0].latitude) : null;
        targetStoreLng = storeRes.rows[0].longitude ? Number(storeRes.rows[0].longitude) : null;
      } else {
        const allStoresRes = await client.query(
          `SELECT code, name, address, latitude, longitude FROM stores s WHERE s.is_active = true AND ${hcmStoreSql('s')} ORDER BY code ASC;`
        );
        if (allStoresRes.rows.length > 0) {
          if (customerCoords) {
            const nearest = findNearestStore(allStoresRes.rows, customerCoords.lat, customerCoords.lng);
            if (nearest) {
              targetStoreCode = nearest.store.code;
              targetStoreAddress = nearest.store.address;
              targetStoreLat = nearest.store.latitude ? Number(nearest.store.latitude) : null;
              targetStoreLng = nearest.store.longitude ? Number(nearest.store.longitude) : null;
            }
          }
          if (!targetStoreCode) {
            targetStoreCode = allStoresRes.rows[0].code;
            targetStoreAddress = allStoresRes.rows[0].address;
            targetStoreLat = allStoresRes.rows[0].latitude ? Number(allStoresRes.rows[0].latitude) : null;
            targetStoreLng = allStoresRes.rows[0].longitude ? Number(allStoresRes.rows[0].longitude) : null;
          }
        } else {
          targetStoreCode = 'NH';
        }
      }

      // 3. SERVER TỰ TÍNH LẠI GIÁ (không tin client)
      let serverCalculatedSubtotal = 0;
      const revalidatedItems = [];

      const { extractBottleMultiplier } = await import('@/lib/inventory');
      const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

      for (const rawItem of normalizedItems) {
        const pId = rawItem.productId;
        let itemPrice = rawItem.price;
        // Tên/đơn vị do trình duyệt gửi chỉ dùng cho combo tự chọn (đang chờ xử lý riêng) và luôn được lọc HTML
        let itemName = stripHtml(rawItem.name.toString()).slice(0, 255) || 'Sản phẩm';
        let itemUnit = rawItem.unit ? stripHtml(rawItem.unit.toString()).slice(0, 50) : rawItem.unit;
        let canonicalProductId: string | null = null;
        let bottleMultiplier = 1;
        // Ảnh dòng hàng lấy từ DB; combo tự chọn chỉ nhận đường dẫn ảnh nội bộ (/images/...), không nhận URL ngoài
        const rawThumb = typeof rawItem.thumbnail === 'string' ? rawItem.thumbnail.trim() : '';
        let itemThumbnail: string | null = /^\/(?!\/)[\w\-./%]+$/.test(rawThumb) ? rawThumb.slice(0, 500) : null;

        // Kiểm tra nếu là combo có trong DB
        if (pId && (pId.startsWith('combo-') || pId.includes('combo'))) {
          // Doanh nghiệp chưa chốt combo nào → tạm ngưng toàn bộ combo (kể cả combo trong bảng combos)
          if (!ENABLE_COMBOS) {
            return NextResponse.json(
              { success: false, error: 'Combo đang tạm ngưng, vui lòng chọn sản phẩm lẻ.' },
              { status: 400 }
            );
          }
          const comboRes = await client.query(
            `SELECT name, sale_price, image FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;`,
            [pId]
          );
          if (comboRes.rows.length > 0) {
            itemPrice = comboRes.rows[0].sale_price;
            itemName = comboRes.rows[0].name;
            itemThumbnail = comboRes.rows[0].image || null;
          } else if (!ENABLE_CUSTOM_COMBOS) {
            // B0: combo tự chọn (không có trong bảng combos) tạm ngưng — không bao giờ nhận giá do trình duyệt gửi
            return NextResponse.json(
              { success: false, error: 'Combo đang tạm ngưng, vui lòng chọn sản phẩm lẻ.' },
              { status: 400 }
            );
          }
        } else {
          // Là sản phẩm đơn hoặc variant: giá, tên, đơn vị và hệ số chai đều lấy từ DB
          const prodInfo = pId ? await resolveProductCanonical(pId, undefined, client) : null;
          if (!prodInfo) {
            return NextResponse.json(
              {
                success: false,
                error: `Không nhận dạng được sản phẩm trong giỏ hàng (mã "${String(pId || '').slice(0, 80)}"). Vui lòng xóa sản phẩm này khỏi giỏ và thêm lại.`,
              },
              { status: 400 }
            );
          }
          canonicalProductId = prodInfo.id;
          const thumbRes = await client.query('SELECT thumbnail FROM products WHERE id = $1 LIMIT 1;', [prodInfo.id]);
          itemThumbnail = thumbRes.rows[0]?.thumbnail || null;

          if (prodInfo.variant) {
            const v = prodInfo.variant;
            // Nguồn chuẩn của số chai là product_variants.bottle_multiplier (admin bắt buộc nhập > 0).
            // Từ chối nếu lệch với quantity để không bán/giữ chỗ sai số chai khi dữ liệu quy cách bị nhập sai.
            if (!v.bottleMultiplier || v.bottleMultiplier <= 0 || (v.quantity && v.quantity > 0 && v.quantity !== v.bottleMultiplier)) {
              console.error('[Orders] Variant bottle_multiplier không hợp lệ:', v);
              return NextResponse.json(
                {
                  success: false,
                  error: `Quy cách "${v.name}" đang được cấu hình sai số chai. Vui lòng liên hệ hotline để được hỗ trợ.`,
                },
                { status: 400 }
              );
            }
            bottleMultiplier = v.bottleMultiplier;
            itemPrice = v.price;
            const variantLabel = [capitalize(v.unit || ''), v.name].filter(Boolean).join(' ');
            itemName = `${prodInfo.name} (${variantLabel})`;
            itemUnit = variantLabel;
          } else {
            try {
              // Hệ số chai chỉ suy ra từ mã sản phẩm và đơn vị trong DB, không dùng tên/đơn vị từ trình duyệt
              bottleMultiplier = extractBottleMultiplier(pId || '', prodInfo.unit);
            } catch {
              return NextResponse.json(
                { success: false, error: `Không xác định được quy cách đóng gói của sản phẩm "${prodInfo.name}".` },
                { status: 400 }
              );
            }
            itemPrice = prodInfo.price * bottleMultiplier;
            itemName = bottleMultiplier > 1 ? `${prodInfo.name} (Lốc ${bottleMultiplier} chai)` : prodInfo.name;
            itemUnit = bottleMultiplier > 1 ? `Lốc ${bottleMultiplier} chai` : prodInfo.unit;
          }
        }

        serverCalculatedSubtotal += itemPrice * rawItem.quantity;
        revalidatedItems.push({
          ...rawItem,
          name: itemName,
          unit: itemUnit,
          price: itemPrice,
          thumbnail: itemThumbnail,
          canonicalProductId,
          bottleMultiplier,
        });
      }

      // 4. SERVER TỰ TÍNH PHÍ VẬN CHUYỂN
      const { calculateShippingFee } = await import('@/config/inventory');
      let customerDistanceKm: number | null = null;
      if (customerCoords && targetStoreLat !== null && targetStoreLng !== null) {
        customerDistanceKm = calculateHaversineDistance(
          customerCoords.lat,
          customerCoords.lng,
          targetStoreLat,
          targetStoreLng
        );
      }
      const shippingCalc = calculateShippingFee(serverCalculatedSubtotal, customerDistanceKm);
      if (shippingCalc.isBeyondRadius && INVENTORY_CONFIG.SHIPPING.DISTANCE_BASED.ENABLED) {
        return NextResponse.json(
          {
            success: false,
            error: shippingCalc.reason || 'Địa chỉ giao hàng nằm ngoài bán kính phục vụ.',
          },
          { status: 400 }
        );
      }
      const serverShippingFee = shippingCalc.fee;
      const serverTotal = serverCalculatedSubtotal + serverShippingFee;

      // 5. BÓC TÁCH COMBO VÀ CHUẨN BỊ ĐƠN HÀNG
      const { expandedBottles, comboSnapshots } = await expandComboItems(revalidatedItems, client);

      // RÀNG BUỘC SỐ LƯỢNG TỐI ĐA 1.000 CHAI TRÊN TOÀN BỘ ĐƠN HÀNG
      const totalBottlesInOrder = expandedBottles.reduce((sum: number, b: any) => sum + (Number(b.bottleQuantity) || 0), 0);
      if (totalBottlesInOrder > 1000) {
        return NextResponse.json(
          {
            success: false,
            error: `Số lượng đặt hàng (${totalBottlesInOrder.toLocaleString('vi-VN')} chai) vượt quá giới hạn tối đa cho phép là 1.000 chai trên một đơn hàng. Vui lòng giảm bớt số lượng hoặc liên hệ hotline để được hỗ trợ đơn hàng sỉ.`,
          },
          { status: 400 }
        );
      }

      // V3 (chính thức): giá trị đơn COD tối đa tính theo tổng do server tự tính, không tin body.total
      if (paymentMethod === 'cod' && serverTotal > codConfig.MAX_ORDER_VALUE) {
        return NextResponse.json(
          {
            success: false,
            error: `Đơn hàng COD không được vượt quá ${codConfig.MAX_ORDER_VALUE.toLocaleString('vi-VN')} ₫. Vui lòng liên hệ hotline để đặt đơn lớn hoặc chọn phương thức thanh toán khác.`,
            maxValue: codConfig.MAX_ORDER_VALUE,
          },
          { status: 400 }
        );
      }

      // 5.2. IN-MEMORY GATEKEEPER / CIRCUIT BREAKER SHIELD
      // Kiểm tra và cấp Permit trên RAM trước khi mở Transaction và khóa row Database
      const { gatekeeperAcquirePermit, gatekeeperCommitPermit, gatekeeperRollbackPermit } = await import('@/lib/inventoryGatekeeper');
      const gatekeeper = await gatekeeperAcquirePermit(targetStoreCode, expandedBottles);
      if (!gatekeeper.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Một số sản phẩm không đủ tồn kho khả dụng tại chi nhánh đã chọn',
            insufficientItems: gatekeeper.insufficientItems,
          },
          { status: 409 }
        );
      }
      const gatekeeperPermitId = gatekeeper.permitId;

      let finalEmail = email;
      if ((!finalEmail || !finalEmail.includes('@')) && userId) {
        try {
          const userRes = await client.query('SELECT email FROM users WHERE id = $1 LIMIT 1;', [userId]);
          if (userRes.rows.length > 0 && userRes.rows[0].email) {
            finalEmail = userRes.rows[0].email;
          }
        } catch (err) {
          console.error('[Orders] Error fetching user email fallback:', err);
        }
      }

      // 5.5. NHẬN DIỆN VÀ XỬ LÝ ATTRIBUTION ĐỐI TÁC (CTV / ĐẠI LÝ)
      let partnerAttribution: {
        partnerId: string;
        partnerCode: string;
        isSelfReferral: boolean;
        fraudFlags: any;
        policyId: string;
        policyName: string;
        rate: number;
        commissionAmount: number;
        attributionMethod: string;
      } | null = null;

      try {
        let detectedRefCode: string | null = (body.referralCode || body.ref || '').toString().trim() || null;
        let attributionMethod = 'MANUAL_CODE';

        if (!detectedRefCode) {
          const cookieHeader = request.headers.get('cookie') || '';
          const match = cookieHeader.match(/tsf_partner_ref=([^;]+)/);
          if (match) {
            const rawCookie = decodeURIComponent(match[1]);
            const { verifyReferralCookie } = await import('@/lib/partner/referral');
            const verified = verifyReferralCookie(rawCookie);
            if (verified) {
              detectedRefCode = verified;
              attributionMethod = 'LAST_CLICK_COOKIE';
            }
          }
        }

        if (detectedRefCode) {
          const pRes = await client.query(
            `SELECT pp.id, pp.user_id, pp.partner_code, pp.phone, pp.email, pp.lifecycle_status,
                    u.phone AS user_phone, u.email AS user_email
             FROM partner_profiles pp
             LEFT JOIN users u ON pp.user_id = u.id
             WHERE UPPER(pp.partner_code) = UPPER($1)
             LIMIT 1;`,
            [detectedRefCode]
          );

          if (pRes.rows.length > 0) {
            const partner = pRes.rows[0];
            const isSelfReferral = Boolean(
              (userId && partner.user_id && userId === partner.user_id) ||
              (cleanPhone && (cleanPhone === partner.phone || cleanPhone === partner.user_phone)) ||
              (finalEmail && (
                finalEmail.toLowerCase() === (partner.email || '').toLowerCase() ||
                finalEmail.toLowerCase() === (partner.user_email || '').toLowerCase()
              ))
            );

            const polRes = await client.query(
              `SELECT id, name, rate, base_type FROM partner_commission_policies WHERE is_active = true ORDER BY created_at DESC LIMIT 1;`
            );
            const policy = polRes.rows[0] || {
              id: 'pol_default_ctv',
              name: 'Chính sách CTV Mặc định (10%)',
              rate: 0.10,
              base_type: 'SUBTOTAL_EXCLUDING_SHIPPING',
            };

            const commissionRate = Number(policy.rate) || 0.10;
            const commissionAmount = isSelfReferral ? 0 : Math.round(serverCalculatedSubtotal * commissionRate);

            partnerAttribution = {
              partnerId: partner.id,
              partnerCode: partner.partner_code,
              isSelfReferral,
              fraudFlags: isSelfReferral ? { reason: 'SELF_PURCHASE_DETECTED', cleanPhone, finalEmail } : null,
              policyId: policy.id,
              policyName: policy.name,
              rate: commissionRate,
              commissionAmount,
              attributionMethod,
            };
          }
        }
      } catch (attrErr) {
        console.error('[Orders] Error resolving partner attribution:', attrErr);
      }

      const orderChannel = partnerAttribution && !partnerAttribution.isSelfReferral
        ? 'PARTNER_REFERRAL'
        : (body.orderChannel || 'CUSTOMER');

      // 6. TẠO ĐƠN HÀNG VÀ DÒNG CHI TIẾT TRONG TRANSACTION (RETRY TỐI ĐA 3 LẦN NẾU TRÙNG KHÓA 23505)
      const MAX_ORDER_RETRIES = 3;
      let attempt = 0;
      let orderId = '';

      while (attempt < MAX_ORDER_RETRIES) {
        attempt++;
        orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        orderCode = attempt === 1
          ? initialOrderCode
          : `TSF-${Date.now().toString().slice(-4)}${crypto.randomInt(1000, 9999)}`;

        try {
          await client.query('BEGIN;');
          // Tuần tự hóa các đơn cùng chi nhánh: nhiều đơn đặt đồng thời trước đây gây "deadlock detected" (HTTP 500).
          // Khóa tư vấn mức transaction, tự nhả khi COMMIT/ROLLBACK; giao dịch ngắn nên không ảnh hưởng đáng kể thông lượng.
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1));', ['tsf-order-store-' + targetStoreCode]);

          await client.query(
            `INSERT INTO orders (
               id, order_code, full_name, phone, email, province, district, ward, address, note,
               payment_method, shipping_fee, subtotal, total, status, user_id, store_code, store_address,
               items_total_count, items_resolved_count, order_channel,
               latitude, longitude, location_confirmed, location_confirmed_by, address_new, address_old,
               recommended_store_id, was_overridden, ranking_snapshot
             )
             VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               $11, $12, $13, $14, $15, $16, $17, $18,
               $19, $20, $21,
               $22, $23, $24, $25, $26, $27,
               $28, $29, $30
             )`,
            [
              orderId,
              orderCode,
              fullName,
              phone,
              finalEmail,
              province,
              district,
              ward,
              address,
              note,
              paymentMethod,
              serverShippingFee,
              serverCalculatedSubtotal,
              serverTotal,
              'PENDING',
              userId,
              targetStoreCode,
              targetStoreAddress,
              revalidatedItems.length,
              revalidatedItems.length,
              orderChannel,
              rawLat,
              rawLng,
              locationConfirmed,
              locationConfirmedBy,
              addressNew,
              addressOld,
              recommendedStoreId,
              wasOverridden,
              rankingSnapshot,
            ]
          );

          for (let i = 0; i < revalidatedItems.length; i++) {
            const item = revalidatedItems[i];
            const itemId = `item_${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${i}`;
            const snapshotJson = comboSnapshots[i] ? JSON.stringify(comboSnapshots[i]) : null;

            // Resolve canonical product ID và tính bottle tracking
            const rawPId = (item.productId || '').trim();
            let canonicalProductId: string | null = null;
            let bottleMultiplier = 1;
            let totalBottlesVal = item.quantity || 1;
            let itemCostPriceSnapshot: number | null = null;

            if (rawPId && !rawPId.startsWith('combo-')) {
              // Đã resolve và tính hệ số chai từ DB ở bước tính giá phía trên
              if (item.canonicalProductId) {
                canonicalProductId = item.canonicalProductId;
                bottleMultiplier = item.bottleMultiplier;
                totalBottlesVal = bottleMultiplier * (item.quantity || 1);

                const prodCostRes = await client.query('SELECT cost_price FROM products WHERE id = $1 LIMIT 1;', [canonicalProductId]);
                if (prodCostRes.rows.length > 0 && prodCostRes.rows[0].cost_price !== null && prodCostRes.rows[0].cost_price !== undefined) {
                  itemCostPriceSnapshot = (Number(prodCostRes.rows[0].cost_price) || 0) * bottleMultiplier;
                }
              }
            } else if (rawPId && (rawPId.startsWith('combo-') || rawPId.includes('combo'))) {
              const comboCostRes = await client.query('SELECT cost_price FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;', [rawPId]);
              if (comboCostRes.rows.length > 0 && comboCostRes.rows[0].cost_price !== null && comboCostRes.rows[0].cost_price !== undefined) {
                itemCostPriceSnapshot = Number(comboCostRes.rows[0].cost_price) || 0;
              }
            }

            await client.query(
              `INSERT INTO order_items (id, order_id, product_id, name, price, quantity, unit, thumbnail, combo_snapshot, canonical_product_id, bottle_multiplier, total_bottles, cost_price)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                itemId,
                orderId,
                item.productId,
                item.name,
                item.price,
                item.quantity,
                item.unit,
                item.thumbnail,
                snapshotJson,
                canonicalProductId,
                bottleMultiplier,
                totalBottlesVal,
                itemCostPriceSnapshot,
              ]
            );
          }

          // 7. KIỂM TRA TỒN KHO VÀ GIỮ CHỖ DƯỚI KHÓA SELECT ... FOR UPDATE (ROLLBACK TOÀN BỘ NẾU THIẾU HÀNG)
          await reserveStock(
            targetStoreCode,
            orderId,
            expandedBottles,
            client,
            INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS
          );

          // 7.5. GHI NHẬN ATTRIBUTION VÀ SỔ CÁI ĐỐI TÁC TRONG CÙNG TRANSACTION (ROLLBACK NẾU LỖI)
          if (partnerAttribution) {
            const attrId = `attr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            await client.query(
              `INSERT INTO order_attributions (
                id, order_id, partner_id, referral_code, attribution_method,
                is_self_referral, fraud_flags, policy_id, snapshot_policy_name,
                snapshot_commission_rate, eligible_order_amount, estimated_commission, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
              [
                attrId,
                orderId,
                partnerAttribution.partnerId,
                partnerAttribution.partnerCode,
                partnerAttribution.attributionMethod,
                partnerAttribution.isSelfReferral,
                partnerAttribution.fraudFlags ? JSON.stringify(partnerAttribution.fraudFlags) : null,
                partnerAttribution.policyId,
                partnerAttribution.policyName,
                partnerAttribution.rate,
                serverCalculatedSubtotal,
                partnerAttribution.commissionAmount,
                partnerAttribution.isSelfReferral ? 'FLAGGED' : 'ESTIMATED',
              ]
            );

            if (!partnerAttribution.isSelfReferral && partnerAttribution.commissionAmount > 0) {
              const ledgerId = `led_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
              await client.query(
                `INSERT INTO partner_ledger (
                  id, partner_id, order_id, entry_type, amount, direction, status,
                  policy_snapshot, reference_id, note, created_by
                ) VALUES ($1, $2, $3, 'COMMISSION', $4, 'CREDIT', 'ESTIMATED', $5, $6, $7, 'system');`,
                [
                  ledgerId,
                  partnerAttribution.partnerId,
                  orderId,
                  partnerAttribution.commissionAmount,
                  JSON.stringify({
                    policyId: partnerAttribution.policyId,
                    policyName: partnerAttribution.policyName,
                    rate: partnerAttribution.rate,
                  }),
                  orderCode,
                  `Hoa hồng dự kiến cho đơn hàng ${orderCode}`,
                ]
              );
            }
          }

          if (saveDefaultAddress && userId && rawLat !== null && rawLng !== null) {
            try {
              await client.query(
                `UPDATE users
                 SET address = $1, province = $2, district = $3, ward = $4, latitude = $5, longitude = $6, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7;`,
                [address, province, district, ward, rawLat, rawLng, userId]
              );
            } catch (uErr) {
              console.error('[Orders] User default address update error:', uErr);
            }
          }

          await client.query('COMMIT;');
          gatekeeperCommitPermit(gatekeeperPermitId);
          break; // Đặt hàng thành công! Thoát khỏi vòng lặp retry
        } catch (err: any) {
          gatekeeperRollbackPermit(gatekeeperPermitId);
          try {
            await client.query('ROLLBACK;');
          } catch (_) {}

          if (err instanceof InsufficientStockError || err.name === 'InsufficientStockError') {
            return NextResponse.json(
              {
                success: false,
                error: 'Một số sản phẩm không đủ tồn kho khả dụng tại chi nhánh đã chọn',
                insufficientItems: err.insufficientItems,
              },
              { status: 409 }
            );
          }

          if (err.code === '23505' && attempt < MAX_ORDER_RETRIES) {
            console.warn(`[Orders] Postgres unique collision (23505) on attempt ${attempt}. Retrying with new order ID/code...`);
            continue;
          }

          throw err;
        }
      }

      // Kích hoạt gửi email xác nhận đặt hàng cho khách (Non-blocking async)
      if (finalEmail && finalEmail.includes('@')) {
        sendOrderEmail('ORDER_CONFIRMATION', {
          id: orderId,
          orderCode,
          fullName,
          phone,
          email: finalEmail,
          address,
          province,
          district,
          ward,
          paymentMethod,
          shippingFee: serverShippingFee,
          subtotal: serverCalculatedSubtotal,
          total: serverTotal,
          note,
          storeCode: targetStoreCode,
          storeAddress: targetStoreAddress,
          items: revalidatedItems,
        }).catch((err) => console.error('[Order] Error sending confirmation email:', err));
      }

      return NextResponse.json({
        success: true,
        orderId,
        orderCode,
        storeCode: targetStoreCode,
        subtotal: serverCalculatedSubtotal,
        shippingFee: serverShippingFee,
        total: serverTotal,
        savedToPostgres: true,
        order: {
          id: orderId,
          orderCode,
          storeCode: targetStoreCode,
          total: serverTotal,
        },
      });
    } catch (dbError: any) {
      try {
        await client.query('ROLLBACK;');
      } catch (_) {}
      console.error('PostgreSQL order insert error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Lỗi khi lưu đơn hàng. Vui lòng thử lại hoặc liên hệ hotline.',
          savedToPostgres: false,
        },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    // Trước đây lỗi ở đây bị nuốt im lặng (không log) nên không chẩn đoán được lỗi 500 khi đặt hàng
    console.error('Unhandled error in POST /api/orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
        ...(process.env.NODE_ENV !== 'production'
          ? { debug: [String(error?.message || error), error?.detail, error?.where, String(error?.stack || '').split(String.fromCharCode(10)).slice(1, 6).join(' | ')].filter(Boolean).join(' // ').slice(0, 1500) }
          : {}),
      },
      { status: 500 }
    );
  }
}

function normalizePhone(p: string): string {
  let clean = p.replace(/[\s\-\.]/g, '');
  if (clean.startsWith('+84')) clean = '0' + clean.slice(3);
  else if (clean.startsWith('84') && clean.length > 9) clean = '0' + clean.slice(2);
  return clean;
}

function maskPhoneNumber(p: string | null | undefined): string | null {
  if (!p) return null;
  const clean = p.replace(/\s+/g, '');
  if (clean.length < 7) return '****';
  return clean.substring(0, 3) + '****' + clean.substring(clean.length - 3);
}

function maskFullName(name: string | null | undefined): string {
  if (!name) return 'Khách hàng';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0) + '***';
  if (parts.length === 2) return `${parts[0].charAt(0)}. ${parts[1]}`;
  return `${parts[0].charAt(0)}. ${parts.slice(1, -1).map(p => p.charAt(0) + '.').join(' ')} ${parts[parts.length - 1]}`;
}

function maskAddress(order: any): string {
  const parts = [order.ward, order.district, order.province].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return 'Khu vực giao hàng đã xác nhận';
}

// GET: Tra cứu thông tin & tiến trình đơn hàng bảo mật (Anti-IDOR & PII Protected)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || searchParams.get('orderCode') || '').trim();
    const rawPhone = (searchParams.get('phone') || '').trim();

    // 0. Xác thực người dùng hiện tại (nếu có đăng nhập)
    let userSession = null;
    try {
      userSession = await getUserSession();
    } catch {
      userSession = null;
    }

    // 1. Nếu người dùng đăng nhập xem đơn chính mình
    if (userSession?.id && code) {
      const userOrderRes = await query(
        `SELECT * FROM orders WHERE (order_code = $1 OR id = $1) AND user_id = $2 LIMIT 1;`,
        [code, userSession.id]
      );
      if (userOrderRes.rows.length > 0) {
        const order = userOrderRes.rows[0];
        const itemsRes = await query(
          `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC;`,
          [order.id]
        );
        return NextResponse.json({
          success: true,
          isOwner: true,
          order: {
            id: order.id,
            orderCode: order.order_code,
            fullName: order.full_name,
            phone: order.phone,
            email: order.email,
            address: order.address,
            province: order.province,
            district: order.district,
            ward: order.ward,
            paymentMethod: order.payment_method || 'Thanh toán tiền mặt khi nhận hàng (COD)',
            shippingFee: order.shipping_fee,
            subtotal: order.subtotal,
            total: order.total,
            status: order.status,
            storeCode: order.store_code,
            storeAddress: order.store_address,
            createdAt: order.created_at,
            items: itemsRes.rows.map((it: any) => ({
              id: it.id,
              name: it.name,
              price: it.price,
              quantity: it.quantity,
              unit: it.unit,
              thumbnail: it.thumbnail,
            })),
          },
        });
      }
    }

    // 2. Tra cứu công khai (YÊU CẦU CẢ MÃ ĐƠN VÀ SỐ ĐIỆN THOẠI)
    if (!code || !rawPhone) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp cả mã đơn hàng và số điện thoại đặt hàng để tra cứu' },
        { status: 400 }
      );
    }

    // 3. Kiểm tra Rate Limiting (10 req/phút/IP và chống brute force dò theo mã đơn)
    const ip = getClientIp(request.headers) ?? UNKNOWN_CLIENT_IP;
    const ipRate = checkRequestRateLimit(`track:ip:${ip}`, 10, 60 * 1000);
    if (ipRate.isBlocked) {
      return NextResponse.json(
        { success: false, error: 'Bạn đã thực hiện quá nhiều yêu cầu tra cứu. Vui lòng thử lại sau.' },
        { status: 429 }
      );
    }

    const codeBlocked = isTrackingCodeBlocked(code);
    if (codeBlocked.isBlocked) {
      return NextResponse.json(
        { success: false, error: `Mã đơn hàng tạm thời bị khóa tra cứu do nhập sai quá nhiều lần. Vui lòng thử lại sau ${codeBlocked.remainingSeconds} giây.` },
        { status: 429 }
      );
    }

    // 4. Tìm đơn theo code và so khớp phone đã chuẩn hóa
    const orderRes = await query(
      `SELECT * FROM orders WHERE order_code = $1 OR id = $1 LIMIT 1;`,
      [code]
    );

    const inputPhoneClean = normalizePhone(rawPhone);
    const order = orderRes.rows[0];
    const orderPhoneClean = order ? normalizePhone(order.phone || '') : '';

    // Khi sai phone hoặc không tìm thấy, trả CÙNG một thông báo và status 404 chung để tránh dò mã đơn
    if (!order || orderPhoneClean !== inputPhoneClean) {
      recordFailedTrackingAttempt(code);
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy thông tin đơn hàng phù hợp.' },
        { status: 404 }
      );
    }

    // 5. Trả về dữ liệu công khai đã được CHE MỜ thông tin nhạy cảm (PII Masked)
    const itemsRes = await query(
      `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC;`,
      [order.id]
    );

    return NextResponse.json({
      success: true,
      isOwner: false,
      order: {
        id: order.id,
        orderCode: order.order_code,
        fullName: maskFullName(order.full_name),
        phone: maskPhoneNumber(order.phone),
        email: null, // Không lộ email ở tra cứu công khai
        address: maskAddress(order), // Ẩn số nhà, tên đường chi tiết
        province: order.province,
        district: order.district,
        ward: order.ward,
        paymentMethod: order.payment_method || 'Thanh toán tiền mặt khi nhận hàng (COD)',
        shippingFee: order.shipping_fee,
        subtotal: order.subtotal,
        total: order.total,
        status: order.status,
        storeCode: order.store_code,
        storeAddress: order.store_address,
        createdAt: order.created_at,
        items: itemsRes.rows.map((it: any) => ({
          id: it.id,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          unit: it.unit,
          thumbnail: it.thumbnail,
        })),
      },
    });
  } catch (error: any) {
    console.error('Order tracking API error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi tra cứu thông tin đơn hàng' },
      { status: 500 }
    );
  }
}
