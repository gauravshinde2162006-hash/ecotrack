const express = require('express');
const { getDb } = require('../db/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get global leaderboard based on average daily footprint over the last 30 days
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    // SQLite raw query to calculate the average carbon footprint per user for the last 30 days
    const leaderboard = await db.raw(`
      SELECT 
        u.id, 
        u.name, 
        u.avatar_url, 
        u.achievements,
        u.daily_goal,
        ROUND(AVG(l.total_co2e), 2) as avg_co2e,
        COUNT(l.id) as days_logged
      FROM users u
      JOIN daily_logs l ON u.id = l.user_id
      WHERE l.date >= date('now', '-30 days')
      GROUP BY u.id
      ORDER BY avg_co2e ASC
      LIMIT 100
    `);

    res.json(leaderboard);
  } catch (err) {
    console.error('[Social] Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
