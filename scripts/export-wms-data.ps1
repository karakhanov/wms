<#
.SYNOPSIS
  Дамп PostgreSQL (формат custom) + zip папки backend/media для переноса на сервер.

.EXAMPLE
  .\scripts\export-wms-data.ps1
  .\scripts\export-wms-data.ps1 -PgPassword "secret"
#>
param(
  [string]$PgHost = "localhost",
  [string]$PgUser = "wms",
  [string]$PgDb = "wms",
  [string]$PgPassword = "wms",
  [string]$OutputDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$pgDump = $null
$fromPath = (Get-Command pg_dump -ErrorAction SilentlyContinue)
$fromPathExe = if ($fromPath) { $fromPath.Source } else { $null }
foreach ($c in @(
    $fromPathExe,
    "${env:ProgramFiles}\PostgreSQL\18\bin\pg_dump.exe",
    "${env:ProgramFiles}\PostgreSQL\16\bin\pg_dump.exe",
    "${env:ProgramFiles}\PostgreSQL\15\bin\pg_dump.exe"
  )) {
  if ($c -and (Test-Path $c)) { $pgDump = $c; break }
}
if (-not $pgDump) {
  throw "pg_dump not found. Install PostgreSQL client tools or add bin to PATH."
}

$dumpPath = Join-Path $OutputDir "wms_backup.dump"
$env:PGPASSWORD = $PgPassword
& $pgDump -h $PgHost -U $PgUser -d $PgDb -F c -f $dumpPath
Write-Host "OK: $dumpPath ($(Get-Item $dumpPath).Length bytes)"

$mediaDir = Join-Path $root "backend\media"
$zipPath = Join-Path $OutputDir "wms_media_export.zip"
if (Test-Path $mediaDir) {
  $files = Get-ChildItem $mediaDir -Recurse -File -ErrorAction SilentlyContinue
  if ($files.Count -gt 0) {
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $mediaDir "*") -DestinationPath $zipPath -Force
    Write-Host "OK: $zipPath ($(Get-Item $zipPath).Length bytes)"
  } else {
    Write-Host "Skip media zip (no files under backend\media)."
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  }
}
