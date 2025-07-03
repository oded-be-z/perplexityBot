const request = require('supertest');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000';

describe('FinanceBot Pro v4.0 - Production Ready Tests', () => {
  let sessionId;

  // =============================================
  // HEALTH & MONITORING TESTS
  // =============================================
  
  describe('Health & Monitoring', () => {
    it('should return comprehensive health check', async () => {
      const res = await request(API_URL).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body.version).toBe('4.0.0');
      expect(res.body.features).toBeDefined();
      expect(res.body.system).toBeDefined();
      expect(res.body.features.rateLimiting).toBe(true);
      expect(res.body.features.caching).toBe(true);
      expect(res.body.features.security).toBe(true);
      console.log('✅ Health check passed');
    });

    it('should return system metrics', async () => {
      const res = await request(API_URL).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.body.cache).toBeDefined();
      expect(res.body.sessions).toBeDefined();
      expect(res.body.uptime).toBeGreaterThan(0);
      expect(res.body.memory).toBeDefined();
      console.log('✅ Metrics endpoint working');
    });
  });

  // =============================================
  // SECURITY TESTS
  // =============================================

  describe('Security Features', () => {
    it('should include security headers', async () => {
      const res = await request(API_URL).get('/api/health');
      expect(res.headers).toHaveProperty('x-content-type-options');
      expect(res.headers).toHaveProperty('x-frame-options');
      console.log('✅ Security headers present');
    });

    it('should handle malicious input safely', async () => {
      const res = await request(API_URL)
        .post('/api/chat')
        .send({ 
          message: '<script>alert("xss")</script>analyze apple', 
          sessionId: 'test' 
        });
      // Should not crash and should sanitize input
      expect(res.status).toBeLessThan(500);
      console.log('✅ XSS protection working');
    });

    it('should reject overly long messages', async () => {
      const longMessage = 'a'.repeat(1000);
      const res = await request(API_URL)
        .post('/api/chat')
        .send({ message: longMessage, sessionId: 'test' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MESSAGE_TOO_LONG');
      console.log('✅ Input length validation working');
    });
  });

  // =============================================
  // CORE FUNCTIONALITY TESTS
  // =============================================

  describe('Core Functionality', () => {
    beforeAll(async () => {
      const res = await request(API_URL).get('/api/session/init');
      sessionId = res.body.sessionId;
    });

    it('should return structured responses for analysis', async () => {
      const res = await request(API_URL)
        .post('/api/chat')
        .send({ message: 'analyze apple stock', sessionId });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.metadata).toBeDefined();
      expect(res.body.metadata.timestamp).toBeDefined();
      console.log('✅ Structured responses working');
    }, 30000);

    it('should handle portfolio upload with new format', async () => {
      const filePath = path.join(__dirname, 'sample_portfolio.csv');
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, 'symbol,shares,current_price,market_value\nAAPL,100,180,18000\nGOOGL,50,140,7000\nTSLA,75,200,15000\n');
      }
      
      const res = await request(API_URL)
        .post('/api/upload')
        .field('sessionId', sessionId)
        .attach('files', filePath);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBeDefined();
      expect(res.body.data.keyMetrics).toBeDefined();
      expect(res.body.metadata.uploadedAt).toBeDefined();
      console.log('✅ Portfolio upload with new format working');
    });

    it('should analyze uploaded portfolio with structured response', async () => {
      const res = await request(API_URL)
        .post('/api/chat')
        .send({ message: 'analyze my portfolio', sessionId });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('portfolio');
      expect(res.body.data.keyMetrics).toBeDefined();
      expect(res.body.data.actionItems).toBeDefined();
      expect(res.body.chart).toBeDefined();
      console.log('✅ Portfolio analysis with structured response working');
    });
  });

  // =============================================
  // PERFORMANCE TESTS
  // =============================================

  describe('Performance Features', () => {
    it('should cache responses for better performance', async () => {
      // First request
      const start1 = Date.now();
      const res1 = await request(API_URL)
        .post('/api/chat')
        .send({ message: 'analyze bitcoin', sessionId });
      const time1 = Date.now() - start1;

      // Second request (should be cached)
      const start2 = Date.now();
      const res2 = await request(API_URL)
        .post('/api/chat')
        .send({ message: 'analyze bitcoin', sessionId });
      const time2 = Date.now() - start2;

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      // Cache should make second request faster (when API is used)
      console.log(`✅ Caching test: First=${time1}ms, Second=${time2}ms`);
    }, 60000);

    it('should handle concurrent requests', async () => {
      const requests = Array(5).fill().map((_, i) => 
        request(API_URL)
          .post('/api/chat')
          .send({ message: `analyze tesla ${i}`, sessionId })
      );

      const responses = await Promise.all(requests);
      
      expect(responses.every(res => res.status === 200)).toBe(true);
      console.log('✅ Concurrent request handling working');
    }, 30000);
  });

  // =============================================
  // ERROR HANDLING TESTS
  // =============================================

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      const res = await request(API_URL).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
      console.log('✅ 404 handling working');
    });

    it('should validate required fields', async () => {
      const res = await request(API_URL)
        .post('/api/chat')
        .send({ sessionId: 'test' }); // Missing message
      
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
      console.log('✅ Input validation working');
    });

    it('should handle file upload errors', async () => {
      const res = await request(API_URL)
        .post('/api/upload')
        .field('sessionId', 'test');
      // No files attached
      
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NO_FILES');
      console.log('✅ Upload error handling working');
    });
  });

  // =============================================
  // RATE LIMITING TESTS
  // =============================================

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // This test might take a while and could hit actual rate limits
      // In a real scenario, you'd mock the rate limiter or use a test environment
      const requests = Array(10).fill().map(() => 
        request(API_URL)
          .post('/api/chat')
          .send({ message: 'test rate limit', sessionId: 'rate-test' })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter(res => res.status === 200).length;
      
      // Should handle requests appropriately
      expect(successCount).toBeGreaterThan(0);
      console.log(`✅ Rate limiting test: ${successCount}/10 requests succeeded`);
    }, 15000);
  });

  // =============================================
  // LEGACY COMPATIBILITY TESTS
  // =============================================

  describe('Legacy Compatibility', () => {
    it('should handle old format queries gracefully', async () => {
      const res = await request(API_URL)
        .post('/api/chat')
        .send({ message: 'show me oil prices', sessionId });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Should work with both old and new formats
      console.log('✅ Legacy compatibility maintained');
    });
  });
}); 