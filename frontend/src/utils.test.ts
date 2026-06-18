import { describe, it, expect } from 'vitest';

describe('Frontend API module', () => {
  it('should export core API functions', async () => {
    const api = await import('./api');
    expect(api).toBeDefined();
    expect(typeof api.fetchDashboard).toBe('function');
    expect(typeof api.fetchLog).toBe('function');
    expect(typeof api.submitLog).toBe('function');
    expect(typeof api.deleteLogEntry).toBe('function');
    expect(typeof api.fetchFactors).toBe('function');
  });

  it('should export AI-related functions', async () => {
    const api = await import('./api');
    expect(typeof api.fetchAIInsight).toBe('function');
    expect(typeof api.askAgent).toBe('function');
  });

  it('should export auth and social functions', async () => {
    const api = await import('./api');
    expect(typeof api.googleLogin).toBe('function');
    expect(typeof api.fetchLeaderboard).toBe('function');
  });

  it('should export goal and streak functions', async () => {
    const api = await import('./api');
    expect(typeof api.fetchGoals).toBe('function');
    expect(typeof api.setGoal).toBe('function');
    expect(typeof api.fetchStreak).toBe('function');
  });

  it('should export transport functions', async () => {
    const api = await import('./api');
    expect(typeof api.getTransportDistance).toBe('function');
    expect(typeof api.fetchTransportModes).toBe('function');
  });
});

describe('Environment configuration', () => {
  it('should have VITE_API_URL defined or default to localhost', () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    expect(apiUrl).toBeDefined();
    expect(typeof apiUrl).toBe('string');
    expect(apiUrl.startsWith('http')).toBe(true);
  });
});
