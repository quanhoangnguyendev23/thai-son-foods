import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const SAMPLE_CUSTOMERS = [
  { name: 'Nguyễn Văn An', phone: '0903123456', email: 'an.nguyen@gmail.com', province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Bến Nghé', address: '45 Lê Duẩn' },
  { name: 'Trần Thị Mai', phone: '0912345678', email: 'mai.tran@gmail.com', province: 'TP. Hồ Chí Minh', district: 'Quận 7', ward: 'Tân Phong', address: '12 Nguyễn Thị Thập' },
  { name: 'Lê Hoàng Long', phone: '0988776655', email: 'long.le@gmail.com', province: 'TP. Hồ Chí Minh', district: 'Bình Thạnh', ward: 'Phường 25', address: '150 Điện Biên Phủ' },
  { name: 'Phạm Hồng Nhung', phone: '0933221144', email: 'nhung.pham@gmail.com', province: 'TP. Hồ Chí Minh', district: 'Tân Bình', ward: 'Phường 2', address: '88 Trường Sơn' },
  { name: 'Vũ Đức Minh', phone: '0977112233', email: 'minh.vu@gmail.com', province: 'Bình Dương', district: 'Thủ Dầu Một', ward: 'Phú Cường', address: '20 Đại lộ Bình Dương' },
  { name: 'Đỗ Thùy Linh', phone: '0908889999', email: 'linh.do@gmail.com', province: 'Đồng Nai', district: 'Biên Hòa', ward: 'Tân Tiến', address: '55 Đồng Khởi' },
];

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Chức năng tạo đơn ảo bị vô hiệu hóa hoàn toàn trên môi trường production.', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }
  return NextResponse.json(
    { success: false, error: 'Phương thức không được hỗ trợ', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  );
}

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Chức năng tạo đơn ảo bị vô hiệu hóa hoàn toàn trên môi trường production.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const session = await getAdminSession();
    if (!session || !hasPermission(session, 'system.seed')) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có quyền thực thi lệnh seed hệ thống.', code: 'FORBIDDEN' },
        { status: !session ? 401 : 403 }
      );
    }
    // 1. Get existing products
    const prodsRes = await query(`SELECT id, name, price, unit, thumbnail FROM products WHERE is_active = true;`);
    const prods = prodsRes.rows;

    if (prods.length === 0) {
      return NextResponse.json({ success: false, error: 'Chưa có sản phẩm trong DB để tạo đơn mẫu' }, { status: 400 });
    }

    const statuses = ['PENDING', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'COMPLETED', 'COMPLETED'];
    let createdCount = 0;

    for (let i = 0; i < 8; i++) {
      const cust = SAMPLE_CUSTOMERS[i % SAMPLE_CUSTOMERS.length];
      const status = statuses[i % statuses.length];
      const orderCode = `TSF${Date.now().toString().slice(-6)}${i}`;
      const orderId = `ord_sample_${Date.now()}_${i}`;

      // Pick 1-3 random products
      const numItems = 1 + (i % 3);
      const selectedProds = prods.slice(i % prods.length, (i % prods.length) + numItems);
      if (selectedProds.length === 0) selectedProds.push(prods[0]);

      let subtotal = 0;
      const orderItemsToInsert: any[] = [];

      selectedProds.forEach((p, idx) => {
        const qty = 2 + ((i + idx) % 4);
        const itemPrice = parseInt(p.price, 10);
        subtotal += itemPrice * qty;
        orderItemsToInsert.push({
          id: `item_${orderId}_${idx}`,
          orderId,
          productId: p.id,
          name: p.name,
          price: itemPrice,
          quantity: qty,
          unit: p.unit || '1 chai',
          thumbnail: p.thumbnail,
        });
      });

      const shippingFee = subtotal > 300000 ? 0 : 25000;
      const total = subtotal + shippingFee;

      // Adjust date to spread across past 7 days
      const daysAgo = i % 6;
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - daysAgo);
      orderDate.setHours(8 + (i * 2) % 12, (i * 17) % 60);

      await query(
        `INSERT INTO orders (
          id, order_code, full_name, phone, email, province, district, ward, address,
          note, payment_method, shipping_fee, subtotal, total, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);`,
        [
          orderId,
          orderCode,
          cust.name,
          cust.phone,
          cust.email,
          cust.province,
          cust.district,
          cust.ward,
          cust.address,
          i % 2 === 0 ? 'Giao giờ hành chính giúp em' : null,
          i % 3 === 0 ? 'bank_transfer' : 'cod',
          shippingFee,
          subtotal,
          total,
          status,
          orderDate,
        ]
      );

      for (const item of orderItemsToInsert) {
        await query(
          `INSERT INTO order_items (id, order_id, product_id, name, price, quantity, unit, thumbnail)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            item.id,
            item.orderId,
            item.productId,
            item.name,
            item.price,
            item.quantity,
            item.unit,
            item.thumbnail,
          ]
        );
      }

      createdCount++;
    }

    await writeAuditLog({
      adminId: session.userId,
      adminUsername: session.username,
      role: session.role,
      action: 'SYSTEM_SEED',
      entityType: 'SYSTEM',
      afterJson: { createdCount },
    });

    return NextResponse.json({
      success: true,
      message: `Đã tạo thành công ${createdCount} đơn hàng mẫu vào database WebTSF`,
    });
  } catch (error: any) {
    console.error('Error seeding sample orders:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
