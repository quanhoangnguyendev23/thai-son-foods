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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    // 1. Lấy tất cả dòng sổ cái của đối tác
    const ledgerRes = await query(
      `SELECT pl.*, o.order_code
       FROM partner_ledger pl
       LEFT JOIN orders o ON pl.order_id = o.id
       WHERE pl.partner_id = $1
       ORDER BY pl.created_at DESC
       LIMIT $2 OFFSET $3;`,
      [session.id, limit, offset]
    );

    const now = new Date();

    // 2. Tính toán trạng thái hiệu lực (effective status) theo thời gian available_at
    const entries = ledgerRes.rows.map(entry => {
      let effectiveStatus = entry.status;
      if (entry.status === 'CONFIRMED' && entry.available_at) {
        if (now >= new Date(entry.available_at)) {
          effectiveStatus = 'AVAILABLE';
        }
      }
      return {
        ...entry,
        effective_status: effectiveStatus,
      };
    });

    // 3. Tính toán tổng số dư theo thời gian thực (Real-time immutable ledger aggregation)
    const allEntriesRes = await query(
      `SELECT status, amount, available_at, direction, entry_type
       FROM partner_ledger
       WHERE partner_id = $1;`,
      [session.id]
    );

    let estimatedBalance = 0;
    let confirmedWaitingBalance = 0;
    let availableBalance = 0;
    let paidBalance = 0;
    let clawbackAmount = 0;

    for (const row of allEntriesRes.rows) {
      const amt = Number(row.amount) || 0;
      let effStatus = row.status;

      if (row.status === 'CONFIRMED' && row.available_at && now >= new Date(row.available_at)) {
        effStatus = 'AVAILABLE';
      }

      if (effStatus === 'ESTIMATED') {
        estimatedBalance += amt;
      } else if (effStatus === 'CONFIRMED') {
        confirmedWaitingBalance += amt;
      } else if (effStatus === 'AVAILABLE') {
        availableBalance += amt;
      } else if (effStatus === 'PAID') {
        paidBalance += Math.abs(amt);
      } else if (effStatus === 'CLAWBACK') {
        clawbackAmount += Math.abs(amt);
        // Trừ trực tiếp vào số dư khả dụng
        availableBalance += amt; // amt là số âm
      }
    }

    // Lấy thông tin tài khoản đối tác
    const profileRes = await query(
      `SELECT current_balance, total_commission_earned FROM partner_profiles WHERE id = $1 LIMIT 1;`,
      [session.id]
    );
    const profile = profileRes.rows[0] || {};

    return NextResponse.json({
      success: true,
      entries,
      balances: {
        estimated: estimatedBalance,
        confirmed_waiting: confirmedWaitingBalance,
        available: Math.max(0, availableBalance),
        raw_available: availableBalance, // Có thể âm nếu có clawback vượt quá số dư
        paid: paidBalance,
        clawback: clawbackAmount,
        profile_balance: Number(profile.current_balance) || 0,
        total_earned: Number(profile.total_commission_earned) || 0,
      },
    });
  } catch (error: any) {
    console.error('[PartnerLedger] Error fetching ledger:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
