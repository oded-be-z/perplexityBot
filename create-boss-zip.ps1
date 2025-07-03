# FinanceBot Pro - Create Boss ZIP Package
Write-Host "🚀 Creating FinanceBot Pro ZIP for Boss..." -ForegroundColor Green

# Create temporary directory for clean files
$tempDir = "FinanceBot-Pro-v4.0"
$zipName = "FinanceBot-Pro-v4.0-BOSS.zip"

Write-Host "📁 Preparing files..." -ForegroundColor Yellow

# Remove old temp directory and zip if exists
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
if (Test-Path $zipName) { Remove-Item $zipName -Force }

# Create new temp directory
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy essential files
Write-Host "📋 Copying essential files..." -ForegroundColor Cyan

# Core files
Copy-Item "server.js" "$tempDir/"
Copy-Item "package.json" "$tempDir/"
Copy-Item "package-lock.json" "$tempDir/"
Copy-Item "Dockerfile" "$tempDir/"
Copy-Item "docker-compose.yml" "$tempDir/"
Copy-Item "start.bat" "$tempDir/"
Copy-Item "BOSS_INSTRUCTIONS.md" "$tempDir/"

# Public folder (entire directory)
Copy-Item "public" "$tempDir/" -Recurse

# Test folder (for demo data)
Copy-Item "test" "$tempDir/" -Recurse

# Documentation
Copy-Item "README.md" "$tempDir/"
Copy-Item "PRODUCTION_UPGRADE_SUMMARY.md" "$tempDir/"

# Environment file (if exists)
if (Test-Path ".env") {
    Copy-Item ".env" "$tempDir/"
    Write-Host "✅ Included .env file with API keys" -ForegroundColor Green
}

Write-Host "📦 Creating ZIP file..." -ForegroundColor Yellow

# Create ZIP file
Compress-Archive -Path $tempDir -DestinationPath $zipName -Force

# Cleanup temp directory
Remove-Item $tempDir -Recurse -Force

# Show results
$zipSize = [math]::Round((Get-Item $zipName).Length / 1MB, 2)
Write-Host ""
Write-Host "✅ SUCCESS!" -ForegroundColor Green
Write-Host "📦 Created: $zipName" -ForegroundColor Cyan
Write-Host "📊 Size: $zipSize MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 ZIP Contents:" -ForegroundColor Yellow
Write-Host "   ✅ start.bat (double-click to run)" -ForegroundColor White
Write-Host "   ✅ BOSS_INSTRUCTIONS.md (read first)" -ForegroundColor White
Write-Host "   ✅ All source code & assets" -ForegroundColor White
Write-Host "   ✅ Docker configuration" -ForegroundColor White
Write-Host "   ✅ API keys included" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Ready to send to boss!" -ForegroundColor Green
Write-Host ""

# Pause so user can see results
Read-Host "Press Enter to continue" 