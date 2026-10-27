import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getUserSession } from '@/lib/auth';
import { getClientIp, UNKNOWN_CLIENT_IP } from '@/lib/runtimeConfig';
import { voteHelpfulReview } from '@/lib/reviews/repository';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu mã đánh giá' }, { status: 400 });
    }

    const session = await getUserSession();

    // Sinh fingerprint client dựa trên IP và User-Agent để chống spam
    const clientIp = getClientIp(req.headers) ?? UNKNOWN_CLIENT_IP;
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const rawFp = `${clientIp}_${userAgent}`;
    const fingerprint = crypto.createHash('sha256').update(rawFp).digest('hex').slice(0, 32);

    const result = await voteHelpfulReview(id, fingerprint, session?.id);

    if (result.alreadyVoted) {
      return NextResponse.json({
        success: false,
        message: 'Bạn đã bấm hữu ích cho đánh giá này rồi.',
        helpfulCount: result.helpfulCount,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Cảm ơn phản hồi của bạn!',
      helpfulCount: result.helpfulCount,
    });
  } catch (error: any) {
    console.error('Error in POST /api/reviews/[id]/helpful:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi ghi nhận đánh giá hữu ích' },
      { status: 500 }
    );
  }
}
