-- ==============================================================================
-- THÁI SƠN FOODS — TẠO USER DB ÍT QUYỀN CHO ỨNG DỤNG (F-02)
--
-- Chạy bằng psql với tài khoản quản trị (postgres), TRONG cửa sổ PowerShell vừa chạy
-- scripts/tao_secret_production.ps1 (cửa sổ đó có sẵn biến TSF_APP_DB_PASSWORD):
--   psql -h 127.0.0.1 -U postgres -d postgres -v app_user=tsf_app -v db_name=WebTSF_production -f scripts\tao_user_db_it_quyen.sql
--
-- Cần psql 15 trở lên (lệnh \getenv). Mật khẩu KHÔNG nằm trong file này và không hiện trên dòng lệnh.
--
-- Mô hình quyền (phương án A — tương thích code hiện tại):
--   * app_user: đăng nhập được, KHÔNG superuser, KHÔNG tạo DB, KHÔNG tạo role, KHÔNG vào DB khác.
--   * app_user SỞ HỮU các bảng trong DB ứng dụng, vì code còn tự chạy CREATE TABLE / CREATE INDEX IF NOT EXISTS
--     lúc chạy (email_logs, inventory_sheet_*, order_status_history, product_reviews, site_settings,
--     item_weekly_delivery; admin/sync ALTER TABLE). User chỉ có quyền SELECT/INSERT/UPDATE/DELETE sẽ làm các
--     chỗ đó báo lỗi "permission denied". Tách user chỉ-DML là việc sau golive (xem docs/golive/F-02-SECRET-PRODUCTION.md).
--
-- Chạy lại nhiều lần vẫn an toàn: role đã có thì chỉ đặt lại mật khẩu và quyền.
-- ==============================================================================

\set ON_ERROR_STOP on
\getenv app_password TSF_APP_DB_PASSWORD

\if :{?app_user}
\else
  \echo 'Thiếu -v app_user=...'
  \quit
\endif
\if :{?db_name}
\else
  \echo 'Thiếu -v db_name=...'
  \quit
\endif
\if :{?app_password}
\else
  \echo 'Thiếu biến môi trường TSF_APP_DB_PASSWORD: chạy scripts/tao_secret_production.ps1 trong cùng cửa sổ trước.'
  \quit
\endif

-- 1. Tạo hoặc cập nhật role ứng dụng (không có quyền quản trị cụm DB)
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 50', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'app_user', :'app_password') \gexec

-- 2. Tạo DB ứng dụng nếu chưa có, giao cho app_user làm chủ
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0', :'db_name', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'app_user') \gexec

-- 3. Chỉ app_user (và quản trị) được kết nối vào DB ứng dụng
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_name') \gexec
SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', :'db_name', :'app_user') \gexec

-- 4. Trong DB ứng dụng: chuyển quyền sở hữu schema public và mọi bảng/chuỗi/view đang có sang app_user
--    (trường hợp DB đã được tạo và chạy migration bằng postgres trước đó)
\connect :db_name
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER TABLE public.%I OWNER TO %I', tablename, :'app_user') FROM pg_tables WHERE schemaname = 'public' \gexec
SELECT format('ALTER SEQUENCE public.%I OWNER TO %I', sequencename, :'app_user') FROM pg_sequences WHERE schemaname = 'public' \gexec
SELECT format('ALTER VIEW public.%I OWNER TO %I', viewname, :'app_user') FROM pg_views WHERE schemaname = 'public' \gexec

-- 5. Kiểm tra: in ra thuộc tính role, KHÔNG in mật khẩu
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolconnlimit
FROM pg_roles WHERE rolname = :'app_user';
SELECT count(*) AS so_bang_chua_thuoc_app_user
FROM pg_tables WHERE schemaname = 'public' AND tableowner <> :'app_user';

\echo 'Xong. so_bang_chua_thuoc_app_user phải bằng 0. Từ giờ chạy migration bằng app_user, không dùng postgres.'
