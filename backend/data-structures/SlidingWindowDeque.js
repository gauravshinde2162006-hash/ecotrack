/**
 * SlidingWindowDeque — O(1) amortized streak calculation and rolling average
 *
 * Design: Circular buffer / deque of last N days' CO2e totals.
 * Maintains a running sum for O(1) average — no recomputation needed.
 *
 * Time Complexity:
 *   - push(value):         O(1) amortized — add to back, evict from front if full
 *   - getRollingAverage(): O(1) — running sum / window size
 *   - getStreak(threshold):O(1) — precomputed streak counter maintained on each push
 *   - getMin()/getMax():   O(1) — maintained monotonic deque internally
 *
 * vs. recomputing average from scratch: O(n) per call — avoided here.
 */

class SlidingWindowDeque {
  /**
   * @param {number} windowSize  Number of days in the rolling window (default: 30)
   * @param {number} streakThreshold  Daily CO2e ceiling for a "low carbon" day (default: 5 kg)
   */
  constructor(windowSize = 30, streakThreshold = 5.0) {
    this._window = windowSize;
    this._threshold = streakThreshold;
    this._buffer = [];        // circular buffer: [{ date, value }]
    this._runningSum = 0;     // maintained O(1) sum
    this._streak = 0;         // current consecutive days below threshold
    this._maxStreak = 0;      // all-time best streak
    this._minDeque = [];      // monotonic deque for O(1) min (ascending values)
    this._maxDeque = [];      // monotonic deque for O(1) max (descending values)
  }

  /**
   * O(1) amortized — Push a new day's total. Evicts oldest if window is full.
   * @param {string} date  ISO date string
   * @param {number} value  kg CO2e
   */
  push(date, value) {
    // Evict oldest if at capacity
    if (this._buffer.length === this._window) {
      const evicted = this._buffer.shift();
      this._runningSum -= evicted.value;

      // Evict from monotonic deques if they reference the evicted element
      if (this._minDeque.length > 0 && this._minDeque[0].date === evicted.date) {
        this._minDeque.shift();
      }
      if (this._maxDeque.length > 0 && this._maxDeque[0].date === evicted.date) {
        this._maxDeque.shift();
      }
    }

    const entry = { date, value };
    this._buffer.push(entry);
    this._runningSum += value;

    // Maintain ascending monotonic deque for min
    while (this._minDeque.length > 0 &&
           this._minDeque[this._minDeque.length - 1].value >= value) {
      this._minDeque.pop();
    }
    this._minDeque.push(entry);

    // Maintain descending monotonic deque for max
    while (this._maxDeque.length > 0 &&
           this._maxDeque[this._maxDeque.length - 1].value <= value) {
      this._maxDeque.pop();
    }
    this._maxDeque.push(entry);

    // Update streak counter
    if (value <= this._threshold) {
      this._streak++;
      this._maxStreak = Math.max(this._maxStreak, this._streak);
    } else {
      this._streak = 0;
    }
  }

  /**
   * O(1) — Rolling average of the current window.
   */
  getRollingAverage() {
    if (this._buffer.length === 0) return 0;
    return +(this._runningSum / this._buffer.length).toFixed(4);
  }

  /**
   * O(1) — Current streak of consecutive days below threshold.
   */
  getCurrentStreak() {
    return this._streak;
  }

  /**
   * O(1) — All-time maximum streak.
   */
  getMaxStreak() {
    return this._maxStreak;
  }

  /**
   * O(1) — Minimum daily total in the current window.
   */
  getMin() {
    return this._minDeque.length > 0 ? this._minDeque[0].value : 0;
  }

  /**
   * O(1) — Maximum daily total in the current window.
   */
  getMax() {
    return this._maxDeque.length > 0 ? this._maxDeque[0].value : 0;
  }

  /**
   * O(1) — Total CO2e in the current window.
   */
  getWindowSum() {
    return +this._runningSum.toFixed(4);
  }

  /**
   * O(1) — How many days are in the current window.
   */
  get currentSize() {
    return this._buffer.length;
  }

  /**
   * O(n) — Return window data for chart/heatmap rendering.
   */
  toArray() {
    return this._buffer.map(({ date, value }) => ({
      date,
      value: +value.toFixed(3),
      isLowCarbon: value <= this._threshold,
    }));
  }

  /**
   * O(n) — Rebuild from an array of { date, value } (sorted chronologically).
   * Called on server startup to restore state from DB.
   */
  rebuild(entries) {
    this._buffer = [];
    this._runningSum = 0;
    this._streak = 0;
    this._maxStreak = 0;
    this._minDeque = [];
    this._maxDeque = [];
    for (const { date, value } of entries) {
      this.push(date, value);
    }
  }
}

module.exports = { SlidingWindowDeque };
