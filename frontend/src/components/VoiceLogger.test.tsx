import { describe, it, expect } from 'vitest';

describe('VoiceLogger Component', () => {
  it('should be importable without errors', async () => {
    const module = await import('./VoiceLogger');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});