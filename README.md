# 🌿 EcoTrack — AI-Powered Personal Carbon Footprint Tracker

> Track, understand, and reduce your carbon footprint with AI-powered coaching, real-time maps, and optimized data structures.

[![Tech Stack](https://img.shields.io/badge/Stack-React%20%2B%20Node.js%20%2B%20SQLite%20%2B%20Redis%20%2B%20Claude-brightgreen)](.)
[![License](https://img.shields.io/badge/License-MIT-blue)](.)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗺️ Transport Tracker | Real distances via OpenRouteService + Redis-cached routes |
| 🍽️ Daily Log | Log electricity, diet, LPG, waste with live CO₂e preview |
| 🤖 AI Coach | Claude Sonnet 4.6 analyzes your week and gives personalized advice |
| 📊 Dashboard | Pie chart, trend chart, heatmap — all from in-memory data structures |
| 🎯 Goals & Streaks | Sliding window streak tracking, rolling average, heatmap calendar |
| ⚙️ n8n Workflows | Daily reminders, weekly email reports, threshold alerts |
| 🐳 Docker | One command: `docker-compose up` |

---

## 🧠 Data Structure Choices & Time Complexity

Every data structure was chosen deliberately. Here's why:

### 1. `EmissionHashMap` — O(1) factor lookup
```
Structure: JavaScript Map keyed by "category:subtype"
Example:   "transport:car_petrol" → 0.192

WHY: Instead of looping through an array to find a factor (O(n) per lookup),
we use a hash table for O(1) constant-time access regardless of how many
factors are defined. This also enables a single-pass O(modes) all-mode
comparison in the transport module.
```

### 2. `PrefixSumArray` — O(1) range-sum queries
```
Structure: Sorted date array + cumulative prefix sums array
Build:     O(n log n) once at startup
Query:     prefixSum[B] - prefixSum[A-1] = O(1) range sum

WHY: Without prefix sums, fetching "total CO₂e between Jan 1 and Jan 31"
requires iterating all 31 records = O(n). With prefix sums, it's one
subtraction = O(1). Used for dashboard trend charts, weekly reports, and
n8n webhook summaries.
```

### 3. `MaxHeap` — O(1) peek, O(log n) insert/update
```
Structure: Binary max-heap (array representation), keyed by category
Build:     O(n) using Floyd's algorithm
Peek:      O(1) — root is always the max

WHY: To find "top emission category" we'd normally scan all categories
O(n) each time. With a max-heap we maintain the invariant that root = max,
so peekMax() is O(1). Updates (after each log entry) are O(log n).
```

### 4. `SlidingWindowDeque` — O(1) amortized streak + rolling average
```
Structure: Circular buffer with running sum, monotonic min/max deques
push():    O(1) amortized — evict oldest, add new, update sum
average(): O(1) — runningSum / bufferSize (no recomputation)
streak:    O(1) — maintained as a counter on each push

WHY: Computing rolling average from scratch each time = O(n). With a
maintained running sum and circular buffer, it's always O(1). Streak
is similarly maintained as a counter — no scanning of past days.
```

### 5. `TimeIndexedMap` — O(1) date lookup + O(1) category upsert
```
Structure: Map<dateString → DailyLog>, each DailyLog has Map<category → CO₂e>
getDay():       O(1) — hash table lookup
upsertEntry():  O(1) — update entry + running category total + day total

WHY: Loading logs from DB every time a dashboard stat is needed would be
O(n) per request. The TimeIndexedMap keeps a live in-memory view of all logs,
so any date or category lookup is O(1).
```

### 6. Redis Route Cache — O(1) cache hit vs. network round-trip
```
Key: "ors:{origin}|{destination}|{mode}"
TTL: 7 days (routes don't change)

WHY: OpenRouteService API calls take 200-2000ms. The same Mumbai→Pune
car route shouldn't be recalculated every time. Redis gives O(1) hash
lookup — effectively turning a 500ms API call into a <1ms read.
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- Redis (or use Docker)

### 1. Clone and configure
```bash
cd "Carbon detection"
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start Redis (if not using Docker)
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. Install and start backend
```bash
cd backend
npm install
npm run seed    # Load 30 days of sample data
npm run dev     # Starts on http://localhost:3001
```

### 4. Start frontend
```bash
cd frontend
npm install
npm run dev     # Starts on http://localhost:5173
```

### 5. Verify backend health
```bash
curl http://localhost:3001/api/health
```

---

## 🐳 Docker (Full Stack)

```bash
cp .env.example .env
# Fill in API keys in .env

docker-compose up --build
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:5173        |
| Backend   | http://localhost:3001        |
| n8n       | http://localhost:5678        |
| Redis     | localhost:6379               |

---

## ⚙️ n8n Workflow Setup

1. Open n8n at http://localhost:5678
2. Go to **Workflows → Import** for each file in `/n8n-workflows/`:
   - `daily-reminder.json` — 8PM reminder if user hasn't logged
   - `weekly-report.json` — Sunday 9AM HTML email with AI insights
   - `threshold-alert.json` — Instant alert when footprint > avg + 20%

3. Set environment variables in n8n:
   - `ECOTRACK_API_URL` = `http://backend:3001`
   - `NOTIFICATION_WEBHOOK_URL` = your Ntfy/Pushover webhook
   - `REPORT_EMAIL` = recipient for weekly reports

4. Configure SMTP credentials in **Credentials** for the weekly report email.

5. Activate each workflow.

---

## 🔑 API Keys

| Key | Where to Get | Required |
|-----|-------------|----------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | For AI insights |
| `ORS_API_KEY` | [openrouteservice.org](https://openrouteservice.org/dev/#/signup) (free) | For real distances |

The app runs without these keys — you'll see mock data and a friendly warning.

---

## 📡 API Reference

| Method | Endpoint | Description | Complexity |
|--------|----------|-------------|-----------|
| GET | `/api/dashboard` | Full stats | O(1) all reads |
| GET | `/api/dashboard/pie?days=30` | Category breakdown | O(n_days) |
| GET | `/api/dashboard/trend` | Line chart data | O(n) |
| POST | `/api/logs` | Submit activity | O(log n) DS update |
| GET | `/api/logs/range?from=&to=` | Range sum | O(log n) |
| GET | `/api/logs/today/status` | Logged today? | O(1) |
| POST | `/api/transport/distance` | ORS + all modes | O(1) cache or O(net) |
| GET | `/api/insights/ai?days=7` | Claude insight | O(1) cache or O(API) |
| GET | `/api/goals` | Goal + streak | O(1) |
| POST | `/api/goals` | Set goal | O(1) |
| GET | `/api/webhooks/daily-check` | n8n: logged today? | O(1) |
| GET | `/api/webhooks/weekly-summary` | n8n: week data | O(log n) |

---

## 🗂️ Project Structure

```
Carbon detection/
├── backend/
│   ├── data-structures/
│   │   ├── EmissionHashMap.js      # O(1) factor lookup
│   │   ├── PrefixSumArray.js       # O(1) range queries
│   │   ├── MaxHeap.js              # O(1) top emitter
│   │   ├── SlidingWindowDeque.js   # O(1) streak + avg
│   │   └── TimeIndexedMap.js       # O(1) date access
│   ├── db/
│   │   ├── schema.sql              # Tables + indexes
│   │   ├── db.js                   # SQLite connection
│   │   └── seed.js                 # 30-day sample data
│   ├── routes/
│   │   ├── logs.js                 # Activity CRUD
│   │   ├── transport.js            # ORS distance
│   │   ├── dashboard.js            # Aggregated stats
│   │   ├── insights.js             # Claude AI
│   │   ├── goals.js                # Goals & streaks
│   │   └── webhooks.js             # n8n integration
│   ├── services/
│   │   ├── claudeService.js        # Claude API + caching
│   │   ├── orsService.js           # OpenRouteService
│   │   └── redisService.js         # Cache-aside pattern
│   ├── appState.js                 # In-memory DS singleton
│   └── server.js                   # Express entry point
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx       # Charts + metrics
│       │   ├── TransportLog.tsx    # Route calculator
│       │   ├── DailyLog.tsx        # Activity form
│       │   ├── AIInsights.tsx      # Claude response
│       │   └── Goals.tsx           # Streak calendar
│       ├── api.ts                  # Typed API client
│       └── emissionFactors.ts      # Frontend hashmap
├── n8n-workflows/
│   ├── daily-reminder.json
│   ├── weekly-report.json
│   └── threshold-alert.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🌍 Emission Factors Reference

| Category | Subtype | Factor | Unit |
|----------|---------|--------|------|
| Transport | Car (Petrol) | 0.192 | kg CO₂e/km |
| Transport | Car (Diesel) | 0.171 | kg CO₂e/km |
| Transport | Bus | 0.105 | kg CO₂e/km |
| Transport | Train | 0.041 | kg CO₂e/km |
| Transport | Bike/Walk | 0.000 | kg CO₂e/km |
| Transport | Short Flight | 0.255 | kg CO₂e/km |
| Diet | Non-Vegetarian | 7.2 | kg CO₂e/day |
| Diet | Vegetarian | 3.8 | kg CO₂e/day |
| Diet | Vegan | 2.5 | kg CO₂e/day |
| Electricity | India Grid | 0.82 | kg CO₂e/kWh |
| LPG | Cylinder | 42.5 | kg CO₂e/cylinder |
| Waste | Landfill | 0.5 | kg CO₂e/kg |

---

*Built with 🌿 by EcoTrack — Claude Sonnet 4.6 • OpenRouteService • Redis • n8n*
