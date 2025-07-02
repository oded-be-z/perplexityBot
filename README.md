# FinanceBot Pro v4.0 - Production Ready 🚀

A sophisticated AI-powered financial advisor with institutional-grade analysis, modern visualizations, and production-ready features.

![FinanceBot Pro](https://img.shields.io/badge/Version-4.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Node](https://img.shields.io/badge/Node-%3E%3D16.0.0-green)
![Production Ready](https://img.shields.io/badge/Production-Ready-brightgreen)

## 🆕 What's New in v4.0

### 🛡️ Production Features
- **Rate Limiting**: Prevents abuse with configurable limits
- **Security Headers**: Comprehensive security via Helmet.js
- **Enhanced Error Handling**: Structured error responses with proper logging
- **Input Validation**: Sanitization and validation of all user inputs
- **Graceful Shutdown**: Proper cleanup on server termination

### 📊 Enhanced User Experience
- **Structured Responses**: Clean, digestible analysis format
- **Smart Formatting**: Automatic price/percentage highlighting
- **Action Items**: Clear next steps for users
- **Key Metrics**: Highlighted important data points
- **Response Caching**: 5-minute cache for faster responses

### 🔧 Performance & Monitoring
- **Health Endpoints**: `/api/health` and `/api/metrics` for monitoring
- **Memory Management**: Automatic cleanup and optimization
- **Request Logging**: Detailed request tracking
- **Cache Management**: Intelligent caching with TTL

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 16.0.0
- npm or yarn
- Perplexity AI API key ([Get one here](https://www.perplexity.ai/settings/api))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd financebot-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the application**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📋 Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# Required
PERPLEXITY_API_KEY=your_api_key_here

# Optional (with defaults)
NODE_ENV=development
PORT=3000
CHAT_RATE_LIMIT=50
UPLOAD_RATE_LIMIT=10
```

See `.env.example` for complete configuration options.

## 🛠️ Features

### 💬 AI Financial Advisor
- **Real-time Analysis**: Live market data and trends
- **Technical Analysis**: Support/resistance levels, indicators
- **Risk Assessment**: Comprehensive risk factor analysis
- **Entry/Exit Points**: Specific trading recommendations

### 📈 Portfolio Management
- **CSV Upload**: Intelligent parsing with auto-column detection
- **Portfolio Analysis**: Holdings breakdown, P&L calculation
- **Visualization**: Beautiful donut charts and performance graphs
- **Recommendations**: Rebalancing and optimization suggestions

### 📊 Advanced Charts
- **Modern Visualizations**: Chart.js powered interactive charts
- **Multiple Chart Types**: Line, candlestick, donut, comparison
- **Real-time Updates**: Live price movements
- **Responsive Design**: Mobile-friendly charts

### 🔒 Enterprise Security
- **Rate Limiting**: Protection against abuse
- **Input Sanitization**: XSS and injection protection
- **CORS Configuration**: Secure cross-origin requests
- **Security Headers**: Comprehensive protection via Helmet

## 🔧 API Endpoints

### Health & Monitoring
```
GET /api/health          - System health check
GET /api/metrics         - Performance metrics
```

### Core Features
```
POST /api/chat           - Chat with AI advisor
POST /api/upload         - Upload portfolio files
GET /api/session/init    - Initialize session
```

### Response Format
All endpoints return structured JSON:
```json
{
  "success": true,
  "data": {
    "title": "📊 Apple Analysis",
    "summary": ["Key point 1", "Key point 2"],
    "sections": [...],
    "actionItems": [...],
    "keyMetrics": {...}
  },
  "chart": {...},
  "metadata": {...}
}
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t financebot-pro .

# Run container
docker run -p 3000:3000 \
  -e PERPLEXITY_API_KEY=your_key \
  -e NODE_ENV=production \
  financebot-pro
```

### PM2 Deployment
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name financebot-pro

# Monitor
pm2 monit

# Auto-restart on system reboot
pm2 startup
pm2 save
```

### Heroku Deployment
```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create your-financebot-app

# Set environment variables
heroku config:set PERPLEXITY_API_KEY=your_key
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Health check
npm run health
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Metrics
```bash
curl http://localhost:3000/api/metrics
```

### Logs
Application logs include:
- Request/response logging
- Error tracking with stack traces
- Performance metrics
- Cache hit/miss ratios

## 🔧 Development

### Project Structure
```
financebot-pro/
├── server.js              # Main application server
├── public/
│   └── index.html         # Frontend application
├── test/                  # Test files
├── package.json           # Dependencies and scripts
└── .env.example          # Environment template
```

### Code Quality
```bash
# Linting
npm run lint

# Formatting
npm run format
```

## 📝 Architecture

### Backend (Node.js/Express)
- **ModernChartGenerator**: Chart.js configuration and data formatting
- **ResponseFormatter**: Structured response creation
- **CacheManager**: Intelligent caching with TTL
- **EnhancedPerplexityClient**: AI analysis with retry logic
- **ImprovedCSVParser**: Robust portfolio parsing

### Frontend (Vanilla JS)
- **Structured Messaging**: Clean response rendering
- **Real-time Charts**: Interactive Chart.js visualizations
- **File Upload**: Drag-and-drop portfolio uploads
- **Market Data**: Live price feeds and watchlists

### Security
- **Helmet.js**: Security headers
- **Rate Limiting**: Request throttling
- **Input Validation**: XSS/injection protection
- **CORS**: Cross-origin security

## 🐛 Troubleshooting

### Common Issues

**API Key Issues**
```bash
# Check if API key is set
echo $PERPLEXITY_API_KEY

# Test API connection
curl -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
     https://api.perplexity.ai/chat/completions
```

**Memory Issues**
```bash
# Check memory usage
node --max-old-space-size=4096 server.js
```

**Port Already in Use**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)
```

### Performance Optimization

1. **Enable Caching**: Set appropriate `CACHE_TTL`
2. **Tune Rate Limits**: Adjust based on traffic
3. **Monitor Memory**: Use PM2 or similar for monitoring
4. **Enable Compression**: Add gzip middleware for production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and code comments
- **Issues**: Create GitHub issues for bugs/features
- **Performance**: Monitor via `/api/health` and `/api/metrics`

## 🏆 Production Checklist

- [ ] Environment variables configured
- [ ] Perplexity API key added
- [ ] Rate limits configured for traffic
- [ ] Monitoring/alerting setup
- [ ] SSL certificate installed
- [ ] Backup strategy implemented
- [ ] Error reporting configured
- [ ] Performance monitoring active

---

**FinanceBot Pro v4.0** - Built for production, designed for performance. 🚀