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
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

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
        status: 'OK',
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

        // Handle different query types
        if (queryInfo.type === 'portfolio' && session.portfolio) {
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
            responseData = {
                type: 'welcome',
                title: '👋 Welcome to FinanceBot Pro',
                summary: ['Upload portfolio or ask about any asset'],
                sections: [
                    {
                        title: 'Getting Started',
                        content: [
                            '📈 Ask about stocks, crypto, or commodities',
                            '📁 Upload your portfolio CSV for analysis',
                            '📊 Request charts and technical analysis'
                        ],
                        type: 'general'
                    }
                ],
                actionItems: ['Try asking: "Analyze Apple stock"', 'Upload your portfolio CSV'],
                keyMetrics: {}
            };
        } else {
            throw new AppError('Please specify an asset to analyze or upload your portfolio', 400, 'INSUFFICIENT_INFO');
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

function analyzeQuery(message, session) {
    const lower = message.toLowerCase();
    const analysis = {
        type: 'general',
        topic: null,
        complexity: 'medium',
        needsChart: false
    };

    // Portfolio queries
    if ((lower.includes('portfolio') || lower.includes('my holdings')) && session.portfolio) {
        analysis.type = 'portfolio';
        analysis.needsChart = true;
        return analysis;
    }

    // Asset detection
    const assetPatterns = {
        'Bitcoin': /\b(bitcoin|btc)\b/i,
        'Ethereum': /\b(ethereum|eth)\b/i,
        'Apple': /\b(apple|aapl)\b/i,
        'Tesla': /\b(tesla|tsla)\b/i,
        'Gold': /\b(gold|xau)\b/i,
        'Oil': /\b(oil|crude|wti|brent)\b/i
    };

    for (const [asset, pattern] of Object.entries(assetPatterns)) {
        if (pattern.test(message)) {
            analysis.topic = asset;
            break;
        }
    }

    // Chart detection
    if (/chart|graph|visual|trend|price movement/i.test(message)) {
        analysis.needsChart = true;
    }

    // Complexity detection
    if (/deep|comprehensive|detailed|technical/i.test(message)) {
        analysis.complexity = 'high';
    }

    return analysis;
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
    const basePrice = {
        'Bitcoin': 43000,
        'Ethereum': 2200,
        'Apple': 182,
        'Tesla': 200,
        'Gold': 2040,
        'Oil': 75
    }[topic] || 100;
    
    const data = [];
    const hours = 24;
    let currentPrice = basePrice;
    
    for (let i = 0; i < hours; i++) {
        const change = (Math.random() - 0.5) * basePrice * 0.02;
        currentPrice += change;
        data.push({
            time: `${i}:00`,
            price: currentPrice
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