import { PoolClient } from 'pg';
import { query } from '@/lib/db';
import { PARTNER_CONFIG } from '@/config/partner';

export type PartnerOrderEventType =
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_COMPLETED'
  | 'COD_RECONCILED'
  | 'PAYMENT_RECONCILED'
  | 'ORDER_CANCELLED'
  | 'ORDER_RETURNED';

/**
 * Xử lý biến động tài chính và sổ cái đối tác đồng bộ theo vòng đời đơn hàng.
 * Hoàn toàn an toàn, idempotent, hỗ trợ chạy bên trong transaction hiện có (externalClient).
 */
export async function processPartnerOrderEvent(
  orderId: string,
  eventType: PartnerOrderEventType,
  options?: {
    client?: PoolClient;
    actor?: string;
    note?: string;
    reconciledAmount?: number;
  }
): Promise<{ processed: boolean; action?: string; ledgerEntryId?: string }> {
  const runner = async (dbClient: PoolClient | { query: typeof query }) => {
    // 1. Kiểm tra xem đơn hàng này có thuộc đối tác nào không (qua order_attributions)
    const attrRes = await dbClient.query(
      `SELECT oa.*, o.status AS order_status, o.total, o.cod_reconciled, o.payment_status
       FROM order_attributions oa
       JOIN orders o ON oa.order_id = o.id
       WHERE oa.order_id = $1
       LIMIT 1;`,
      [orderId]
    );

    if (attrRes.rows.length === 0) {
      return { processed: false }; // Đơn không qua giới thiệu đối tác
    }

    const attr = attrRes.rows[0];
    const partnerId = attr.partner_id;
    const estimatedCommission = Number(attr.estimated_commission) || 0;

    // Không xử lý hoa hồng cho các đơn tự mua bị gắn cờ
    if (attr.is_self_referral || attr.status === 'FLAGGED') {
      return { processed: false, action: 'flagged_self_referral_ignored' };
    }

    // 2. Tìm bản ghi sổ cái gần nhất liên quan đến đơn hàng này
    const ledgerRes = await dbClient.query(
      `SELECT * FROM partner_ledger WHERE order_id = $1 AND entry_type = 'COMMISSION' ORDER BY created_at DESC LIMIT 1;`,
      [orderId]
    );
    const currentLedger = ledgerRes.rows[0] || null;

    const holdingDays = PARTNER_CONFIG.COMMISSION.HOLDING_DAYS_UNTIL_AVAILABLE;

    // ─────────────────────────────────────────────────────────────────────────
    // XỬ LÝ THEO LOẠI SỰ KIỆN
    // ─────────────────────────────────────────────────────────────────────────
    switch (eventType) {
      case 'ORDER_COMPLETED':
      case 'COD_RECONCILED':
      case 'PAYMENT_RECONCILED': {
        // Điều kiện để thu nhập chuyển từ ESTIMATED sang CONFIRMED:
        // Đơn phải COMPLETED VÀ (cod_reconciled = true HOẶC payment_status = 'PAID')
        const isCompleted = attr.order_status === 'COMPLETED' || eventType === 'ORDER_COMPLETED';
        const isPaidOrReconciled =
          attr.cod_reconciled === true ||
          attr.payment_status === 'PAID' ||
          eventType === 'COD_RECONCILED' ||
          eventType === 'PAYMENT_RECONCILED';

        if (isCompleted && isPaidOrReconciled && currentLedger && currentLedger.status === 'ESTIMATED') {
          // Cập nhật dòng sổ cái sang CONFIRMED và tính thời điểm available_at
          await dbClient.query(
            `UPDATE partner_ledger
             SET status = 'CONFIRMED',
                 available_at = CURRENT_TIMESTAMP + ($1 || ' days')::INTERVAL,
                 note = COALESCE(note, '') || ' [Xác nhận hoàn thành & thu tiền]'
             WHERE id = $2;`,
            [holdingDays.toString(), currentLedger.id]
          );

          // Cập nhật trạng thái attribution sang CONFIRMED
          await dbClient.query(
            `UPDATE order_attributions SET status = 'CONFIRMED' WHERE id = $1;`,
            [attr.id]
          );

          // Cập nhật tổng hoa hồng đã tích lũy trên hồ sơ đối tác
          await dbClient.query(
            `UPDATE partner_profiles
             SET total_commission_earned = total_commission_earned + $1,
                 current_balance = current_balance + $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2;`,
            [estimatedCommission, partnerId]
          );

          return { processed: true, action: 'commission_confirmed', ledgerEntryId: currentLedger.id };
        }
        return { processed: false, action: 'waiting_for_full_completion_or_payment' };
      }

      case 'ORDER_CANCELLED':
      case 'ORDER_RETURNED': {
        if (!currentLedger) {
          return { processed: false };
        }

        // Idempotent: đơn đã được hủy/thu hồi hoa hồng trước đó (attribution VOID hoặc đã có bút toán CLAWBACK) thì không làm lại,
        // nếu không mỗi lần gọi lại sẽ chèn thêm một CLAWBACK và trừ ví thêm một lần
        const clawbackRes = await dbClient.query(
          `SELECT 1 FROM partner_ledger WHERE order_id = $1 AND entry_type = 'CLAWBACK' LIMIT 1;`,
          [orderId]
        );
        if (attr.status === 'VOID' || clawbackRes.rows.length > 0) {
          return { processed: false, action: 'ledger_already_void_or_handled' };
        }

        const ledgerStatus = currentLedger.status;

        // Trường hợp A: Đơn bị hủy khi thu nhập đang ở mức ESTIMATED -> Đổi thành VOID (không sinh tiền, không trừ ví)
        if (ledgerStatus === 'ESTIMATED') {
          await dbClient.query(
            `UPDATE partner_ledger
             SET status = 'VOID',
                 note = COALESCE(note, '') || ' [Hủy bỏ đơn hàng: ' || $1 || ']'
             WHERE id = $2;`,
            [options?.note || 'Đơn bị hủy', currentLedger.id]
          );

          await dbClient.query(
            `UPDATE order_attributions SET status = 'VOID' WHERE id = $1;`,
            [attr.id]
          );

          return { processed: true, action: 'commission_voided', ledgerEntryId: currentLedger.id };
        }

        // Trường hợp B: Đơn hủy/hoàn sau khi đã CONFIRMED, AVAILABLE hoặc PAID -> Sinh bút toán đối ứng CLAWBACK
        if (ledgerStatus === 'CONFIRMED' || ledgerStatus === 'AVAILABLE' || ledgerStatus === 'PAID') {
          const clawbackId = `clw_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
          const clawbackAmount = -Math.abs(estimatedCommission);

          await dbClient.query(
            `INSERT INTO partner_ledger (
              id, partner_id, order_id, entry_type, amount, direction, status, note, created_by
            ) VALUES ($1, $2, $3, 'CLAWBACK', $4, 'DEBIT', 'CLAWBACK', $5, $6);`,
            [
              clawbackId,
              partnerId,
              orderId,
              clawbackAmount,
              options?.note || 'Thu hồi hoa hồng do hoàn đơn / bùng hàng',
              options?.actor || 'system',
            ]
          );

          await dbClient.query(
            `UPDATE order_attributions SET status = 'VOID' WHERE id = $1;`,
            [attr.id]
          );

          // Trừ lại số dư trong ví đối tác (có thể âm nếu đã rút hết tiền)
          await dbClient.query(
            `UPDATE partner_profiles
             SET current_balance = current_balance - $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2;`,
            [Math.abs(estimatedCommission), partnerId]
          );

          return { processed: true, action: 'commission_clawback_created', ledgerEntryId: clawbackId };
        }

        return { processed: false, action: 'ledger_already_void_or_handled' };
      }

      default:
        return { processed: false };
    }
  };

  if (options?.client) {
    return runner(options.client);
  } else {
    return runner({ query });
  }
}
