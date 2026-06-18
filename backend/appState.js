/**
 * AppState — singleton holding all in-memory data structures.
 * All DB calls now use async Knex API.
 */

const { emissionHashMap } = require('./data-structures/EmissionHashMap');
const { PrefixSumArray }  = require('./data-structures/PrefixSumArray');
const { MaxHeap }         = require('./data-structures/MaxHeap');
const { SlidingWindowDeque } = require('./data-structures/SlidingWindowDeque');
const { TimeIndexedMap }  = require('./data-structures/TimeIndexedMap');
const { getDb }           = require('./db/db');

class AppState {
  constructor() {
    this.emissionMap  = emissionHashMap;
    this.prefixSum    = new PrefixSumArray();
    this.maxHeap      = new MaxHeap();
    this.slidingWindow = new SlidingWindowDeque(30, 5.0);
    this.timeIndexMap = new TimeIndexedMap();
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;
    const db = getDb();

    const entries = await db('log_entries as le')
      .join('daily_logs as dl', 'le.log_id', 'dl.id')
      .where('dl.user_id', 1)
      .orderBy('dl.date', 'asc')
      .select('dl.date', 'le.category', 'le.subtype', 'le.co2e', 'le.quantity');

    const dailyTotals = await db('daily_logs')
      .where('user_id', 1)
      .orderBy('date', 'asc')
      .select('date', 'total_co2e as total');

    this.timeIndexMap.loadFromDB(entries);
    this.prefixSum.build(dailyTotals);

    const last30 = dailyTotals.slice(-30);
    this.slidingWindow.rebuild(last30.map(d => ({ date: d.date, value: d.total })));

    const categoryTotals = {};
    for (const e of entries) {
      categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.co2e;
    }
    this.maxHeap.build(
      Object.entries(categoryTotals).map(([category, value]) => ({ category, value: +value.toFixed(4) }))
    );

    this._initialized = true;
    console.log(`[AppState] Initialized: ${dailyTotals.length} days, ${entries.length} entries`);
    console.log(`[AppState] Top emission: ${JSON.stringify(this.maxHeap.peekMax())}`);
    console.log(`[AppState] Total CO2e: ${this.prefixSum.getTotal().toFixed(2)} kg`);
    console.log(`[AppState] Streak: ${this.slidingWindow.getCurrentStreak()} days`);
  }

  onLogUpdated(date, dayTotal, categoryBreakdown) {
    this.prefixSum.update(date, dayTotal);
    this.slidingWindow.push(date, dayTotal);
    for (const [category, co2e] of Object.entries(categoryBreakdown)) {
      const existing = this.maxHeap._indexMap.has(category)
        ? this.maxHeap._heap[this.maxHeap._indexMap.get(category)].value
        : 0;
      this.maxHeap.updateCategory(category, existing + co2e);
    }
  }

  async getDashboardStats(userId = 1) {
    const db = getDb();
    const user = await db('users').where('id', userId).first();
    const goal = user?.daily_goal ?? 5.0;

    const today         = new Date().toISOString().split('T')[0];
    const sevenDaysAgo  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    return {
      totalCO2e:       this.prefixSum.getTotal(),
      last7DaysCO2e:   this.prefixSum.rangeQuery(sevenDaysAgo, today),
      last30DaysCO2e:  this.prefixSum.rangeQuery(thirtyDaysAgo, today),
      todayCO2e:       this.prefixSum.getDayTotal(today),
      rollingAverage:  this.slidingWindow.getRollingAverage(),
      currentStreak:   this.slidingWindow.getCurrentStreak(),
      maxStreak:       this.slidingWindow.getMaxStreak(),
      topEmissionCategory: this.maxHeap.peekMax(),
      treeEquivalent:  +(this.prefixSum.getTotal() / 21).toFixed(2),
      dailyGoal:       goal,
      goalProgress:    goal > 0 ? +((this.slidingWindow.getRollingAverage() / goal) * 100).toFixed(1) : 0,
    };
  }
}

const appState = new AppState();
module.exports = { appState };
