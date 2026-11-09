import { NextRequest, NextResponse } from 'next/server';
import {
  renderOrderConfirmationEmail,
  renderOrderShippingEmail,
  renderOrderCompletedEmail,
  OrderEmailData,
} from '@/lib/email/templates';
import { sendOrderEmail, EmailType } from '@/lib/email/service';
import { getAdminSession } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const mockTestOrder: OrderEmailData = {
  orderCode: 'DH1234',
  fullName: 'Nguyễn Văn An',
  phone: '0987654321',
  email: 'khachhang@gmail.com',
  address: '123 Nguyễn Thị Minh Khai, Phường Bến Thành',
  district: 'Quận 1',
  province: 'TP. Hồ Chí Minh',
  paymentMethod: 'COD',
  shippingFee: 0,
  subtotal: 105000,
  total: 105000,
  note: 'Giao giờ hành chính, gọi trước khi đến 15 phút giúp mình.',
  storeCode: 'NH',
  storeAddress: 'Cửa hàng Vườn Lài: 298/4 Vườn Lài, P. Phú Thọ Hòa, Q. Tân Phú, TP. HCM',
  createdAt: new Date().toISOString(),
  items: [
    {
      name: 'Nha đam lá dứa tươi nguyên chất 350ml',
      price: 25000,
      quantity: 2,
      unit: 'Chai',
      thumbnail: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=300&q=80',
    },
    {
      name: 'Sữa bắp non thanh mát organic 330ml',
      price: 28000,
      quantity: 1,
      unit: 'Chai',
      thumbnail: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=300&q=80',
    },
    {
      name: 'Trà thảo mộc hoa cúc mật ong 350ml',
      price: 27000,
      quantity: 1,
      unit: 'Chai',
      thumbnail: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80',
    },
  ],
};

// GET: Trả về trực tiếp HTML để render preview trên iframe hoặc tab mới
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const session = await getAdminSession();
  const auth = requirePermission(session as any, 'system.seed');
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get('type') || 'confirmation').toLowerCase();
  const format = searchParams.get('format') || 'html';

  let rendered: { subject: string; html: string };

  if (type === 'shipping' || type === 'order_shipping') {
    rendered = renderOrderShippingEmail(mockTestOrder, {
      shipperName: 'Nguyễn Văn Tài (Tài xế giao nhanh TSF)',
      shipperPhone: '0961 888 888',
      storePhone: '1900 6868',
      storeAddress: mockTestOrder.storeAddress || undefined,
      estimatedDeliveryTime: '30 - 45 phút tới',
    });
  } else if (type === 'completed' || type === 'order_completed') {
    rendered = renderOrderCompletedEmail(mockTestOrder);
  } else {
    // confirmation mặc định
    rendered = renderOrderConfirmationEmail(mockTestOrder);
  }

  if (format === 'json') {
    return NextResponse.json({
      success: true,
      type,
      subject: rendered.subject,
      html: rendered.html,
      mockData: mockTestOrder,
    });
  }

  // Trả về HTML trực tiếp để xem trên trình duyệt
  return new NextResponse(rendered.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Email-Subject': encodeURIComponent(rendered.subject),
    },
  });
}

// POST: Gửi thử nghiệm một email đến địa chỉ mong muốn
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const session = await getAdminSession();
  const auth = requirePermission(session as any, 'system.seed');
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await req.json();
    const to = body.to?.trim();
    const type: EmailType = body.type || 'ORDER_CONFIRMATION';

    if (!to || !to.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp địa chỉ email hợp lệ' },
        { status: 400 }
      );
    }

    const testOrder: OrderEmailData = {
      ...mockTestOrder,
      email: to,
      orderCode: body.orderCode || `DH${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: body.fullName || mockTestOrder.fullName,
    };

    const shippingInfo = {
      shipperName: body.shipperName || 'Nguyễn Văn Tài (Tài xế TSF)',
      shipperPhone: body.shipperPhone || '0961 888 888',
      storePhone: '1900 6868',
      storeAddress: '45 Lê Duẩn, P. Bến Nghé, Quận 1, TP. HCM',
      estimatedDeliveryTime: '30 - 45 phút tới',
    };

    const result = await sendOrderEmail(type, testOrder, shippingInfo);

    return NextResponse.json({
      success: result.success,
      provider: result.provider,
      messageId: result.messageId,
      recipient: to,
      emailType: type,
      error: result.error,
      message:
        result.provider === 'MOCK'
          ? 'Hệ thống đang chạy ở chế độ MOCK (Chưa gắn RESEND_API_KEY hoặc SMTP). Email đã được ghi vào bảng log PostgreSQL!'
          : `Đã gửi email thành công qua cổng ${result.provider}! Vui lòng kiểm tra hòm thư của bạn.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi server' },
      { status: 500 }
    );
  }
}
