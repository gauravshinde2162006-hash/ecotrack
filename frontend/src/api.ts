// API client — all backend calls centralized here
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor to inject JWT token into all axios requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ecotrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Types ──────────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalCO2e: number;
  last7DaysCO2e: number;
  last30DaysCO2e: number;
  todayCO2e: number;
  rollingAverage: number;
  currentStreak: number;
  maxStreak: number;
  topEmissionCategory: { category: string; value: number } | null;
  treeEquivalent: number;
  dailyGoal: number;
  goalProgress: number;
  windowData: DayWindow[];
  topCategories: { category: string; value: number }[];
}

export interface DayWindow {
  date: string;
  value: number;
  isLowCarbon: boolean;
}

export interface PieBreakdown {
  category: string;
  value: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface TrendPoint {
  date: string;
  total: number;
  cumulative: number;
  goal?: number;
}

export interface TransportMode {
  mode: string;
  factor: number;
  co2e: number;
}

export interface AIInsight {
  insight: string;
  topCategories: { category: string; co2eKg: number; percentOfTotal: number }[];
  suggestions: {
    action: string;
    estimatedSavingKg: number;
    difficulty: 'easy' | 'medium' | 'hard';
    timeframe: string;
  }[];
  positiveNote: string;
  cached: boolean;
  generatedAt?: string;
}

export interface LogEntry {
  category: string;
  subtype: string;
  quantity: number;
  co2e: number;
  notes?: string;
}

export interface GoalData {
  dailyGoal: number;
  rollingAverage: number;
  currentStreak: number;
  maxStreak: number;
  progressPct: number;
  onTrack: boolean;
  deficit: number;
  windowData: (DayWindow & { streakDay: number; isLowCarbon: boolean })[];
  min: number;
  max: number;
  avg: number;
}

// ── API functions ──────────────────────────────────────────────────────────
export const fetchDashboard = () => api.get<DashboardStats>('/dashboard').then(r => r.data);
export const fetchPieData   = (days = 30) => api.get<{ breakdown: PieBreakdown[]; total: number }>(`/dashboard/pie?days=${days}`).then(r => r.data);
export const fetchTrend     = () => api.get<{ data: TrendPoint[]; summary: any }>('/dashboard/trend').then(r => r.data);

export const fetchLog       = (date: string) => api.get(`/logs?date=${date}`).then(r => r.data);
export const fetchFactors   = () => api.get('/logs/factors').then(r => r.data);
export const submitLog      = (entry: { date: string; category: string; subtype: string; quantity: number; notes?: string }) =>
  api.post('/logs', entry).then(r => r.data);
export const deleteLogEntry = (id: number) => api.delete(`/logs/${id}`).then(r => r.data);
export const fetchTodayStatus = () => api.get('/logs/today/status').then(r => r.data);

export const fetchTransportModes = () => api.get('/transport/modes').then(r => r.data);
export const getTransportDistance = (origin: string, destination: string, mode: string) =>
  api.post('/transport/distance', { origin, destination, mode }).then(r => r.data);

export const fetchAIInsight = (days = 7) => api.get<AIInsight>(`/insights/ai?days=${days}`).then(r => r.data);
export const askAI          = (question: string) => api.post('/insights/chat', { question }).then(r => r.data);

export const fetchGoals   = () => api.get<GoalData>('/goals').then(r => r.data);
export const fetchStreak  = () => api.get('/goals/streak').then(r => r.data);
export const setGoal      = (dailyGoal: number) => api.post('/goals', { dailyGoal }).then(r => r.data);

// ── Auth & Social ──────────────────────────────────────────────────────────
export const googleLogin = (credential: string) => api.post('/auth/google', { credential }).then(r => r.data);
export const fetchLeaderboard = () => api.get('/social/leaderboard').then(r => r.data);

// Re-export emission helpers for client-side CO₂e preview (no API roundtrip)
export { computeCO2e } from './emissionFactors';

// ── Agentic AI — SSE streaming tool-calling agent ─────────────────────────
export interface AgentStep {
  type: 'thinking' | 'tool_result' | 'answer' | 'error';
  content: any;
}

/**
 * Send a message to the agentic AI and stream back each reasoning step.
 * Uses fetch + ReadableStream so we get real-time SSE without EventSource
 * (EventSource doesn't support POST bodies).
 *
 * @param message   User's question or instruction
 * @param onStep    Called for each streamed step
 * @returns         Promise that resolves when the agent finishes
 */
export async function askAgent(
  message: string,
  onStep: (step: AgentStep) => void
): Promise<void> {
  const token = localStorage.getItem('ecotrack_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api/insights/agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    onStep({ type: 'error', content: err.error ?? 'Agent request failed' });
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: AgentStep = JSON.parse(line.slice(6));
          onStep(event);
        } catch { /* ignore malformed lines */ }
      }
    }
  }
}
