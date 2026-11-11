/**
 * Cấu hình nghiệp vụ Quản lý Kho & Giữ chỗ tồn kho Thái Sơn Foods
 * Không hardcode trong code logic - tất cả cấu hình tập trung tại đây.
 */

export const INVENTORY_CONFIG = {
  // Thời gian giữ chỗ cho đơn hàng PENDING (mặc định 24 giờ)
  RESERVATION_EXPIRY_HOURS: 24,

  // Ngưỡng cảnh báo sản phẩm sắp hết hàng tại chi nhánh
  LOW_STOCK_THRESHOLD: 5,

  // Chính sách chống lạm dụng COD
  COD_VALIDATION: {
    // Giá trị đơn COD tối đa (10 triệu - đơn lớn hơn cần xác nhận)
    MAX_ORDER_VALUE: 10_000_000,

    // Số đơn PENDING tối đa cùng SĐT (chống spam)
    MAX_PENDING_ORDERS_PER_PHONE: 3,

    // Thời gian tối thiểu giữa 2 đơn cùng SĐT (phút)
    MIN_ORDER_INTERVAL_MINUTES: 5,

    // SĐT Việt Nam hợp lệ (regex)
    PHONE_REGEX: /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/,

    // Yêu cầu địa chỉ tối thiểu (số ký tự)
    MIN_ADDRESS_LENGTH: 10,
  },

  // Chính sách phí vận chuyển
  SHIPPING: {
    // Mặc định hiện tại: 30.000đ, miễn phí từ 200.000đ
    DEFAULT_FEE: 30000,
    FREE_SHIPPING_THRESHOLD: 200000,

    // Phí theo khoảng cách (chốt 04/11/2026): km = quãng đường đi thật từ cửa hàng phục vụ tới ghim của khách
    // - Trong 10 km: đơn dưới 200.000đ phí 30.000đ, đơn từ 200.000đ miễn phí
    // - Vùng đệm: 10 km đến dưới 11 km chưa phụ thu (bản đồ có thể lệch vài trăm mét)
    // - Phụ thu xa (cộng thêm cho mọi đơn): từ 11 km +20.000đ, từ 15 km +35.000đ
    // - Trên 20 km: không nhận giao
    DISTANCE_BASED: {
      ENABLED: true,
      FREE_RADIUS_KM: 10, // Mốc hiển thị cho khách: "miễn phí ship trong 10 km"
      MAX_DELIVERY_RADIUS_KM: 20,
      SURCHARGE_TIERS: [
        { fromKm: 15, fee: 35000 },
        { fromKm: 11, fee: 20000 },
      ],
    },
  },
} as const;

/** Phụ thu xa theo km (0 nếu chưa tới 11 km) */
export function getDistanceSurcharge(distanceKm?: number | null): number {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  // Làm tròn lên 0,1 km (10,95 km -> 11,0 km)
  const km = Math.ceil(distanceKm * 10) / 10;
  for (const tier of INVENTORY_CONFIG.SHIPPING.DISTANCE_BASED.SURCHARGE_TIERS) {
    if (km >= tier.fromKm) return tier.fee;
  }
  return 0;
}

/**
 * Hàm tính phí vận chuyển dùng chung cho Client & Server
 * Phí = phí cơ bản (30.000đ, hoặc 0đ nếu đơn từ 200.000đ) + phụ thu xa theo km.
 * Không có km (chưa có vị trí) -> chỉ tính phí cơ bản.
 */
export function calculateShippingFee(
  subtotal: number,
  distanceKm?: number | null
): {
  fee: number;
  isFree: boolean;
  isBeyondRadius: boolean;
  reason?: string;
  baseFee: number;
  surcharge: number;
} {
  const shipping = INVENTORY_CONFIG.SHIPPING;
  const distConfig = shipping.DISTANCE_BASED;
  const baseFee = subtotal >= shipping.FREE_SHIPPING_THRESHOLD ? 0 : shipping.DEFAULT_FEE;
  const hasKm = distConfig.ENABLED && typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm >= 0;

  if (hasKm && (distanceKm as number) > distConfig.MAX_DELIVERY_RADIUS_KM) {
    return {
      fee: baseFee,
      isFree: false,
      isBeyondRadius: true,
      // Làm tròn LÊN 0,1 km (cùng cách với phụ thu): 20,04 km hiện "20.1 km", không hiện "20.0 km vượt quá 20 km"
      reason: `Khoảng cách (${(Math.ceil((distanceKm as number) * 10) / 10).toFixed(1)} km) vượt quá bán kính giao tối đa (${distConfig.MAX_DELIVERY_RADIUS_KM} km). Vui lòng chọn cửa hàng gần hơn hoặc tự đến lấy.`,
      baseFee,
      surcharge: 0,
    };
  }

  const surcharge = hasKm ? getDistanceSurcharge(distanceKm) : 0;
  const fee = baseFee + surcharge;
  return { fee, isFree: fee === 0, isBeyondRadius: false, baseFee, surcharge };
}
