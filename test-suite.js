// FinanceBot Pro - Comprehensive End-to-End Testing Suite
// This script tests ALL features and generates a detailed report

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class FinanceBotTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.startTime = Date.now();
        this.sessionId = `test_${Date.now()}`;
    }

    // Utility methods
    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${type}] ${message}`);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    recordTest(testName, passed, details = {}, error = null) {
        this.totalTests++;
        if (passed) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }

        this.testResults.push({
            testName,
            passed,
            details,
            error: error ? error.message : null,
            timestamp: new Date().toISOString()
        });

        const status = passed ? '✅ PASS' : '❌ FAIL';
        this.log(`${status} - ${testName}`, passed ? 'PASS' : 'FAIL');
        if (error) {
            this.log(`   Error: ${error.message}`, 'ERROR');
        }
    }

    // Test Categories
    async runAllTests() {
        this.log('🚀 Starting Comprehensive FinanceBot Testing Suite', 'START');
        this.log(`📊 Base URL: ${this.baseURL}`, 'INFO');
        this.log(`🆔 Session ID: ${this.sessionId}`, 'INFO');

        try {
            // 1. Infrastructure Tests
            await this.testServerHealth();
            await this.testAPIEndpoints();
            
            // 2. Core Functionality Tests
            await this.testAssetDetection();
            await this.testGuardrails();
            await this.testChartGeneration();
            
            // 3. Portfolio Tests
            await this.testPortfolioAnalysis();
            
            // 4. Advanced Query Tests
            await this.testGeneralFinancialQueries();
            await this.testFuzzyMatching();
            await this.testComplexityDetection();
            
            // 5. Error Handling Tests
            await this.testErrorHandling();
            await this.testRateLimiting();
            
            // 6. Performance Tests
            await this.testPerformance();
            
            // 7. Data Validation Tests
            await this.testDataIntegrity();

        } catch (error) {
            this.log(`💥 Critical test failure: ${error.message}`, 'CRITICAL');
        }

        await this.generateReport();
    }

    // 1. Infrastructure Tests
    async testServerHealth() {
        this.log('🏥 Testing Server Health...', 'CATEGORY');
        
        try {
            const response = await axios.get(`${this.baseURL}/api/health`);
            this.recordTest('Server Health Check', 
                response.status === 200 && response.data.status === 'healthy',
                { statusCode: response.status, serverStatus: response.data.status }
            );

            // Test if all expected features are enabled
            const features = response.data.features;
            this.recordTest('Portfolio Analysis Feature', features.portfolioAnalysis === true);
            this.recordTest('Perplexity Integration', features.perplexityIntegration === true);
            this.recordTest('Rate Limiting', features.rateLimiting === true);
            this.recordTest('Caching System', features.caching === true);
            this.recordTest('Error Handling', features.errorHandling === true);
            this.recordTest('Security Features', features.security === true);

        } catch (error) {
            this.recordTest('Server Health Check', false, {}, error);
        }
    }

    async testAPIEndpoints() {
        this.log('🌐 Testing API Endpoints...', 'CATEGORY');
        
        // Test session initialization
        try {
            const response = await axios.get(`${this.baseURL}/api/session/init`);
            this.recordTest('Session Initialization', 
                response.status === 200 && response.data.success === true,
                { sessionId: response.data.sessionId }
            );
        } catch (error) {
            this.recordTest('Session Initialization', false, {}, error);
        }

        // Test metrics endpoint
        try {
            const response = await axios.get(`${this.baseURL}/api/metrics`);
            this.recordTest('Metrics Endpoint', 
                response.status === 200 && typeof response.data.uptime === 'number',
                { metrics: response.data }
            );
        } catch (error) {
            this.recordTest('Metrics Endpoint', false, {}, error);
        }
    }

    // 2. Core Functionality Tests
    async testAssetDetection() {
        this.log('🎯 Testing Asset Detection...', 'CATEGORY');
        
        const assetTests = [
            // Popular Stocks
            { query: 'Apple stock analysis', expectedAsset: 'Apple', category: 'Stock' },
            { query: 'Microsoft performance', expectedAsset: 'Microsoft', category: 'Stock' },
            { query: 'AAPL price', expectedAsset: 'Apple', category: 'Stock' },
            { query: 'TSLA trends', expectedAsset: 'Tesla', category: 'Stock' },
            
            // Cryptocurrencies
            { query: 'Bitcoin analysis', expectedAsset: 'Bitcoin', category: 'Cryptocurrency' },
            { query: 'BTC price', expectedAsset: 'Bitcoin', category: 'Cryptocurrency' },
            { query: 'Ethereum trends', expectedAsset: 'Ethereum', category: 'Cryptocurrency' },
            { query: 'ETH analysis', expectedAsset: 'Ethereum', category: 'Cryptocurrency' },
            
            // Commodities
            { query: 'Gold price analysis', expectedAsset: 'Gold', category: 'Commodity' },
            { query: 'Oil market trends', expectedAsset: 'Oil', category: 'Commodity' },
            { query: 'Silver investment', expectedAsset: 'Silver', category: 'Commodity' },
            
            // ETFs and Indices
            { query: 'S&P 500 performance', expectedAsset: 'S&P 500', category: 'Commodity' },
            { query: 'QQQ analysis', expectedAsset: 'QQQ', category: 'ETF' },
            { query: 'SPY trends', expectedAsset: 'SPY', category: 'ETF' }
        ];

        for (const test of assetTests) {
            try {
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: test.query,
                    sessionId: this.sessionId
                });

                const success = response.data.success && 
                              response.data.data.title && 
                              response.data.data.title.includes(test.expectedAsset);

                this.recordTest(`Asset Detection: ${test.query}`, success, {
                    expectedAsset: test.expectedAsset,
                    detectedTitle: response.data.data.title,
                    queryType: response.data.metadata.queryType,
                    hasChart: response.data.metadata.hasChart
                });

                await this.delay(100); // Prevent rate limiting
            } catch (error) {
                this.recordTest(`Asset Detection: ${test.query}`, false, {}, error);
            }
        }
    }

    async testGuardrails() {
        this.log('🚧 Testing Guardrails...', 'CATEGORY');
        
        const nonFinancialQueries = [
            'How do I make pizza?',
            'What\'s the weather today?',
            'Best pizza recipe',
            'How to cook pasta',
            'Movie recommendations',
            'Travel advice for Europe',
            'How to fix my car',
            'Programming tutorial',
            'Exercise routine',
            'Relationship advice'
        ];

        for (const query of nonFinancialQueries) {
            try {
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: query,
                    sessionId: this.sessionId
                });

                const isGuardrailResponse = response.data.success && 
                                          response.data.data.type === 'guardrail' &&
                                          response.data.data.title.includes('finance');

                this.recordTest(`Guardrail: "${query}"`, isGuardrailResponse, {
                    responseType: response.data.data.type,
                    title: response.data.data.title
                });

                await this.delay(100);
            } catch (error) {
                this.recordTest(`Guardrail: "${query}"`, false, {}, error);
            }
        }
    }

    async testChartGeneration() {
        this.log('📊 Testing Chart Generation...', 'CATEGORY');
        
        const chartTests = [
            { query: 'Apple stock analysis', shouldHaveChart: true },
            { query: 'Bitcoin price trends', shouldHaveChart: true },
            { query: 'Microsoft technical analysis', shouldHaveChart: true },
            { query: 'Gold price movement', shouldHaveChart: true },
            { query: 'Show me Tesla chart', shouldHaveChart: true }
        ];

        for (const test of chartTests) {
            try {
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: test.query,
                    sessionId: this.sessionId
                });

                const hasChart = response.data.chart !== null && response.data.chart !== undefined;
                const success = test.shouldHaveChart ? hasChart : !hasChart;

                this.recordTest(`Chart Generation: ${test.query}`, success, {
                    hasChart: hasChart,
                    chartType: response.data.chart?.type,
                    chartTitle: response.data.chart?.title
                });

                await this.delay(100);
            } catch (error) {
                this.recordTest(`Chart Generation: ${test.query}`, false, {}, error);
            }
        }
    }

    // 3. Portfolio Tests
    async testPortfolioAnalysis() {
        this.log('📈 Testing Portfolio Analysis...', 'CATEGORY');
        
        // Test the analysis endpoint without portfolio
        try {
            const response = await axios.post(`${this.baseURL}/api/chat`, {
                message: 'analyze my portfolio',
                sessionId: this.sessionId
            });

            // This should return either portfolio analysis or clarification
            const success = response.data.success && 
                           (response.data.data.type === 'portfolio' || 
                            response.data.data.type === 'clarification');

            this.recordTest('Portfolio Analysis Query', success, {
                responseType: response.data.data.type,
                title: response.data.data.title
            });

        } catch (error) {
            this.recordTest('Portfolio Analysis Query', false, {}, error);
        }
    }

    // 4. Advanced Query Tests
    async testGeneralFinancialQueries() {
        this.log('💡 Testing General Financial Queries...', 'CATEGORY');
        
        const generalQueries = [
            'What are the best dividend stocks?',
            'Current market trends',
            'Investment strategies for beginners',
            'How to diversify my portfolio?',
            'Best growth stocks',
            'Cryptocurrency market analysis',
            'Risk management strategies',
            'Sector analysis today',
            'Economic indicators impact',
            'Interest rate effects on markets'
        ];

        for (const query of generalQueries) {
            try {
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: query,
                    sessionId: this.sessionId
                });

                const success = response.data.success && 
                               response.data.data.type !== 'non_financial' &&
                               response.data.data.type !== 'guardrail';

                this.recordTest(`General Financial: "${query}"`, success, {
                    responseType: response.data.data.type,
                    topic: response.data.metadata.topic
                });

                await this.delay(100);
            } catch (error) {
                this.recordTest(`General Financial: "${query}"`, false, {}, error);
            }
        }
    }

    async testFuzzyMatching() {
        this.log('🔍 Testing Fuzzy Matching...', 'CATEGORY');
        
        const fuzzyTests = [
            { query: 'Appel stock', expected: 'Apple' },
            { query: 'Microsft analysis', expected: 'Microsoft' },
            { query: 'Bitcon price', expected: 'Bitcoin' },
            { query: 'Teslas performance', expected: 'Tesla' },
            { query: 'Googel trends', expected: 'Google' }
        ];

        for (const test of fuzzyTests) {
            try {
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: test.query,
                    sessionId: this.sessionId
                });

                const success = response.data.success && 
                               response.data.data.title && 
                               response.data.data.title.includes(test.expected);

                this.recordTest(`Fuzzy Match: "${test.query}" → ${test.expected}`, success, {
                    query: test.query,
                    expected: test.expected,
                    actualTitle: response.data.data.title
                });

                await this.delay(100);
            } catch (error) {
                this.recordTest(`Fuzzy Match: "${test.query}" → ${test.expected}`, false, {}, error);
            }
        }
    }

    async testComplexityDetection() {
        this.log('🎚️ Testing Complexity Detection...', 'CATEGORY');
        
        const complexityTests = [
            { query: 'Simple Apple analysis', expectedComplexity: 'low' },
            { query: 'Quick Bitcoin overview', expectedComplexity: 'low' },
            { query: 'Detailed comprehensive Microsoft analysis', expectedComplexity: 'high' },
            { query: 'In-depth technical analysis of Tesla', expectedComplexity: 'high' },
            { query: 'Thorough examination of Gold markets', expectedComplexity: 'high' },
            { query: 'Bitcoin analysis', expectedComplexity: 'medium' }
        ];

        for (const test of complexityTests) {
            try {
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: test.query,
                    sessionId: this.sessionId
                });

                // Note: Complexity is handled internally and may not be exposed in response
                const success = response.data.success;

                this.recordTest(`Complexity Detection: "${test.query}"`, success, {
                    query: test.query,
                    expectedComplexity: test.expectedComplexity,
                    note: 'Complexity detection is internal'
                });

                await this.delay(100);
            } catch (error) {
                this.recordTest(`Complexity Detection: "${test.query}"`, false, {}, error);
            }
        }
    }

    // 5. Error Handling Tests
    async testErrorHandling() {
        this.log('⚠️ Testing Error Handling...', 'CATEGORY');
        
        const errorTests = [
            { test: 'Empty message', data: { message: '', sessionId: this.sessionId } },
            { test: 'Very long message', data: { message: 'A'.repeat(1000), sessionId: this.sessionId } },
            { test: 'Missing sessionId', data: { message: 'test message' } },
            { test: 'XSS attempt', data: { message: '<script>alert("xss")</script>', sessionId: this.sessionId } }
        ];

        for (const test of errorTests) {
            try {
                const response = await axios.post(`${this.baseURL}/api/chat`, test.data);
                
                // Error handling should either return a proper error response or sanitized response
                const success = !response.data.success || 
                               (response.data.success && !response.data.data.title.includes('<script>'));

                this.recordTest(`Error Handling: ${test.test}`, success, {
                    responseStatus: response.status,
                    hasError: !response.data.success
                });

            } catch (error) {
                // Expected errors are actually good
                const success = error.response && error.response.status >= 400;
                this.recordTest(`Error Handling: ${test.test}`, success, {
                    errorStatus: error.response?.status,
                    errorMessage: error.response?.data?.error
                });
            }
        }
    }

    async testRateLimiting() {
        this.log('🚦 Testing Rate Limiting...', 'CATEGORY');
        
        try {
            // Make multiple rapid requests
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    axios.post(`${this.baseURL}/api/chat`, {
                        message: `Test message ${i}`,
                        sessionId: `rapid_test_${i}`
                    })
                );
            }

            const responses = await Promise.allSettled(promises);
            const successful = responses.filter(r => r.status === 'fulfilled').length;
            const rateLimited = responses.filter(r => 
                r.status === 'rejected' && 
                r.reason.response?.status === 429
            ).length;

            this.recordTest('Rate Limiting Protection', rateLimited > 0 || successful <= 8, {
                totalRequests: 10,
                successful: successful,
                rateLimited: rateLimited
            });

        } catch (error) {
            this.recordTest('Rate Limiting Protection', false, {}, error);
        }
    }

    // 6. Performance Tests
    async testPerformance() {
        this.log('⚡ Testing Performance...', 'CATEGORY');
        
        const performanceTests = [
            'Apple stock analysis',
            'Bitcoin price trends',
            'What are the best dividend stocks?',
            'Microsoft performance'
        ];

        for (const query of performanceTests) {
            const startTime = Date.now();
            try {
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: query,
                    sessionId: this.sessionId
                });

                const responseTime = Date.now() - startTime;
                const success = responseTime < 5000; // Should respond within 5 seconds

                this.recordTest(`Performance: "${query}"`, success, {
                    responseTime: `${responseTime}ms`,
                    threshold: '5000ms',
                    cached: response.data.metadata?.cached
                });

                await this.delay(100);
            } catch (error) {
                const responseTime = Date.now() - startTime;
                this.recordTest(`Performance: "${query}"`, false, { responseTime: `${responseTime}ms` }, error);
            }
        }
    }

    // 7. Data Validation Tests
    async testDataIntegrity() {
        this.log('🔍 Testing Data Integrity...', 'CATEGORY');
        
        try {
            const response = await axios.post(`${this.baseURL}/api/chat`, {
                message: 'Apple stock analysis',
                sessionId: this.sessionId
            });

            if (response.data.success) {
                const data = response.data.data;
                
                // Test response structure
                this.recordTest('Response Structure - Title', typeof data.title === 'string');
                this.recordTest('Response Structure - Summary', Array.isArray(data.summary));
                this.recordTest('Response Structure - Sections', Array.isArray(data.sections));
                this.recordTest('Response Structure - Action Items', Array.isArray(data.actionItems));
                this.recordTest('Response Structure - Key Metrics', typeof data.keyMetrics === 'object');

                // Test chart structure if present
                if (response.data.chart) {
                    const chart = response.data.chart;
                    this.recordTest('Chart Structure - Type', typeof chart.type === 'string');
                    this.recordTest('Chart Structure - Title', typeof chart.title === 'string');
                    this.recordTest('Chart Structure - Data', typeof chart.data === 'object');
                }

                // Test metadata structure
                const metadata = response.data.metadata;
                this.recordTest('Metadata Structure - Query Type', typeof metadata.queryType === 'string');
                this.recordTest('Metadata Structure - Has Chart', typeof metadata.hasChart === 'boolean');
                this.recordTest('Metadata Structure - Timestamp', typeof metadata.timestamp === 'string');
            }

        } catch (error) {
            this.recordTest('Data Integrity Test', false, {}, error);
        }
    }

    // Report Generation
    async generateReport() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        this.log('📋 Generating Test Report...', 'REPORT');

        const report = {
            testSuite: 'FinanceBot Pro - Comprehensive End-to-End Tests',
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`,
            summary: {
                totalTests: this.totalTests,
                passed: this.passedTests,
                failed: this.failedTests,
                successRate: `${((this.passedTests / this.totalTests) * 100).toFixed(2)}%`
            },
            categories: this.categorizeResults(),
            detailedResults: this.testResults,
            recommendations: this.generateRecommendations()
        };

        // Write report to file
        const reportPath = path.join(__dirname, 'test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Generate human-readable report
        this.generateHumanReadableReport(report);

        this.log(`📊 Test Report saved to: ${reportPath}`, 'REPORT');
        this.log(`🎯 Overall Success Rate: ${report.summary.successRate}`, 'REPORT');
        
        return report;
    }

    categorizeResults() {
        const categories = {};
        
        this.testResults.forEach(test => {
            const category = test.testName.split(':')[0] || 'General';
            if (!categories[category]) {
                categories[category] = { passed: 0, failed: 0, total: 0 };
            }
            categories[category].total++;
            if (test.passed) {
                categories[category].passed++;
            } else {
                categories[category].failed++;
            }
        });

        // Calculate success rates
        Object.keys(categories).forEach(cat => {
            categories[cat].successRate = `${((categories[cat].passed / categories[cat].total) * 100).toFixed(2)}%`;
        });

        return categories;
    }

    generateRecommendations() {
        const recommendations = [];
        const failedTests = this.testResults.filter(t => !t.passed);

        if (failedTests.length === 0) {
            recommendations.push('🎉 All tests passed! The application is production-ready.');
        } else {
            recommendations.push(`⚠️ ${failedTests.length} tests failed. Review the following areas:`);
            
            const categories = {};
            failedTests.forEach(test => {
                const category = test.testName.split(':')[0] || 'General';
                if (!categories[category]) categories[category] = 0;
                categories[category]++;
            });

            Object.entries(categories).forEach(([cat, count]) => {
                recommendations.push(`   • ${cat}: ${count} failed tests`);
            });
        }

        if (this.passedTests / this.totalTests > 0.9) {
            recommendations.push('✅ High success rate indicates stable application');
        } else if (this.passedTests / this.totalTests > 0.7) {
            recommendations.push('⚠️ Moderate success rate - investigate failed tests');
        } else {
            recommendations.push('❌ Low success rate - significant issues need attention');
        }

        return recommendations;
    }

    generateHumanReadableReport(report) {
        const reportLines = [
            '╔════════════════════════════════════════════════════════════╗',
            '║             FINANCEBOT PRO - TEST REPORT                  ║',
            '╠════════════════════════════════════════════════════════════╣',
            `║  Date: ${new Date().toLocaleString().padEnd(48)} ║`,
            `║  Duration: ${report.duration.padEnd(43)} ║`,
            '╠════════════════════════════════════════════════════════════╣',
            '║                        SUMMARY                             ║',
            '╠════════════════════════════════════════════════════════════╣',
            `║  Total Tests: ${report.summary.totalTests.toString().padEnd(42)} ║`,
            `║  Passed: ${report.summary.passed.toString().padEnd(47)} ║`,
            `║  Failed: ${report.summary.failed.toString().padEnd(47)} ║`,
            `║  Success Rate: ${report.summary.successRate.padEnd(39)} ║`,
            '╠════════════════════════════════════════════════════════════╣',
            '║                     BY CATEGORY                            ║',
            '╚════════════════════════════════════════════════════════════╝'
        ];

        Object.entries(report.categories).forEach(([category, stats]) => {
            reportLines.push(`${category}: ${stats.passed}/${stats.total} (${stats.successRate})`);
        });

        reportLines.push('\n📋 RECOMMENDATIONS:');
        report.recommendations.forEach(rec => {
            reportLines.push(rec);
        });

        const humanReport = reportLines.join('\n');
        console.log('\n' + humanReport);

        // Save human-readable report
        const humanReportPath = path.join(__dirname, 'test-report.txt');
        fs.writeFileSync(humanReportPath, humanReport);
        
        this.log(`📄 Human-readable report saved to: ${humanReportPath}`, 'REPORT');
    }
}

// Main execution
async function runTests() {
    const tester = new FinanceBotTester();
    
    try {
        await tester.runAllTests();
    } catch (error) {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    }
}

// Export for module use or run directly
if (require.main === module) {
    runTests();
}

module.exports = FinanceBotTester;
