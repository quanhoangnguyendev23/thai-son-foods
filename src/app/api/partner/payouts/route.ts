import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { getPartnerSession } from '@/lib/partner/auth';
import { PARTNER_CONFIG } from '@/config/partner';
import { publicErrorMessage } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

// GET: Danh sách lịch sử yêu cầu rút tiền của đối tác
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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const res = await query(
      `SELECT * FROM payout_requests WHERE partner_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;`,
      [session.id, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM payout_requests WHERE partner_id = $1;`,
      [session.id]
    );

    return NextResponse.json({
      success: true,
      payouts: res.rows,
      pagination: {
        total: parseInt(countRes.rows[0]?.total || '0', 10),
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('[PartnerPayouts] Error fetching payouts:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}

// POST: Gửi yêu cầu rút tiền mới
export async function POST(request: Request) {
  try {
    const session = await getPartnerSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 1. Kiểm tra trạng thái tài khoản: SUSPENDED hoặc chưa ACTIVE không được rút tiền
    if (session.lifecycleStatus !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: `Tài khoản đối tác đang ở trạng thái "${session.lifecycleStatus}", chưa đủ điều kiện rút tiền.`,
          code: 'ACCOUNT_NOT_ACTIVE',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const amount = Math.round(Number(body.amount) || 0);

    // 2. Kiểm tra số tiền tối thiểu
    const minPayout = PARTNER_CONFIG.PAYOUT.MIN_PAYOUT_AMOUNT;
    if (amount < minPayout) {
      return NextResponse.json(
        {
          success: false,
          error: `Số tiền rút tối thiểu là ${minPayout.toLocaleString('vi-VN')} ₫. Bạn yêu cầu: ${amount.toLocaleString('vi-VN')} ₫.`,
          code: 'BELOW_MIN_PAYOUT',
        },
        { status: 400 }
      );
    }

    // 3. Kiểm tra thông tin tài khoản ngân hàng
    const bankName = (body.bankName || session.bankName || '').trim();
    const bankAccountNumber = (body.bankAccountNumber || session.bankAccountNumber || '').trim();
    const bankAccountName = (body.bankAccountName || session.bankAccountName || session.fullName || '').trim();

    if (!bankName || !bankAccountNumber || !bankAccountName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng cung cấp đầy đủ thông tin tài khoản ngân hàng nhận tiền (Tên ngân hàng, Số tài khoản, Tên chủ tài khoản).',
          code: 'MISSING_BANK_INFO',
        },
        { status: 400 }
      );
    }

    // 4. Kiểm tra chống double-submit: Đang có yêu cầu PENDING thì không được tạo thêm
    const pendingRes = await query(
      `SELECT id, amount, created_at FROM payout_requests WHERE partner_id = $1 AND status = 'PENDING' LIMIT 1;`,
      [session.id]
    );

    if (pendingRes.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bạn đang có một yêu cầu rút tiền đang chờ xử lý. Vui lòng chờ kế toán duyệt xong trước khi tạo yêu cầu mới.',
          code: 'PENDING_PAYOUT_EXISTS',
          pendingRequest: pendingRes.rows[0],
        },
        { status: 409 }
      );
    }

    // 5. Thực hiện kiểm tra số dư khả dụng và tạo yêu cầu trong TRANSACTION an toàn
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      // Khóa bản ghi partner_profiles FOR UPDATE
      const pRes = await client.query(
        `SELECT current_balance FROM partner_profiles WHERE id = $1 FOR UPDATE;`,
        [session.id]
      );
      const currentBalance = Number(pRes.rows[0]?.current_balance) || 0;

      // Xử lý ví âm: nếu số dư âm, chặn tuyệt đối và thông báo số tiền cần bù
      if (currentBalance < 0) {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          {
            success: false,
            error: `Ví của bạn đang bị âm ${Math.abs(currentBalance).toLocaleString('vi-VN')} ₫ do phát sinh hoàn đơn. Vui lòng tích lũy thêm hoa hồng để bù số âm trước khi rút tiền.`,
            code: 'NEGATIVE_BALANCE',
            negativeAmount: Math.abs(currentBalance),
          },
          { status: 400 }
        );
      }

      // Tính số dư khả dụng thực tế từ sổ cái (now >= available_at)
      const ledgerSumRes = await client.query(
        `SELECT amount, status, available_at FROM partner_ledger WHERE partner_id = $1;`,
        [session.id]
      );

      const now = new Date();
      let availableSum = 0;

      for (const row of ledgerSumRes.rows) {
        const amt = Number(row.amount) || 0;
        let effStatus = row.status;
        if (row.status === 'CONFIRMED' && row.available_at && now >= new Date(row.available_at)) {
          effStatus = 'AVAILABLE';
        }

        if (effStatus === 'AVAILABLE') {
          availableSum += amt;
        } else if (effStatus === 'CLAWBACK') {
          availableSum += amt; // Số âm
        }
      }

      // Trừ đi các khoản payout đã rút trước đó
      const existingPayouts = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_locked FROM payout_requests WHERE partner_id = $1 AND status IN ('PENDING', 'APPROVED', 'PAID');`,
        [session.id]
      );
      const lockedAmount = Number(existingPayouts.rows[0]?.total_locked) || 0;

      // Số dư rút tối đa phải thỏa mãn cả 2 điều kiện:
      // 1. Nhỏ hơn hoặc bằng số dư ví hiện tại partner_profiles.current_balance
      // 2. Nhỏ hơn hoặc bằng tổng số dư khả dụng thực tế từ sổ cái (đã qua 7 ngày)
      const realAvailableBalance = Math.min(Math.max(0, currentBalance), Math.max(0, availableSum));

      if (amount > realAvailableBalance) {
        await client.query('ROLLBACK;');
        return NextResponse.json(
          {
            success: false,
            error: `Số dư khả dụng không đủ điều kiện rút. Khả dụng (sau 7 ngày đối soát): ${realAvailableBalance.toLocaleString('vi-VN')} ₫, Yêu cầu: ${amount.toLocaleString('vi-VN')} ₫.`,
            code: 'INSUFFICIENT_AVAILABLE_BALANCE',
            availableBalance: realAvailableBalance,
          },
          { status: 400 }
        );
      }

      // 6. Tạo bản ghi payout_requests
      const payoutId = `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO payout_requests (id, partner_id, amount, bank_name, bank_account_number, bank_account_name, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING');`,
        [payoutId, session.id, amount, bankName, bankAccountNumber, bankAccountName]
      );

      // 7. Khóa số tiền trong ví đối tác (trừ trước để tránh rút kép)
      await client.query(
        `UPDATE partner_profiles
         SET current_balance = current_balance - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2;`,
        [amount, session.id]
      );

      // 8. Ghi dòng sổ cái tạm giữ (PENDING_PAYOUT)
      const ledgerHoldId = `led_pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO partner_ledger (
          id, partner_id, entry_type, amount, direction, status, reference_id, note, created_by
        ) VALUES ($1, $2, 'PAYOUT_HOLD', $3, 'DEBIT', 'PENDING', $4, $5, 'system');`,
        [
          ledgerHoldId,
          session.id,
          -amount,
          payoutId,
          `Tạm giữ tiền cho yêu cầu rút tiền #${payoutId}`,
        ]
      );

      await client.query('COMMIT;');

      return NextResponse.json({
        success: true,
        payoutId,
        amount,
        bankName,
        bankAccountNumber,
        bankAccountName,
        message: `Đã tạo yêu cầu rút tiền ${amount.toLocaleString('vi-VN')} ₫ thành công. Kế toán sẽ xét duyệt và chuyển khoản trong vòng 24-48h.`,
      });
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[PartnerPayouts] Error creating payout request:', error);
    return NextResponse.json({ success: false, error: publicErrorMessage(error, 'Lỗi hệ thống') }, { status: 500 });
  }
}
