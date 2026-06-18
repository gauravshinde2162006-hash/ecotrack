const { EmissionHashMap, emissionHashMap } = require('../EmissionHashMap');

describe('EmissionHashMap', () => {
  describe('constructor', () => {
    it('should create a singleton instance', () => {
      expect(emissionHashMap).toBeDefined();
      expect(emissionHashMap).toBeInstanceOf(EmissionHashMap);
    });

    it('should initialize with known emission factors', () => {
      expect(emissionHashMap.getFactor('transport', 'car_petrol')).toBe(0.192);
      expect(emissionHashMap.getFactor('transport', 'train')).toBe(0.041);
      expect(emissionHashMap.getFactor('diet', 'vegan')).toBe(2.5);
      expect(emissionHashMap.getFactor('electricity', 'india_grid')).toBe(0.82);
      expect(emissionHashMap.getFactor('lpg', 'cylinder')).toBe(42.5);
    });
  });

  describe('getFactor', () => {
    it('should return correct factor for known categories', () => {
      expect(emissionHashMap.getFactor('transport', 'bus')).toBe(0.105);
      expect(emissionHashMap.getFactor('transport', 'bike')).toBe(0);
      expect(emissionHashMap.getFactor('waste', 'landfill')).toBe(0.5);
      expect(emissionHashMap.getFactor('water', 'tap')).toBe(0.000344);
    });

    it('should return 0 for unknown category', () => {
      expect(emissionHashMap.getFactor('unknown', 'xyz')).toBe(0);
    });

    it('should return 0 for unknown subtype', () => {
      expect(emissionHashMap.getFactor('transport', 'helicopter')).toBe(0);
    });
  });

  describe('getFactorByKey', () => {
    it('should look up by compound key', () => {
      expect(emissionHashMap.getFactorByKey('transport:car_petrol')).toBe(0.192);
      expect(emissionHashMap.getFactorByKey('diet:vegetarian')).toBe(3.8);
    });

    it('should return 0 for unknown key', () => {
      expect(emissionHashMap.getFactorByKey('fake:key')).toBe(0);
    });
  });

  describe('setFactor', () => {
    it('should set a new factor and retrieve it', () => {
      const instance = new EmissionHashMap();
      instance.setFactor('custom', 'test', 99.9);
      expect(instance.getFactor('custom', 'test')).toBe(99.9);
    });

    it('should override an existing factor', () => {
      const instance = new EmissionHashMap();
      instance.setFactor('transport', 'car_petrol', 0.25);
      expect(instance.getFactor('transport', 'car_petrol')).toBe(0.25);
    });
  });

  describe('computeCO2e', () => {
    it('should compute CO2e for a 10km car petrol trip', () => {
      expect(emissionHashMap.computeCO2e('transport', 'car_petrol', 10)).toBeCloseTo(1.92, 2);
    });

    it('should compute CO2e for 5 kWh India grid electricity', () => {
      expect(emissionHashMap.computeCO2e('electricity', 'india_grid', 5)).toBeCloseTo(4.1, 2);
    });

    it('should return 0 for zero quantity', () => {
      expect(emissionHashMap.computeCO2e('transport', 'car_petrol', 0)).toBe(0);
    });

    it('should return 0 for unknown category', () => {
      expect(emissionHashMap.computeCO2e('unknown', 'xyz', 100)).toBe(0);
    });

    it('should compute correctly for a full LPG cylinder', () => {
      expect(emissionHashMap.computeCO2e('lpg', 'cylinder', 1)).toBe(42.5);
    });

    it('should compute correctly for bike (zero emission)', () => {
      expect(emissionHashMap.computeCO2e('transport', 'bike', 100)).toBe(0);
    });
  });

  describe('allTransportComparison', () => {
    it('should return array sorted by CO2e ascending', () => {
      const results = emissionHashMap.allTransportComparison(100);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].co2e).toBeGreaterThanOrEqual(results[i - 1].co2e);
      }
    });

    it('should include bike and walk at 0 CO2e', () => {
      const results = emissionHashMap.allTransportComparison(50);
      const bikeEntry = results.find(r => r.mode === 'bike');
      const walkEntry = results.find(r => r.mode === 'walk');
      expect(bikeEntry.co2e).toBe(0);
      expect(walkEntry.co2e).toBe(0);
    });

    it('should scale with distance', () => {
      const results10 = emissionHashMap.allTransportComparison(10);
      const results100 = emissionHashMap.allTransportComparison(100);
      const car10 = results10.find(r => r.mode === 'car_petrol');
      const car100 = results100.find(r => r.mode === 'car_petrol');
      expect(car100.co2e).toBeCloseTo(car10.co2e * 10, 1);
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all factors', () => {
      const json = emissionHashMap.toJSON();
      expect(typeof json).toBe('object');
      expect(json['transport:car_petrol']).toBe(0.192);
      expect(json['diet:vegan']).toBe(2.5);
    });

    it('should contain all expected keys', () => {
      const json = emissionHashMap.toJSON();
      const keys = Object.keys(json);
      expect(keys.length).toBeGreaterThanOrEqual(15);
      expect(keys).toContain('transport:car_petrol');
      expect(keys).toContain('diet:vegetarian');
      expect(keys).toContain('electricity:india_grid');
    });
  });
});
