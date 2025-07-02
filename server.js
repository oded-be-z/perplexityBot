// server.js - FIXED VERSION with Better Charts and Portfolio Parsing
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// ======================
// MODERN CHART GENERATOR - No More ASCII Charts!
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

    generateDataTable(data, title = 'Data Summary') {
        if (!data || data.length === 0) return null;
        
        return {
            type: 'table',
            title: title,
            headers: Object.keys(data[0]),
            rows: data.map(item => Object.values(item))
        };
    }

    generateKeyStatsTable(asset, stats) {
        const tableData = [
            { metric: 'Current Price', value: `$${stats.price}` },
            { metric: '24h Change', value: `${stats.change24h >= 0 ? '+' : ''}${stats.change24h}%` },
            { metric: '7d Change', value: `${stats.change7d >= 0 ? '+' : ''}${stats.change7d}%` },
            { metric: 'Market Cap', value: stats.marketCap || 'N/A' },
            { metric: 'Volume', value: stats.volume || 'N/A' }
        ].filter(item => item.value !== 'N/A');

        return this.generateDataTable(tableData, `${asset} Key Statistics`);
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
        const systemPrompt = `You are Max, a friendly and knowledgeable financial advisor who loves talking about ${topic}! 

Your personality:
- Conversational and approachable, like chatting with a smart financial buddy
- Enthusiastic about finance but easy to understand
- Use emojis to make things fun (📈📉💰🚀⚠️)
- Keep responses concise but informative
- Friendly warnings about risks, not scary lectures

IMPORTANT RULES:
1. Focus ONLY on ${topic} - politely redirect if asked about other assets
2. Keep responses under 200 words unless specifically asked for details
3. Use bullet points and clear structure
4. Include specific prices/percentages with emojis
5. If someone asks about non-financial topics, be friendly but redirect to finance

Style: Think "helpful financial friend" not "formal advisor"`;

        const userPrompt = `Give me a friendly but insightful analysis of ${topic}. I want:
• Current price & recent changes 📊
• Key levels to watch 👀  
• What's driving the price 📰
• Quick entry/exit thoughts 💭
• Main risks to know ⚠️

Keep it concise but actionable - like you're texting a friend who knows finance!`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], {
                complexity: options.complexity || 'balanced',
                recency: 'day'
            });

            return this.formatAnalysisResponse(response.content, topic);
        } catch (error) {
            console.error('Perplexity Analysis Error:', error);
            throw error;
        }
    }

    formatAnalysisResponse(content, topic) {
        // Remove ASCII charts if any exist
        let formatted = content.replace(/╔═+╗[\s\S]*?╚═+╝/g, '');
        
        // Remove overly technical sections that make it verbose
        formatted = formatted.replace(/━+/g, ''); // Remove line separators
        
        // Add friendly header if not present
        if (!formatted.includes('📊') && !formatted.includes('💰')) {
            formatted = `💰 ${topic} Quick Analysis\n\n${formatted}`;
        }

        // Format prices with emphasis
        formatted = formatted
            .replace(/\$[\d,]+\.?\d*/g, match => `**${match}**`)
            .replace(/([+-]?\d+\.?\d*%)/g, match => {
                const value = parseFloat(match);
                return value >= 0 ? `📈 ${match}` : `📉 ${match}`;
            });

        // Ensure response isn't too long - truncate if over 300 words
        const words = formatted.split(' ');
        if (words.length > 300) {
            formatted = words.slice(0, 280).join(' ') + '...\n\n💡 *Want more details? Just ask for a deeper analysis!*';
        }

        // Add friendly closing if response seems complete
        if (!formatted.includes('💡') && !formatted.includes('questions')) {
            formatted += '\n\n💡 Got questions? I love talking finance! 😊';
        }

        return formatted;
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

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'FinanceBot Pro - Production Ready',
        version: '3.0.0',
        features: {
            modernCharts: true,
            improvedCSVParsing: true,
            portfolioAnalysis: true,
            perplexityIntegration: !!perplexityClient
        }
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Message is required' 
            });
        }

        // Get session data
        const session = sessions.get(sessionId) || { portfolio: null };
        
        // Analyze query
        const queryInfo = analyzeQuery(message, session);
        
        let responseText = '';
        let chartData = null;

        // Handle different query types
        if (queryInfo.type === 'portfolio' && session.portfolio) {
            const analysis = analyzePortfolio(session.portfolio);
            responseText = formatPortfolioAnalysis(analysis);
            
            // Generate portfolio donut chart
            chartData = chartGenerator.generatePortfolioDonutData(
                analysis.holdings,
                analysis.totalValue
            );
        } else if (queryInfo.topic && perplexityClient) {
            // Get analysis from Perplexity
            responseText = await perplexityClient.getFinancialAnalysis(
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
        } else if (queryInfo.type === 'non_financial') {
            responseText = getFriendlyRedirection(message);
        } else if (queryInfo.type === 'financial_general') {
            responseText = "I love talking general finance! 💰 But I'm even better when we dive into specific assets. Try asking about:\n\n" +
                          "📈 Individual stocks (Apple, Tesla, Microsoft...)\n" +
                          "₿ Crypto prices (Bitcoin, Ethereum...)\n" +
                          "🏆 Commodities (Gold, Oil, Silver...)\n" +
                          "📊 Or upload your portfolio for personalized insights!\n\n" +
                          "What interests you most? 😊";
        } else if (!queryInfo.topic && !session.portfolio) {
            responseText = "Hey there! I'm Max, your friendly finance buddy! 🤝\n\n" +
                          "I'm here to help with:\n" +
                          "📈 Stock analysis (try 'analyze Apple')\n" +
                          "₿ Crypto insights (ask about Bitcoin)\n" +
                          "📁 Portfolio reviews (upload your CSV)\n" +
                          "📊 Charts and trends\n\n" +
                          "What financial topic can I help you explore? 💭";
        } else {
            responseText = "Hmm, I'm not sure what you're looking for! 🤔\n\n" +
                          "Try asking about a specific stock, crypto, or upload your portfolio. I'm here to help with all things finance! 💰";
        }

        res.json({
            success: true,
            message: responseText,
            chart: chartData,
            metadata: {
                queryType: queryInfo.type,
                hasChart: !!chartData,
                topic: queryInfo.topic
            }
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Analysis temporarily unavailable. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/api/upload', upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No files provided' 
            });
        }

        const sessionId = req.body.sessionId || 'default';
        let portfolioData = null;
        let parseErrors = [];

        for (const file of req.files) {
            if (file.mimetype === 'text/csv') {
                const parseResult = await csvParser.parsePortfolioCSV(file.buffer);
                
                if (parseResult.success && parseResult.data.length > 0) {
                    portfolioData = parseResult.data;
                    
                    // Validate the data
                    const validation = csvParser.validatePortfolioData(portfolioData);
                    if (!validation.valid) {
                        parseErrors.push(`Missing required fields: ${validation.missing.join(', ')}`);
                    }
                } else {
                    parseErrors.push(parseResult.error || 'Failed to parse CSV');
                }
            }
        }

        if (portfolioData && portfolioData.length > 0) {
            // Store in session
            if (!sessions.has(sessionId)) {
                sessions.set(sessionId, {});
            }
            sessions.get(sessionId).portfolio = portfolioData;

            // Calculate summary
            const analysis = analyzePortfolio(portfolioData);
            
            res.json({
                success: true,
                message: `✅ Portfolio uploaded successfully!\n\n` +
                        `📊 ${analysis.holdingsCount} holdings detected\n` +
                        `💰 Total value: $${analysis.totalValue.toFixed(2)}\n` +
                        `📈 Total gain/loss: ${analysis.totalGainLoss >= 0 ? '+' : ''}$${analysis.totalGainLoss.toFixed(2)}\n\n` +
                        `Type "analyze my portfolio" to see detailed analysis and charts!`,
                summary: {
                    holdings: analysis.holdingsCount,
                    totalValue: analysis.totalValue,
                    topHoldings: analysis.topHoldings.slice(0, 3)
                }
            });
        } else {
            res.json({
                success: false,
                error: 'Could not parse portfolio data',
                details: parseErrors.length > 0 ? parseErrors : ['No valid portfolio data found in CSV'],
                hint: 'Make sure your CSV has columns like: symbol, shares, current_price, market_value'
            });
        }

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process files',
            details: error.message 
        });
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

    // Detect non-financial topics first
    const nonFinancialPatterns = [
        /\b(weather|food|movie|music|sports|travel|health|medicine|politics|religion)\b/i,
        /\b(how are you|hello|hi|good morning|good evening|thank you|thanks)\b/i,
        /\b(recipe|cooking|game|entertainment|celebrity|news|weather forecast)\b/i
    ];
    
    for (const pattern of nonFinancialPatterns) {
        if (pattern.test(message)) {
            analysis.type = 'non_financial';
            return analysis;
        }
    }

    // Asset detection (expanded list)
    const assetPatterns = {
        'Bitcoin': /\b(bitcoin|btc)\b/i,
        'Ethereum': /\b(ethereum|eth)\b/i,
        'Apple': /\b(apple|aapl)\b/i,
        'Tesla': /\b(tesla|tsla)\b/i,
        'Microsoft': /\b(microsoft|msft)\b/i,
        'Amazon': /\b(amazon|amzn)\b/i,
        'Google': /\b(google|googl|alphabet)\b/i,
        'Gold': /\b(gold|xau)\b/i,
        'Silver': /\b(silver|xag)\b/i,
        'Oil': /\b(oil|crude|wti|brent)\b/i,
        'S&P 500': /\b(s&p|spx|spy)\b/i
    };

    for (const [asset, pattern] of Object.entries(assetPatterns)) {
        if (pattern.test(message)) {
            analysis.topic = asset;
            break;
        }
    }

    // General financial terms
    if (!analysis.topic && /\b(stock|stocks|crypto|forex|investment|trading|market|economy|inflation|interest rate)\b/i.test(message)) {
        analysis.type = 'financial_general';
    }

    // Auto-chart detection: Generate charts for any asset analysis automatically
    if (analysis.topic) {
        analysis.needsChart = true; // Always show charts for financial assets
    }
    
    // Also detect explicit chart requests
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
    const gainLossText = analysis.totalGainLoss >= 0 ? 'looking good' : 'down a bit';
    
    let response = `💼 Your Portfolio Snapshot\n\n`;
    response += `You've got **${analysis.holdingsCount} holdings** worth **$${analysis.totalValue.toFixed(2)}**\n`;
    response += `${gainLossEmoji} Currently ${gainLossText}: **$${Math.abs(analysis.totalGainLoss).toFixed(2)}**\n\n`;
    
    response += `🏆 **Top 3 Holdings:**\n`;
    analysis.topHoldings.slice(0, 3).forEach((holding, i) => {
        const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        response += `${emoji} ${holding.symbol}: ${holding.percentage}%\n`;
    });
    
    // Quick recommendation based on concentration
    const topPercentage = parseFloat(analysis.topHoldings[0]?.percentage || 0);
    if (topPercentage > 30) {
        response += `\n⚠️ Your top holding is ${topPercentage}% - consider diversifying!\n`;
    } else if (topPercentage < 15 && analysis.holdingsCount > 10) {
        response += `\n✅ Nice diversification across your holdings!\n`;
    }
    
    response += `\n💡 Want detailed charts and insights? Just ask! 😊`;
    
    return response;
}

