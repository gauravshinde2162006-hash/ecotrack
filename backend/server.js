/**
 * EcoTrack Backend — Express server entry point
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { appState } = require('./appState');
const { initSchema, getDb } = require('./db/db');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: true, // Allow all origins for the stateless demo
  credentials: true,
}));
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/logs',       require('./routes/logs'));
app.use('/api/transport',  require('./routes/transport'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/insights',   require('./routes/insights'));
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/social',     require('./routes/social'));
app.use('/api/goals',      require('./routes/goals'));
app.use('/api/webhooks',   require('./routes/webhooks'));

// Health check (used by Docker + n8n)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    features: {
      redis: !!process.env.REDIS_URL,
      ai: !!(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY),
      ors: !!process.env.ORS_API_KEY,
    },
  });
});

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ error: err.message });
});

// ── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Initialize DB schema then load data structures
    await initSchema();
    
    // Auto-seed for stateless deployments (like Render free tier)
    const db = getDb();
    const count = await db('daily_logs').count('id as c').first();
    if (count.c === 0) {
      console.log('[Startup] Database is empty. Running auto-seed for demo deployment...');
      await seed();
    }
    
    await appState.initialize();

    app.listen(PORT, () => {
      const isAIConfigured = !!(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY);
      const provider = process.env.GROQ_API_KEY ? 'Groq' : 'Claude';
      console.log(`\n🌿 EcoTrack Backend running on http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`   AI:     ${isAIConfigured ? `✅ Configured (${provider})` : '⚠️  Not configured'}`);
      console.log(`   ORS:    ${process.env.ORS_API_KEY ? '✅ Configured' : '⚠️  Not configured'}`);
      console.log(`   Redis:  ${process.env.REDIS_URL || 'redis://localhost:6379'}\n`);
    });
  } catch (err) {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  require('./db/db').closeDb();
  process.exit(0);
});
