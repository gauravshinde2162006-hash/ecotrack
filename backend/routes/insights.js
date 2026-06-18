/**
 * AI Insights route — weekly analysis + agentic multi-step agent
 */

const express = require('express');
const router = express.Router();
const { generateInsight, buildWeeklyPayload } = require('../services/claudeService');
const { runAgentLoop } = require('../services/agentService');
const { appState } = require('../appState');
const { getDb } = require('../db/db');

// POST /api/insights/agent — Agentic AI with tool calling (SSE stream)
router.post('/agent', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY not configured' });
  }

  // Set SSE headers so client receives a streamed event feed
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
  await runAgentLoop(message, res, baseUrl);
});

router.get('/ai', async (req, res) => {
  try {
    const userId = 1;
    const days = parseInt(req.query.days) || 7;
    const toDate   = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const db = getDb();
    const logs = await db('daily_logs')
      .where('user_id', userId)
      .whereBetween('date', [fromDate, toDate])
      .orderBy('date', 'asc')
      .select('date', 'total_co2e');

    const breakdown = appState.timeIndexMap.aggregateByCategory(fromDate, toDate);
    const user = await db('users').where('id', userId).first();
    const goal = user?.daily_goal ?? 5.0;
    const streak = appState.slidingWindow.getCurrentStreak();

    const weeklyPayload = buildWeeklyPayload(logs.map(l => ({ ...l, total_co2e: l.total_co2e })), breakdown, goal, streak);
    const insight = await generateInsight(userId, weeklyPayload, 'weekly');
    res.json(insight);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });
    const stats = await appState.getDashboardStats(1);
    const payload = {
      question,
      context: {
        totalCO2e: stats.totalCO2e,
        rollingAverage: stats.rollingAverage,
        topCategory: stats.topEmissionCategory,
        streak: stats.currentStreak,
        goal: stats.dailyGoal,
      },
      period: 'current',
      categoryBreakdown: [],
    };
    const result = await generateInsight(1, payload, 'chat');
    res.json({ answer: result.insight, suggestions: result.suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
