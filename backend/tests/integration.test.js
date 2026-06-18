const request = require('supertest');
const app = require('../server');
const { getDb, initSchema, closeDb } = require('../db/db');
const { seed } = require('../db/seed');
const { appState } = require('../appState');

// Silence expected warnings to keep output clean
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});

beforeAll(async () => {
  await initSchema();
  await seed();
  await appState.initialize();
});

afterAll(async () => {
  await closeDb();
});

describe('API Integration Tests', () => {
  let logId;

  describe('Health Check', () => {
    it('GET /api/health should return 200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBeDefined();
    });
  });

  describe('Auth Routes', () => {
    it('GET /api/auth/me should return default user without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('EcoUser');
    });

    it('POST /api/auth/google should reject missing credentials', async () => {
      const res = await request(app).post('/api/auth/google').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('Logs Routes', () => {
    it('GET /api/logs/factors should return emission factors', async () => {
      const res = await request(app).get('/api/logs/factors');
      expect(res.status).toBe(200);
      expect(res.body.factors).toBeDefined();
    });

    it('POST /api/logs should create a new log entry', async () => {
      const payload = {
        date: new Date().toISOString().split('T')[0],
        category: 'transport',
        subtype: 'car_petrol',
        quantity: 10
      };
      const res = await request(app).post('/api/logs').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.co2e).toBeDefined();
      logId = res.body.logId; // Save for delete test
    });

    it('GET /api/logs should return logs for today', async () => {
      const res = await request(app).get('/api/logs');
      expect(res.status).toBe(200);
      expect(res.body.entries).toBeDefined();
    });

    it('GET /api/logs/today/status should return status', async () => {
      const res = await request(app).get('/api/logs/today/status');
      expect(res.status).toBe(200);
      expect(res.body.hasLogged).toBeDefined();
    });

    it('GET /api/logs/chart should return chart data', async () => {
      const res = await request(app).get('/api/logs/chart');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/logs/range should require from and to', async () => {
      const res = await request(app).get('/api/logs/range');
      expect(res.status).toBe(400);
    });

    it('GET /api/logs/range should return range data', async () => {
      const res = await request(app).get('/api/logs/range?from=2026-06-01&to=2026-06-30');
      expect(res.status).toBe(200);
      expect(res.body.totalCO2e).toBeDefined();
    });
  });

  describe('Dashboard Routes', () => {
    it('GET /api/dashboard should return dashboard stats', async () => {
      const res = await request(app).get('/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.topCategories).toBeDefined();
    });

    it('GET /api/dashboard/pie should return pie data', async () => {
      const res = await request(app).get('/api/dashboard/pie');
      expect(res.status).toBe(200);
      expect(res.body.breakdown).toBeDefined();
    });

    it('GET /api/dashboard/trend should return trend data', async () => {
      const res = await request(app).get('/api/dashboard/trend');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('Goals Routes', () => {
    it('GET /api/goals should return goal data', async () => {
      const res = await request(app).get('/api/goals');
      expect(res.status).toBe(200);
      expect(res.body.dailyGoal).toBeDefined();
    });

    it('POST /api/goals should update goal', async () => {
      const res = await request(app).post('/api/goals').send({ dailyGoal: 10 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/goals/streak should return streak data', async () => {
      const res = await request(app).get('/api/goals/streak');
      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBeDefined();
    });
  });

  describe('Transport Routes', () => {
    it('GET /api/transport/modes should return modes', async () => {
      const res = await request(app).get('/api/transport/modes');
      expect(res.status).toBe(200);
      expect(res.body.modes).toBeDefined();
    });

    it('POST /api/transport/distance should reject without origin/destination', async () => {
      const res = await request(app).post('/api/transport/distance');
      expect(res.status).toBe(400);
    });

    it('POST /api/transport/compare should calculate comparison for distance', async () => {
      const res = await request(app).post('/api/transport/compare').send({ distanceKm: 10 });
      expect(res.status).toBe(200);
      expect(res.body.distanceKm).toBe(10);
      expect(res.body.allModes).toBeDefined();
    });

    it('GET /api/transport/aqi should reject without lat/lng', async () => {
      const res = await request(app).get('/api/transport/aqi');
      expect(res.status).toBe(400);
    });
  });

  describe('Social Routes', () => {
    it('GET /api/social/leaderboard should return leaderboard array', async () => {
      const res = await request(app).get('/api/social/leaderboard');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Insights Routes', () => {
    it('POST /api/insights/chat should require question', async () => {
      const res = await request(app).post('/api/insights/chat').send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/insights/agent should require message', async () => {
      const res = await request(app).post('/api/insights/agent').send({});
      expect(res.status).toBe(400);
    });

    it('GET /api/insights/ai should handle missing AI config safely', async () => {
      const res = await request(app).get('/api/insights/ai');
      expect(res.status).toBe(200);
    });
  });

  describe('Webhooks Routes', () => {
    it('GET /api/webhooks/daily-check should return ok', async () => {
      const res = await request(app).get('/api/webhooks/daily-check');
      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown/route/123');
      expect(res.status).toBe(404);
    });
  });
});
