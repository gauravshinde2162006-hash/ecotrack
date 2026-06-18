const { getDb } = require('../db/db');

const BADGES = {
  FIRST_LOG: { id: 'first_log', name: 'First Log', icon: '🌱' },
  STREAK_7: { id: 'streak_7', name: '1-Week Streak', icon: '🔥' },
  ECO_COMMUTER: { id: 'eco_commuter', name: 'Eco Commuter', icon: '🚲' }, // 10+ km public/walk
};

async function evaluateBadges(userId) {
  const db = getDb();
  const user = await db('users').where({ id: userId }).first();
  if (!user) return [];

  let achievements = [];
  try {
    achievements = typeof user.achievements === 'string' ? JSON.parse(user.achievements) : (user.achievements || []);
  } catch(e) {}

  const hasBadge = (id) => achievements.some(a => a.id === id);
  let newlyAwarded = [];

  // 1. Check First Log
  if (!hasBadge(BADGES.FIRST_LOG.id)) {
    const logCount = await db('daily_logs').where({ user_id: userId }).count('id as count').first();
    if (logCount.count > 0) newlyAwarded.push(BADGES.FIRST_LOG);
  }

  // 2. Check 7-Day Streak
  if (!hasBadge(BADGES.STREAK_7.id)) {
    const recentLogs = await db('daily_logs')
      .where({ user_id: userId })
      .andWhere('date', '>=', db.raw("date('now', '-7 days')"))
      .count('id as count')
      .first();
    
    if (recentLogs.count >= 7) newlyAwarded.push(BADGES.STREAK_7);
  }

  // 3. Check Eco Commuter
  if (!hasBadge(BADGES.ECO_COMMUTER.id)) {
    const commuterLogs = await db('log_entries')
      .join('daily_logs', 'log_entries.log_id', 'daily_logs.id')
      .where('daily_logs.user_id', userId)
      .andWhere('log_entries.category', 'transport')
      .andWhere(builder => {
        builder.where('log_entries.subtype', 'walking')
               .orWhere('log_entries.subtype', 'bus')
               .orWhere('log_entries.subtype', 'train');
      })
      .sum('log_entries.quantity as total_km')
      .first();

    if (commuterLogs.total_km >= 10) newlyAwarded.push(BADGES.ECO_COMMUTER);
  }

  // Save new badges if any
  if (newlyAwarded.length > 0) {
    const updatedAchievements = [...achievements, ...newlyAwarded];
    await db('users')
      .where({ id: userId })
      .update({ achievements: JSON.stringify(updatedAchievements) });
    return updatedAchievements;
  }

  return achievements;
}

module.exports = { evaluateBadges, BADGES };
