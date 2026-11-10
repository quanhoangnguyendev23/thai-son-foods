import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { getUserSession, UserJWTPayload } from '@/lib/auth';

export interface PartnerProfileData {
  id: string;
  userId: string;
  partnerCode: string;
  partnerType: 'CTV' | 'DEALER';
  lifecycleStatus: 'LITE' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  phone: string;
  fullName: string;
  email: string | null;
  idCardNumber: string | null;
  idCardIssuedDate: string | null;
  idCardIssuedPlace: string | null;
  taxCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankBranch: string | null;
  tierId: string | null;
  referralCount: number;
  totalRevenueGenerated: number;
  totalCommissionEarned: number;
  currentBalance: number;
  verifiedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  suspensionReason: string | null;
  createdAt: string;
}

export interface PartnerSession extends PartnerProfileData {
  user: UserJWTPayload;
  partner: PartnerProfileData;
}

/**
 * Lấy phiên đăng nhập của Đối tác hiện tại từ cookie tsf_user_session hoặc Bearer token
 */
export async function getPartnerSession(req?: Request): Promise<PartnerSession | null> {
  let user: UserJWTPayload | null = null;

  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const { getUserSessionFromToken } = await import('@/lib/auth');
      user = await getUserSessionFromToken(token);
    }

    if (!user) {
      const cookieHeader = req.headers.get('cookie') || '';
      const match = cookieHeader.match(/tsf_user_session=([^;]+)/);
      if (match) {
        const { getUserSessionFromToken } = await import('@/lib/auth');
        user = await getUserSessionFromToken(match[1]);
      }
    }
  }

  if (!user) {
    try {
      user = await getUserSession();
    } catch {
      user = null;
    }
  }

  if (!user || !user.id) {
    return null;
  }

  const res = await query(
    `SELECT 
      id, user_id AS "userId", partner_code AS "partnerCode", partner_type AS "partnerType",
      lifecycle_status AS "lifecycleStatus", phone, full_name AS "fullName", email,
      id_card_number AS "idCardNumber", id_card_issued_date AS "idCardIssuedDate",
      id_card_issued_place AS "idCardIssuedPlace", tax_code AS "taxCode",
      bank_name AS "bankName", bank_account_number AS "bankAccountNumber",
      bank_account_name AS "bankAccountName", bank_branch AS "bankBranch",
      tier_id AS "tierId", referral_count AS "referralCount",
      total_revenue_generated AS "totalRevenueGenerated",
      total_commission_earned AS "totalCommissionEarned",
      current_balance AS "currentBalance", verified_at AS "verifiedAt",
      approved_by AS "approvedBy", rejection_reason AS "rejectionReason",
      suspension_reason AS "suspensionReason", created_at AS "createdAt"
     FROM partner_profiles
     WHERE user_id = $1
     LIMIT 1;`,
    [user.id]
  );

  if (res.rows.length === 0) {
    return null;
  }

  const partnerData = res.rows[0];

  return {
    ...partnerData,
    user,
    partner: partnerData,
  };
}
