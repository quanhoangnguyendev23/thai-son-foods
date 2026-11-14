# ==============================================================================
# THÁI SƠN FOODS — SAO LƯU DB + ẢNH TẢI LÊN CHO MÁY CHỦ WINDOWS (F-03)
# Bản PowerShell tương đương scripts/backup_db.sh (bản .sh giữ nguyên cho máy Linux).
#
# - DB: pg_dump định dạng custom (-Fc, đã nén), tên <DB>_yyyyMMdd_HHmmss.dump
# - Kiểm tra bản dump đọc được (pg_restore --list) ngay sau khi tạo; lỗi → mã thoát 1
# - Ảnh: nén thư mục public\uploads (hoặc UPLOAD_DIR) thành uploads_yyyyMMdd_HHmmss.zip
# - Giữ $Keep bản mới nhất mỗi loại (mặc định 14), xoá bản cũ hơn
# - Chuỗi kết nối đọc từ $env:DATABASE_URL hoặc dòng DATABASE_URL trong <AppDir>\.env.
#   Mật khẩu chuyển qua biến PGPASSWORD của tiến trình, không đặt trên dòng lệnh, không in ra.
#
# Chạy tay:
#   powershell -ExecutionPolicy Bypass -File C:\inetpub\thai-son-foods\scripts\sao_luu_db.ps1 -AppDir C:\inetpub\thai-son-foods -BackupDir D:\Backup\webtsf
# Lịch hằng ngày + khôi phục: docs/golive/ROLLBACK-TOAN-HE-THONG.md
# ==============================================================================

param(
  [string]$AppDir = (Split-Path $PSScriptRoot -Parent),
  [string]$BackupDir = 'D:\Backup\webtsf',
  [int]$Keep = 14,
  [switch]$SkipUploads
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$dbDir = Join-Path $BackupDir 'database'
$upDir = Join-Path $BackupDir 'uploads'
New-Item -ItemType Directory -Force -Path $dbDir, $upDir | Out-Null
$logFile = Join-Path $BackupDir 'sao-luu.log'

function Write-Log([string]$msg) {
  $line = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $msg
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Read-EnvValue([string]$name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  $envFile = Join-Path $AppDir '.env'
  if (-not $v -and (Test-Path $envFile)) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
    if ($line) { $v = ($line -replace "^\s*$name\s*=\s*", '').Trim().Trim('"').Trim("'") }
  }
  return $v
}

# Tách DATABASE_URL thành từng phần cho pg_dump (mật khẩu đi qua PGPASSWORD)
function Get-PgConn([string]$url) {
  $u = [Uri]($url -replace '^postgres(ql)?://', 'http://')
  $userInfo = $u.UserInfo.Split(':', 2)
  return [pscustomobject]@{
    Host     = $u.Host
    Port     = $(if ($u.Port -gt 0) { $u.Port } else { 5432 })
    User     = [Uri]::UnescapeDataString($userInfo[0])
    Password = $(if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' })
    Db       = $u.AbsolutePath.Trim('/')
  }
}

function Invoke-Native([string]$exe, [string[]]$argv) {
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & $exe @argv 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $prev }
  return [pscustomobject]@{ Code = $LASTEXITCODE; Out = $out }
}

foreach ($tool in 'pg_dump', 'pg_restore') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Write-Log "LỖI: không thấy $tool trong PATH"; exit 1 }
}

$url = Read-EnvValue 'DATABASE_URL'
if (-not $url) { Write-Log 'LỖI: thiếu DATABASE_URL (biến môi trường hoặc .env)'; exit 1 }
$c = Get-PgConn $url
$env:PGPASSWORD = $c.Password

try {
  # 1. DB
  $dumpFile = Join-Path $dbDir ("{0}_{1}.dump" -f $c.Db, $stamp)
  Write-Log "Bắt đầu sao lưu DB [$($c.Db)] -> $dumpFile"
  $r = Invoke-Native 'pg_dump' @('-h', $c.Host, '-p', "$($c.Port)", '-U', $c.User, '-d', $c.Db, '-Fc', '--no-password', '-f', $dumpFile)
  if ($r.Code -ne 0) { Write-Log ("LỖI pg_dump: " + ($r.Out -join ' ')); if (Test-Path $dumpFile) { Remove-Item $dumpFile -Force }; exit 1 }

  $check = Invoke-Native 'pg_restore' @('--list', $dumpFile)
  $tableData = @($check.Out | Where-Object { $_ -match ' TABLE DATA ' }).Count
  if ($check.Code -ne 0 -or $tableData -eq 0) { Write-Log "LỖI: bản dump không đọc được hoặc rỗng ($dumpFile)"; exit 1 }
  $sizeMb = [Math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
  Write-Log "OK DB: $sizeMb MB, $tableData bảng có dữ liệu"

  # 2. Ảnh tải lên
  if (-not $SkipUploads) {
    $uploadSrc = Read-EnvValue 'UPLOAD_DIR'
    if (-not $uploadSrc) { $uploadSrc = Join-Path $AppDir 'public\uploads' }
    elseif (-not [IO.Path]::IsPathRooted($uploadSrc)) { $uploadSrc = Join-Path $AppDir $uploadSrc }
    if (Test-Path $uploadSrc) {
      $zip = Join-Path $upDir ("uploads_{0}.zip" -f $stamp)
      Compress-Archive -Path (Join-Path $uploadSrc '*') -DestinationPath $zip -CompressionLevel Optimal
      Write-Log ("OK ảnh: {0} MB -> {1}" -f [Math]::Round((Get-Item $zip).Length / 1MB, 2), $zip)
    } else {
      Write-Log "Bỏ qua ảnh: không có thư mục $uploadSrc"
    }
  }

  # 3. Giữ $Keep bản mới nhất
  foreach ($set in @(@{ Dir = $dbDir; Pattern = "$($c.Db)_*.dump" }, @{ Dir = $upDir; Pattern = 'uploads_*.zip' })) {
    $old = Get-ChildItem -Path $set.Dir -Filter $set.Pattern | Sort-Object Name -Descending | Select-Object -Skip $Keep
    foreach ($f in $old) { Remove-Item $f.FullName -Force; Write-Log "Xoá bản cũ: $($f.Name)" }
  }
  Write-Log 'Hoàn tất sao lưu.'
  exit 0
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
