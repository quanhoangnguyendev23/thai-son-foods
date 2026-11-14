# ==============================================================================
# THÁI SƠN FOODS — GỌI CRON DỌN GIỮ CHỖ QUÁ HẠN (thay cho "crons" trong vercel.json khi chạy trên IIS) (F-21)
#
# Gọi GET http://127.0.0.1:3000/api/cron/cleanup-reservations kèm "Authorization: Bearer <CRON_SECRET>".
# CRON_SECRET đọc từ biến môi trường hoặc dòng CRON_SECRET trong file .env của thư mục ứng dụng; không in ra.
# Ghi một dòng kết quả vào logs\cron-cleanup.log (tạo thư mục nếu chưa có). Lỗi → mã thoát 1 để Task Scheduler ghi nhận.
#
# Chạy tay để thử:
#   powershell -ExecutionPolicy Bypass -File C:\inetpub\thai-son-foods\scripts\goi_cron_don_giu_cho.ps1 -AppDir C:\inetpub\thai-son-foods
# Đăng ký lịch chạy hằng ngày: docs/golive/CUTOVER.md (mục 5).
# ==============================================================================

param(
  [string]$AppDir = (Split-Path $PSScriptRoot -Parent),
  [string]$BaseUrl = 'http://127.0.0.1:3000',
  [string]$Path = '/api/cron/cleanup-reservations'
)

$ErrorActionPreference = 'Stop'
$logDir = Join-Path $AppDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'cron-cleanup.log'

function Write-Log([string]$msg) {
  $line = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $msg
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

$secret = $env:CRON_SECRET
$envFile = Join-Path $AppDir '.env'
if (-not $secret -and (Test-Path $envFile)) {
  $line = Get-Content $envFile | Where-Object { $_ -match '^\s*CRON_SECRET\s*=' } | Select-Object -First 1
  if ($line) { $secret = ($line -replace '^\s*CRON_SECRET\s*=\s*', '').Trim().Trim('"').Trim("'") }
}
if (-not $secret) { Write-Log 'LỖI: thiếu CRON_SECRET (biến môi trường hoặc .env)'; exit 1 }

try {
  $res = Invoke-WebRequest -Uri ($BaseUrl + $Path) -Method Get -UseBasicParsing -TimeoutSec 120 `
    -Headers @{ Authorization = "Bearer $secret" }
  $body = $res.Content
  if ($body.Length -gt 300) { $body = $body.Substring(0, 300) }
  Write-Log "OK $($res.StatusCode) $body"
  exit 0
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Log "LỖI $code $($_.Exception.Message)"
  exit 1
}
