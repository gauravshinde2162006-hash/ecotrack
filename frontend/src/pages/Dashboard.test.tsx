import { describe, it, expect, vi } from 'vitest';

vi.mock('../api', () => ({
  fetchDashboardData: vi.fn().mockResolvedValue({
    todayCO2e: 0,
    weeklyTotal: 0,
    topCategories: [],
    windowData: [],
  }),
  fetchPieData: vi.fn().mockResolvedValue({ breakdown: [] }),
  fetchTrendData: vi.fn().mockResolvedValue({ data: [] }),
}));

describe('Dashboard Page', () => {
  it('should be importable without errors', async () => {
    const module = await import('./Dashboard');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});