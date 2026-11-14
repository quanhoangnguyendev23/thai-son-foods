# ==============================================================================
# THÁI SƠN FOODS — TẠO SECRET MỚI CHO MÁY CHỦ PRODUCTION (F-02)
#
# Sinh ngẫu nhiên (bộ sinh số mật mã của Windows): JWT_SECRET, CRON_SECRET, ADMIN_REGISTER_KEY
# và mật khẩu cho user DB ứng dụng. Chỉ IN RA MÀN HÌNH để người vận hành tự dán vào .env production.
# Script KHÔNG ghi file, KHÔNG kết nối DB, KHÔNG gửi đi đâu.
#
# Cách chạy (PowerShell, trên máy chủ production hoặc máy quản trị tin cậy):
#   powershell -ExecutionPolicy Bypass -File scripts\tao_secret_production.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\tao_secret_production.ps1 -DbHost 127.0.0.1 -DbName WebTSF_production -AppUser tsf_app
#
# Sau khi chạy: dán khối .env vào file .env production (KHÔNG đưa lên Git), rồi đóng cửa sổ PowerShell.
# Hướng dẫn đầy đủ: docs/golive/F-02-SECRET-PRODUCTION.md
# ==============================================================================

param(
  [string]$DbHost = '127.0.0.1',
  [int]$Port = 5432,
  [string]$DbName = 'WebTSF_production',
  [string]$AppUser = 'tsf_app'
)

$ErrorActionPreference = 'Stop'

# Chuỗi ngẫu nhiên dạng base64url (chỉ A-Z a-z 0-9 - _), an toàn để đặt trong URL và file .env
function New-Secret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$jwtSecret = New-Secret 48          # 64 ký tự (app yêu cầu >= 32)
$cronSecret = New-Secret 32         # 43 ký tự (app yêu cầu >= 16)
$adminRegisterKey = New-Secret 32   # 43 ký tự
$dbPassword = New-Secret 24         # 32 ký tự, không cần mã hoá URL

# Đặt sẵn vào phiên PowerShell hiện tại để psql đọc bằng \getenv (không lộ trên dòng lệnh)
$env:TSF_APP_DB_PASSWORD = $dbPassword

Write-Host ''
Write-Host '==================== DÁN VÀO .env PRODUCTION ====================' -ForegroundColor Yellow
Write-Host "DATABASE_URL=postgresql://${AppUser}:${dbPassword}@${DbHost}:${Port}/${DbName}?sslmode=disable"
Write-Host "JWT_SECRET=$jwtSecret"
Write-Host "CRON_SECRET=$cronSecret"
Write-Host "ADMIN_REGISTER_KEY=$adminRegisterKey"
Write-Host '=================================================================' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Bước tiếp theo, chạy TRONG CHÍNH CỬA SỔ NÀY (biến TSF_APP_DB_PASSWORD chỉ tồn tại ở đây):' -ForegroundColor Cyan
Write-Host "  psql -h $DbHost -p $Port -U postgres -d postgres -v app_user=$AppUser -v db_name=$DbName -f scripts\tao_user_db_it_quyen.sql"
Write-Host ''
Write-Host 'Lưu ý:' -ForegroundColor Cyan
Write-Host '  - DB không ở cùng máy (sslmode khác disable): sửa đuôi ?sslmode=... trong DATABASE_URL cho đúng.'
Write-Host '  - Lưu các giá trị trên vào kho mật khẩu của công ty; không gửi qua chat, email, không commit.'
Write-Host '  - Đổi JWT_SECRET làm mọi phiên đăng nhập cũ (khách 7 ngày, admin 24 giờ) hết hiệu lực.'
Write-Host '  - Chạy lại script sẽ sinh bộ giá trị MỚI khác hẳn; chỉ dùng một bộ.'
Write-Host ''
