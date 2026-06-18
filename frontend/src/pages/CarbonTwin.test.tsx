import { describe, it, expect, vi } from 'vitest';

// Mock Three.js and react-three-fiber to avoid WebGL errors in jsdom
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="canvas">{children}</div>,
  useFrame: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Environment: () => null,
  Float: ({ children }: any) => <div>{children}</div>,
  Text: () => null,
  OrbitControls: () => null,
  Stars: () => null,
  Cloud: () => null,
  ContactShadows: () => null,
}));

vi.mock('three', () => ({
  __esModule: true,
  default: {},
  Group: class {},
  Mesh: class {},
  MeshStandardMaterial: class {},
}));

describe('CarbonTwin Page', () => {
  it('should be importable without errors', async () => {
    const module = await import('./CarbonTwin');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});