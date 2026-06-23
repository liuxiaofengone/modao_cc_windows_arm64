# Modao Windows ARM64 Client Builder (PowerShell Script)
$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "         Modao Windows ARM64 Client Builder" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check if Node.js is installed
$hasNode = $false
try {
    $nodeVer = node -v 2>$null
    if ($nodeVer) {
        $hasNode = $true
        Write-Host "[INFO] Locally installed Node.js detected ($nodeVer). Starting build..." -ForegroundColor Green
    }
} catch {}

$nodeDir = Join-Path $PSScriptRoot ".node-portable"

if (-not $hasNode) {
    Write-Host "[WARN] Node.js environment not found!" -ForegroundColor Yellow
    Write-Host "[INFO] Downloading portable Node.js (v20.11.1 win-arm64) from Alibaba mirror..." -ForegroundColor Cyan
    Write-Host ""

    $nodeZip = Join-Path $PSScriptRoot "node-arm64-portable.zip"
    $nodeUrl = "https://npmmirror.com/mirrors/node/v20.11.1/node-v20.11.1-win-arm64.zip"

    # Download Node.js
    try {
        Write-Host "Downloading Node.js portable zip package..." -ForegroundColor Gray
        Start-BitsTransfer -Source $nodeUrl -Destination $nodeZip
    } catch {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip -UseBasicParsing
    }

    # Extract Node.js
    Write-Host "Download completed. Extracting Node.js..." -ForegroundColor Gray
    if (Test-Path $nodeDir) {
        Remove-Item -Path $nodeDir -Recurse -Force
    }
    Expand-Archive -Path $nodeZip -DestinationPath $nodeDir
    Remove-Item -Path $nodeZip -Force

    # Set path
    $portableNodePath = Join-Path $nodeDir "node-v20.11.1-win-arm64"
    $env:PATH = "$portableNodePath;" + $env:PATH
    Write-Host "[SUCCESS] Portable Node.js environment configured." -ForegroundColor Green
    Write-Host ""
}

# 2. Run npm install and build
try {
    Write-Host "[INFO] Installing build dependencies via npmmirror..." -ForegroundColor Cyan
    cmd /c "npm install"

    Write-Host ""
    Write-Host "[INFO] Building native Windows ARM64 Modao client..." -ForegroundColor Cyan
    cmd /c "npm run build"
} catch {
    Write-Host "[ERROR] Build failed. Please check your network connection!" -ForegroundColor Red
    Write-Error $_
} finally {
    # 3. Clean up
    if (Test-Path $nodeDir) {
        Write-Host "[INFO] Cleaning up portable Node.js directory..." -ForegroundColor Gray
        Remove-Item -Path $nodeDir -Recurse -Force
    }
}

Write-Host "======================================================" -ForegroundColor Green
Write-Host "🎉 Modao Windows ARM64 Native Client Built Successfully!" -ForegroundColor Green
Write-Host "Output: $(Join-Path $PSScriptRoot 'dist\modao-win32-arm64')" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit..."
