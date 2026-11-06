-- Bù lược đồ cho production (06/11/2026): các câu mà bộ khởi tạo tự động trong src/lib/db.ts sẽ chạy nhưng
-- production (bản b27549b, 04/11) chưa có. Sinh từ: npx tsx scripts/schema_bootstrap_dry_run.mjs --since b27549b
-- Không gồm cột/bảng ô địa chỉ (đã có ở address_round3_schema.sql, address_round4_schema.sql).
-- Mọi câu đều "IF NOT EXISTS": chạy lại không hỏng. Không xóa / sửa dữ liệu có sẵn; câu INSERT cuối chỉ chép lại
-- lịch sử đổi trạng thái cũ từ audit_logs vào bảng mới (ON CONFLICT DO NOTHING).

-- 1) Giờ giao hàng (giao ngay / hẹn khung giờ)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot_end TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_orders_store_delivery_slot ON orders(store_code, delivery_slot_start);

-- 2) Lịch sử đổi trạng thái đơn (ai xác nhận / ai huỷ): bảng + trigger + chép lịch sử cũ (src/lib/orderStatusHistory.ts)
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
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tsf_log_order_status_v1') THEN
      EXECUTE $fn$
        CREATE FUNCTION tsf_log_order_status_v1() RETURNS trigger AS $body$
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
        EXECUTE FUNCTION tsf_log_order_status_v1();
    END IF;
  END
  $do$;

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