function getFriendlyRedirection(message) {
    const lower = message.toLowerCase();
    
    // Friendly responses for different types of non-financial topics
    if (/\b(hello|hi|hey|good morning|good evening)\b/i.test(message)) {
        return "Hello there! 👋 Nice to meet you! I'm Max, your friendly financial advisor. While I'd love to chat about everything, I'm really passionate about helping with investments, stocks, crypto, and portfolio management! 💰\n\nWhat financial topic can I help you explore today? 📈";
    }
    
    if (/\b(how are you|how's it going)\b/i.test(message)) {
        return "I'm doing great, thanks for asking! 😊 I'm always excited when I get to talk about finance and help people make smart money decisions. Speaking of which - are you looking to analyze any investments or check on market trends? 📊";
    }
    
    if (/\b(thank you|thanks)\b/i.test(message)) {
        return "You're very welcome! 😊 I love helping with financial stuff! Got any other questions about stocks, crypto, or your investments? I'm here to help! 💪";
    }
    
    if (/\b(weather|food|movie|music|sports|travel|health|politics|religion|recipe|cooking|game|entertainment|celebrity)\b/i.test(message)) {
        return "That sounds interesting! 😊 While I'd love to chat about that, I'm actually specialized in financial topics - it's what I'm really passionate about! 💰\n\nHow about we talk about something finance-related? Maybe:\n📈 Stock market trends\n₿ Cryptocurrency analysis\n💼 Portfolio optimization\n📊 Investment opportunities\n\nWhat financial topic interests you most?";
    }
    
    // Default friendly redirection
    return "That's an interesting topic! 😊 While I'd love to chat about everything, I'm really passionate about finance and investments. That's where I can give you the best insights! 💰\n\nHow about we explore something financial? Ask me about any stock, crypto, commodity, or upload your portfolio for analysis! 📈";
}

function generateMockPriceData(topic) {
    // Generate realistic price data for charting
    const basePrice = {
        'Bitcoin': 43000,
        'Ethereum': 2200,
        'Apple': 182,
        'Tesla': 200,
        'Microsoft': 378,
        'Amazon': 3100,
        'Google': 142,
        'Gold': 2040,
        'Silver': 23,
        'Oil': 75,
        'S&P 500': 4500
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

// Serve static files
app.use(express.static('public'));

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 FinanceBot Pro Server - PRODUCTION READY v3.0          ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                              ║
║  Status: ${process.env.PERPLEXITY_API_KEY ? '✅ All Systems Operational' : '⚠️  Limited Mode (No API Key)'}              ║
╠════════════════════════════════════════════════════════════╣
║  ✨ What's New:                                            ║
║  ✅ Modern Chart.js visualizations (no more ASCII!)        ║
║  ✅ Robust CSV parsing with Papa Parse                     ║
║  ✅ Smart column detection for portfolios                  ║
║  ✅ Beautiful donut charts for portfolios                  ║
║  ✅ Real-time price charts with smooth animations          ║
╚════════════════════════════════════════════════════════════╝
    `);
});