import { describe, it, expect, vi } from 'vitest';

vi.mock('../api', () => ({
  fetchAIInsight: vi.fn().mockResolvedValue({ insight: 'test', suggestions: [] }),
  askAgent: vi.fn().mockResolvedValue(undefined),
}));

describe('AIInsights Page', () => {
  it('should be importable without errors', async () => {
    const module = await import('./AIInsights');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});