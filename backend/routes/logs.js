/**
 * Logs routes — async Knex version
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { appState } = require('../appState');
const { emissionHashMap } = require('../data-structures/EmissionHashMap');
const { evaluateBadges } = require('../services/badgeService');
const { authenticateToken } = require('../middleware/auth');

// Apply auth middleware to all routes except public ones if needed.
// For now, apply to all log routes.
router.use(authenticateToken);

// GET /api/logs/factors
router.get('/factors', (req, res) => {
  res.json({ factors: emissionHashMap.toJSON() });
});

// GET /api/logs/today/status
router.get('/today/status', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayTotal = appState.prefixSum.getDayTotal(today);
  const hasLogged = appState.timeIndexMap.hasDay(today);
  res.json({ date: today, hasLogged, todayCO2e: todayTotal });
});

// GET /api/logs/range
router.get('/range', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required (YYYY-MM-DD)' });
  const total = appState.prefixSum.rangeQuery(from, to);
  const breakdown = appState.timeIndexMap.aggregateByCategory(from, to);
  res.json({ from, to, totalCO2e: total, breakdown });
});

// GET /api/logs/chart
router.get('/chart', (req, res) => {
  res.json({ data: appState.prefixSum.toChartData() });
});

// GET /api/logs?date=
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const db = getDb();
    const log = await db('daily_logs').where({ user_id: req.user.id, date }).first();
    if (!log) return res.json({ date, entries: [], totalCO2e: 0 });

    const entries = await db('log_entries').where('log_id', log.id);
    res.json({
      ...log,
      entries,
      categoryBreakdown: appState.timeIndexMap.getDayCategoryBreakdown(date),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/logs
router.post('/', async (req, res) => {
  try {
    const { date, category, subtype, quantity, notes } = req.body;
    if (!date || !category || !subtype || quantity === undefined) {
      return res.status(400).json({ error: 'date, category, subtype, quantity required' });
    }

    const co2e = emissionHashMap.computeCO2e(category, subtype, quantity);
    const db = getDb();

    // Upsert daily log header
    await db('daily_logs')
      .insert({ user_id: req.user.id, date, total_co2e: 0 })
      .onConflict(['user_id', 'date']).ignore();

    const log = await db('daily_logs').where({ user_id: req.user.id, date }).first();
    const logId = log.id;

    await db('log_entries').insert({ log_id: logId, category, subtype, quantity, co2e, notes: notes ?? null });

    const [{ total }] = await db('log_entries').where('log_id', logId).sum('co2e as total');
    const dayTotal = +total.toFixed(4);
    await db('daily_logs').where('id', logId).update({ total_co2e: dayTotal });

    appState.timeIndexMap.upsertEntry(date, category, subtype, co2e, quantity);
    const newBreakdown = appState.timeIndexMap.getDayCategoryBreakdown(date);
    appState.onLogUpdated(date, dayTotal, newBreakdown);

    // Threshold check — non-blocking
    const avg = appState.slidingWindow.getRollingAverage();
    if (dayTotal > avg * 1.2 && avg > 0) {
      triggerThresholdAlert(req.user.id, dayTotal, avg, category).catch(console.warn);
    }

    // Gamification: Evaluate and award badges asynchronously
    evaluateBadges(req.user.id).catch(err => console.error('[Badges] Evaluation failed:', err));

    res.status(201).json({ date, logId, co2e, dayTotal, category, subtype, quantity });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/logs/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const entry = await db('log_entries').where('id', req.params.id).first();
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await db('log_entries').where('id', req.params.id).del();

    const log = await db('daily_logs').where('id', entry.log_id).first();
    const [{ total }] = await db('log_entries').where('log_id', entry.log_id).sum('co2e as total');
    const newTotal = +(total ?? 0).toFixed(4);
    await db('daily_logs').where('id', entry.log_id).update({ total_co2e: newTotal });

    // Rebuild date in time-indexed map
    const remaining = await db('log_entries').where('log_id', entry.log_id);
    appState.timeIndexMap.deleteDay(log.date);
    for (const e of remaining) {
      appState.timeIndexMap.upsertEntry(log.date, e.category, e.subtype, e.co2e, e.quantity);
    }
    appState.prefixSum.update(log.date, newTotal);

    res.json({ success: true, newDayTotal: newTotal });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function triggerThresholdAlert(userId, daily, average, category) {
  try {
    const axios = require('axios');
    const webhookUrl = process.env.N8N_THRESHOLD_WEBHOOK;
    if (!webhookUrl) return;
    await axios.post(webhookUrl, { userId, daily, average, category, timestamp: new Date().toISOString() });
  } catch (e) {
    console.warn('[Webhook] Threshold alert failed:', e.message);
  }
}

module.exports = router;
