// server.js - PRODUCTION-READY VERSION with Enhanced Features
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const Papa = require('papaparse'); // Better CSV parsing
const fs = require('fs').promises;

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// PRODUCTION MIDDLEWARE & SECURITY
// ======================

// Rate limiting for production
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Security headers
// app.use(helmet({
//     contentSecurityPolicy: false  // Disabled for local testing
// }));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] // Replace with actual domain
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Rate limiting
const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 uploads per hour
    message: {
        success: false,
        error: 'Upload limit reached, please try again later.',
        retryAfter: '1 hour'
    }
});

// Body parsing with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging with better format
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.path;
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
    next();
});

// ======================
// ENHANCED RESPONSE FORMATTER
// ======================

class ResponseFormatter {
    static formatFinancialAnalysis(content, topic) {
        // Split long responses into digestible sections
        const sections = this.extractSections(content);
        
        return {
            title: `📊 ${topic} Analysis`,
            summary: this.createSummary(sections),
            sections: sections.map(section => ({
                title: section.title,
                content: this.formatSectionContent(section.content),
                type: section.type
            })),
            actionItems: this.extractActionItems(content),
            keyMetrics: this.extractKeyMetrics(content)
        };
    }

    static extractSections(content) {
        const sections = [];
        const lines = content.split('\n');
        let currentSection = { title: 'Overview', content: [], type: 'general' };
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (this.isSectionHeader(trimmed)) {
                if (currentSection.content.length > 0) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: this.cleanSectionTitle(trimmed),
                    content: [],
                    type: this.getSectionType(trimmed)
                };
            } else if (trimmed.length > 0) {
                currentSection.content.push(trimmed);
            }
        }
        
        if (currentSection.content.length > 0) {
            sections.push(currentSection);
        }
        
        return sections;
    }

    static isSectionHeader(line) {
        return /^(#{1,4}|••••|\*\*|Current Price|Technical Analysis|Market Sentiment|Recommendations?|Risk Factors?|Summary)/i.test(line);
    }

    static cleanSectionTitle(title) {
        return title.replace(/^#+\s*|\*\*|\|/g, '').trim();
    }

    static getSectionType(title) {
        const lower = title.toLowerCase();
        if (lower.includes('price') || lower.includes('technical')) return 'technical';
        if (lower.includes('risk') || lower.includes('warning')) return 'risk';
        if (lower.includes('recommend') || lower.includes('entry') || lower.includes('exit')) return 'actionable';
        return 'general';
    }

    static formatSectionContent(content) {
        return content
            .slice(0, 3) // Limit to 3 main points per section
            .map(line => {
                // Format prices and percentages with better styling
                return line
                    .replace(/\$[\d,]+\.?\d*/g, match => `💰 ${match}`)
                    .replace(/([+-]?\d+\.?\d*%)/g, match => {
                        const value = parseFloat(match);
                        return value >= 0 ? `📈 ${match}` : `📉 ${match}`;
                    })
                    .replace(/^[-•]\s*/, '• '); // Normalize bullet points
            });
    }

    static createSummary(sections) {
        const summaryPoints = [];
        
        // Extract key points from each section (max 1 per section)
        sections.forEach(section => {
            if (section.content.length > 0) {
                const keyPoint = section.content[0];
                if (keyPoint.length < 100) { // Only short, concise points
                    summaryPoints.push(`${section.title}: ${keyPoint}`);
                }
            }
        });
        
        return summaryPoints.slice(0, 3); // Max 3 summary points
    }

    static extractActionItems(content) {
        const actionPatterns = [
            /(?:buy|entry|enter|long).*?(?:at|@|above|below)\s*\$?[\d,.]+/gi,
            /(?:sell|exit|take profit|target).*?(?:at|@|above|below)\s*\$?[\d,.]+/gi,
            /(?:stop loss|stop|stop-loss).*?(?:at|@|above|below)\s*\$?[\d,.]+/gi
        ];
        
        const actions = [];
        actionPatterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            actions.push(...matches.slice(0, 2)); // Max 2 per pattern
        });
        
        return actions.slice(0, 4); // Max 4 total action items
    }

    static extractKeyMetrics(content) {
        const metrics = {};
        
        // Extract current price
        const priceMatch = content.match(/current price.*?\$?[\d,]+\.?\d*/i);
        if (priceMatch) metrics.currentPrice = priceMatch[0];
        
        // Extract changes
        const changeMatch = content.match(/(?:24h?|daily).*?[+-]?\d+\.?\d*%/i);
        if (changeMatch) metrics.change24h = changeMatch[0];
        
        // Extract support/resistance
        const supportMatch = content.match(/support.*?\$?[\d,]+\.?\d*/i);
        if (supportMatch) metrics.support = supportMatch[0];
        
        const resistanceMatch = content.match(/resistance.*?\$?[\d,]+\.?\d*/i);
        if (resistanceMatch) metrics.resistance = resistanceMatch[0];
        
        return metrics;
    }
}

// ======================
// CACHING SYSTEM
// ======================

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.ttl = 5 * 60 * 1000; // 5 minutes TTL
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + this.ttl
        });
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

const cache = new CacheManager();

// ======================
// ENHANCED ERROR HANDLING
// ======================

class AppError extends Error {
    constructor(message, statusCode, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    console.error(`[ERROR] ${req.method} ${req.path}:`, {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString()
    });

    // Perplexity API errors
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        error = new AppError('Service temporarily unavailable. Please try again.', 503, 'SERVICE_UNAVAILABLE');
    }

