/**
 * Database initialization using Knex + SQLite3
 * Uses async/await API — no native compilation required (prebuilt binaries)
 */

const knex = require('knex');
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/ecotrack.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = knex({
      client: 'sqlite3',
      connection: { filename: DB_PATH },
      useNullAsDefault: true,
      pool: { min: 1, max: 1 },
      asyncStackTraces: true,
    });
    console.log(`[DB] Connected to SQLite at ${DB_PATH}`);
  }
  return db;
}

/**
 * Initialize schema — creates tables if they don't exist.
 * Called once at startup.
 */
async function initSchema() {
  const db = getDb();

  await db.raw('PRAGMA journal_mode = WAL');
  await db.raw('PRAGMA synchronous = NORMAL');
  await db.raw('PRAGMA foreign_keys = ON');
  await db.raw('PRAGMA cache_size = -32000');

  // Users table
  const hasUsers = await db.schema.hasTable('users');
  if (!hasUsers) {
    await db.schema.createTable('users', t => {
      t.increments('id').primary();
      t.string('google_id').unique();
      t.string('name').notNullable().defaultTo('EcoUser');
      t.string('email').unique();
      t.string('avatar_url');
      t.json('achievements').defaultTo('[]');
      t.float('daily_goal').notNullable().defaultTo(5.0);
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
    await db('users').insert({ id: 1, name: 'EcoUser', email: 'user@ecotrack.local', daily_goal: 5.0 });
  } else {
    const hasGoogleId = await db.schema.hasColumn('users', 'google_id');
    if (!hasGoogleId) {
      await db.schema.alterTable('users', t => {
        t.string('google_id').unique();
        t.string('avatar_url');
      });
    }
    const hasAchievements = await db.schema.hasColumn('users', 'achievements');
    if (!hasAchievements) {
      await db.schema.alterTable('users', t => {
        t.json('achievements').defaultTo('[]');
      });
    }
  }

  // Daily logs
  const hasLogs = await db.schema.hasTable('daily_logs');
  if (!hasLogs) {
    await db.schema.createTable('daily_logs', t => {
      t.increments('id').primary();
      t.integer('user_id').notNullable().defaultTo(1);
      t.string('date').notNullable();
      t.float('total_co2e').notNullable().defaultTo(0.0);
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
      t.unique(['user_id', 'date']);
      t.foreign('user_id').references('users.id');
    });
    await db.raw('CREATE INDEX IF NOT EXISTS idx_logs_user_date ON daily_logs(user_id, date)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_logs_date ON daily_logs(date)');
  }

  // Log entries
  const hasEntries = await db.schema.hasTable('log_entries');
  if (!hasEntries) {
    await db.schema.createTable('log_entries', t => {
      t.increments('id').primary();
      t.integer('log_id').notNullable();
      t.string('category').notNullable();
      t.string('subtype').notNullable();
      t.float('quantity').notNullable();
      t.float('co2e').notNullable();
      t.text('notes').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.foreign('log_id').references('daily_logs.id').onDelete('CASCADE');
    });
    await db.raw('CREATE INDEX IF NOT EXISTS idx_entries_log ON log_entries(log_id)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_entries_category ON log_entries(category)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_entries_log_cat ON log_entries(log_id, category)');
  }

  // Goals
  const hasGoals = await db.schema.hasTable('goals');
  if (!hasGoals) {
    await db.schema.createTable('goals', t => {
      t.increments('id').primary();
      t.integer('user_id').notNullable().defaultTo(1);
      t.float('daily_target').notNullable();
      t.string('start_date').notNullable();
      t.string('end_date').nullable();
      t.integer('is_active').defaultTo(1);
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  // AI cache
  const hasAICache = await db.schema.hasTable('ai_cache');
  if (!hasAICache) {
    await db.schema.createTable('ai_cache', t => {
      t.increments('id').primary();
      t.integer('user_id').notNullable().defaultTo(1);
      t.string('cache_date').notNullable();
      t.string('prompt_hash').notNullable();
      t.text('response').notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.unique(['user_id', 'cache_date']);
    });
  }

  // Route cache fallback
  const hasRouteCache = await db.schema.hasTable('route_cache');
  if (!hasRouteCache) {
    await db.schema.createTable('route_cache', t => {
      t.string('cache_key').primary();
      t.float('distance_km').notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  console.log('[DB] Schema initialized');
}

async function closeDb() {
  if (db) {
    await db.destroy();
    db = null;
  }
}

module.exports = { getDb, initSchema, closeDb };
