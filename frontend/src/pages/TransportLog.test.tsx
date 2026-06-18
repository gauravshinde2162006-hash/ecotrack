import { describe, it, expect, vi } from 'vitest';

vi.mock('../api', () => ({
  fetchTransportRoute: vi.fn().mockResolvedValue({ distanceKm: 0, allModes: [] }),
}));

describe('TransportLog Page', () => {
  it('should be importable without errors', async () => {
    const module = await import('./TransportLog');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});