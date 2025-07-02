const request = require('supertest');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000';

describe('FinanceBot Pro End-to-End', () => {
  let sessionId;

  it('should initialize a session', async () => {
    const res = await request(API_URL).get('/api/session/init');
    expect(res.body.success).toBe(true);
    expect(res.body.sessionId).toBeDefined();
    sessionId = res.body.sessionId;
    console.log('Session initialized:', sessionId);
  });

  it('should upload a portfolio CSV and confirm', async () => {
    const filePath = path.join(__dirname, 'sample_portfolio.csv');
    // Create a sample CSV if not exists
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, 'symbol,value\nAAPL,10000\nGOOGL,8000\nTSLA,6000\nBTC,4000\n');
    }
    const res = await request(API_URL)
      .post('/api/upload')
      .field('sessionId', sessionId)
      .attach('files', filePath);
    expect(res.body.success).toBe(true);
    expect(res.body.hasPortfolio).toBe(true);
    expect(res.body.message).toMatch(/Portfolio uploaded successfully/);
    console.log('Portfolio upload confirmed.');
  });

  it('should analyze portfolio with a vague query', async () => {
    const res = await request(API_URL)
      .post('/api/chat')
      .send({ message: 'my po', sessionId });
    expect(res.body.success).toBe(true);
    expect(res.body.charts && res.body.charts.portfolio).toBeDefined();
    expect(res.body.message).toMatch(/portfolio/i);
    console.log('Portfolio analysis (vague query) successful.');
  });

  it('should analyze portfolio with an explicit query', async () => {
    const res = await request(API_URL)
      .post('/api/chat')
      .send({ message: 'analyze my portfolio', sessionId });
    expect(res.body.success).toBe(true);
    expect(res.body.charts && res.body.charts.portfolio).toBeDefined();
    expect(res.body.message).toMatch(/portfolio/i);
    console.log('Portfolio analysis (explicit query) successful.');
  }, 15000);

  it('should return a smooth price chart for BTC', async () => {
    const res = await request(API_URL)
      .post('/api/chat')
      .send({ message: 'Show me Bitcoin price trends with charts', sessionId });
    expect(res.body.success).toBe(true);
    expect(res.body.charts && res.body.charts.prices).toBeDefined();
    const prices = res.body.charts.prices.map(p => p.price);
    expect(prices.length).toBeGreaterThanOrEqual(12);
    expect(prices.every(p => p > 0)).toBe(true);
    console.log('BTC price chart is smooth and valid.');
  });

  it('should handle a non-portfolio file gracefully', async () => {
    const filePath = path.join(__dirname, 'sample.txt');
    fs.writeFileSync(filePath, 'This is a test file, not a portfolio.');
    const res = await request(API_URL)
      .post('/api/upload')
      .field('sessionId', sessionId)
      .attach('files', filePath);
    expect(res.body.success).toBe(true);
    expect(res.body.hasPortfolio).toBe(false);
    console.log('Non-portfolio file handled gracefully.');
  });

  it('should return an error for vague query with no portfolio', async () => {
    // New session without portfolio
    const resInit = await request(API_URL).get('/api/session/init');
    const newSessionId = resInit.body.sessionId;
    const res = await request(API_URL)
      .post('/api/chat')
      .send({ message: 'my po', sessionId: newSessionId });
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/could not determine which asset/i);
    console.log('Vague query with no portfolio returns error as expected.');
  });
}); 