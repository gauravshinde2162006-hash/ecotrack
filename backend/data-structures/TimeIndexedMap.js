/**
 * TimeIndexedMap — O(1) date-keyed access to daily logs with category aggregation
 *
 * Design: Outer Map<dateString → DailyLog>. Each DailyLog contains:
 *   - entries: Map<category → CO2e>  (O(1) category upsert and lookup)
 *   - total: number                  (maintained running total)
 *   - timestamp: ISO string
 *
 * Time Complexity:
 *   - getDay(date):            O(1)
 *   - upsertEntry(date, cat):  O(1)
 *   - getCategoryTotal(cat):   O(days) — iterate all days for a category (acceptable; n ≤ 365)
 *   - getDayTotal(date):       O(1) — pre-aggregated per day
 *
 * vs. loading and aggregating from DB on every request: O(n*m) — avoided here.
 */

class TimeIndexedMap {
  constructor() {
    // Outer: date string → DailyLog object
    this._map = new Map();
  }

  /**
   * O(1) — Get the DailyLog for a specific date, or null.
   */
  getDay(date) {
    return this._map.get(date) ?? null;
  }

  /**
   * O(1) — Check if a date has been logged.
   */
  hasDay(date) {
    return this._map.has(date);
  }

  /**
   * O(1) — Upsert a category entry for a given date.
   * Creates the DailyLog if it doesn't exist.
   * @param {string} date       ISO date string "YYYY-MM-DD"
   * @param {string} category   e.g. "transport", "diet"
   * @param {string} subtype    e.g. "car_petrol", "vegan"
   * @param {number} co2e       kg CO2e for this entry
   * @param {number} quantity   raw quantity (km, kWh, etc.)
   */
  upsertEntry(date, category, subtype, co2e, quantity = 0) {
    if (!this._map.has(date)) {
      this._map.set(date, {
        date,
        entries: new Map(), // category:subtype → { co2e, quantity }
        categoryTotals: new Map(), // category → total CO2e
        total: 0,
        updatedAt: new Date().toISOString(),
      });
    }
    const log = this._map.get(date);
    const entryKey = `${category}:${subtype}`;
    const existing = log.entries.get(entryKey);

    // Update running total — O(1)
    if (existing) {
      log.total -= existing.co2e;
      const catTotal = log.categoryTotals.get(category) ?? 0;
      log.categoryTotals.set(category, catTotal - existing.co2e);
    }

    log.entries.set(entryKey, { category, subtype, co2e, quantity });
    log.total = +(log.total + co2e).toFixed(4);

    const prevCatTotal = log.categoryTotals.get(category) ?? 0;
    log.categoryTotals.set(category, +(prevCatTotal + co2e).toFixed(4));
    log.updatedAt = new Date().toISOString();
  }

  /**
   * O(1) — Get total CO2e for a specific date.
   */
  getDayTotal(date) {
    return this._map.get(date)?.total ?? 0;
  }

  /**
   * O(1) — Get category breakdown for a specific date.
   * Returns: { transport: 2.3, diet: 7.2, ... }
   */
  getDayCategoryBreakdown(date) {
    const log = this._map.get(date);
    if (!log) return {};
    return Object.fromEntries(log.categoryTotals);
  }

  /**
   * O(n) where n = number of logged days — Aggregate all CO2e by category across date range.
   * Used for pie chart data.
   */
  aggregateByCategory(fromDate, toDate) {
    const totals = new Map();
    for (const [date, log] of this._map) {
      if (date < fromDate || date > toDate) continue;
      for (const [cat, val] of log.categoryTotals) {
        totals.set(cat, +(( totals.get(cat) ?? 0 ) + val).toFixed(4));
      }
    }
    return Object.fromEntries(totals);
  }

  /**
   * O(n) — Get all { date, total } pairs sorted chronologically.
   * Used to feed PrefixSumArray.build().
   */
  toSortedDailyTotals() {
    return [...this._map.values()]
      .map(({ date, total }) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * O(n) — Load from DB records into the map.
   * @param {Array<{ date, category, subtype, co2e, quantity }>} records
   */
  loadFromDB(records) {
    this._map.clear();
    for (const { date, category, subtype, co2e, quantity } of records) {
      this.upsertEntry(date, category, subtype, co2e, quantity);
    }
  }

  /**
   * O(1) — Delete a specific date's log (e.g., on correction).
   */
  deleteDay(date) {
    this._map.delete(date);
  }

  /**
   * O(1) — Total number of logged days.
   */
  get size() { return this._map.size; }

  /**
   * O(n) — Return all dates logged.
   */
  getDates() {
    return [...this._map.keys()].sort();
  }
}

module.exports = { TimeIndexedMap };
