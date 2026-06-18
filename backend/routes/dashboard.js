/**
 * Dashboard route — async Knex version
 */

const express = require('express');
const router = express.Router();
const { appState } = require('../appState');
const { getDb } = require('../db/db');

router.get('/', async (req, res) => {
  try {
    const stats = await appState.getDashboardStats(1);
    const windowData = appState.slidingWindow.toArray();
    res.json({
      ...stats,
      windowData,
      topCategories: appState.maxHeap.getSorted().slice(0, 5),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pie', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const toDate   = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const breakdown = appState.timeIndexMap.aggregateByCategory(fromDate, toDate);
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    const pieData = Object.entries(breakdown)
      .map(([category, value]) => ({
        category,
        value: +value.toFixed(3),
        percentage: total > 0 ? +((value / total) * 100).toFixed(1) : 0,
        color: CATEGORY_COLORS[category] ?? '#64748b',
        icon: CATEGORY_ICONS[category] ?? '📊',
      }))
      .sort((a, b) => b.value - a.value);
    res.json({ from: fromDate, to: toDate, total: +total.toFixed(3), breakdown: pieData });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/trend', async (req, res) => {
  try {
    const chartData = appState.prefixSum.toChartData();
    const db = getDb();
    const user = await db('users').where('id', 1).first();
    const goal = user?.daily_goal ?? 5.0;
    res.json({
      data: chartData.map(d => ({ ...d, goal })),
      summary: {
        min: appState.slidingWindow.getMin(),
        max: appState.slidingWindow.getMax(),
        avg: appState.slidingWindow.getRollingAverage(),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const CATEGORY_COLORS = {
  transport:   '#f97316',
  diet:        '#10b981',
  electricity: '#3b82f6',
  lpg:         '#f59e0b',
  waste:       '#8b5cf6',
  water:       '#06b6d4',
};
const CATEGORY_ICONS = {
  transport:   '🚗',
  diet:        '🍽️',
  electricity: '⚡',
  lpg:         '🔥',
  waste:       '🗑️',
  water:       '💧',
};

module.exports = router;
