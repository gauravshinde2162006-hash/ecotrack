// Frontend emission factors — mirrors backend EmissionHashMap for O(1) live preview
// Avoids API roundtrip for real-time CO2e display as user types

export const emissionFactors: Record<string, number> = {
  'transport:car_petrol':    0.192,
  'transport:car_diesel':    0.171,
  'transport:bus':           0.105,
  'transport:train':         0.041,
  'transport:bike':          0.000,
  'transport:walk':          0.000,
  'transport:flight_short':  0.255,
  'transport:motorcycle':    0.114,
  'diet:vegan':              2.5,
  'diet:vegetarian':         3.8,
  'diet:non_vegetarian':     7.2,
  'electricity:india_grid':  0.82,
  'electricity:solar':       0.041,
  'electricity:wind':        0.011,
  'lpg:cylinder':            42.5,
  'waste:landfill':          0.5,
  'waste:recycled':          0.1,
  'water:tap':               0.000344,
};

/** O(1) lookup — same complexity as backend HashMap */
export function getFactor(category: string, subtype: string): number {
  return emissionFactors[`${category}:${subtype}`] ?? 0;
}

export function computeCO2e(category: string, subtype: string, quantity: number): number {
  return +(getFactor(category, subtype) * quantity).toFixed(4);
}
