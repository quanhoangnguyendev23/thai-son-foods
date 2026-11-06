import type { PoolClient } from 'pg';
import { query } from '@/lib/db';

/**
 * Lịch sử đổi trạng thái đơn hàng: AI đổi, đổi từ gì sang gì, LÚC NÀO.
 *
 * Ghi bằng trigger trong Postgres (bảng orders, khi cột status đổi) nên mọi đường đổi trạng thái
 * đều được ghi, kể cả đường không qua API admin (tự huỷ đơn quá hạn giữ chỗ, khớp chuyển khoản...).
 *
 * Người thao tác: route đặt `setOrderStatusActor()` trong cùng transaction TRƯỚC lệnh UPDATE.
 * Không đặt thì trigger ghi "Hệ thống" (hoặc người khớp chuyển khoản nếu cột payment_reconciled_by vừa đổi).
 *
 * Bảng riêng, KHÔNG nằm trong audit_logs, để không bị dọn theo hạn lưu giữ nhật ký (src/lib/logRetention.ts).
 * Chỉ thêm bảng / chỉ mục / trigger mới, không sửa hay xoá dữ liệu cũ.
 */

export interface OrderStatusActor {
  orderId: string;
  /** admin | customer | dealer | system */
  type: 'admin' | 'customer' | 'dealer' | 'system';
  id?: string | null;
  username?: string | null;
  name?: string | null;
  role?: string | null;
  note?: string | null;
}

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  actor_type: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_name: string | null;
  actor_role: string | null;
  note: string | null;
  created_at: string;
}

const TRIGGER_FN = 'tsf_log_order_status_v1';

const DDL = `
  CREATE TABLE IF NOT EXISTS order_status_history (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    actor_type VARCHAR(20) NOT NULL DEFAULT 'system',
    actor_id VARCHAR(50),
    actor_username VARCHAR(100),
    actor_name VARCHAR(255),
    actor_role VARCHAR(50),
    note TEXT,
    audit_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_order_status_history_audit ON order_status_history(audit_id);

  DO $do$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = '${TRIGGER_FN}') THEN
      EXECUTE $fn$
        CREATE FUNCTION ${TRIGGER_FN}() RETURNS trigger AS $body$
        DECLARE
          raw TEXT := current_setting('tsf.order_actor', true);
          actor JSONB := NULL;
          adm RECORD;
        BEGIN
          -- Mọi lỗi ở đây chỉ cảnh báo: ghi lịch sử lỗi thì KHÔNG được làm hỏng việc đổi trạng thái đơn
          BEGIN
            IF raw IS NOT NULL AND raw <> '' THEN
              BEGIN
                actor := raw::jsonb;
              EXCEPTION WHEN others THEN
                actor := NULL;
              END;
            END IF;

            -- Người thao tác chỉ áp cho đúng đơn đã khai báo (tránh gán nhầm đơn khác bị tự huỷ trong cùng transaction)
            IF actor IS NULL OR (actor->>'orderId') IS DISTINCT FROM NEW.id THEN
              actor := NULL;
              -- Khớp chuyển khoản: route ghi tên người khớp vào payment_reconciled_by
              IF NEW.payment_reconciled_by IS NOT NULL
                 AND NEW.payment_reconciled_by IS DISTINCT FROM OLD.payment_reconciled_by THEN
                SELECT id, full_name, role INTO adm FROM admin_users WHERE username = NEW.payment_reconciled_by LIMIT 1;
                actor := jsonb_build_object(
                  'type', 'admin',
                  'id', adm.id,
                  'username', NEW.payment_reconciled_by,
                  'name', COALESCE(adm.full_name, NEW.payment_reconciled_by),
                  'role', adm.role,
                  'note', 'Xác nhận đã nhận chuyển khoản'
                );
              END IF;
            END IF;

            IF actor IS NULL THEN
              actor := jsonb_build_object('type', 'system', 'name', 'Hệ thống');
            END IF;

            INSERT INTO order_status_history
              (order_id, from_status, to_status, actor_type, actor_id, actor_username, actor_name, actor_role, note, created_at)
            VALUES (
              NEW.id, OLD.status, NEW.status,
              COALESCE(actor->>'type', 'system'),
              actor->>'id', actor->>'username',
              COALESCE(NULLIF(actor->>'name', ''), actor->>'username', 'Hệ thống'),
              actor->>'role', actor->>'note', NOW()
            );
          EXCEPTION WHEN others THEN
            RAISE WARNING 'order_status_history insert failed: %', SQLERRM;
          END;
          RETURN NEW;
        END
        $body$ LANGUAGE plpgsql;
      $fn$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_status_history' AND NOT tgisinternal) THEN
      CREATE TRIGGER trg_orders_status_history
        AFTER UPDATE OF status ON orders
        FOR EACH ROW
        WHEN (OLD.status IS DISTINCT FROM NEW.status)
        EXECUTE FUNCTION ${TRIGGER_FN}();
    END IF;
  END
  $do$;
`;

