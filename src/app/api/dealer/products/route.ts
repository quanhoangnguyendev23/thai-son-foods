import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPartnerSession } from '@/lib/partner/auth';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
        { success: false, error: 'Chức năng bảng giá sỉ chỉ dành riêng cho tài khoản Đại lý chính thức.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (session.lifecycleStatus !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Tài khoản Đại lý hiện không ở trạng thái hoạt động.', code: 'ACCOUNT_NOT_ACTIVE' },
        { status: 403 }
      );
    }

    // 1. Lấy thông tin Tier đại lý hiện tại
    const tierId = session.tierId || 'tier_bronze';
    const tierRes = await query(
      `SELECT * FROM dealer_tiers WHERE id = $1 LIMIT 1;`,
      [tierId]
    );

    const tier = tierRes.rows[0] || {
      id: 'tier_bronze',
      tier_name: 'Đại lý Đồng',
      tier_code: 'TIER_1',
      discount_rate: 15.00,
      credit_limit: 0,
    };

    const discountRate = Number(tier.discount_rate) || 15.00;

    // 2. Lấy danh sách sản phẩm đang bán
    const prodRes = await query(
      `SELECT id, name, slug, price, cost_price, thumbnail, is_active, stock_quantity
       FROM products
       WHERE is_active = true
       ORDER BY name ASC;`
    );

    const products = prodRes.rows.map(prod => {
      const retailPrice = Math.round(Number(prod.price) || 0);
      const wholesalePrice = Math.round(retailPrice * (1 - discountRate / 100));
      return {
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        retailPrice,
        discountRate,
        wholesalePrice,
        savingAmount: retailPrice - wholesalePrice,
        imageUrl: prod.thumbnail,
        stockQuantity: prod.stock_quantity,
      };
    });

    return NextResponse.json({
      success: true,
      dealer: {
        partnerId: session.id,
        partnerCode: session.partnerCode,
        fullName: session.fullName,
        tier: {
          id: tier.id,
          name: tier.tier_name,
          code: tier.tier_code,
          discountRate,
          creditLimit: Number(tier.credit_limit) || 0,
        },
      },
      products,
    });
  } catch (error: any) {
    console.error('[DealerProducts] Error fetching wholesale products:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi hệ thống') }, { status: 500 });
  }
}
