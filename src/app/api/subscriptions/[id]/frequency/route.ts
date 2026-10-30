import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth';
import { updateSubscriptionFrequency } from '@/lib/membership/repository';
import { SubscriptionFrequency } from '@/types/membership';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getUserSession();
    if (!session?.id) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { frequency, preferredDayOfWeek } = body;

    if (!frequency || !['1_WEEK', '2_WEEKS', '4_WEEKS'].includes(frequency)) {
      return NextResponse.json({ success: false, error: 'Tần suất giao hàng không hợp lệ (1_WEEK, 2_WEEKS, 4_WEEKS).' }, { status: 400 });
    }

    const newNextDeliveryDate = await updateSubscriptionFrequency(
      id,
      session.id,
      frequency as SubscriptionFrequency,
      preferredDayOfWeek ? Number(preferredDayOfWeek) : undefined
    );

    const formattedDate = new Date(newNextDeliveryDate).toLocaleDateString('vi-VN');

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật chu kỳ giao hàng thành công! Kỳ giao tiếp theo sẽ là ngày ${formattedDate}.`,
      newNextDeliveryDate,
    });
  } catch (error: any) {
    console.error('Error in update subscription frequency:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi cập nhật tần suất giao hàng.') }, { status: 500 });
  }
}
