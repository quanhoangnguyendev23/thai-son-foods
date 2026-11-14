# ==============================================================================
# THÁI SƠN FOODS — KHÔI PHỤC DB TỪ BẢN SAO LƯU .dump SANG MỘT DB MỚI + ĐỐI SOÁT (F-03)
#
# Luôn khôi phục vào DB MỚI (không ghi đè DB đang chạy). Đổi sang DB mới bằng cách sửa DATABASE_URL
# rồi khởi động lại app (docs/golive/ROLLBACK-TOAN-HE-THONG.md). DB cũ giữ lại để điều tra.
#
#   -BackupFile   file .dump do scripts/sao_luu_db.ps1 tạo
#   -TargetDb     tên DB mới, phải CHƯA tồn tại (ví dụ WebTSF_production_restore_20261114)
#   -CompareWith  (tuỳ chọn) tên DB nguồn để đếm số dòng từng bảng hai bên và báo khớp / lệch
#   -DropAfter    (tuỳ chọn, chỉ dùng khi diễn tập) xoá DB mới sau khi đối soát
#   -AppOwner     (tuỳ chọn) role làm chủ các bảng sau khi khôi phục, ví dụ tsf_app
#
# Kết nối: lấy host/port/user/mật khẩu từ DATABASE_URL (biến môi trường hoặc <AppDir>\.env); user này phải
# có quyền CREATE DATABASE (thường chạy bằng tài khoản quản trị postgres: đặt $env:DATABASE_URL tạm thời).
# Mật khẩu đi qua PGPASSWORD, không in ra.
#
# Ví dụ diễn tập:
#   powershell -ExecutionPolicy Bypass -File scripts\khoi_phuc_db.ps1 -BackupFile D:\Backup\webtsf\database\WebTSF_production_20261114_000500.dump `
#     -TargetDb webtsf_restore_test -CompareWith WebTSF_production -DropAfter
# ==============================================================================

param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [Parameter(Mandatory = $true)][string]$TargetDb,
  [string]$CompareWith = '',
  [switch]$DropAfter,
  [string]$AppOwner = '',
  [string]$AppDir = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'

function Read-EnvValue([string]$name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  $envFile = Join-Path $AppDir '.env'
  if (-not $v -and (Test-Path $envFile)) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
    if ($line) { $v = ($line -replace "^\s*$name\s*=\s*", '').Trim().Trim('"').Trim("'") }
  }
  return $v
}

function Invoke-Native([string]$exe, [string[]]$argv) {
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & $exe @argv 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $prev }
  return [pscustomobject]@{ Code = $LASTEXITCODE; Out = $out }
}

if ($TargetDb -notmatch '^[A-Za-z0-9_]+$') { throw 'TargetDb chỉ gồm chữ, số, dấu gạch dưới.' }
if (-not (Test-Path $BackupFile)) { throw "Không thấy file: $BackupFile" }
foreach ($tool in 'psql', 'pg_restore') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Không thấy $tool trong PATH" }
}

$url = Read-EnvValue 'DATABASE_URL'
if (-not $url) { throw 'Thiếu DATABASE_URL' }
$u = [Uri]($url -replace '^postgres(ql)?://', 'http://')
$ui = $u.UserInfo.Split(':', 2)
$pgHost = $u.Host; $pgPort = $(if ($u.Port -gt 0) { "$($u.Port)" } else { '5432' })
$pgUser = [Uri]::UnescapeDataString($ui[0])
$env:PGPASSWORD = $(if ($ui.Count -gt 1) { [Uri]::UnescapeDataString($ui[1]) } else { '' })
$env:PGOPTIONS = '-c client_min_messages=warning'
$conn = @('-h', $pgHost, '-p', $pgPort, '-U', $pgUser, '--no-password')

function Invoke-Sql([string]$db, [string]$sql) {
  $r = Invoke-Native 'psql' ($conn + @('-d', $db, '-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', $sql))
  if ($r.Code -ne 0) { throw ($r.Out -join "`n") }
  return $r.Out
}

try {
  $exists = Invoke-Sql 'postgres' "SELECT 1 FROM pg_database WHERE datname = '$TargetDb'"
  if ("$exists".Trim() -eq '1') { throw "DB $TargetDb đã tồn tại. Chọn tên khác (không ghi đè DB có sẵn)." }

  $t0 = Get-Date
  Invoke-Sql 'postgres' "CREATE DATABASE `"$TargetDb`" ENCODING 'UTF8' TEMPLATE template0" | Out-Null
  Write-Host "Đã tạo DB $TargetDb, đang khôi phục..." -ForegroundColor Cyan
  $r = Invoke-Native 'pg_restore' ($conn + @('-d', $TargetDb, '--no-owner', '--no-privileges', '--exit-on-error', $BackupFile))
  if ($r.Code -ne 0) { throw ("pg_restore lỗi: " + ($r.Out -join "`n")) }
  $secs = [Math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
  Write-Host "Khôi phục xong trong $secs giây." -ForegroundColor Green

  if ($AppOwner) {
    if ($AppOwner -notmatch '^[A-Za-z0-9_]+$') { throw 'AppOwner không hợp lệ' }
    Invoke-Sql $TargetDb "ALTER SCHEMA public OWNER TO `"$AppOwner`"" | Out-Null
    $stmts = Invoke-Sql $TargetDb "SELECT format('ALTER TABLE public.%I OWNER TO %I', tablename, '$AppOwner') FROM pg_tables WHERE schemaname='public' UNION ALL SELECT format('ALTER SEQUENCE public.%I OWNER TO %I', sequencename, '$AppOwner') FROM pg_sequences WHERE schemaname='public'"
    foreach ($s in $stmts) { if ($s) { Invoke-Sql $TargetDb $s | Out-Null } }
    Write-Host "Đã giao các bảng cho $AppOwner." -ForegroundColor Green
  }

  if ($CompareWith) {
    $tables = Invoke-Sql $TargetDb "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
    $rows = @(); $bad = 0
    foreach ($t in $tables) {
      if (-not $t) { continue }
      $q = "SELECT count(*) FROM public.`"$t`""
      $a = "$(Invoke-Sql $CompareWith $q)".Trim(); $b = "$(Invoke-Sql $TargetDb $q)".Trim()
      $ok = ($a -eq $b); if (-not $ok) { $bad++ }
      $rows += [pscustomobject]@{ Bang = $t; Nguon = $a; KhoiPhuc = $b; Khop = $(if ($ok) { 'khớp' } else { 'LỆCH' }) }
    }
    $rows | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    Write-Host ("Đối soát {0} bảng: {1} khớp, {2} lệch." -f $rows.Count, ($rows.Count - $bad), $bad) -ForegroundColor $(if ($bad) { 'Red' } else { 'Green' })
    if ($bad) { $script:exitCode = 1 }
  }
} finally {
  if ($DropAfter) {
    try { Invoke-Sql 'postgres' "DROP DATABASE IF EXISTS `"$TargetDb`"" | Out-Null; Write-Host "Đã xoá DB tạm $TargetDb." } catch { Write-Host "Không xoá được $TargetDb : $_" -ForegroundColor Red }
  }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
if ($script:exitCode) { exit $script:exitCode }
