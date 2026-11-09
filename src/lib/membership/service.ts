/**
 * Dịch vụ Nghiệp vụ Hội viên & Subscribe & Save Thái Sơn Foods
 * Tuân thủ bảo toàn hệ thống Core V1.0, hỗ trợ múi giờ Asia/Ho_Chi_Minh,
 * bảo vệ Zero-Oversell, và chống gian lận/đăng ký trùng lặp.
 */

import { MEMBERSHIP_CONFIG } from '@/config/membership';
import { INVENTORY_CONFIG } from '@/config/inventory';
import { calculateHaversineDistance } from '@/lib/geo';

// ==============================================================================
// 1. MÚI GIỜ ASIA/HO_CHI_MINH & TÍNH TOÁN LỊCH GIAO ĐỊNH KỲ
// ==============================================================================

/**
 * Lấy thời gian hiện tại chuẩn hóa theo múi giờ Việt Nam (UTC+7)
 */
export function getVietnamDate(dateInput: Date | string = new Date()): Date {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  // Chuẩn hóa theo múi giờ Asia/Ho_Chi_Minh
  const vnTimeStr = d.toLocaleString('en-US', { timeZone: MEMBERSHIP_CONFIG.TIMEZONE });
  return new Date(vnTimeStr);
}

/**
 * Định dạng ngày theo chuẩn Việt Nam (DD/MM/YYYY) tại múi giờ Asia/Ho_Chi_Minh
 */
