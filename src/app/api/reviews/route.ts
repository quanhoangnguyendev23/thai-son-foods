import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth';
import {
  getProductReviews,
  createProductReview,
  checkAndRecordReviewRateLimit,
  normalizePhoneNumber,
} from '@/lib/reviews/repository';
import { CreateReviewInput } from '@/types/reviews';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>?/gm, '').trim();
}

const VN_PHONE_REGEX = /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId') || searchParams.get('slug') || '';

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã sản phẩm (productId)' },
        { status: 400 }
      );
    }

    const ratingParam = searchParams.get('rating');
    const rating = ratingParam ? parseInt(ratingParam, 10) : undefined;
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';
    const hasImagesOnly = searchParams.get('hasImagesOnly') === 'true';
    const sort = (searchParams.get('sort') as 'newest' | 'helpful') || 'helpful';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const data = await getProductReviews(productId, {
      rating,
      verifiedOnly,
      hasImagesOnly,
      sort,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: data.reviews,
      total: data.total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Error in GET /api/reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi tải danh sách đánh giá. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession();
    const body = await req.json();

    const {
      productId,
      customerName,
      customerPhone,
      variantInfo,
      rating,
      title,
      comment,
      images,
      orderId,
    } = body;

    // 1. Kiểm tra mã sản phẩm
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Mã sản phẩm không hợp lệ' },
        { status: 400 }
      );
    }

    // 2. Kiểm tra rating nguyên 1-5
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn số sao đánh giá nguyên từ 1 đến 5' },
        { status: 400 }
      );
    }

    // 3. Kiểm tra họ tên
    const cleanCustomerName = stripHtml(customerName || session?.fullName || 'Khách hàng Thái Sơn');
    if (!cleanCustomerName || cleanCustomerName.length > 150) {
      return NextResponse.json(
        { success: false, error: 'Họ tên người đánh giá tối đa 150 ký tự' },
        { status: 400 }
      );
    }

    // 4. Kiểm tra số điện thoại (nếu có cung cấp)
    const rawPhone = (customerPhone || session?.phone || '').trim();
    if (rawPhone) {
      const cleanPhoneDigits = rawPhone.replace(/\s+/g, '');
      if (!VN_PHONE_REGEX.test(cleanPhoneDigits)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam hợp lệ (ví dụ: 0123456789 hoặc +84123456789)',
          },
          { status: 400 }
        );
      }
    }

    // 5. Kiểm tra tiêu đề (<= 255 ký tự)
    const cleanTitle = stripHtml(title || '');
    if (!cleanTitle) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập tiêu đề tóm tắt đánh giá' },
        { status: 400 }
      );
    }
    if (cleanTitle.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Tiêu đề đánh giá không được vượt quá 255 ký tự' },
        { status: 400 }
      );
    }

    // 6. Kiểm tra nội dung (10 - 2000 ký tự)
    const cleanComment = stripHtml(comment || '');
    if (!cleanComment || cleanComment.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Nội dung nhận xét tối thiểu 10 ký tự' },
        { status: 400 }
      );
    }
    if (cleanComment.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Nội dung nhận xét không được vượt quá 2000 ký tự' },
        { status: 400 }
      );
    }

    // 7. Rate Limit & Chống spam (tối đa 3 lượt/IP/giờ, chặn trùng lặp trong 24h)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateResult = await checkAndRecordReviewRateLimit({
      ip,
      phone: rawPhone,
      userId: session?.id,
      productId: productId.trim(),
      comment: cleanComment,
    });

    if (!rateResult.allowed) {
      return NextResponse.json(
        { success: false, error: rateResult.error || 'Yêu cầu bị từ chối do vượt quá tần suất cho phép' },
        { status: 429 }
      );
    }

    const input: CreateReviewInput = {
      productId: productId.trim(),
      customerName: cleanCustomerName,
      customerPhone: rawPhone || undefined,
      variantInfo: variantInfo ? stripHtml(variantInfo) : 'Lốc 7 chai (330ml)',
      rating: numRating,
      title: cleanTitle,
      comment: cleanComment,
      images: Array.isArray(images)
        ? images
            .filter(
              (s: unknown): s is string =>
                typeof s === 'string' &&
                /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) &&
                s.length <= 400_000
            )
            .slice(0, 3)
        : [],
      orderId,
    };

    const result = await createProductReview(input, session?.id);

    const isApproved = result.review.status === 'APPROVED';
    const message = isApproved
      ? 'Cảm ơn bạn! Đánh giá đã được ghi nhận với huy hiệu Đã mua hàng.'
      : 'Cảm ơn bạn, đánh giá sẽ hiển thị sau khi được duyệt.';

    return NextResponse.json({
      success: true,
      message,
      data: result.review,
      isVerifiedBuyer: result.isVerified,
    });
  } catch (error: any) {
    console.error('Error in POST /api/reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi khi gửi đánh giá. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
