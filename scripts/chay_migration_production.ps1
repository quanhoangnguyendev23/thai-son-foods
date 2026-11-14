# ==============================================================================
# THÁI SƠN FOODS — CHẠY MIGRATION THEO THỨ TỰ, CÓ BẢNG GHI LẠI BẢN ĐÃ CHẠY (F-01)
#
# - Tạo bảng schema_migrations (nếu chưa có): tên file, mã băm SHA-256, thời điểm, người chạy.
# - Chạy lần lượt danh sách $Order bên dưới bằng psql (ON_ERROR_STOP), bỏ qua file đã ghi nhận.
# - File đã chạy mà nội dung bị sửa (mã băm khác) → DỪNG, không tự chạy lại.
# - Không in chuỗi kết nối / mật khẩu.
#
# Cách chạy (PowerShell, trong thư mục ứng dụng trên máy chủ, cần psql trong PATH):
#   $env:DATABASE_URL đã có sẵn (hoặc script tự đọc dòng DATABASE_URL trong file .env của thư mục hiện tại)
#   powershell -ExecutionPolicy Bypass -File scripts\chay_migration_production.ps1 -Bootstrap C:\deploy\bootstrap.sql -DryRun
#   powershell -ExecutionPolicy Bypass -File scripts\chay_migration_production.ps1 -Bootstrap C:\deploy\bootstrap.sql
#
# -Bootstrap: file lược đồ gốc sinh bằng  npx tsx scripts/schema_bootstrap_dry_run.mjs --out C:\deploy\bootstrap.sql
#             (chỉ cần cho DB trống; DB đã có bảng thì bỏ tham số này).
# -DryRun:    chỉ in file nào sẽ chạy / bỏ qua, không ghi gì.
# Thứ tự và lý do: docs/golive/CUTOVER.md (mục 3).
# ==============================================================================

param(
  [string]$Bootstrap = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Thứ tự đã chạy thử trên DB trống ngày 14/11/2026 (docs/golive/CUTOVER.md). Không đổi thứ tự khi chưa thử lại.
$Order = @(
  'phase1_rbac_schema.sql',
  '01_gps_stores_orders_schema.sql',
  'phase4_cost_price_schema.sql',
  'phase7_membership_schema.sql',
  'phase8_reviews_schema.sql',
  'phase8_reviews_v2_schema.sql',
  'address_round3_schema.sql',
  'address_round4_schema.sql',
  'bootstrap_catchup_20261106_schema.sql',
  'site_settings_schema.sql',
  'product_detail_content_schema.sql',
  'golive_fresh_db_gaps_schema.sql',
  'golive_variant_multiplier_fix.sql'
)

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'Không thấy psql trong PATH (cài PostgreSQL client 15+).' }

$dbUrl = $env:DATABASE_URL
if (-not $dbUrl -and (Test-Path '.env')) {
  $line = Get-Content '.env' | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if ($line) { $dbUrl = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'") }
}
if (-not $dbUrl) { throw 'Thiếu DATABASE_URL (biến môi trường hoặc dòng DATABASE_URL trong .env).' }
$dbName = ([Uri]($dbUrl -replace '^postgres(ql)?://', 'http://')).AbsolutePath.Trim('/')
Write-Host "DB đích: $dbName" -ForegroundColor Cyan

# Ẩn NOTICE ("đã tồn tại, bỏ qua"); vẫn hiện WARNING/ERROR
$env:PGOPTIONS = '-c client_min_messages=warning'

function Invoke-Psql([string[]]$PsqlArgs) {
  # PowerShell 5.1 coi chữ psql ghi ra stderr là lỗi; tạm tắt Stop, chỉ dựa vào mã thoát của psql
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $out = & psql $dbUrl -X -q -v ON_ERROR_STOP=1 @PsqlArgs 2>&1 | ForEach-Object { "$_" } }
  finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE -ne 0) { throw ($out | Out-String) }
  return $out
}

$migDir = Join-Path $PSScriptRoot 'migrations'
$items = @()
if ($Bootstrap) {
  if (-not (Test-Path $Bootstrap)) { throw "Không thấy file bootstrap: $Bootstrap" }
  $items += [pscustomobject]@{ Name = '000_bootstrap.sql'; Path = (Resolve-Path $Bootstrap).Path }
}
foreach ($f in $Order) {
  $p = Join-Path $migDir $f
  if (-not (Test-Path $p)) { throw "Thiếu file migration: $p" }
  $items += [pscustomobject]@{ Name = $f; Path = $p }
}

if (-not $DryRun) {
  Invoke-Psql @('-c', @'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(200) PRIMARY KEY,
  sha256     CHAR(64)     NOT NULL,
  applied_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  applied_by VARCHAR(100) NOT NULL DEFAULT current_user
);
'@) | Out-Null
}

$applied = @{}
try {
  $rows = Invoke-Psql @('-tA', '-F', '|', '-c', 'SELECT filename, sha256 FROM schema_migrations')
  foreach ($r in $rows) { if ("$r" -match '^(.+)\|([0-9a-f]{64})$') { $applied[$Matches[1]] = $Matches[2] } }
} catch {
  if (-not $DryRun) { throw } # chạy thử trên DB chưa có bảng ghi: coi như chưa chạy file nào
}

foreach ($it in $items) {
  $hash = (Get-FileHash -Algorithm SHA256 -Path $it.Path).Hash.ToLower()
  if ($applied.ContainsKey($it.Name)) {
    if ($applied[$it.Name] -ne $hash -and $it.Name -ne '000_bootstrap.sql') {
      throw "$($it.Name) đã chạy trước đây nhưng nội dung file đã đổi. Dừng lại, báo lập trình viên."
    }
    Write-Host "  bỏ qua (đã chạy): $($it.Name)"
    continue
  }
  if ($DryRun) { Write-Host "  SẼ CHẠY: $($it.Name)" -ForegroundColor Yellow; continue }
  Write-Host "  đang chạy: $($it.Name)" -ForegroundColor Yellow
  Invoke-Psql @('-f', $it.Path) | Out-Null
  Invoke-Psql @('-c', "INSERT INTO schema_migrations (filename, sha256) VALUES ('$($it.Name)', '$hash')") | Out-Null
  Write-Host "  xong: $($it.Name)" -ForegroundColor Green
}

Write-Host ''
if ($DryRun) { Write-Host 'CHẠY THỬ: chưa ghi gì vào DB.' -ForegroundColor Cyan }
else { Invoke-Psql @('-c', 'SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at') }
