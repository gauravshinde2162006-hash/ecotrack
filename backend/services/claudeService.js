/**
 * Claude AI service — personalized sustainability coaching
 * Uses claude-sonnet-4-6 via Anthropic SDK
 *
 * Caching strategy:
 *   - 1 AI call per user per day (cached in SQLite ai_cache table + Redis)
 *   - Cache key: "ai:{userId}:{date}"
 *   - Prevents runaway API costs while keeping insights fresh
 */

const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const { getDb } = require('../db/db');
const { get, set } = require('./redisService');

let anthropic = null;

function getClient() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

/**
 * Build structured weekly data payload for the AI prompt.
 */
function buildWeeklyPayload(logs, categoryBreakdown, goal, streak) {
  const total = logs.reduce((s, l) => s + l.total_co2e, 0);
  const avg = logs.length > 0 ? total / logs.length : 0;

  // Rank categories by total
  const ranked = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, co2e]) => ({ category: cat, co2e: +co2e.toFixed(3) }));

  return {
    period: `Last ${logs.length} days`,
    totalCO2eKg: +total.toFixed(2),
    averageDailyKg: +avg.toFixed(2),
    dailyGoalKg: goal,
    currentStreakDays: streak,
    categoryBreakdown: ranked,
    worstDay: logs.reduce((m, l) => l.total_co2e > (m?.total_co2e ?? 0) ? l : m, null),
    bestDay: logs.reduce((m, l) => l.total_co2e < (m?.total_co2e ?? Infinity) ? l : m, null),
  };
}

/**
 * O(1) — Check DB cache for today's AI insight.
 */
async function getCachedInsight(userId, today, promptHash) {
  const db = getDb();
  const row = await db('ai_cache').where({ user_id: userId, cache_date: today, prompt_hash: promptHash }).first();
  return row?.response ? JSON.parse(row.response) : null;
}

/**
 * O(1) — Store AI insight in DB cache.
 */
async function cacheInsight(userId, today, promptHash, response) {
  const db = getDb();
  await db('ai_cache').insert({
    user_id: userId,
    cache_date: today,
    prompt_hash: promptHash,
    response: JSON.stringify(response),
  }).onConflict(['user_id', 'cache_date']).merge({ response: JSON.stringify(response), prompt_hash: promptHash });
}

/**
 * Generate or retrieve cached AI insights for a user.
 *
 * @param {number} userId
 * @param {object} weeklyData  Built by buildWeeklyPayload()
 * @param {string} insightType  "weekly" | "threshold_alert" | "onboarding"
 * @returns {Promise<{ insight: string, topCategories: [], suggestions: [], cached: boolean }>}
 */
async function generateInsight(userId, weeklyData, insightType = 'weekly') {
  const today = new Date().toISOString().split('T')[0];
  const payloadStr = JSON.stringify({ weeklyData, insightType });
  const promptHash = crypto.createHash('sha256').update(payloadStr).digest('hex').slice(0, 16);
  const redisKey = `ai:${userId}:${today}:${insightType}`;

  // 1. Check Redis cache first (O(1) network round-trip)
  const redisCached = await get(redisKey);
  if (redisCached) return { ...redisCached, cached: true };

  // 2. Check SQLite cache (O(1) indexed lookup)
  const dbCached = await getCachedInsight(userId, today, promptHash);
  if (dbCached) {
    await set(redisKey, dbCached, 86400); // Warm Redis from DB
    return { ...dbCached, cached: true };
  }

  // 3. No cache — call AI API (Groq or Claude)
  const useGroq = !!process.env.GROQ_API_KEY;
  const useClaude = !useGroq && !!process.env.ANTHROPIC_API_KEY;

  if (!useGroq && !useClaude) {
    return {
      insight: 'AI insights unavailable (Neither ANTHROPIC_API_KEY nor GROQ_API_KEY is configured). Please add your API key to .env.',
      topCategories: weeklyData.categoryBreakdown?.slice(0, 2) ?? [],
      suggestions: [],
      cached: false,
      error: 'API_KEY_MISSING',
    };
  }

  const systemPrompt = `You are EcoCoach — a warm, expert sustainability coach helping users reduce their carbon footprint. 
You speak directly and personally, avoid jargon, and give realistic, actionable advice.
Always respond with valid JSON in exactly this structure:
{
  "insight": "2-3 sentence personalized summary of the user's week",
  "topCategories": [
    { "category": "string", "co2eKg": number, "percentOfTotal": number }
  ],
  "suggestions": [
    { 
      "action": "Specific action to take",
      "estimatedSavingKg": number,
      "difficulty": "easy|medium|hard",
      "timeframe": "daily|weekly|monthly"
    }
  ],
  "positiveNote": "One encouraging sentence about what they did well"
}`;

  let userMessage;
  if (insightType === 'threshold_alert') {
    userMessage = `A user just had a high-emission day. Their data: ${JSON.stringify(weeklyData)}
Today they exceeded their average by 20%+. Give them 2 specific, immediate actions for tomorrow.`;
  } else {
    userMessage = `Analyze this user's carbon footprint data and provide personalized coaching:
${JSON.stringify(weeklyData, null, 2)}

Identify their top 2 emission categories and suggest 3 specific, realistic actions with estimated CO2e savings.`;
  }

  try {
    let rawText;
    if (useGroq) {
      const axios = require('axios');
      const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      rawText = response.data.choices[0].message.content;
    } else {
      const client = getClient();
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: userMessage }],
        system: systemPrompt,
      });
      rawText = message.content[0]?.text ?? '{}';
    }

    // Extract JSON from response (sometimes models wrap in markdown blocks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { insight: rawText, suggestions: [] };

    const result = {
      insight: parsed.insight ?? '',
      topCategories: parsed.topCategories ?? weeklyData.categoryBreakdown?.slice(0, 2) ?? [],
      suggestions: parsed.suggestions ?? [],
      positiveNote: parsed.positiveNote ?? '',
      weeklyData,
      generatedAt: new Date().toISOString(),
    };

    // Cache in both Redis (O(1)) and SQLite (O(log n) insert)
    await set(redisKey, result, 86400);
    cacheInsight(userId, today, promptHash, result);

    return { ...result, cached: false };
  } catch (err) {
    console.error('[AI Service] API error:', err.message);
    return {
      insight: `Unable to generate AI insights: ${err.message}`,
      topCategories: weeklyData.categoryBreakdown?.slice(0, 2) ?? [],
      suggestions: [],
      cached: false,
      error: err.message,
    };
  }
}

module.exports = { generateInsight, buildWeeklyPayload };
