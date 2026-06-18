/**
 * EmissionHashMap — O(1) emission factor lookups
 *
 * Design: Uses a native JS Map (hash table) keyed by "category:subtype" compound key.
 * Time Complexity:
 *   - lookup: O(1) average — hash-based retrieval, no iteration
 *   - insert: O(1) average
 *   - vs. array scan: would be O(n) per lookup — avoided here
 */

class EmissionHashMap {
  constructor() {
    // Internal hash map: "category:subtype" → kg CO2e per unit
    // Units are described in comments next to each entry.
    this._map = new Map([
      // ── TRANSPORT (kg CO2e per km) ─────────────────────────────────────────
      ['transport:car_petrol',    0.192],   // per km
      ['transport:car_diesel',    0.171],   // per km
      ['transport:bus',           0.105],   // per km
      ['transport:train',         0.041],   // per km
      ['transport:bike',          0.000],   // per km (zero emission)
      ['transport:walk',          0.000],   // per km (zero emission)
      ['transport:flight_short',  0.255],   // per km (short-haul)
      ['transport:flight_long',   0.195],   // per km (long-haul, more efficient)
      ['transport:motorcycle',    0.114],   // per km

      // ── DIET (kg CO2e per day) ─────────────────────────────────────────────
      ['diet:vegan',              2.5],
      ['diet:vegetarian',         3.8],
      ['diet:non_vegetarian',     7.2],

      // ── ELECTRICITY (kg CO2e per kWh) ──────────────────────────────────────
      ['electricity:india_grid',  0.82],    // India national average
      ['electricity:solar',       0.041],   // solar PV lifecycle
      ['electricity:wind',        0.011],   // wind lifecycle

      // ── LPG (kg CO2e per cylinder) ─────────────────────────────────────────
      ['lpg:cylinder',            42.5],    // 14.2 kg cylinder × 2.983 kg CO2e/kg LPG

      // ── WASTE (kg CO2e per kg waste) ───────────────────────────────────────
      ['waste:landfill',          0.5],     // mixed municipal solid waste
      ['waste:recycled',          0.1],     // recycled/composted

      // ── WATER (kg CO2e per litre) ──────────────────────────────────────────
      ['water:tap',               0.000344],
    ]);
  }

  /**
   * O(1) — Get emission factor for a category+subtype pair.
   * @param {string} category  e.g. "transport"
   * @param {string} subtype   e.g. "car_petrol"
   * @returns {number} kg CO2e per unit, or 0 if unknown
   */
  getFactor(category, subtype) {
    const key = `${category}:${subtype}`;
    return this._map.get(key) ?? 0;
  }

  /**
   * O(1) — Direct lookup by compound key.
   * @param {string} key  e.g. "transport:car_petrol"
   */
  getFactorByKey(key) {
    return this._map.get(key) ?? 0;
  }

  /**
   * O(1) — Set or update a factor (supports runtime config overrides).
   */
  setFactor(category, subtype, value) {
    this._map.set(`${category}:${subtype}`, value);
  }

  /**
   * O(modes) — Compute CO2e for ALL transport modes in a single pass.
   * Returns array sorted by CO2e for direct comparison display.
   * @param {number} distanceKm
   * @returns {{ mode: string, factor: number, co2e: number }[]}
   */
  allTransportComparison(distanceKm) {
    const transportKeys = [
      'car_petrol', 'car_diesel', 'bus', 'train',
      'bike', 'walk', 'flight_short', 'motorcycle'
    ];
    // Single pass — O(modes), not O(modes × n)
    return transportKeys.map(mode => {
      const factor = this.getFactor('transport', mode);
      return { mode, factor, co2e: +(distanceKm * factor).toFixed(3) };
    }).sort((a, b) => a.co2e - b.co2e);
  }

  /**
   * O(1) — Compute CO2e for a log entry using the hashmap.
   * @param {string} category
   * @param {string} subtype
   * @param {number} quantity  units depend on category (km, kWh, cylinders, kg, litres)
   */
  computeCO2e(category, subtype, quantity) {
    const factor = this.getFactor(category, subtype);
    return +(factor * quantity).toFixed(4);
  }

  /**
   * O(k) where k = number of categories — return all factors as plain object (for API serialization).
   */
  toJSON() {
    return Object.fromEntries(this._map);
  }
}

// Singleton export — one instance shared across the app
const emissionHashMap = new EmissionHashMap();
module.exports = { EmissionHashMap, emissionHashMap };
