/**
 * Seed script — generates 30 days of realistic sample data
 * Run: node backend/db/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { getDb, initSchema } = require('./db');
const { emissionHashMap } = require('../data-structures/EmissionHashMap');

const USER_ID = 1;

const TRANSPORT_PROFILES = [
  { subtype: 'car_petrol', km: 15 },
  { subtype: 'car_petrol', km: 22 },
  { subtype: 'bus', km: 12 },
  { subtype: 'train', km: 25 },
  { subtype: 'bike', km: 5 },
  { subtype: 'walk', km: 2 },
  { subtype: 'car_petrol', km: 30 },
  { subtype: 'bus', km: 18 },
];

const DIET_PROFILES = ['vegan', 'vegetarian', 'non_vegetarian', 'non_vegetarian', 'vegetarian', 'vegan', 'non_vegetarian'];

function generateDailyData(dateOffset) {
  const transportProfile = TRANSPORT_PROFILES[dateOffset % TRANSPORT_PROFILES.length];
  const dietSubtype = DIET_PROFILES[dateOffset % DIET_PROFILES.length];
  const variance = 1 + (Math.sin(dateOffset * 0.7) * 0.15);
  const transportKm = +(transportProfile.km * variance).toFixed(1);
  const entries = [];

  const transportCO2e = emissionHashMap.computeCO2e('transport', transportProfile.subtype, transportKm);
  entries.push({ category: 'transport', subtype: transportProfile.subtype, quantity: transportKm, co2e: transportCO2e });

  const dietCO2e = emissionHashMap.computeCO2e('diet', dietSubtype, 1);
  entries.push({ category: 'diet', subtype: dietSubtype, quantity: 1, co2e: dietCO2e });

  const isWeekend = (dateOffset % 7) >= 5;
  const kWh = isWeekend ? +(5 + Math.random() * 3).toFixed(2) : +(2 + Math.random() * 3).toFixed(2);
  const electricCO2e = emissionHashMap.computeCO2e('electricity', 'india_grid', kWh);
  entries.push({ category: 'electricity', subtype: 'india_grid', quantity: kWh, co2e: electricCO2e });

  if (dateOffset % 5 === 0) {
    const cylinderFraction = +(0.05 + Math.random() * 0.05).toFixed(3);
    const lpgCO2e = emissionHashMap.computeCO2e('lpg', 'cylinder', cylinderFraction);
    entries.push({ category: 'lpg', subtype: 'cylinder', quantity: cylinderFraction, co2e: lpgCO2e });
  }

  if (dateOffset % 3 === 0) {
    const wasteKg = +(0.5 + Math.random() * 1.0).toFixed(2);
    const wasteCO2e = emissionHashMap.computeCO2e('waste', 'landfill', wasteKg);
    entries.push({ category: 'waste', subtype: 'landfill', quantity: wasteKg, co2e: wasteCO2e });
  }

  return entries;
}

async function seed() {
  await initSchema();
  const db = getDb();
  console.log('[Seed] Starting seed with 30 days of sample data...');

  // Clear existing data
  await db('log_entries').del();
  await db('daily_logs').del();

  const today = new Date();
  let totalCO2e = 0;

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const entries = generateDailyData(29 - i);
    const dayTotal = +entries.reduce((s, e) => s + e.co2e, 0).toFixed(4);
    totalCO2e += dayTotal;

    // Upsert daily log
    await db('daily_logs').insert({
      user_id: USER_ID, date: dateStr, total_co2e: dayTotal
    }).onConflict(['user_id', 'date']).merge({ total_co2e: dayTotal });

    const logRow = await db('daily_logs').where({ user_id: USER_ID, date: dateStr }).first();
    const logId = logRow.id;

    // Insert entries
    for (const entry of entries) {
      await db('log_entries').insert({ log_id: logId, ...entry });
    }

    console.log(`[Seed] ${dateStr}: ${dayTotal.toFixed(3)} kg CO2e (${entries.length} entries)`);
  }

  console.log(`\n[Seed] ✅ Done! Total: ${totalCO2e.toFixed(2)} kg CO2e over 30 days`);
  console.log(`[Seed]    Average: ${(totalCO2e / 30).toFixed(2)} kg CO2e/day`);
  console.log(`[Seed]    Trees equivalent: ${(totalCO2e / 21).toFixed(1)} trees/year`);
  await db.destroy();
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
