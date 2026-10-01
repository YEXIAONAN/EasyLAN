# Built-in Windows PowerShell launcher. No Go/Node runtime is required.
$ErrorActionPreference = 'Stop'
try {
    $localchatRoot = Split-Path -Parent $PSScriptRoot
    $localchatPort = $env:LOCALCHAT_PORT
    if ([string]::IsNullOrWhiteSpace($localchatPort)) {
        $localchatEnv = Join-Path $localchatRoot '.env'
        if (Test-Path -LiteralPath $localchatEnv) {
            foreach ($line in Get-Content -LiteralPath $localchatEnv) {
                if ($line -match '^\s*(?:export\s+)?LOCALCHAT_PORT\s*=(.*)$') {
                    $localchatPort = ($Matches[1] -split '#', 2)[0].Trim().Trim('"').Trim("'")
                }
            }
        }
    }
    if ([string]::IsNullOrWhiteSpace($localchatPort)) { $localchatPort = '8787' }
    if ($localchatPort -notmatch '^\d{1,5}$' -or [int]$localchatPort -lt 1 -or [int]$localchatPort -gt 65535) {
        throw 'LOCALCHAT_PORT must be a number from 1 to 65535.'
    }
    $localchatBinary = $null
    foreach ($relative in @('release\localchat-windows-amd64.exe', 'localchat-windows-amd64.exe', 'localchat.exe')) {
        $candidate = Join-Path $localchatRoot $relative
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $localchatBinary = $candidate; break }
    }
    if (-not $localchatBinary) {
        throw 'Missing localchat-windows-amd64.exe. Put it in the project root or release/, or build the project first (see README.md).'
    }
    Write-Host "Starting LocalChat on port $localchatPort..."
    Set-Location -LiteralPath $localchatRoot
    & $localchatBinary -addr "0.0.0.0:$localchatPort" @args
    exit $LASTEXITCODE
} catch {
    Write-Host "LocalChat: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
