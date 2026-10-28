import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { getPartnerSession } from '@/lib/partner/auth';
import { reserveStock, InsufficientStockError } from '@/lib/inventory';
import { INVENTORY_CONFIG } from '@/config/inventory';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getPartnerSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (session.partnerType !== 'DEALER') {
      return NextResponse.json(
        { success: false, error: 'Chức năng đặt hàng sỉ chỉ dành cho tài khoản Đại lý chính thức.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (session.lifecycleStatus !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Tài khoản Đại lý hiện không ở trạng thái hoạt động.', code: 'ACCOUNT_NOT_ACTIVE' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Giỏ hàng sỉ đang trống.' }, { status: 400 });
    }

    // 1. Lấy thông tin tier chiết khấu
    const tierId = session.tierId || 'tier_bronze';
    const tierRes = await query(`SELECT * FROM dealer_tiers WHERE id = $1 LIMIT 1;`, [tierId]);
    const tier = tierRes.rows[0] || {
      id: 'tier_bronze',
      tier_name: 'Đại lý Đồng',
      tier_code: 'TIER_1',
      discount_rate: 15.00,
    };
    const discountRate = Number(tier.discount_rate) || 15.00;

    // 2. Tính toán số lượng chai và áp dụng giá sỉ chiết khấu
    let totalBottles = 0;
    let originalSubtotal = 0;
    let wholesaleSubtotal = 0;
    const resolvedItems: any[] = [];
    const stockItemsToReserve: any[] = [];

    for (const item of rawItems) {
      const pId = item.productId || item.id;
      const qty = Math.max(1, Math.round(Number(item.quantity) || 1));

      const prodRes = await query(`SELECT id, name, price FROM products WHERE id = $1 LIMIT 1;`, [pId]);
      if (prodRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: `Sản phẩm không tồn tại: ${pId}` }, { status: 404 });
      }
      const prod = prodRes.rows[0];
      const retailPrice = Number(prod.price) || 0;
      const wholesalePrice = Math.round(retailPrice * (1 - discountRate / 100));

      totalBottles += qty;
      originalSubtotal += retailPrice * qty;
      wholesaleSubtotal += wholesalePrice * qty;

      resolvedItems.push({
        productId: prod.id,
        name: prod.name,
        price: wholesalePrice,
        originalPrice: retailPrice,
        quantity: qty,
        unit: 'Chai',
      });

      stockItemsToReserve.push({
        productId: prod.id,
        bottleQuantity: qty,
      });
    }

    // 3. Kiểm tra số lượng tối thiểu cho đơn sỉ Đại lý (Tối thiểu 50 chai)
    const minBottlesRequired = 50;
    if (totalBottles < minBottlesRequired) {
      return NextResponse.json(
        {
          success: false,
          error: `Đơn hàng đại lý yêu cầu số lượng tối thiểu ${minBottlesRequired} chai để áp dụng chiết khấu sỉ. Bạn đang chọn: ${totalBottles} chai.`,
          code: 'BELOW_MIN_DEALER_QUANTITY',
          currentBottles: totalBottles,
          minRequired: minBottlesRequired,
        },
        { status: 400 }
      );
    }

    // 4. Chuẩn hóa địa chỉ và thông tin nhận hàng
    const fullName = (body.fullName || session.fullName).trim();
    const phone = (body.phone || session.phone).trim();
    const address = (body.address || 'Kho Đại lý').trim();
    const province = body.province || 'Hồ Chí Minh';
    const district = body.district || 'Quận 1';
    const ward = body.ward || 'Phường Bến Nghé';
    const note = body.note || `Đơn hàng sỉ đại lý (${tier.tier_name}) - Chiết khấu ${discountRate}%`;
    const targetStoreCode = body.storeCode || 'NH';
    const shippingFee = Math.round(Number(body.shippingFee) || 0);
    const finalTotal = wholesaleSubtotal + shippingFee;

    const orderId = `ord_dl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const orderCode = `TSF-DL-${Date.now().toString().slice(-4)}${crypto.randomInt(1000, 9999)}`;

    // 5. Mở Transaction an toàn tạo đơn và giữ kho
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      await client.query(
        `INSERT INTO orders (
          id, order_code, full_name, phone, email, province, district, ward, address,
          note, payment_method, shipping_fee, subtotal, total, status, user_id,
          store_code, items_total_count, items_resolved_count, order_channel,
          payment_status, dealer_tier_snapshot
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          'bank_transfer', $11, $12, $13, 'PENDING', $14,
          $15, $16, $17, 'DEALER_PURCHASE', 'PENDING_REVIEW', $18
        );`,
        [
          orderId,
          orderCode,
          fullName,
          phone,
          session.email,
          province,
          district,
          ward,
          address,
          note,
          shippingFee,
          wholesaleSubtotal,
          finalTotal,
          session.userId,
          targetStoreCode,
          resolvedItems.length,
          resolvedItems.length,
          tier.tier_code,
        ]
      );

      for (let i = 0; i < resolvedItems.length; i++) {
        const item = resolvedItems[i];
        const itemId = `item_dl_${Date.now()}_${i}`;
        await client.query(
          `INSERT INTO order_items (id, order_id, product_id, name, price, quantity, unit, total_bottles)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [itemId, orderId, item.productId, item.name, item.price, item.quantity, item.unit, item.quantity]
        );
      }

      // Giữ kho số lượng lớn cho đơn sỉ
      await reserveStock(
        targetStoreCode,
        orderId,
        stockItemsToReserve,
        client,
        INVENTORY_CONFIG.RESERVATION_EXPIRY_HOURS
      );

      await client.query('COMMIT;');

      return NextResponse.json({
        success: true,
        orderId,
        orderCode,
        totalBottles,
        originalSubtotal,
        discountRate,
        wholesaleSubtotal,
        finalTotal,
        paymentStatus: 'PENDING_REVIEW',
        paymentMethod: 'bank_transfer',
        bankTransferInfo: {
          bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
          accountNumber: '012345678999',
          accountHolder: 'CONG TY CP THAI SON FOODS',
          amount: finalTotal,
          transferNote: `TSF ${orderCode}`,
        },
        message: 'Đã tạo đơn sỉ đại lý thành công! Vui lòng chuyển khoản đúng cú pháp để kế toán xác nhận và xuất kho.',
      });
    } catch (err: any) {
      await client.query('ROLLBACK;');
      if (err instanceof InsufficientStockError || err.name === 'InsufficientStockError') {
        return NextResponse.json(
          {
            success: false,
            error: 'Kho chi nhánh không đủ số lượng khả dụng cho đơn sỉ số lượng lớn này.',
            insufficientItems: err.insufficientItems,
          },
          { status: 409 }
        );
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[DealerOrder] Error creating wholesale order:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi hệ thống') }, { status: 500 });
  }
}
