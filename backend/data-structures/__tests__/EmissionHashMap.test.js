const { emissionHashMap } = require('../EmissionHashMap');

describe('EmissionHashMap', () => {
  it('should initialize successfully', () => {
    expect(emissionHashMap).toBeDefined();
  });

  it('should compute CO2e for transport correctly', () => {
    // 10 km car ride
    const co2e = emissionHashMap.computeCO2e('transport', 'car_petrol', 10);
    expect(co2e).toBeCloseTo(1.92, 2);
  });

  it('should compute CO2e for electricity correctly', () => {
    const co2e = emissionHashMap.computeCO2e('electricity', 'india_grid', 5);
    expect(co2e).toBeCloseTo(4.1, 2); // 5 * 0.82
  });

  it('should return 0 for unknown keys', () => {
    const co2e = emissionHashMap.computeCO2e('unknown_cat', 'unknown_sub', 10);
    expect(co2e).toBe(0);
  });
});
