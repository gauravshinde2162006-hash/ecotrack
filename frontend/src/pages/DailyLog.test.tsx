import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the API module
vi.mock('../api', () => ({
  fetchDailyLog: vi.fn().mockResolvedValue({ entries: [], totalCO2e: 0 }),
  logEntry: vi.fn().mockResolvedValue({ co2e: 1.5 }),
  deleteEntry: vi.fn().mockResolvedValue({ success: true }),
  fetchEmissionFactors: vi.fn().mockResolvedValue({ factors: {} }),
}));

// We need to mock the VoiceLogger since it uses browser APIs
vi.mock('../components/VoiceLogger', () => ({
  default: () => <button aria-label="Voice log">🎤</button>,
}));

describe('DailyLog Page', () => {
  it('should be importable without errors', async () => {
    const module = await import('./DailyLog');
    expect(module.default).toBeDefined();
  });

  it('should export a default component', async () => {
    const { default: DailyLog } = await import('./DailyLog');
    expect(typeof DailyLog).toBe('function');
  });
});