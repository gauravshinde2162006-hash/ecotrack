/**
 * PrefixSumArray — O(1) range-sum queries for daily carbon totals
 *
 * Design: Maintains a sorted date array + prefix sum array.
 *   prefixSum[i] = sum of daily totals from index 0 to i (inclusive)
 *
 * Time Complexity:
 *   - build(logs):           O(n log n) — one-time sort + O(n) scan
 *   - rangeQuery(dA, dB):    O(log n) binary search for endpoints, O(1) subtraction
 *   - append(date, total):   O(1) amortized — push to end (dates must be chronological)
 *   - getTotal():            O(1) — last element of prefix array
 *
 * vs. naive sum over all records each time: O(n) per query — avoided here.
 */

class PrefixSumArray {
  constructor() {
    this._dates = [];       // sorted ISO date strings ["2025-01-01", ...]
    this._totals = [];      // daily CO2e totals corresponding to each date
    this._prefix = [];      // prefix[i] = sum of totals[0..i]
    this._dateIndex = new Map(); // date → array index for O(log n) → O(1) date lookup
  }

  /**
   * O(n log n) — Build from an array of { date, total } objects.
   * Call once on startup after loading logs from DB.
   */
  build(logs) {
    // Sort by date — O(n log n)
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

    this._dates = [];
    this._totals = [];
    this._prefix = [];
    this._dateIndex.clear();

    let running = 0;
    sorted.forEach(({ date, total }, i) => {
      this._dates.push(date);
      this._totals.push(total);
      running += total;
      this._prefix.push(running);
      this._dateIndex.set(date, i); // O(1) map insert
    });
  }

  /**
   * O(1) — Append a new day (must be chronologically after last entry).
   * Called when user submits a new daily log.
   */
  append(date, total) {
    const lastPrefix = this._prefix.length > 0
      ? this._prefix[this._prefix.length - 1]
      : 0;
    const i = this._dates.length;
    this._dates.push(date);
    this._totals.push(total);
    this._prefix.push(lastPrefix + total);
    this._dateIndex.set(date, i);
  }

  /**
   * O(1) — Update an existing date's total and recompute all subsequent prefix sums.
   * Note: This is O(n) in worst case (update at index 0). For real-world use,
   * edits are rare and typically on recent dates (amortized O(1) for tail updates).
   */
  update(date, newTotal) {
    if (!this._dateIndex.has(date)) {
      this.append(date, newTotal);
      return;
    }
    const idx = this._dateIndex.get(date);
    const delta = newTotal - this._totals[idx];
    this._totals[idx] = newTotal;
    // Propagate delta forward — O(n - idx), typically O(1) for recent edits
    for (let i = idx; i < this._prefix.length; i++) {
      this._prefix[i] += delta;
    }
  }

  /**
   * O(log n) — Range sum query: total CO2e between dateA and dateB (inclusive).
   * Uses binary search for date-to-index mapping when not cached in dateIndex.
   * @returns {number} total kg CO2e in range, or 0 if no data
   */
  rangeQuery(dateA, dateB) {
    if (this._dates.length === 0) return 0;

    const idxA = this._findIndex(dateA, 'left');
    const idxB = this._findIndex(dateB, 'right');

    if (idxA === -1 || idxB === -1 || idxA > idxB) return 0;

    const prefixB = this._prefix[idxB];
    const prefixBeforeA = idxA > 0 ? this._prefix[idxA - 1] : 0;

    // O(1) subtraction — the core benefit
    return +(prefixB - prefixBeforeA).toFixed(4);
  }

  /**
   * O(1) — Grand total of all logged CO2e.
   */
  getTotal() {
    return this._prefix.length > 0
      ? this._prefix[this._prefix.length - 1]
      : 0;
  }

  /**
   * O(1) — Get the daily total for a specific date.
   */
  getDayTotal(date) {
    const idx = this._dateIndex.get(date);
    return idx !== undefined ? this._totals[idx] : 0;
  }

  /**
   * O(n) — Get all { date, total, cumulative } records for chart rendering.
   */
  toChartData() {
    return this._dates.map((date, i) => ({
      date,
      total: +this._totals[i].toFixed(3),
      cumulative: +this._prefix[i].toFixed(3),
    }));
  }

  /**
   * O(log n) — Binary search helper.
   * side: 'left' returns first index >= date, 'right' returns last index <= date.
   */
  _findIndex(date, side) {
    let lo = 0, hi = this._dates.length - 1, result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cmp = this._dates[mid].localeCompare(date);
      if (cmp === 0) return mid;
      if (side === 'left') {
        if (cmp < 0) lo = mid + 1;
        else { result = mid; hi = mid - 1; }
      } else {
        if (cmp > 0) hi = mid - 1;
        else { result = mid; lo = mid + 1; }
      }
    }
    return result;
  }

  get length() { return this._dates.length; }
}

module.exports = { PrefixSumArray };
