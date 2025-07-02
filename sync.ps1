# FinanceBot Pro v4.0 - Windows Sync Script
# Run this script in your financebot-pro directory

Write-Host "🔄 Syncing FinanceBot Pro to v4.0..." -ForegroundColor Yellow

# Create backup of current files
Write-Host "📦 Creating backup..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path "./backup"
Copy-Item -Path "./server.js" -Destination "./backup/server.js.backup" -ErrorAction SilentlyContinue
Copy-Item -Path "./package.json" -Destination "./backup/package.json.backup" -ErrorAction SilentlyContinue

Write-Host "✅ Backup complete!" -ForegroundColor Green

# Instructions for manual file updates
Write-Host @"

📝 MANUAL STEPS REQUIRED:

1. ✅ Update package.json (copy the content I provided above)

2. ✅ Install new dependencies:
   npm install express-rate-limit helmet

3. ✅ I'll provide you the updated server.js content next

4. ✅ Keep your .env file (it's perfect with your API key!)

5. ✅ Test with: npm start

"@ -ForegroundColor Cyan

Write-Host "🎯 Ready for next steps!" -ForegroundColor Yellow