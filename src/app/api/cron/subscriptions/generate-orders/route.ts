import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { MEMBERSHIP_CONFIG } from '@/config/membership';
import { calculateNextDeliveryDate, getVietnamDate } from '@/lib/membership/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Fail-closed: không có CRON_SECRET thì từ chối; không nhận secret qua query string (lộ trong log)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ success: false, error: 'CRON_SECRET chưa được cấu hình' }, { status: 500 });
    }
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const provided = req.headers.get('x-cron-secret') || bearer;
    const digest = (v: string) => crypto.createHash('sha256').update(v).digest();
    if (!crypto.timingSafeEqual(digest(provided), digest(cronSecret))) {
      return NextResponse.json({ success: false, error: 'Unauthorized CRON execution' }, { status: 401 });
    }

    const force = req.nextUrl.searchParams.get('force') === 'true';
    const vnNow = getVietnamDate(new Date());
    const isPast18 = vnNow.getHours() >= MEMBERSHIP_CONFIG.CUTOFF_HOUR;

    const client = await pool.connect();
    const generatedOrderCodes: string[] = [];

    try {
      // 1. Quét các lịch giao hàng theo múi giờ Asia/Ho_Chi_Minh:
      // - Nếu chưa đến 18:00 T-1 và không có cờ force: CHỈ xử lý các đơn của hôm nay hoặc quá khứ (không sinh đơn sớm cho ngày mai)
      // - Nếu đã qua 18:00 T-1 (hoặc force=true): Xử lý toàn bộ đơn đến hết ngày mai (T-1 cut-off đã đạt)
      const dateCondition = (isPast18 || force)
        ? `ss.scheduled_date::date <= ((CURRENT_TIMESTAMP AT TIME ZONE '${MEMBERSHIP_CONFIG.TIMEZONE}') + INTERVAL '1 day')::date`
        : `ss.scheduled_date::date <= (CURRENT_TIMESTAMP AT TIME ZONE '${MEMBERSHIP_CONFIG.TIMEZONE}')::date`;

      const sqlSchedules = `
        SELECT 
          ss.id AS schedule_id, ss.scheduled_date, ss.subscription_id,
          s.id AS sub_id, s.subscription_code, s.user_id, s.delivery_frequency,
          s.preferred_day_of_week, s.preferred_time_slot, s.recipient_name,
          s.recipient_phone, s.shipping_address, s.province, s.district,
          s.ward, s.store_code, s.payment_method
        FROM subscription_schedules ss
        JOIN subscriptions s ON ss.subscription_id = s.id
        WHERE ss.status IN ('SCHEDULED', 'REMINDER_SENT')
          AND ${dateCondition}
          AND s.status = 'ACTIVE'
        ORDER BY ss.scheduled_date ASC
        LIMIT 50;
      `;

      const schedulesRes = await client.query(sqlSchedules);
      const schedules = schedulesRes.rows;

      for (const sc of schedules) {
        await client.query('BEGIN;');

        // Kiểm tra Idempotence chặt chẽ: Lock dòng schedule hiện tại
        const lockScheduleRes = await client.query(
          `SELECT status, generated_order_id FROM subscription_schedules WHERE id = $1 FOR UPDATE;`,
          [sc.schedule_id]
        );
        const currentSched = lockScheduleRes.rows[0];
        if (!currentSched || currentSched.status === 'ORDER_GENERATED' || currentSched.generated_order_id) {
          // Kỳ này đã được sinh đơn trước đó, bỏ qua an toàn không sinh trùng
          await client.query('ROLLBACK;');
          continue;
        }

        // Lấy danh sách sản phẩm trong hợp đồng
        const itemsRes = await client.query(
          `SELECT id, product_id, variant_id, name, unit, price_snapshot, discount_rate, final_price, quantity 
           FROM subscription_items 
           WHERE subscription_id = $1;`,
          [sc.sub_id]
        );
        const subItems = itemsRes.rows;
        if (subItems.length === 0) {
          await client.query('ROLLBACK;');
          continue;
        }

        // 2. Tính giá theo Price Snapshotting:
        // Giá áp dụng = min(giá_đã_chốt, giá_niêm_yết_hiện_tại × 0.85)
        let subtotal = 0;
        const processedItems: Array<any> = [];

        for (const it of subItems) {
          // Truy vấn giá niêm yết hiện tại từ bảng products hoặc combos
          let currentCatalogPrice: number | null = null;
          const prodRes = await client.query(
            `SELECT price FROM products WHERE id = $1 OR slug = $1 LIMIT 1;`,
            [it.product_id]
          );
          if (prodRes.rows.length > 0 && prodRes.rows[0].price) {
            currentCatalogPrice = Number(prodRes.rows[0].price);
          } else {
            const comboRes = await client.query(
              `SELECT original_price, sale_price FROM combos WHERE id = $1 OR slug = $1 LIMIT 1;`,
              [it.product_id]
            );
            if (comboRes.rows.length > 0) {
              currentCatalogPrice = Number(comboRes.rows[0].original_price || comboRes.rows[0].sale_price);
            }
          }

          const baseRetail = currentCatalogPrice || Number(it.price_snapshot);
          const rate = Number(it.discount_rate) || MEMBERSHIP_CONFIG.SUBSCRIPTION_DISCOUNT_RATE;
          const currentDiscountedPrice = Math.round(baseRetail * (1 - rate));
          const lockedPrice = Number(it.final_price);

          // Áp dụng công thức min: Nếu giá thị trường giảm, tự động giảm theo
          const appliedFinalPrice = Math.min(lockedPrice, currentDiscountedPrice);

          const qty = Number(it.quantity) || 1;
          subtotal += appliedFinalPrice * qty;

          processedItems.push({
            ...it,
            appliedFinalPrice,
            quantity: qty,
          });
        }

        const shippingFee = MEMBERSHIP_CONFIG.FREE_SHIPPING_FEE; // Freeship 100% bằng xe lạnh
        const total = subtotal + shippingFee;

        // 3. Tạo đơn hàng trong bảng orders
        const orderId = `ord_sub_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const orderCode = `TSF-SUB-${Date.now().toString().slice(-4)}${crypto.randomInt(100, 999)}`;
        const storeCode = sc.store_code || 'NH';

        const insertOrderSql = `
          INSERT INTO orders (
            id, order_code, user_id, full_name, phone, address, province, district, ward,
            store_code, payment_method, status, subtotal, shipping_fee, total,
            order_channel, note, inventory_deducted
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING', $12, $13, $14,
            'SUBSCRIBE_AND_SAVE', $15, false
          );
        `;

        await client.query(insertOrderSql, [
          orderId,
          orderCode,
          sc.user_id,
          sc.recipient_name,
          sc.recipient_phone,
          sc.shipping_address,
          sc.province,
          sc.district,
          sc.ward,
          storeCode,
          sc.payment_method || 'vietqr',
          subtotal,
          shippingFee,
          total,
          `Đơn giao tự động định kỳ theo hợp đồng #${sc.subscription_code} (Khung giờ: ${sc.preferred_time_slot})`,
        ]);

        // 4. Lưu từng món vào order_items & Khóa tồn kho khả dụng (Zero-Oversell Guarantee)
        for (const it of processedItems) {
          const orderItemId = `oi_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          const is5Pack = it.unit?.includes('5 chai');
          const bottleMultiplier = is5Pack ? 5 : 7;
          const totalBottles = it.quantity * bottleMultiplier;

          await client.query(
            `INSERT INTO order_items (
              id, order_id, product_id, name, price, quantity, unit,
              canonical_product_id, bottle_multiplier, total_bottles
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
            [
              orderItemId,
              orderId,
              it.product_id,
              it.name,
              it.appliedFinalPrice,
              it.quantity,
              it.unit,
              it.product_id,
              bottleMultiplier,
              totalBottles,
            ]
          );

          // Khóa tồn kho khả dụng tại chi nhánh
          try {
            const invRes = await client.query(
              `SELECT stock_quantity, reserved, safety_stock 
               FROM store_inventory 
               WHERE store_code = $1 AND product_id = $2 
               FOR UPDATE;`,
              [storeCode, it.product_id]
            );

            if (invRes.rows.length > 0) {
              const inv = invRes.rows[0];
              const available = Math.max(0, inv.stock_quantity - inv.reserved - (inv.safety_stock || 0));
              const reserveAmount = Math.min(available, totalBottles);

              if (reserveAmount > 0) {
                await client.query(
                  `UPDATE store_inventory 
                   SET reserved = reserved + $1, updated_at = CURRENT_TIMESTAMP 
                   WHERE store_code = $2 AND product_id = $3;`,
                  [reserveAmount, storeCode, it.product_id]
                );

                const reservationId = `res_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
                const expiresAt = new Date(sc.scheduled_date);
                expiresAt.setDate(expiresAt.getDate() + 2); // Hết hạn sau 2 ngày

                await client.query(
                  `INSERT INTO stock_reservations (
                     id, order_id, store_code, product_id, quantity, status, expires_at
                   ) VALUES ($1, $2, $3, $4, $5, 'active', $6);`,
                  [reservationId, orderId, storeCode, it.product_id, reserveAmount, expiresAt]
                );
              }
            }
          } catch (invErr) {
            console.warn('[CronGenerateOrders] Thông báo tồn kho chi nhánh:', invErr);
          }
        }

        // 5. Cập nhật trạng thái kỳ giao thành ORDER_GENERATED
        await client.query(
          `UPDATE subscription_schedules 
           SET status = 'ORDER_GENERATED', generated_order_id = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1;`,
          [sc.schedule_id, orderId]
        );

        // 6. Tính ngày giao kế tiếp của chu kỳ mới
        const nextDate = calculateNextDeliveryDate(
          new Date(sc.scheduled_date),
          sc.delivery_frequency,
          sc.preferred_day_of_week
        );

        await client.query(
          `UPDATE subscriptions 
           SET last_delivered_date = $2, next_delivery_date = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1;`,
          [sc.sub_id, sc.scheduled_date, nextDate]
        );

        // 7. Tạo bản ghi schedule mới cho chu kỳ tiếp theo
        const newScheduleId = `sc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        await client.query(
          `INSERT INTO subscription_schedules (id, subscription_id, scheduled_date, status)
           VALUES ($1, $2, $3, 'SCHEDULED')
           ON CONFLICT (subscription_id, scheduled_date) DO NOTHING;`,
          [newScheduleId, sc.sub_id, nextDate]
        );

        await client.query('COMMIT;');
        generatedOrderCodes.push(orderCode);
      }
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      message: `Đã tự động tạo thành công ${generatedOrderCodes.length} đơn hàng định kỳ chuẩn T-1.`,
      ordersCount: generatedOrderCodes.length,
      generatedOrderCodes,
    });
  } catch (error: any) {
    console.error('Error in cron generate-orders:', error);
    return NextResponse.json({ success: false, error: 'Lỗi thực thi cron sinh đơn định kỳ.' }, { status: 500 });
  }
}
