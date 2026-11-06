-- ==============================================================================
-- Migration Phase 1: RBAC & Store Scope Foundation (Idempotent)
-- ==============================================================================

-- 1. Thêm các cột mới vào bảng admin_users nếu chưa tồn tại
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS store_code VARCHAR(50);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 2. Thêm Foreign Key từ admin_users.store_code -> stores.code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_users_store_code'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT fk_admin_users_store_code
      FOREIGN KEY (store_code) REFERENCES stores(code)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Tạo bảng audit_logs lưu vết hành động của admin
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  admin_id VARCHAR(50),
  admin_username VARCHAR(100),
  role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  store_code VARCHAR(50),
  before_json JSONB,
  after_json JSONB,
  ip VARCHAR(100),
  user_agent TEXT
);

-- 4. Tạo các chỉ mục tối ưu cho bảng audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_username ON audit_logs(admin_username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_store_code ON audit_logs(store_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Lưu ý: CHECK constraint chk_admin_users_role sẽ được thêm sau khi migrate dữ liệu các tài khoản hiện có.
