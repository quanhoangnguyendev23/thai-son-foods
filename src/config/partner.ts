/**
 * CONFIGURATION & POLICY ENGINE - PHÂN HỆ ĐỐI TÁC (PARTNER / CTV / ĐẠI LÝ)
 * 
 * Toàn bộ các thông số nghiệp vụ dưới đây được cấu hình tập trung với giá trị mặc định chuẩn (Provisional Values),
 * hỗ trợ ghi đè qua biến môi trường hoặc cấu hình động từ Database (bảng partner_commission_policies, dealer_tiers).
 * Tuyệt đối không hard-code các giá trị này trong logic mã nguồn.
 */

export const PARTNER_CONFIG = {
  // 1. Quản lý Cookie & Attribution
  REFERRAL: {
    COOKIE_NAME: 'tsf_partner_ref',
    COOKIE_EXPIRY_DAYS: 30, // Thời gian lưu cookie giới thiệu (mặc định 30 ngày)
    ATTRIBUTION_WINDOW_DAYS: 30, // Khung thời gian ghi nhận đơn hàng sau cú click cuối
    CODE_PREFIX: 'TSF-CTV-', // Tiền tố mã đối tác CTV
    DEALER_PREFIX: 'TSF-DL-', // Tiền tố mã đối tác Đại lý
  },

  // 2. Chính sách Hoa hồng CTV mặc định (Provisional Default Rate)
  COMMISSION: {
    DEFAULT_RATE_PERCENT: 10.0, // 10% hoa hồng trên giá trị sản phẩm hợp lệ
    BASE_TYPE: 'PRODUCT_SUBTOTAL' as const, // 'PRODUCT_SUBTOTAL' (trừ phí ship) | 'ORDER_TOTAL'
    MIN_ORDER_VALUE_FOR_COMMISSION: 50000, // Đơn tối thiểu 50.000đ mới sinh hoa hồng
    HOLDING_DAYS_UNTIL_AVAILABLE: 7, // Số ngày chờ khiếu nại/hoàn trả trước khi tiền khả dụng (available_at)
  },

  // 3. Quy định Rút tiền & Quyết toán (Payout)
  PAYOUT: {
    MIN_PAYOUT_AMOUNT: 200000, // Số tiền rút tối thiểu: 200.000 VNĐ
    MAX_PAYOUT_PER_DAY: 50000000, // Hạn mức rút tối đa mỗi ngày: 50.000.000 VNĐ
    AUTO_APPROVE_BELOW: 0, // 0 = Bắt buộc kế toán/admin duyệt thủ công mọi yêu cầu rút tiền
    FEE_PERCENT: 0.0, // Phí rút tiền (mặc định 0%)
  },

  // 4. Tiêu chí nâng cấp CTV -> Đại lý (Provisional Dealer Upgrade Thresholds)
  DEALER_UPGRADE: {
    MIN_MONTHLY_REVENUE: 20000000, // Doanh số CTV tích lũy tối thiểu 20.000.000 VNĐ
    MIN_MONTHLY_ORDERS: 30, // Tối thiểu 30 đơn hàng giao thành công (COMPLETED)
    AUTO_UPGRADE_ENABLED: false, // false = Bắt buộc CTV gửi yêu cầu và Admin phê duyệt
  },

  // 5. Chính sách chiết khấu Đại lý mặc định theo Tier (Provisional Tiers)
  DEALER_TIERS_DEFAULT: [
    {
      code: 'TIER_1',
      name: 'Đại lý Đồng (Cơ bản)',
      discountRate: 15.0, // Chiết khấu 15%
      minOrderBottles: 50, // Số lượng chai tối thiểu mỗi đơn sỉ: 50 chai
      creditLimit: 0, // Không cấp công nợ, thanh toán trước
    },
    {
      code: 'TIER_2',
      name: 'Đại lý Bạc (Tiêu chuẩn)',
      discountRate: 20.0, // Chiết khấu 20%
      minOrderBottles: 150, // Số lượng chai tối thiểu: 150 chai
      creditLimit: 10000000, // Hạn mức công nợ 10.000.000 VNĐ
    },
    {
      code: 'TIER_3',
      name: 'Đại lý Vàng (Chiến lược)',
      discountRate: 25.0, // Chiết khấu 25%
      minOrderBottles: 300, // Số lượng chai tối thiểu: 300 chai
      creditLimit: 30000000, // Hạn mức công nợ 30.000.000 VNĐ
    },
  ],

  // 6. Quy định bảo mật & Chống gian lận (Anti-Fraud)
  SECURITY: {
    BLOCK_SELF_REFERRAL: true, // Chặn CTV tự đặt qua mã của chính mình
    MATCH_FIELDS: ['phone', 'email', 'userId'] as const,
    OTP_EXPIRY_SECONDS: 300, // OTP hết hạn sau 5 phút
    OTP_MAX_ATTEMPTS: 5, // Tối đa 5 lần nhập sai OTP
  },
} as const;

/** Chiết khấu mặc định (phần trăm) khi hạng đại lý thiếu hoặc có giá trị không hợp lệ */
export const DEFAULT_DEALER_DISCOUNT_PERCENT = 15;

/**
 * Chiết khấu của hạng đại lý, đơn vị phần trăm (dealer_tiers.discount_rate).
 * 0% là giá trị hợp lệ; chỉ giá trị thiếu, không phải số hoặc ngoài 0 đến 100 mới dùng mặc định
 * (viết `Number(x) || 15` sẽ đổi hạng 0% thành 15%).
 */
export function resolveDealerDiscountPercent(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_DEALER_DISCOUNT_PERCENT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_DEALER_DISCOUNT_PERCENT;
}
