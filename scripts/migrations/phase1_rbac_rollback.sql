-- ==============================================================================
-- Rollback Migration Phase 1: RBAC & Store Scope Foundation
-- ==============================================================================

-- 1. Xóa ràng buộc CHECK role
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS chk_admin_users_role;

-- 2. Xóa Foreign Key store_code
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS fk_admin_users_store_code;

-- 3. Xóa các cột đã thêm trong admin_users
ALTER TABLE admin_users DROP COLUMN IF EXISTS store_code;
ALTER TABLE admin_users DROP COLUMN IF EXISTS must_change_password;
ALTER TABLE admin_users DROP COLUMN IF EXISTS password_changed_at;
ALTER TABLE admin_users DROP COLUMN IF EXISTS last_login_at;

-- 4. Chuyển ngược vai trò STORE_STAFF về ADMIN nếu cần
UPDATE admin_users SET role = 'ADMIN' WHERE role = 'STORE_STAFF';

-- 5. Xóa bảng audit_logs
DROP TABLE IF EXISTS audit_logs CASCADE;
