<#
.SYNOPSIS
  Копирует wms_backup.dump и (если есть) wms_media_export.zip на сервер по SCP.

.EXAMPLE
  .\scripts\push-wms-data.ps1 -RemoteHost "deploy@203.0.113.10"
  .\scripts\push-wms-data.ps1 -RemoteHost "user@vps" -RemotePath "/home/user/wms-migrate"
#>
param(
  [Parameter(Mandatory = $true)][string]$RemoteHost,
  [string]$RemotePath = "~/wms-migrate",
  [string]$LocalDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$dump = Join-Path $LocalDir "wms_backup.dump"
if (-not (Test-Path $dump)) {
  throw "Missing $dump — run .\scripts\export-wms-data.ps1 first."
}

ssh $RemoteHost "mkdir -p $RemotePath"
scp $dump "${RemoteHost}:${RemotePath}/wms_backup.dump"

$zip = Join-Path $LocalDir "wms_media_export.zip"
if (Test-Path $zip) {
  scp $zip "${RemoteHost}:${RemotePath}/wms_media_export.zip"
  Write-Host "Uploaded dump + media zip to ${RemoteHost}:$RemotePath"
} else {
  Write-Host "Uploaded dump only (no wms_media_export.zip) to ${RemoteHost}:$RemotePath"
}

Write-Host "On the server, run: bash scripts/server-restore.sh (from repo root, after editing paths if needed)."
