/**
 * Webhooks — async Knex version
 */

const express = require('express');
const router = express.Router();
const { appState } = require('../appState');
const { getDb } = require('../db/db');
const { generateInsight, buildWeeklyPayload } = require('../services/claudeService');

router.post('/threshold', async (req, res) => {
  try {
    const { userId = 1, daily, average, category } = req.body;
    const db = getDb();
    const logs = await db('daily_logs').where('user_id', userId).orderBy('date', 'desc').limit(7).select('date', 'total_co2e');
    const first = logs[logs.length - 1]?.date ?? '';
    const last  = logs[0]?.date ?? '';
    const breakdown = appState.timeIndexMap.aggregateByCategory(first, last);
    const user = await db('users').where('id', userId).first();
    const goal = user?.daily_goal ?? 5.0;
    const payload = buildWeeklyPayload(logs, breakdown, goal, appState.slidingWindow.getCurrentStreak());
    payload.alertContext = { daily, average, triggeredCategory: category };
    const insight = await generateInsight(userId, payload, 'threshold_alert');
    res.json({ triggered: true, userId, daily, average, insight: insight.insight, suggestions: insight.suggestions?.slice(0, 2) ?? [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/daily-check', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const hasLogged = appState.timeIndexMap.hasDay(today);
  const todayTotal = appState.prefixSum.getDayTotal(today);
  res.json({ date: today, hasLogged, todayCO2e: todayTotal, needsReminder: !hasLogged });
});

router.get('/weekly-summary', async (req, res) => {
  try {
    const toDate   = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const weekTotal = appState.prefixSum.rangeQuery(fromDate, toDate);
    const breakdown = appState.timeIndexMap.aggregateByCategory(fromDate, toDate);
    const stats = await appState.getDashboardStats(1);
    res.json({
      from: fromDate, to: toDate, weekTotal, breakdown,
      stats: {
        streak: stats.currentStreak,
        avg: stats.rollingAverage,
        goal: stats.dailyGoal,
        trees: stats.treeEquivalent,
        topCategory: stats.topEmissionCategory,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
