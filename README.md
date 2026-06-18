# 🌍 EcoTrack — AI-Powered Carbon Footprint Tracker

[![CI](https://github.com/gauravshinde2162006-hash/ecotrack/actions/workflows/ci.yml/badge.svg)](https://github.com/gauravshinde2162006-hash/ecotrack/actions)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

> **An AI-powered progressive web app that helps users track, understand, and reduce their daily carbon footprint through gamification, real-time 3D visualization, and autonomous AI agents.**

## 🎯 Problem Statement

Climate change is the defining challenge of our generation, yet most people have **no idea** how much carbon dioxide their daily activities produce. Without awareness, behavior change is impossible. EcoTrack solves this by making carbon tracking as intuitive as a fitness tracker — with the added power of AI coaching, real-time 3D feedback, and social gamification to drive sustained behavior change.

## 🔗 Live Demo

- **Frontend**: [https://ecotrack-flax.vercel.app](https://ecotrack-flax.vercel.app)
- **Backend API**: [https://ecotrack-hsak.onrender.com/api/health](https://ecotrack-hsak.onrender.com/api/health)

## ✨ Key Features

### 🤖 Agentic AI Coach
Powered by **Groq/LLaMA-3**, the AI agent autonomously:
- Fetches your real historical data from the database
- Runs CO₂ calculations using custom tools
- Logs entries and updates goals on your behalf
- Provides step-by-step reasoning transparency

### 🌐 3D Carbon Digital Twin
Built with **React Three Fiber** (Three.js):
- Real-time 3D environment that reacts to your carbon footprint
- Lush green trees when CO₂ is low → barren landscape when high
- Interactive orbit controls, day/night cycle, particle effects

### 🎙️ Voice Logging
- Speak naturally: *"I drove 30km in my petrol car today"*
- AI parses your speech and creates structured log entries

### 🗺️ Live Transport Routing
Integrated with **OpenRouteService API**:
- Calculate real driving/transit distances between any two cities
- Side-by-side emission comparison across all transport modes

### 🏆 Global Leaderboard & Gamification
- Google OAuth 2.0 authentication
- Achievement badges (First Log, 7-Day Streak, Eco Commuter)
- 3D globe visualization of top users

### 📊 Advanced Analytics
- 30-day rolling window statistics (O(1) amortized)
- Category breakdown pie charts
- Daily trend line with goal tracking

## 🏗️ Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   React Frontend    │────▶│   Express Backend     │
│   (Vite + TS)       │     │   (Node.js)           │
│   Vercel            │     │   Render              │
└─────────────────────┘     └──────────┬───────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
              ┌─────▼─────┐    ┌──────▼──────┐    ┌─────▼─────┐
              │  SQLite    │    │   Redis     │    │ Groq API  │
              │  (Knex)    │    │  (Cache)    │    │ (LLaMA-3) │
              └───────────┘    └─────────────┘    └───────────┘
```

### Custom Data Structures
| Structure | Purpose | Time Complexity |
|-----------|---------|-----------------|
| `EmissionHashMap` | O(1) emission factor lookups | O(1) get/set |
| `SlidingWindowDeque` | Rolling 30-day stats + streak tracking | O(1) push/avg/min/max |
| `PrefixSumArray` | Range queries for date-based CO₂ totals | O(1) query after O(n) build |
| `TimeIndexMap` | Date-indexed category breakdown | O(1) per-day lookup |
| `MaxHeap` | Top emission categories sorted | O(log n) insert |

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, TypeScript, CSS, Three.js (R3F), Lucide Icons |
| **Backend** | Node.js, Express.js, Knex.js |
| **Database** | SQLite (WAL mode), Redis (optional cache) |
| **AI** | Groq API (LLaMA-3), Agentic tool-calling architecture |
| **Auth** | Google OAuth 2.0, JWT (HS256) |
| **APIs** | OpenRouteService, Nominatim (geocoding) |
| **Security** | Helmet, express-rate-limit, parameterized queries |
| **Testing** | Jest + Supertest (backend), Vitest + Testing Library (frontend) |
| **CI/CD** | GitHub Actions |
| **Deployment** | Vercel (frontend), Render (backend) |

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- npm

### Setup
```bash
# Clone the repository
git clone https://github.com/gauravshinde2162006-hash/ecotrack.git
cd ecotrack

# Copy environment template
cp .env.example .env
# Edit .env with your API keys (see Environment Variables below)

# Install and start backend
cd backend
npm install
npm start

# Install and start frontend (in a new terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for AI features |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `JWT_SECRET` | No | JWT signing secret (has default) |
| `ORS_API_KEY` | No | OpenRouteService API key for routing |
| `REDIS_URL` | No | Redis connection URL (optional cache) |
| `VITE_API_URL` | Yes | Backend URL for the frontend |
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google Client ID for frontend |

## 🧪 Testing

We maintain comprehensive test coverage across both frontend and backend.

```bash
# Run backend tests (Jest)
cd backend && npm test

# Run frontend tests (Vitest)
cd frontend && npm test
```

### Test Coverage
- **Backend**: 18 test suites, 96+ passing tests
- **Frontend**: 11 test suites covering all pages and components
- **CI/CD**: Automated via GitHub Actions on every push

## 🔒 Security

See [SECURITY.md](SECURITY.md) for our complete security policy including:
- OAuth 2.0 authentication
- JWT token management
- SQL injection prevention via parameterized queries
- Rate limiting and HTTP security headers
- Responsible disclosure policy

## 📄 License

This project is licensed under the MIT License.

---

Built with 💚 for a sustainable future.