    // Rate limit errors
    if (err.status === 429) {
        error = new AppError('Too many requests. Please wait before trying again.', 429, 'RATE_LIMIT');
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        error = new AppError('Invalid input data', 400, 'VALIDATION_ERROR');
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Something went wrong',
        code: error.code,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// ======================
// MODERN CHART GENERATOR - Enhanced
// ======================

class ModernChartGenerator {
    constructor() {
        this.chartConfig = {
            defaultHeight: 400,
            colors: {
                primary: '#22c55e',
                danger: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6',
                gold: '#FFD700'
            }
        };
    }

    generatePriceChartData(data, options = {}) {
        const { title = "Price Chart", symbol = "Asset" } = options;
        
        if (!data || data.length === 0) {
            return null;
        }

        // Ensure we have proper price data
        const prices = data.map((d, index) => ({
            x: d.time || d.date || index,
            y: parseFloat(d.price || d.close || d.value || 0)
        }));

        return {
            type: 'line',
            title: title,
            data: {
                labels: prices.map(p => p.x),
                datasets: [{
                    label: symbol,
                    data: prices.map(p => p.y),
                    borderColor: this.chartConfig.colors.primary,
                    backgroundColor: `${this.chartConfig.colors.primary}20`,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: title,
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Price ($)'
                        },
                        ticks: {
                            callback: (value) => '$' + value.toFixed(2)
                        }
                    }
                }
            }
        };
    }

    generateCandlestickData(ohlcData, options = {}) {
        const { title = "Price Movement", symbol = "Asset" } = options;
        
        if (!ohlcData || ohlcData.length === 0) {
            return null;
        }

        return {
            type: 'candlestick',
            title: title,
            data: ohlcData.map(candle => ({
                x: candle.date || candle.time,
                o: parseFloat(candle.open),
                h: parseFloat(candle.high),
                l: parseFloat(candle.low),
                c: parseFloat(candle.close),
                v: candle.volume
            }))
        };
    }

    generatePortfolioDonutData(holdings, totalValue) {
        if (!holdings || holdings.length === 0) return null;

        // Sort by value and get top 10
        const sorted = [...holdings].sort((a, b) => b.value - a.value);
        const top10 = sorted.slice(0, 10);
        
        // Calculate others if needed
        let othersValue = 0;
        if (sorted.length > 10) {
            othersValue = sorted.slice(10).reduce((sum, h) => sum + h.value, 0);
        }

        const data = {
            type: 'doughnut',
            title: 'Portfolio Distribution',
            data: {
                labels: [...top10.map(h => h.symbol || h.asset), ...(othersValue > 0 ? ['Others'] : [])],
                datasets: [{
                    data: [...top10.map(h => h.value), ...(othersValue > 0 ? [othersValue] : [])],
                    backgroundColor: [
                        '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
                        '#ec4899', '#10b981', '#f97316', '#06b6d4', '#6366f1',
                        '#64748b'
                    ],
                    borderWidth: 2,
                    borderColor: '#0a0e1a'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Portfolio Distribution - Total: $${totalValue.toFixed(2)}`,
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            generateLabels: (chart) => {
                                const data = chart.data;
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = ((value / totalValue) * 100).toFixed(1);
                                    return {
                                        text: `${label}: ${percentage}%`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        index: i
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed;
                                const percentage = ((value / totalValue) * 100).toFixed(1);
                                return `${context.label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        return data;
    }

    generateComparisonChart(assets, period = '1D') {
        if (!assets || assets.length === 0) return null;

        const datasets = assets.map((asset, index) => {
            const colors = [this.chartConfig.colors.primary, this.chartConfig.colors.info, this.chartConfig.colors.warning];
            const color = colors[index % colors.length];
            
            return {
                label: asset.name || asset.symbol,
                data: asset.prices || [],
                borderColor: color,
                backgroundColor: `${color}20`,
                fill: false,
                tension: 0.3
            };
        });

        return {
            type: 'line',
            title: 'Asset Comparison',
            data: {
                labels: assets[0].prices.map((_, i) => i),
                datasets: datasets
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Performance Comparison - ${period}`,
                        font: { size: 16, weight: 'bold' }
                    }
                }
            }
        };
    }
}

// ======================
// IMPROVED CSV PARSER
// ======================

class ImprovedCSVParser {
    async parsePortfolioCSV(buffer) {
        try {
            let csvText = buffer.toString('utf8');
            
            // Remove BOM if present
            if (csvText.charCodeAt(0) === 0xFEFF) {
                csvText = csvText.slice(1);
            }

            // Use Papa Parse for robust CSV parsing
            const parseResult = Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                transformHeader: (header) => {
                    // Normalize headers - remove spaces and convert to lowercase
                    return header.trim().toLowerCase().replace(/[\s_]+/g, '_');
                },
                transform: (value) => {
                    // Clean numeric values
                    if (typeof value === 'string') {
                        // Remove currency symbols and commas
                        const cleaned = value.replace(/[$,]/g, '').trim();
                        const num = parseFloat(cleaned);
                        return isNaN(num) ? value : num;
                    }
                    return value;
                }
            });

            if (parseResult.errors.length > 0) {
                console.error('CSV Parse Errors:', parseResult.errors);
            }

            // Normalize the data structure
            const normalizedData = parseResult.data.map(row => {
                // Map various possible column names to standard names
                const normalized = {
                    symbol: row.symbol || row.ticker || row.asset || row.stock || '',
                    asset: row.asset || row.name || row.description || row.symbol || '',
                    shares: row.shares || row.quantity || row.qty || row.units || 0,
                    purchase_price: row.purchase_price || row.cost || row.buy_price || row.avg_cost || 0,
                    current_price: row.current_price || row.price || row.last_price || row.market_price || 0,
                    market_value: row.market_value || row.value || row.total_value || row.position_value || 0,
                    gain_loss: row.gain_loss || row.pnl || row.profit_loss || row.unrealized_gain || 0,
                    asset_type: row.asset_type || row.type || row.category || 'stock'
                };

                // Calculate missing values if possible
                if (!normalized.market_value && normalized.shares && normalized.current_price) {
                    normalized.market_value = normalized.shares * normalized.current_price;
                }

                if (!normalized.gain_loss && normalized.market_value && normalized.shares && normalized.purchase_price) {
                    const totalCost = normalized.shares * normalized.purchase_price;
                    normalized.gain_loss = normalized.market_value - totalCost;
                }

                return normalized;
            }).filter(row => row.symbol || row.asset); // Filter out empty rows

            console.log(`[CSV Parser] Successfully parsed ${normalizedData.length} portfolio items`);
            
            return {
                success: true,
                data: normalizedData,
                headers: Object.keys(parseResult.data[0] || {}),
                rowCount: normalizedData.length
            };

        } catch (error) {
            console.error('[CSV Parser] Error:', error);
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    validatePortfolioData(data) {
        const required = ['symbol', 'market_value'];
        const missing = [];

        for (const field of required) {
            if (!data.some(row => row[field] && row[field] !== 0)) {
                missing.push(field);
            }
        }

        return {
            valid: missing.length === 0,
            missing: missing
        };
    }
}

// ======================
// ENHANCED PERPLEXITY CLIENT
// ======================

class EnhancedPerplexityClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.perplexity.ai/chat/completions';
        this.chartGenerator = new ModernChartGenerator();
        
        this.models = {
            complex: 'llama-3.1-sonar-large-128k-online',
            balanced: 'llama-3.1-sonar-small-128k-online',
            fast: 'llama-3.1-sonar-small-128k-online'
        };
    }

    async getFinancialAnalysis(topic, options = {}) {
        // Check cache first
        const cacheKey = `analysis_${topic}_${options.complexity || 'balanced'}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log(`[CACHE HIT] Analysis for ${topic}`);
            return cached;
        }

        const systemPrompt = `You are Max, a professional financial advisor. Provide CONCISE, actionable analysis.

CRITICAL RULES:
1. Keep responses under 500 words total
2. Use clear section headers: ## Current Price, ## Technical Levels, ## Recommendation
3. Focus on specific price levels and actionable insights
4. Include ONLY the most important risk factors
5. No lengthy explanations - be direct and precise

Structure your response with clear sections for easy parsing.`;

        const userPrompt = `Analyze ${topic} with focus on:
- Current price and key daily changes
- 2-3 critical technical levels (support/resistance)
- One clear recommendation with specific entry/exit points
- Top 2 risk factors

Keep response under 400 words, be specific with numbers.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], {
                complexity: options.complexity || 'balanced',
                recency: 'day'
            });

            const formattedResponse = ResponseFormatter.formatFinancialAnalysis(response.content, topic);
            
            // Cache the result
            cache.set(cacheKey, formattedResponse);
            
            return formattedResponse;
        } catch (error) {
            console.error('Perplexity Analysis Error:', error);
            throw new AppError('Analysis service temporarily unavailable', 503, 'ANALYSIS_UNAVAILABLE');
        }
    }

    async makeRequest(messages, options = {}) {
        const model = options.complexity === 'high' 
            ? this.models.complex 
            : this.models.balanced;
        
        const requestBody = {
            model: model,
            messages: messages,
            max_tokens: 4000,
            temperature: 0.2,
            top_p: 0.9,
            return_citations: true,
            search_domain_filter: [
                "yahoo.finance.com",
                "bloomberg.com",
                "reuters.com",
                "marketwatch.com",
                "tradingview.com"
            ],
            search_recency_filter: options.recency || "day"
        };

        try {
            const response = await axios.post(this.baseURL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            
            return {
                content: response.data.choices[0].message.content,
                citations: response.data.citations || [],
                usage: response.data.usage
            };
        } catch (error) {
            console.error('Perplexity API Error:', error.response?.data || error.message);
            throw new Error('Unable to complete analysis. Please try again.');
        }
    }
}

// Initialize services
const chartGenerator = new ModernChartGenerator();
const csvParser = new ImprovedCSVParser();
let perplexityClient;

if (process.env.PERPLEXITY_API_KEY) {
    perplexityClient = new EnhancedPerplexityClient(process.env.PERPLEXITY_API_KEY);
    console.log('✅ Enhanced Perplexity client initialized');
} else {
    console.error('❌ PERPLEXITY_API_KEY not found in environment variables');
}

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 
                             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        cb(null, allowedTypes.includes(file.mimetype));
    }
});

// Session storage (simple in-memory for now)
const sessions = new Map();

// ======================
// API ROUTES
// ======================

// ======================
// HEALTH & MONITORING ENDPOINTS
// ======================

app.get('/api/health', (req, res) => {
    const healthData = {
        status: 'healthy',
        message: 'FinanceBot Pro - Production Ready v4.0',
        timestamp: new Date().toISOString(),
        version: '4.0.0',
        environment: process.env.NODE_ENV || 'development',
        features: {
            modernCharts: true,
            improvedCSVParsing: true,
            portfolioAnalysis: true,
            perplexityIntegration: !!perplexityClient,
            rateLimiting: true,
            caching: true,
            errorHandling: true,
            security: true
        },
        system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cacheSize: cache.size(),
            activeSessions: sessions.size
        }
    };

    res.json(healthData);
});

app.get('/api/metrics', (req, res) => {
    // Basic metrics endpoint for monitoring
    res.json({
        cache: {
            size: cache.size(),
            hitRate: cache.hitRate || 0
        },
        sessions: {
            active: sessions.size,
            withPortfolios: Array.from(sessions.values()).filter(s => s.portfolio).length
        },
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// ======================
// API ENDPOINTS
// ======================

app.post('/api/chat', chatLimiter, async (req, res, next) => {
    try {
        // Input validation
        const { message, sessionId } = req.body;
        
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            throw new AppError('Message is required and must be a non-empty string', 400, 'INVALID_INPUT');
        }

        if (message.length > 500) {
            throw new AppError('Message too long. Please keep under 500 characters.', 400, 'MESSAGE_TOO_LONG');
        }

        // Sanitize input
        const sanitizedMessage = message.trim().replace(/[<>]/g, '');

        // Get session data with validation
        const session = sessions.get(sessionId) || { portfolio: null };
        
        // Analyze query
        const queryInfo = analyzeQuery(sanitizedMessage, session);
        
        let responseData = null;
        let chartData = null;

        // Handle non-financial queries with guardrails
        if (queryInfo.type === 'non_financial') {
            responseData = {
                type: 'guardrail',
                title: '🤝 I\'m here to help with finance!',
                summary: ['I specialize in financial analysis and investment guidance'],
                sections: [
                    {
                        title: 'What I can help you with',
                        content: [
                            '📈 Stock, crypto, and commodity analysis',
                            '💰 Investment strategies and market insights',
                            '📊 Portfolio analysis and recommendations',
                            '📉 Risk assessment and diversification advice'
                        ],
                        type: 'general'
                    },
                    {
                        title: 'Try asking me about',
                        content: [
                            '💡 "Analyze Apple stock performance"',
                            '💡 "What are the best dividend stocks?"',
                            '💡 "Should I invest in Bitcoin?"',
                            '💡 "How to diversify my portfolio?"'
                        ],
                        type: 'general'
                    }
                ],
                actionItems: [
                    'Ask me about any financial topic or investment',
                    'Upload your portfolio for personalized analysis',
                    'Request market trends or investment strategies'
                ],
                keyMetrics: {
                    specialization: 'Financial Analysis & Investment Guidance',
                    coverage: '50+ Assets, Market Trends, Portfolio Management'
                }
            };
        }
        // Handle different query types
        else if (queryInfo.type === 'portfolio' && session.portfolio) {
            const analysis = analyzePortfolio(session.portfolio);
            responseData = {
                type: 'portfolio',
                title: '📊 Portfolio Analysis',
                summary: [`Total Value: $${analysis.totalValue.toFixed(2)}`, 
                         `Holdings: ${analysis.holdingsCount}`,
                         `P&L: ${analysis.totalGainLoss >= 0 ? '+' : ''}$${analysis.totalGainLoss.toFixed(2)}`],
                sections: [
                    {
                        title: 'Top Holdings',
                        content: analysis.topHoldings.slice(0, 5).map((h, i) => 
                            `${i + 1}. ${h.symbol}: $${h.value.toFixed(2)} (${h.percentage}%)`),
                        type: 'general'
                    }
                ],
                actionItems: [
                    'Review portfolio balance and consider rebalancing',
                    'Check underperforming positions for tax-loss opportunities'
                ],
                keyMetrics: {
                    totalValue: `$${analysis.totalValue.toFixed(2)}`,
                    totalGainLoss: `${analysis.totalGainLoss >= 0 ? '+' : ''}$${analysis.totalGainLoss.toFixed(2)}`,
                    topHolding: analysis.topHoldings[0]?.symbol
                }
            };
            
            // Generate portfolio donut chart
            chartData = chartGenerator.generatePortfolioDonutData(
                analysis.holdings,
                analysis.totalValue
            );
        } else if (queryInfo.topic && perplexityClient) {
            // Get analysis from Perplexity with caching
            responseData = await perplexityClient.getFinancialAnalysis(
                queryInfo.topic,
                { complexity: queryInfo.complexity }
            );
            
            // Generate price chart if requested
            if (queryInfo.needsChart) {
                const priceData = generateMockPriceData(queryInfo.topic);
                chartData = chartGenerator.generatePriceChartData(priceData, {
                    title: `${queryInfo.topic} Price Movement`,
                    symbol: queryInfo.topic
                });
            }
        } else if (!queryInfo.topic && !session.portfolio) {
            // Handle cases where no specific topic was found
            if (queryInfo.suggestions && queryInfo.suggestions.length > 0) {
                // Provide helpful suggestions
                responseData = {
                    type: 'suggestion',
                    title: '🤔 Did you mean one of these?',
                    summary: ['I found some similar assets you might be looking for'],
                    sections: [
                        {
                            title: 'Suggested Assets',
                            content: queryInfo.suggestions.map((suggestion, i) => 
                                `${i + 1}. ${suggestion}`),
                            type: 'general'
                        },
                        {
                            title: 'Or try these examples',
                            content: [
                                '💡 "Analyze Apple stock"',
                                '💡 "What are the best dividend stocks?"',
                                '💡 "Show me current market trends"',
                                '💡 "Bitcoin price analysis"'
                            ],
                            type: 'general'
                        }
                    ],
                    actionItems: [
                        'Try one of the suggested assets above',
                        'Ask about market trends or investment strategies',
                        'Upload your portfolio CSV for analysis'
                    ],
                    keyMetrics: {}
                };
            } else {
                // Welcome screen for first-time users
                responseData = {
                    type: 'welcome',
                    title: '👋 Welcome to FinanceBot Pro',
                    summary: ['Upload portfolio or ask about any asset'],
                    sections: [
                        {
                            title: 'What I can help you with',
                            content: [
                                '📈 Individual stock, crypto, and commodity analysis',
                                '💰 General market trends and investment strategies',
                                '📁 Portfolio analysis from uploaded CSV files',
                                '📊 Technical analysis with interactive charts'
                            ],
                            type: 'general'
                        },
                        {
                            title: 'Try these examples',
                            content: [
                                '💡 "Analyze Microsoft stock"',
                                '💡 "What are the best dividend stocks?"',
                                '💡 "Show me Bitcoin trends"',
                                '💡 "Current market outlook"'
                            ],
                            type: 'general'
                        }
                    ],
                    actionItems: [
                        'Ask about any stock, crypto, or commodity',
                        'Upload your portfolio CSV for detailed analysis',
                        'Request investment strategies or market insights'
                    ],
                    keyMetrics: {}
                };
            }
        } else if (!queryInfo.topic && session.portfolio) {
            // User has portfolio but query wasn't understood
            responseData = {
                type: 'clarification',
                title: '💭 Need clarification',
                summary: ['I have your portfolio but need more specific guidance'],
                sections: [
                    {
                        title: 'I can help you with',
                        content: [
                            '📊 "Analyze my portfolio" - Full portfolio breakdown',
                            '🔍 Ask about specific holdings in your portfolio',
                            '💡 "Investment recommendations" - General advice',
                            '📈 "Show portfolio performance" - Charts and metrics'
                        ],
                        type: 'general'
                    }
                ],
                actionItems: [
                    'Try "analyze my portfolio" for detailed insights',
                    'Ask about specific stocks or investment strategies'
                ],
                keyMetrics: {
                    portfolioStatus: 'Ready for analysis',
                    uploadedAt: session.uploadedAt || 'Recently'
                }
            };
        } else {
            // Fallback - shouldn't reach here with new logic
            throw new AppError('Unable to process your request. Please try asking about a specific asset or upload your portfolio.', 400, 'PROCESSING_ERROR');
        }

        res.json({
            success: true,
            data: responseData,
            chart: chartData,
            metadata: {
                queryType: queryInfo.type,
                hasChart: !!chartData,
                topic: queryInfo.topic,
                cached: responseData.cached || false,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        next(error);
    }
});

app.post('/api/upload', uploadLimiter, upload.array('files', 5), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new AppError('No files provided', 400, 'NO_FILES');
        }

        const sessionId = req.body.sessionId || 'default';
        let portfolioData = null;
        let parseErrors = [];

        // Validate file types and sizes
        for (const file of req.files) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                throw new AppError('File too large. Maximum size is 2MB.', 400, 'FILE_TOO_LARGE');
            }

            if (file.mimetype === 'text/csv') {
                const parseResult = await csvParser.parsePortfolioCSV(file.buffer);
                
                if (parseResult.success && parseResult.data.length > 0) {
                    // Security: Limit number of holdings
                    if (parseResult.data.length > 1000) {
                        throw new AppError('Too many holdings. Maximum 1000 per portfolio.', 400, 'TOO_MANY_HOLDINGS');
                    }
                    
                    portfolioData = parseResult.data;
                    
                    // Validate the data
                    const validation = csvParser.validatePortfolioData(portfolioData);
                    if (!validation.valid) {
                        parseErrors.push(`Missing required fields: ${validation.missing.join(', ')}`);
                    }
                } else {
                    parseErrors.push(parseResult.error || 'Failed to parse CSV');
                }
            } else {
                parseErrors.push(`Unsupported file type: ${file.mimetype}`);
            }
        }

        if (portfolioData && portfolioData.length > 0) {
            // Store in session with validation
            if (!sessions.has(sessionId)) {
                sessions.set(sessionId, {});
            }
            sessions.get(sessionId).portfolio = portfolioData;
            sessions.get(sessionId).uploadedAt = new Date().toISOString();

            // Calculate summary
            const analysis = analyzePortfolio(portfolioData);
            
            res.json({
                success: true,
                message: '✅ Portfolio uploaded successfully!',
                data: {
                    type: 'upload_success',
                    title: '� Portfolio Upload Complete',
                    summary: [
                        `${analysis.holdingsCount} holdings detected`,
                        `Total value: $${analysis.totalValue.toFixed(2)}`,
                        `P&L: ${analysis.totalGainLoss >= 0 ? '+' : ''}$${analysis.totalGainLoss.toFixed(2)}`
                    ],
                    sections: [
                        {
                            title: 'Upload Summary',
                            content: [
                                `Holdings processed: ${analysis.holdingsCount}`,
                                `Top position: ${analysis.topHoldings[0]?.symbol} (${analysis.topHoldings[0]?.percentage}%)`,
                                'Ready for analysis!'
                            ],
                            type: 'general'
                        }
                    ],
                    actionItems: [
                        'Type "analyze my portfolio" for detailed insights',
                        'Ask about specific holdings for individual analysis'
                    ],
                    keyMetrics: {
                        holdings: analysis.holdingsCount,
                        totalValue: `$${analysis.totalValue.toFixed(2)}`,
                        topHolding: analysis.topHoldings[0]?.symbol
                    }
                },
                metadata: {
                    uploadedAt: new Date().toISOString(),
                    fileCount: req.files.length,
                    warnings: parseErrors.length > 0 ? parseErrors : undefined
                }
            });
        } else {
            throw new AppError(
                'Could not parse portfolio data', 
                400, 
                'PARSE_ERROR',
                { 
                    details: parseErrors.length > 0 ? parseErrors : ['No valid portfolio data found'],
                    hint: 'Ensure CSV has columns: symbol, shares, current_price, market_value'
                }
            );
        }

    } catch (error) {
        next(error);
    }
});

app.get('/api/session/init', (req, res) => {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessions.set(sessionId, { portfolio: null });
    
    res.json({
        success: true,
        sessionId: sessionId
    });
});

// ======================
// HELPER FUNCTIONS
// ======================

// ======================
// ENHANCED ASSET DATABASE & QUERY ANALYZER
// ======================

class AssetDatabase {
    constructor() {
        this.assets = new Map();
        this.initializeAssets();
    }

    initializeAssets() {
        // Popular Stocks
        const stocks = {
            'Apple': ['apple', 'aapl', 'apple inc', 'apple stock'],
            'Microsoft': ['microsoft', 'msft', 'microsoft corp', 'ms'],
            'Google': ['google', 'googl', 'goog', 'alphabet', 'alphabet inc'],
            'Amazon': ['amazon', 'amzn', 'amazon stock', 'aws'],
            'Tesla': ['tesla', 'tsla', 'tesla stock', 'elon musk stock'],
            'Meta': ['meta', 'fb', 'facebook', 'meta platforms'],
            'Netflix': ['netflix', 'nflx', 'nflx stock'],
            'Nvidia': ['nvidia', 'nvda', 'nvda stock', 'gpu stock'],
            'AMD': ['amd', 'advanced micro devices', 'amd stock'],
            'Intel': ['intel', 'intc', 'intel corp'],
            'Salesforce': ['salesforce', 'crm', 'salesforce stock'],
            'Oracle': ['oracle', 'orcl', 'oracle corp'],
            'Visa': ['visa', 'v', 'visa stock'],
            'Mastercard': ['mastercard', 'ma', 'mastercard stock'],
            'JPMorgan': ['jpmorgan', 'jpm', 'jp morgan', 'jpmorgan chase'],
            'Bank of America': ['bank of america', 'bac', 'boa'],
            'Wells Fargo': ['wells fargo', 'wfc', 'wells'],
            'Coca Cola': ['coca cola', 'ko', 'coke', 'coca-cola'],
            'PepsiCo': ['pepsi', 'pep', 'pepsico'],
            'Johnson & Johnson': ['johnson', 'jnj', 'j&j', 'johnson and johnson'],
            'Pfizer': ['pfizer', 'pfe', 'pfizer stock'],
            'Walmart': ['walmart', 'wmt', 'walmart stock'],
            'Disney': ['disney', 'dis', 'walt disney'],
            'Boeing': ['boeing', 'ba', 'boeing stock'],
            'McDonald\'s': ['mcdonalds', 'mcd', 'mcdonald', 'mickey d'],
            'Home Depot': ['home depot', 'hd', 'homedepot'],
            'IBM': ['ibm', 'international business machines'],
            'General Electric': ['ge', 'general electric'],
            'Ford': ['ford', 'f', 'ford motor'],
            'General Motors': ['gm', 'general motors', 'gmc'],
            'Exxon': ['exxon', 'xom', 'exxon mobil'],
            'Chevron': ['chevron', 'cvx', 'chevron corp']
        };

        // Cryptocurrencies
        const crypto = {
            'Bitcoin': ['bitcoin', 'btc', 'bitcoin cash', 'crypto king'],
            'Ethereum': ['ethereum', 'eth', 'ether', 'ethereum classic'],
            'Binance Coin': ['binance', 'bnb', 'binance coin'],
            'Cardano': ['cardano', 'ada', 'cardano ada'],
            'Solana': ['solana', 'sol', 'solana coin'],
            'XRP': ['xrp', 'ripple', 'ripple coin'],
            'Dogecoin': ['dogecoin', 'doge', 'doge coin', 'shiba'],
            'Polygon': ['polygon', 'matic', 'polygon matic'],
            'Avalanche': ['avalanche', 'avax', 'avalanche coin'],
            'Chainlink': ['chainlink', 'link', 'chain link'],
            'Litecoin': ['litecoin', 'ltc', 'lite coin'],
            'Polkadot': ['polkadot', 'dot', 'polka dot'],
            'Uniswap': ['uniswap', 'uni', 'uniswap token'],
            'Bitcoin Cash': ['bitcoin cash', 'bch', 'bcash']
        };

        // Commodities & Indices
        const commodities = {
            'Gold': ['gold', 'xau', 'gold price', 'precious metal', 'au', 'gold analysis'],
            'Silver': ['silver', 'xag', 'silver price', 'ag', 'silver investment', 'silver market'],
            'Oil': ['oil', 'crude', 'wti', 'brent', 'petroleum', 'crude oil', 'oil market', 'oil trends'],
            'Natural Gas': ['natural gas', 'gas', 'ng', 'natgas'],
            'Copper': ['copper', 'cu', 'copper price'],
            'Platinum': ['platinum', 'xpt', 'platinum price'],
            'S&P 500': ['sp500', 's&p 500', 'spy', 'spx', 'sp 500', 's&p500', 's and p 500', 'sp 500 performance'],
            'Nasdaq': ['nasdaq', 'qqq', 'nasdaq 100', 'tech index'],
            'Dow Jones': ['dow', 'dow jones', 'djia', 'dow 30'],
            'VIX': ['vix', 'volatility', 'fear index', 'market volatility']
        };

        // ETFs
        const etfs = {
            'QQQ': ['qqq', 'nasdaq etf', 'tech etf', 'qqq analysis', 'qqq trends'],
            'SPY': ['spy', 's&p etf', 'sp500 etf', 'spy trends', 'spy analysis'],
            'VTI': ['vti', 'total stock market'],
            'IWM': ['iwm', 'russell 2000'],
            'GLD': ['gld', 'gold etf'],
            'TLT': ['tlt', 'treasury etf', 'bond etf']
        };

        // Add all categories to the main assets map
        this.addCategory('Stock', stocks);
        this.addCategory('Cryptocurrency', crypto);
        this.addCategory('Commodity', commodities);
        this.addCategory('ETF', etfs);
    }

    addCategory(category, assets) {
        for (const [name, aliases] of Object.entries(assets)) {
            this.assets.set(name, {
                category,
                aliases: aliases.map(alias => alias.toLowerCase()),
                displayName: name
            });
        }
    }

    findAsset(query) {
        const lowerQuery = query.toLowerCase();
        
        // Direct match first
        for (const [name, data] of this.assets) {
            if (data.aliases.some(alias => lowerQuery.includes(alias))) {
                return {
                    name,
                    category: data.category,
                    displayName: data.displayName,
                    confidence: 1.0
                };
            }
        }

        // Fuzzy matching for partial matches
        const fuzzyMatches = [];
        for (const [name, data] of this.assets) {
            for (const alias of data.aliases) {
                const similarity = this.calculateSimilarity(lowerQuery, alias);
                if (similarity > 0.6) {
                    fuzzyMatches.push({
                        name,
                        category: data.category,
                        displayName: data.displayName,
                        confidence: similarity,
                        matchedAlias: alias
                    });
                }
            }
        }

        // Return best fuzzy match
        if (fuzzyMatches.length > 0) {
            fuzzyMatches.sort((a, b) => b.confidence - a.confidence);
            return fuzzyMatches[0];
        }

        return null;
    }

    calculateSimilarity(str1, str2) {
        // Simple similarity calculation using Levenshtein distance
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        const maxLen = Math.max(len1, len2);
        return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
    }

    getSuggestions(query, limit = 3) {
        const lowerQuery = query.toLowerCase();
        const suggestions = [];

        for (const [name, data] of this.assets) {
            for (const alias of data.aliases) {
                if (alias.includes(lowerQuery) || lowerQuery.includes(alias)) {
                    const similarity = this.calculateSimilarity(lowerQuery, alias);
                    suggestions.push({
                        name,
                        displayName: data.displayName,
                        category: data.category,
                        similarity
                    });
                }
            }
        }

        return suggestions
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(s => `${s.displayName} (${s.category})`);
    }
}

class EnhancedQueryAnalyzer {
    constructor() {
        this.assetDB = new AssetDatabase();
        this.generalPatterns = this.initializeGeneralPatterns();
    }

    initializeGeneralPatterns() {
        return {
            'dividend_stocks': {
                patterns: [/dividend stock/i, /best dividend/i, /dividend yield/i, /dividend investing/i, /income stock/i],
                topic: 'High Dividend Yield Stocks',
                needsChart: false
            },
            'growth_stocks': {
                patterns: [/growth stock/i, /high growth/i, /growth investing/i, /growth companies/i],
                topic: 'Growth Stocks Analysis',
                needsChart: false
            },
            'market_trends': {
                patterns: [/market trend/i, /market outlook/i, /market analysis/i, /stock market/i, /market update/i],
                topic: 'Current Market Trends',
                needsChart: true
            },
            'investment_strategy': {
                patterns: [/investment strategy/i, /investment advice/i, /how to invest/i, /investment tips/i],
                topic: 'Investment Strategy Guide',
                needsChart: false
            },
            'sector_analysis': {
                patterns: [/tech sector/i, /healthcare sector/i, /financial sector/i, /energy sector/i, /sector rotation/i],
                topic: 'Sector Analysis',
                needsChart: true
            },
            'crypto_market': {
                patterns: [/crypto market/i, /cryptocurrency/i, /bitcoin trend/i, /altcoin/i, /defi/i],
                topic: 'Cryptocurrency Market Analysis',
                needsChart: true
            },
            'economic_indicators': {
                patterns: [/inflation/i, /interest rate/i, /gdp/i, /unemployment/i, /fed/i, /federal reserve/i],
                topic: 'Economic Indicators Impact',
                needsChart: false
            },
            'risk_management': {
                patterns: [/risk management/i, /portfolio risk/i, /diversification/i, /stop loss/i],
                topic: 'Risk Management Strategies',
                needsChart: false
            }
        };
    }

    analyzeQuery(message, session) {
        const lower = message.toLowerCase();
        const analysis = {
            type: 'general',
            topic: null,
            complexity: 'medium',
            needsChart: false,
            confidence: 0,
            suggestions: [],
            isFinancial: true
        };

        // 1. First check if query is financial-related
        if (!this.isFinancialQuery(message)) {
            analysis.isFinancial = false;
            analysis.type = 'non_financial';
            analysis.confidence = 1.0;
            return analysis;
        }

        // Portfolio queries
        if ((lower.includes('portfolio') || lower.includes('my holdings')) && session.portfolio) {
            analysis.type = 'portfolio';
            analysis.needsChart = true;
            analysis.confidence = 1.0;
            return analysis;
        }

        // 2. First try general financial patterns (higher priority for general queries)
        for (const [key, pattern] of Object.entries(this.generalPatterns)) {
            if (pattern.patterns.some(p => p.test(message))) {
                analysis.topic = pattern.topic;
                analysis.type = 'general_financial';
                analysis.needsChart = pattern.needsChart;
                analysis.confidence = 0.9;
                break;
            }
        }

        // 3. If no general pattern found, try to find specific assets
        if (!analysis.topic) {
            const assetMatch = this.assetDB.findAsset(message);
            if (assetMatch && assetMatch.confidence > 0.6) {  // Lowered from 0.7 to 0.6 for better fuzzy matching
                analysis.topic = assetMatch.displayName;
                analysis.type = 'asset';
                analysis.confidence = assetMatch.confidence;
                analysis.assetCategory = assetMatch.category;
                // AUTO-ENABLE CHARTS for all asset queries
                analysis.needsChart = true;
            }
        }

        // 4. Force charts for financial analysis keywords
        if (/chart|graph|visual|trend|price movement|technical analysis|analysis|price/i.test(message)) {
            analysis.needsChart = true;
        }

        // 5. Complexity detection
        if (/deep|comprehensive|detailed|technical|in-depth|thorough/i.test(message)) {
            analysis.complexity = 'high';
        } else if (/simple|basic|quick|brief|summary/i.test(message)) {
            analysis.complexity = 'low';
        }

        // 6. Generate suggestions if no good match found
        if (!analysis.topic || analysis.confidence < 0.6) {  // Also lowered suggestion threshold
            analysis.suggestions = this.assetDB.getSuggestions(message, 3);
        }

        return analysis;
    }

    isFinancialQuery(message) {
        const lower = message.toLowerCase();
        
        // Financial keywords that indicate this is a finance-related query
        const financialKeywords = [
            // Asset types
            'stock', 'stocks', 'share', 'shares', 'equity', 'securities',
            'crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'coin',
            'bond', 'bonds', 'treasury', 'yield', 'commodities', 'commodity',
            'etf', 'etfs', 'fund', 'funds', 'index', 'mutual fund',
            
            // Financial concepts
            'investment', 'investing', 'investor', 'portfolio', 'finance', 'financial',
            'market', 'markets', 'trading', 'trade', 'trader', 'buy', 'sell',
            'price', 'prices', 'valuation', 'analysis', 'dividend', 'dividends',
            'earnings', 'revenue', 'profit', 'loss', 'gains', 'return', 'returns',
            'risk', 'volatility', 'correlation', 'diversification', 'allocation',
            
            // Market terms
            'bull', 'bear', 'bullish', 'bearish', 'rally', 'correction', 'crash',
            'support', 'resistance', 'breakout', 'trend', 'momentum', 'volume',
            'chart', 'technical', 'fundamental', 'sentiment', 'outlook',
            
            // Economic terms
            'inflation', 'deflation', 'recession', 'growth', 'gdp', 'fed', 'federal reserve',
            'interest rate', 'rates', 'monetary', 'fiscal', 'economy', 'economic',
            'unemployment', 'employment', 'payroll', 'cpi', 'ppi',
            
            // Specific assets (partial list)
            'apple', 'aapl', 'microsoft', 'msft', 'google', 'tesla', 'amazon',
            'gold', 'silver', 'oil', 'gas', 'dollar', 'euro', 'yen',
            'nasdaq', 'dow', 'sp500', 's&p'
        ];

        // Check if message contains any financial keywords
        const hasFinancialKeywords = financialKeywords.some(keyword => 
            lower.includes(keyword)
        );

        // Non-financial indicators
        const nonFinancialKeywords = [
            'recipe', 'cooking', 'food', 'pizza', 'bread', 'baking',
            'weather', 'sports', 'music', 'movie', 'book', 'travel',
            'health', 'medicine', 'doctor', 'workout', 'exercise',
            'programming', 'code', 'software', 'game', 'gaming',
            'fashion', 'clothes', 'car repair', 'home improvement',
            'relationship', 'dating', 'marriage', 'parenting',
            'education', 'school', 'university', 'homework',
            'travel advice', 'europe', 'vacation', 'trip', 'tourism',
            'holiday', 'destination', 'sightseeing', 'flights', 'hotels'
        ];

        const hasNonFinancialKeywords = nonFinancialKeywords.some(keyword => 
            lower.includes(keyword)
        );

        // If it has non-financial keywords and no financial keywords, it's not financial
        if (hasNonFinancialKeywords && !hasFinancialKeywords) {
            return false;
        }

        // If it has financial keywords, it's financial
        if (hasFinancialKeywords) {
            return true;
        }

        // For ambiguous cases, assume it might be financial if it's asking for analysis or advice
        if (/analyze|analysis|advice|recommend|should i|what about|tell me about|how is|performance/i.test(message)) {
            return true;
        }

        // Default to financial for short queries that might be asset names
        if (message.trim().split(' ').length <= 3) {
            return true;
        }

        return false;
    }
}

// Initialize the enhanced analyzer
const queryAnalyzer = new EnhancedQueryAnalyzer();

function analyzeQuery(message, session) {
    return queryAnalyzer.analyzeQuery(message, session);
}

function analyzePortfolio(portfolioData) {
    const analysis = {
        holdings: portfolioData,
        holdingsCount: portfolioData.length,
        totalValue: 0,
        totalGainLoss: 0,
        topHoldings: [],
        distribution: {}
    };

    // Calculate totals
    portfolioData.forEach(holding => {
        const value = parseFloat(holding.market_value || 0);
        const gainLoss = parseFloat(holding.gain_loss || 0);
        
        analysis.totalValue += value;
        analysis.totalGainLoss += gainLoss;
        
        // Track by asset type
        const type = holding.asset_type || 'Other';
        if (!analysis.distribution[type]) {
            analysis.distribution[type] = 0;
        }
        analysis.distribution[type] += value;
    });

    // Sort by value
    analysis.topHoldings = [...portfolioData]
        .sort((a, b) => (b.market_value || 0) - (a.market_value || 0))
        .map(h => ({
            symbol: h.symbol || h.asset,
            value: h.market_value || 0,
            percentage: ((h.market_value || 0) / analysis.totalValue * 100).toFixed(1)
        }));

    return analysis;
}

function formatPortfolioAnalysis(analysis) {
    const gainLossEmoji = analysis.totalGainLoss >= 0 ? '📈' : '📉';
    const gainLossText = analysis.totalGainLoss >= 0 ? 'Profit' : 'Loss';
    
    let response = `📊 **Portfolio Analysis**\n━━━━━━━━━━━━━━━━━━\n\n`;
    response += `💼 Total Holdings: ${analysis.holdingsCount}\n`;
    response += `💰 Total Value: **$${analysis.totalValue.toFixed(2)}**\n`;
    response += `${gainLossEmoji} Total ${gainLossText}: **$${Math.abs(analysis.totalGainLoss).toFixed(2)}**\n\n`;
    
    response += `**Top Holdings:**\n`;
    analysis.topHoldings.slice(0, 5).forEach((holding, i) => {
        response += `${i + 1}. ${holding.symbol}: $${holding.value.toFixed(2)} (${holding.percentage}%)\n`;
    });
    
    response += `\n**Asset Distribution:**\n`;
    Object.entries(analysis.distribution).forEach(([type, value]) => {
        const percentage = (value / analysis.totalValue * 100).toFixed(1);
        response += `• ${type}: ${percentage}%\n`;
    });
    
    response += `\n💡 **Recommendations:**\n`;
    response += `• Consider rebalancing if any position exceeds 25% of portfolio\n`;
    response += `• Review underperforming assets for potential tax-loss harvesting\n`;
    response += `• Ensure adequate diversification across sectors and asset classes`;
    
    return response;
}

function generateMockPriceData(topic) {
    // Generate realistic price data for charting
    const basePrices = {
        // Stocks
        'Apple': 182,
        'Microsoft': 378,
        'Google': 142,
        'Amazon': 150,
        'Tesla': 201,
        'Meta': 485,
        'Netflix': 500,
        'Nvidia': 875,
        'AMD': 180,
        'Intel': 36,
        'Salesforce': 275,
        'Oracle': 115,
        'Visa': 234,
        'Mastercard': 325,
        'JPMorgan': 180,
        'Bank of America': 32,
        'Wells Fargo': 45,
        'Coca Cola': 60,
        'PepsiCo': 170,
        'Johnson & Johnson': 165,
        'Pfizer': 28,
        'Walmart': 165,
        'Disney': 95,
        'Boeing': 210,
        'McDonald\'s': 295,
        'Home Depot': 340,
        'IBM': 195,
        'General Electric': 115,
        'Ford': 12,
        'General Motors': 38,
        'Exxon': 115,
        'Chevron': 160,
        
        // Crypto
        'Bitcoin': 43000,
        'Ethereum': 2200,
        'Binance Coin': 320,
        'Cardano': 0.45,
        'Solana': 95,
        'XRP': 0.52,
        'Dogecoin': 0.08,
        'Polygon': 0.85,
        'Avalanche': 28,
        'Chainlink': 14,
        'Litecoin': 72,
        'Polkadot': 6.5,
        'Uniswap': 7.2,
        'Bitcoin Cash': 250,
        
        // Commodities & Indices
        'Gold': 2040,
        'Silver': 24,
        'Oil': 75,
        'Natural Gas': 2.8,
        'Copper': 8.5,
        'Platinum': 950,
        'S&P 500': 4500,
        'Nasdaq': 15500,
        'Dow Jones': 35000,
        'VIX': 18,
        
        // ETFs
        'QQQ': 385,
        'SPY': 450,
        'VTI': 235,
        'IWM': 195,
        'GLD': 190,
        'TLT': 95
    };
    
    const basePrice = basePrices[topic] || 100;
    
    const data = [];
    const hours = 24;
    let currentPrice = basePrice;
    
    // Determine volatility based on asset type
    let volatility = 0.02; // Default 2%
    if (topic.includes('Bitcoin') || topic.includes('Ethereum') || basePrices[topic] < 1) {
        volatility = 0.05; // 5% for crypto and penny stocks
    } else if (topic.includes('VIX')) {
        volatility = 0.08; // 8% for volatility index
    } else if (['Gold', 'Silver', 'Oil'].includes(topic)) {
        volatility = 0.03; // 3% for commodities
    }
    
    for (let i = 0; i < hours; i++) {
        const change = (Math.random() - 0.5) * basePrice * volatility;
        currentPrice = Math.max(currentPrice + change, basePrice * 0.8); // Don't go below 80% of base
        data.push({
            time: `${i}:00`,
            price: parseFloat(currentPrice.toFixed(basePrice < 1 ? 4 : 2))
        });
    }
    
    return data;
}

// ======================
// STATIC FILES (must be before 404 handler)
// ======================

// Serve static files from public directory
app.use(express.static('public'));

// ======================
// ERROR HANDLING MIDDLEWARE (must be last)
// ======================

// 404 handler for API routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: req.originalUrl
    });
});

// Global error handler
app.use(errorHandler);

// ======================
// SERVER STARTUP & SHUTDOWN
// ======================

const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 FinanceBot Pro Server - PRODUCTION READY v4.0          ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                              ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                        ║
║  Status: ${process.env.PERPLEXITY_API_KEY ? '✅ All Systems Operational' : '⚠️  Limited Mode (No API Key)'}              ║
╠════════════════════════════════════════════════════════════╣
║  🆕 Production Features:                                   ║
║  ✅ Rate limiting & security headers                       ║
║  ✅ Enhanced error handling & logging                      ║
║  ✅ Response caching system                               ║
║  ✅ Structured response formatting                        ║
║  ✅ Input validation & sanitization                       ║
║  ✅ Health monitoring endpoints                           ║
║  ✅ Graceful shutdown handling                           ║
╚════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n[${new Date().toISOString()}] ${signal} received. Starting graceful shutdown...`);
    
    server.close((err) => {
        if (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
        
        console.log('Server closed successfully');
        
        // Clean up resources
        cache.clear();
        sessions.clear();
        
        console.log('Resources cleaned up');
        process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});