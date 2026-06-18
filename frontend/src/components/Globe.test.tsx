import { describe, it, expect, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useLoader: vi.fn().mockReturnValue([{}, {}, {}]),
}));

vi.mock('@react-three/drei', () => ({
  useTexture: vi.fn().mockReturnValue([null, null, null]),
}));

describe('Globe Component', () => {
  it('should be importable without errors', async () => {
    const module = await import('./Globe');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});