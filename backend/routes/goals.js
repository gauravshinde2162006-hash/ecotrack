/**
 * Goals & Streaks route — async Knex version
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { appState } = require('../appState');

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const user = await db('users').where('id', 1).first();
    const goal = user?.daily_goal ?? 5.0;
    const avg    = appState.slidingWindow.getRollingAverage();
    const streak = appState.slidingWindow.getCurrentStreak();
    const maxStreak = appState.slidingWindow.getMaxStreak();
    const windowData = appState.slidingWindow.toArray();
    res.json({
      dailyGoal: goal,
      rollingAverage: avg,
      currentStreak: streak,
      maxStreak,
      progressPct: goal > 0 ? +((avg / goal) * 100).toFixed(1) : 0,
      onTrack: avg <= goal,
      deficit: +(avg - goal).toFixed(3),
      windowData,
      min: appState.slidingWindow.getMin(),
      max: appState.slidingWindow.getMax(),
      avg,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { dailyGoal } = req.body;
    if (!dailyGoal || isNaN(dailyGoal) || dailyGoal <= 0) {
      return res.status(400).json({ error: 'dailyGoal must be a positive number' });
    }
    const db = getDb();
    await db('users').where('id', 1).update({ daily_goal: parseFloat(dailyGoal) });
    await db('goals').insert({
      user_id: 1,
      daily_target: parseFloat(dailyGoal),
      start_date: new Date().toISOString().split('T')[0],
      is_active: 1,
    });
    res.json({ success: true, dailyGoal: parseFloat(dailyGoal) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/streak', async (req, res) => {
  try {
    const db = getDb();
    const user = await db('users').where('id', 1).first();
    const goal = user?.daily_goal ?? 5.0;
    const windowData = appState.slidingWindow.toArray();
    const streaks = [];
    let current = 0;
    for (const day of windowData) {
      if (day.value <= goal) { current++; streaks.push({ ...day, streakDay: current, isLowCarbon: true }); }
      else { current = 0; streaks.push({ ...day, streakDay: 0, isLowCarbon: false }); }
    }
    res.json({
      currentStreak: appState.slidingWindow.getCurrentStreak(),
      maxStreak: appState.slidingWindow.getMaxStreak(),
      goal,
      windowData: streaks,
      min: appState.slidingWindow.getMin(),
      max: appState.slidingWindow.getMax(),
      avg: appState.slidingWindow.getRollingAverage(),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
