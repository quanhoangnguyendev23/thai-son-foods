/**
 * Định nghĩa Type & Interface cho Phân hệ Hội viên & Subscribe & Save
 */

export type MembershipTierCode = 'FREE' | 'PRIME_MONTHLY' | 'PRIME_YEARLY';

export type MembershipStatus =
  | 'STANDARD_FREE'
  | 'TRIAL_ACTIVE'
  | 'PAID_ACTIVE'
  | 'RENEWAL_DUE'
  | 'PAUSED'
  | 'CANCELLED_GRACE'
  | 'EXPIRED_CHURN'
  | 'WIN_BACK';

export type SubscriptionFrequency = '1_WEEK' | '2_WEEKS' | '4_WEEKS';

export type SubscriptionStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export type SubscriptionScheduleStatus =
  | 'SCHEDULED'
  | 'REMINDER_SENT'
  | 'ORDER_GENERATED'
  | 'SKIPPED'
  | 'CANCELLED';

export interface MembershipTier {
  id: string;
  code: MembershipTierCode;
  name: string;
  price: number;
  billingCycle: 'none' | 'month' | 'year';
  discountRate: number;
  freeShipping: boolean;
  pointRate: number;
  description?: string | null;
  isActive: boolean;
}

export interface UserMembership {
  id: string;
  userId: string;
  tierId: string;
  status: MembershipStatus;
  startedAt: Date | string;
  expiresAt: Date | string;
  autoRenew: boolean;
  cancelledAt?: Date | string | null;
  cancelReason?: string | null;
  pausedUntil?: Date | string | null;
}

export interface SubscriptionItem {
  id: string;
  subscriptionId: string;
  productId: string;
  variantId?: string | null;
  name: string;
  unit: string;
  priceSnapshot: number;
  discountRate: number;
  finalPrice: number;
  quantity: number;
}

export interface Subscription {
  id: string;
  subscriptionCode: string;
  userId: string;
  status: SubscriptionStatus;
  deliveryFrequency: SubscriptionFrequency;
  preferredDayOfWeek: number; // 2 (Thứ Hai) .. 8 (Chủ Nhật)
  preferredTimeSlot: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  province: string;
  district: string;
  ward: string;
  storeCode?: string | null;
  paymentMethod: string;
  nextDeliveryDate: Date | string;
  lastDeliveredDate?: Date | string | null;
  items: SubscriptionItem[];
}

export interface SubscriptionSchedule {
  id: string;
  subscriptionId: string;
  scheduledDate: Date | string;
  status: SubscriptionScheduleStatus;
  generatedOrderId?: string | null;
  skipReason?: string | null;
  reminderSentAt?: Date | string | null;
}
