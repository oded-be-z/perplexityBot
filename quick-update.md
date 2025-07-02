# 🚀 Quick v4.0 Update (2 Files Only)

## Step 1: Update package.json ✅
Replace your `package.json` with the one I provided above.

## Step 2: Install New Dependencies
```bash
npm install express-rate-limit helmet
```

## Step 3: Replace server.js
Since the server.js file is very large (~850 lines), here are your options:

### Option A: Manual Copy (Recommended)
1. Open a new `server.js` file
2. Copy ALL the content from my previous response (the complete server.js file)
3. Save it, replacing your old server.js

### Option B: Quick Test First
Want to test if everything works before replacing? 

1. Rename your current server.js: `mv server.js server.js.old`
2. I'll help you create the new one step by step

## Step 4: Keep Your .env (Perfect!)
Your `.env` file is exactly right:
```env
PERPLEXITY_API_KEY=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
PORT=3000
NODE_ENV=production
```

## Step 5: Test
```bash
npm start
```

Then visit: `http://localhost:3000`

---

## 🆘 Need the server.js content?

The server.js file is in my previous responses above (search for "server.js - PRODUCTION-READY VERSION"). 

It's the complete file starting with:
```javascript
// server.js - PRODUCTION-READY VERSION with Enhanced Features
const express = require('express');
...
```

**Just copy that entire file content and replace your current server.js!**

---

## ✅ That's It!

With just these 2 file updates + dependency install, you'll have:
- ✅ All production security features
- ✅ Structured responses (no more walls of text!)
- ✅ Health monitoring at `/api/health`
- ✅ Beautiful modern UI
- ✅ All v4.0 improvements

**The other files (README.md, Dockerfile, etc.) are optional - you can add them later!**