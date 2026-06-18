import { describe, it, expect, vi } from 'vitest';

vi.mock('../api', () => ({
  fetchLeaderboard: vi.fn().mockResolvedValue([]),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Environment: () => null,
}));

vi.mock('../components/Globe', () => ({
  default: () => null,
}));

describe('Leaderboard Page', () => {
  it('should be importable without errors', async () => {
    const module = await import('./Leaderboard');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});