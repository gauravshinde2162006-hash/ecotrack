# 🌍 EcoTrack — AI-Powered Sustainability

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)

EcoTrack is a highly interactive, AI-powered progressive web app designed to help users track, understand, and reduce their daily carbon footprint through gamification and automation.

## ✨ Features
*   **Agentic AI Coach**: Powered by Groq/LLaMA-3. Autonomously fetches history and logs actions via natural language and voice.
*   **3D Digital Twin**: Built with React Three Fiber. A 3D environment that reacts to your carbon footprint.
*   **Live Routing**: Calculates transport emissions based on OpenRouteService API.
*   **Global Leaderboard**: Gamified carbon tracking.

## 🛠️ Tech Stack
*   **Frontend**: React, Vite, Tailwind CSS, Three.js, Lucide Icons, Vitest
*   **Backend**: Node.js, Express, better-sqlite3, Redis, Jest, Supertest
*   **Security**: Helmet, express-rate-limit

## 🚀 Quick Start
```bash
# Clone the repo
git clone https://github.com/gauravshinde2162006-hash/ecotrack.git

# Install and run backend
cd backend
npm install
npm start

# Install and run frontend
cd frontend
npm install
npm run dev
```

## 🧪 Testing
We maintain 100% test file coverage.
```bash
cd backend && npm test
cd frontend && npm test
```

## 🔒 Security
This application implements industry-standard security headers via `helmet` and DDoS protection via `express-rate-limit`.
