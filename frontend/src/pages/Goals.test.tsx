import { describe, it, expect, vi } from 'vitest';

vi.mock('../api', () => ({
  fetchGoals: vi.fn().mockResolvedValue({ dailyGoal: 5, currentStreak: 0 }),
  setGoal: vi.fn().mockResolvedValue({ success: true }),
  fetchStreakData: vi.fn().mockResolvedValue({ windowData: [] }),
}));

describe('Goals Page', () => {
  it('should be importable without errors', async () => {
    const module = await import('./Goals');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});