/**
 * Lấy lại lịch sử cũ từ nhật ký hoạt động (audit_logs) cho các lần admin đổi trạng thái TRƯỚC khi có bảng này.
 * Chỉ lấy bản ghi cũ hơn dòng đầu tiên do trigger ghi, nên chạy lại nhiều lần cũng không bị trùng.
 */
const BACKFILL = `
  INSERT INTO order_status_history
    (order_id, from_status, to_status, actor_type, actor_id, actor_username, actor_name, actor_role, note, created_at, audit_id)
  SELECT a.entity_id,
         a.before_json->>'status',
         a.after_json->>'status',
         'admin',
         a.admin_id,
         a.admin_username,
         COALESCE(u.full_name, a.admin_username),
         a.role,
         NULL,
         a.created_at,
         a.id
    FROM audit_logs a
    LEFT JOIN admin_users u ON u.username = a.admin_username
   WHERE a.entity_type = 'ORDER'
     AND a.entity_id IS NOT NULL
     AND a.after_json ? 'status'
     AND (a.after_json->>'status') IS NOT NULL
     AND (a.after_json->>'status') IS DISTINCT FROM (a.before_json->>'status')
     AND a.created_at < COALESCE(
       (SELECT MIN(created_at) FROM order_status_history WHERE audit_id IS NULL),
       'infinity'::timestamptz
     )
  ON CONFLICT (audit_id) DO NOTHING;
`;

let readyPromise: Promise<boolean> | null = null;

/** Tạo bảng + trigger nếu chưa có (một lần mỗi tiến trình). Trả false nếu lỗi — trang vẫn chạy, chỉ thiếu lịch sử. */
export function ensureOrderStatusHistory(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        await query(DDL);
      } catch (err) {
        console.error('[OrderStatusHistory] Không tạo được bảng/trigger:', err);
        readyPromise = null; // cho thử lại ở request sau
        return false;
      }
      try {
        await query(BACKFILL);
      } catch (err) {
        console.error('[OrderStatusHistory] Không lấy lại được lịch sử cũ từ audit_logs:', err);
      }
      return true;
    })();
  }
  return readyPromise;
}

/**
 * Khai báo người đổi trạng thái cho trigger. Gọi trong transaction (sau BEGIN), trước lệnh UPDATE orders.
 * Giá trị tự mất khi transaction kết thúc nên không lẫn sang request khác dùng chung kết nối.
 */
export async function setOrderStatusActor(client: PoolClient, actor: OrderStatusActor): Promise<void> {
  try {
    await client.query(`SELECT set_config('tsf.order_actor', $1, true);`, [
      JSON.stringify({
        orderId: actor.orderId,
        type: actor.type,
        id: actor.id || null,
        username: actor.username || null,
        name: actor.name || actor.username || null,
        role: actor.role || null,
        note: actor.note ? String(actor.note).slice(0, 500) : null,
      }),
    ]);
  } catch (err) {
    console.error('[OrderStatusHistory] Không đặt được người thao tác:', err);
  }
}

/** Toàn bộ lịch sử trạng thái của 1 đơn, cũ → mới */
export async function getOrderStatusHistory(orderId: string): Promise<OrderStatusHistoryRow[]> {
  if (!(await ensureOrderStatusHistory())) return [];
  try {
    const res = await query(
      `SELECT id::text AS id, order_id, from_status, to_status, actor_type, actor_id, actor_username,
              actor_name, actor_role, note, created_at
         FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC, id ASC;`,
      [orderId]
    );
    return res.rows;
  } catch (err) {
    console.error('[OrderStatusHistory] Lỗi đọc lịch sử:', err);
    return [];
  }
}

/** Cột phụ cho câu SELECT danh sách đơn (bí danh bảng orders phải là `o`): lần đổi trạng thái gần nhất */
export const LAST_STATUS_CHANGE_SELECT = `
  (SELECT json_build_object(
      'from_status', h.from_status,
      'to_status', h.to_status,
      'actor_type', h.actor_type,
      'actor_username', h.actor_username,
      'actor_name', h.actor_name,
      'actor_role', h.actor_role,
      'created_at', h.created_at
    )
    FROM order_status_history h
   WHERE h.order_id = o.id
   ORDER BY h.created_at DESC, h.id DESC
   LIMIT 1) AS last_status_change`;