export function formatVietnamDate(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: MEMBERSHIP_CONFIG.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Tính ngày giao hàng tiếp theo dựa trên chu kỳ (1 tuần, 2 tuần, 4 tuần) và thứ mong muốn
 * @param fromDate Ngày bắt đầu tính
 * @param frequency Chu kỳ giao
 * @param preferredDayOfWeek Thứ mong muốn (2: Thứ Hai .. 8: Chủ Nhật)
 */
export function calculateNextDeliveryDate(
  fromDate: Date | string,
  frequency: '1_WEEK' | '2_WEEKS' | '4_WEEKS',
  preferredDayOfWeek: number = 2
): Date {
  const start = getVietnamDate(fromDate);
  const cycleDays = MEMBERSHIP_CONFIG.DELIVERY_FREQUENCIES[frequency]?.days || 7;

  // Cộng số ngày chu kỳ
  const target = new Date(start.getTime() + cycleDays * 24 * 60 * 60 * 1000);

  // Điều chỉnh về đúng thứ mong muốn (2: Mon .. 8: Sun)
  // Trong JS getDay(): 0 là Sun, 1 là Mon, 2 là Tue...
  const jsTargetDay = target.getDay();
  const currentDayOfWeek = jsTargetDay === 0 ? 8 : jsTargetDay + 1; // Quy đổi về 2..8

  let diffDays = preferredDayOfWeek - currentDayOfWeek;
  if (diffDays < 0) {
    diffDays += 7;
  }

  target.setDate(target.getDate() + diffDays);
  target.setHours(8, 0, 0, 0); // Đặt mặc định 08:00 sáng tại VN
  return target;
}

/**
 * Kiểm tra xem đã qua giờ cắt đơn (Cutoff Time) cho ngày mai chưa (18:00 giờ VN)
 */
export function isCutoffTimePassed(
  currentDate: Date = new Date(),
  cutoffHour: number = MEMBERSHIP_CONFIG.CUTOFF_HOUR
): boolean {
  const vnDate = getVietnamDate(currentDate);
  return vnDate.getHours() >= cutoffHour;
}

/**
 * Tính mốc thời gian cắt đơn (18:00 của ngày T-1 trước ngày giao hàng) theo giờ Việt Nam
 */
export function getDeliveryCutoffTime(
  scheduledDateInput: Date | string,
  cutoffHour: number = MEMBERSHIP_CONFIG.CUTOFF_HOUR
): Date {
  const schedVn = getVietnamDate(scheduledDateInput);
  const cutoff = new Date(schedVn);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(cutoffHour, 0, 0, 0);
  return cutoff;
}

/**
 * Kiểm tra xem khách có được quyền Bỏ qua kỳ này (One-Click Skip) không:
 * - Được phép: Bấm trước 18:00 ngày T-1
 * - Bị từ chối: Bấm từ 18:00 ngày T-1 trở đi (xưởng đã nấu đêm và xếp xe lạnh)
 */
export function isSkipAllowed(
  scheduledDateInput: Date | string,
  nowInput: Date | string = new Date(),
  cutoffHour: number = MEMBERSHIP_CONFIG.CUTOFF_HOUR
): {
  allowed: boolean;
  cutoffTime: Date;
  reason?: string;
} {
  const cutoffTime = getDeliveryCutoffTime(scheduledDateInput, cutoffHour);
  const nowVn = getVietnamDate(nowInput);

  if (nowVn.getTime() >= cutoffTime.getTime()) {
    return {
      allowed: false,
      cutoffTime,
      reason: `Đã qua giờ cắt đơn (${cutoffHour}:00 ngày T-1). Xưởng nấu đêm đã lên lịch sản xuất và điều phối xe lạnh, không thể bỏ qua kỳ giao này.`,
    };
  }

  return {
    allowed: true,
    cutoffTime,
  };
}

// ==============================================================================
// 2. CHÍNH SÁCH ĐỔI GIÁ & BẢO LƯU GIÁ SNAPSHOT (PRICE SNAPSHOTTING)
// ==============================================================================

export interface PriceSnapshotCalculationInput {
  catalogPrice?: number;
  priceSnapshot?: number;
  snapshotRetailPrice?: number;
  discountRate?: number;
  discountPercent?: number;
  quantity?: number;
  useCatalogPriceIfLower?: boolean;
}

/**
 * Tính giá sản phẩm trong kỳ giao định kỳ:
 * - Bảo đảm giá snapshot được tôn trọng khi giá niêm yết tăng
 * - Nếu giá niêm yết giảm, tự động bảo vệ quyền lợi khách hàng bằng cách lấy giá thấp hơn
 */
export function calculateSubscriptionItemPrice(input: PriceSnapshotCalculationInput): {
  appliedBasePrice: number;
  discountAmount: number;
  finalPrice: number;
  appliedFinalPrice: number;
  subtotal: number;
  totalSaved: number;
} {
  const snap = input.priceSnapshot ?? input.snapshotRetailPrice ?? 0;
  const cat = input.catalogPrice ?? snap;
  const rate = input.discountRate ?? ((input.discountPercent ?? MEMBERSHIP_CONFIG.SUBSCRIPTION_DISCOUNT_PERCENT) / 100);
  const qty = input.quantity ?? 1;
  const useCatalogPriceIfLower = input.useCatalogPriceIfLower ?? true;

  // Lấy giá cơ sở: ưu tiên snapshot, nhưng nếu catalog giảm sâu thì lấy catalog
  let basePrice = snap > 0 ? snap : cat;
  if (useCatalogPriceIfLower && cat < basePrice) {
    basePrice = cat;
  }

  const discountAmount = Math.round(basePrice * rate);
  const finalPrice = Math.max(0, basePrice - discountAmount);
  const subtotal = finalPrice * qty;
  const totalSaved = discountAmount * qty;

  return {
    appliedBasePrice: basePrice,
    discountAmount,
    finalPrice,
    appliedFinalPrice: finalPrice,
    subtotal,
    totalSaved,
  };
}

// ==============================================================================
// 3. KIỂM SOÁT TỒN KHO & HẾT HÀNG (ZERO-OVERSELL GUARANTEE)
// ==============================================================================

export interface StockValidationItem {
  productId: string;
  productName: string;
  requestedBottles: number;
}

export interface StoreStockItem {
  productId: string;
  stockQuantity: number;
  reserved: number;
  safetyStock?: number;
}

/**
 * Kiểm tra tồn kho khả dụng tại chi nhánh trước khi xác nhận đơn Subscribe & Save
 */
export function validateSubscriptionStock(
  items: StockValidationItem[],
  storeStockMap: Map<string, StoreStockItem>
): {
  isAvailable: boolean;
  insufficientItems: Array<{ productId: string; requested: number; available: number; name: string }>;
} {
  const insufficientItems: Array<{ productId: string; requested: number; available: number; name: string }> = [];

  for (const item of items) {
    const stock = storeStockMap.get(item.productId);
    const stockQty = stock?.stockQuantity || 0;
    const reservedQty = stock?.reserved || 0;
    const safetyQty = stock?.safetyStock || 0;

    const available = Math.max(0, stockQty - reservedQty - safetyQty);

    if (available < item.requestedBottles) {
      insufficientItems.push({
        productId: item.productId,
        requested: item.requestedBottles,
        available,
        name: item.productName,
      });
    }
  }

  return {
    isAvailable: insufficientItems.length === 0,
    insufficientItems,
  };
}

// ==============================================================================
// 4. KIỂM SOÁT BÁN KÍNH ĐỊA LÝ 25KM (GEO-ROUTING DISTANCE LIMIT)
// ==============================================================================

export function validateDeliveryDistance(
  customerLat: number,
  customerLng: number,
  storeLat: number,
  storeLng: number,
  maxRadiusKm: number = MEMBERSHIP_CONFIG.MAX_DELIVERY_RADIUS_KM
): {
  isValid: boolean;
  distanceKm: number;
  error?: string;
} {
  const distanceKm = calculateHaversineDistance(customerLat, customerLng, storeLat, storeLng);

  if (distanceKm > maxRadiusKm) {
    return {
      isValid: false,
      distanceKm,
      error: `Khoảng cách giao hàng (${distanceKm.toFixed(1)}km) vượt quá bán kính phục vụ tối đa (${maxRadiusKm}km) của chi nhánh.`,
    };
  }

  return {
    isValid: true,
    distanceKm,
  };
}

/**
 * Kiểm tra bán kính giao hàng theo km trực tiếp
 */
export function validateDeliveryRadius(
  distanceKm: number,
  maxRadiusKm: number = MEMBERSHIP_CONFIG.MAX_DELIVERY_RADIUS_KM
): {
  isValid: boolean;
  distanceKm: number;
  error?: string;
} {
  if (distanceKm > maxRadiusKm) {
    return {
      isValid: false,
      distanceKm,
      error: `Khoảng cách giao hàng (${distanceKm.toFixed(1)}km) vượt quá bán kính phục vụ tối đa (${maxRadiusKm}km) của chi nhánh xe lạnh.`,
    };
  }

  return {
    isValid: true,
    distanceKm,
  };
}

// ==============================================================================
// 5. CHÍNH SÁCH CHỐNG LẠM DỤNG & TỪ CHỐI COD (ANTI-ABUSE COD RULES)
// ==============================================================================

export interface CODValidationInput {
  orderTotal: number;
  pendingOrdersCount: number;
  lastOrderCreatedAt?: Date | string | null;
  phone: string;
  address: string;
  currentDate?: Date;
}

export function validateSubscriptionCOD(input: CODValidationInput): {
  isValid: boolean;
  error?: string;
  code?: string;
} {
  const cfg = INVENTORY_CONFIG.COD_VALIDATION;
  const now = input.currentDate || new Date();

  // 1. Kiểm tra giá trị đơn tối đa
  if (input.orderTotal > cfg.MAX_ORDER_VALUE) {
    return {
      isValid: false,
      error: `Đơn hàng vượt hạn mức COD tối đa (${(cfg.MAX_ORDER_VALUE / 1_000_000).toFixed(0)} triệu đồng). Vui lòng chuyển khoản trước.`,
      code: 'COD_MAX_VALUE_EXCEEDED',
    };
  }

  // 2. Kiểm tra số đơn PENDING cùng SĐT
  if (input.pendingOrdersCount >= cfg.MAX_PENDING_ORDERS_PER_PHONE) {
    return {
      isValid: false,
      error: `Số điện thoại của bạn đang có ${input.pendingOrdersCount} đơn chờ xử lý. Vui lòng hoàn tất hoặc hủy bớt trước khi tạo đơn mới.`,
      code: 'COD_PENDING_LIMIT_REACHED',
    };
  }

  // 3. Kiểm tra tần suất tạo đơn (Rate limit 5 phút)
  if (input.lastOrderCreatedAt) {
    const lastTime = new Date(input.lastOrderCreatedAt).getTime();
    const elapsedMinutes = (now.getTime() - lastTime) / (1000 * 60);
    if (elapsedMinutes < cfg.MIN_ORDER_INTERVAL_MINUTES) {
      return {
        isValid: false,
        error: `Bạn thao tác quá nhanh. Vui lòng đợi thêm ${Math.ceil(cfg.MIN_ORDER_INTERVAL_MINUTES - elapsedMinutes)} phút trước khi đặt đơn tiếp theo.`,
        code: 'COD_RATE_LIMIT_EXCEEDED',
      };
    }
  }

  // 4. Kiểm tra định dạng số điện thoại Việt Nam
  const cleanPhone = (input.phone || '').replace(/[\s\-\.]/g, '');
  if (!cfg.PHONE_REGEX.test(cleanPhone)) {
    return {
      isValid: false,
      error: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam 10 chữ số.',
      code: 'INVALID_PHONE_FORMAT',
    };
  }

  // 5. Kiểm tra độ dài địa chỉ
  if (!input.address || input.address.trim().length < cfg.MIN_ADDRESS_LENGTH) {
    return {
      isValid: false,
      error: 'Địa chỉ giao hàng quá ngắn (tối thiểu 10 ký tự). Vui lòng nhập số nhà, tên đường chi tiết.',
      code: 'INVALID_ADDRESS_LENGTH',
    };
  }

  return { isValid: true };
}

/**
 * Thẩm định điều kiện COD cho đăng ký định kỳ
 */
export function validateCodEligibility(input: {
  totalAmount?: number;
  orderTotal?: number;
  pendingOrdersCount?: number;
  recentPendingOrdersCount?: number;
  phone?: string;
  address?: string;
  lastOrderCreatedAt?: Date | string | null;
  currentDate?: Date;
}): {
  isEligible: boolean;
  isValid: boolean;
  error?: string;
  code?: string;
} {
  const result = validateSubscriptionCOD({
    orderTotal: input.orderTotal ?? input.totalAmount ?? 0,
    pendingOrdersCount: input.pendingOrdersCount ?? input.recentPendingOrdersCount ?? 0,
    phone: input.phone || '',
    address: input.address || '',
    lastOrderCreatedAt: input.lastOrderCreatedAt,
    currentDate: input.currentDate,
  });

  return {
    isEligible: result.isValid,
    isValid: result.isValid,
    error: result.error,
    code: result.code,
  };
}

// ==============================================================================
// 6. KIỂM SOÁT ĐĂNG KÝ TRÙNG LẶP (DUPLICATE REGISTRATION PREVENTION)
// ==============================================================================

export function checkDuplicateSubscription(
  firstArg: any,
  secondArg?: any,
  thirdArg?: any
): {
  isDuplicate: boolean;
  existingId?: string;
  error?: string;
} {
  let newUserId: string;
  let newProductId: string;
  let existingList: any[];

  if (typeof firstArg === 'object' && firstArg !== null && 'userId' in firstArg) {
    newUserId = firstArg.userId;
    newProductId = firstArg.productId;
    existingList = firstArg.existingSubscriptions || [];
  } else {
    newUserId = firstArg;
    newProductId = secondArg;
    existingList = thirdArg || [];
  }

  for (const s of existingList) {
    if (s.userId !== newUserId || s.status !== 'ACTIVE') continue;

    // Kiểm tra theo trường productId trực tiếp hoặc theo mảng items
    const hasProduct =
      s.productId === newProductId ||
      (Array.isArray(s.items) && s.items.some((it: any) => it.productId === newProductId));

    if (hasProduct) {
      return {
        isDuplicate: true,
        existingId: s.id || 'SUB-EXISTING',
        error: `Bạn đã có một hợp đồng đăng ký giao định kỳ đang hoạt động cho sản phẩm này. Vui lòng điều chỉnh trong trang cá nhân.`,
      };
    }
  }

  return { isDuplicate: false };
}
