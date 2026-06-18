/**
 * AIInsights — Agentic AI page
 * Shows the agent's real-time reasoning: which tools it calls, what they return,
 * and finally the human-readable answer.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Brain, Sparkles, RefreshCw, Lightbulb, TrendingDown,
  Clock, ChevronDown, ChevronRight, Wrench, CheckCircle2,
  AlertCircle, Zap, BarChart3, Map, BookOpen, Target,
} from 'lucide-react';
import { fetchAIInsight, askAgent, type AIInsight, type AgentStep } from '../api';
import { format, parseISO } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────
const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   'text-eco-400 bg-eco-500/10 border-eco-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  hard:   'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const TOOL_META: Record<string, { icon: any; label: string; color: string }> = {
  get_footprint:          { icon: BarChart3, label: 'Fetching footprint data',       color: '#22c55e' },
  get_category_breakdown: { icon: BarChart3, label: 'Analysing emission categories', color: '#3b82f6' },
  get_transport_options:  { icon: Map,       label: 'Calculating route & emissions', color: '#f97316' },
  log_activity:           { icon: BookOpen,  label: 'Logging activity',              color: '#a855f7' },
  set_goal:               { icon: Target,    label: 'Updating daily goal',           color: '#f59e0b' },
};

// ── Typewriter ────────────────────────────────────────────────────────────────
function TypewriterText({ text, speed = 12 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed(''); setDone(false);
    let i = 0;
    const t = setInterval(() => {
      if (i < text.length) { setDisplayed(text.slice(0, ++i)); }
      else { setDone(true); clearInterval(t); }
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return (
    <span className="text-carbon-200 leading-relaxed whitespace-pre-wrap">
      {displayed}
      {!done && <span className="inline-block w-0.5 h-4 bg-eco-400 ml-0.5 animate-pulse" />}
    </span>
  );
}

// ── Agent "thinking step" card ───────────────────────────────────────────────
function ThinkingStep({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);

  if (step.type === 'thinking') {
    const meta = TOOL_META[step.content.tool] ?? { icon: Wrench, label: step.content.tool, color: '#71717a' };
    const Icon = meta.icon;
    return (
      <div className="flex items-start gap-3 py-2 animate-fade-in">
        <div className="mt-0.5 p-1.5 rounded-lg shrink-0" style={{ background: `${meta.color}20` }}>
          <Icon size={13} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-carbon-300 font-medium">{meta.label}</p>
          {step.content.args && Object.keys(step.content.args).length > 0 && (
            <p className="text-[10px] text-carbon-600 font-mono truncate">
              {JSON.stringify(step.content.args)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <RefreshCw size={10} className="text-carbon-600 animate-spin" />
          <span className="text-[10px] text-carbon-600">Running</span>
        </div>
      </div>
    );
  }

  if (step.type === 'tool_result') {
    const meta = TOOL_META[step.content.tool] ?? { icon: CheckCircle2, label: step.content.tool, color: '#22c55e' };
    const Icon = meta.icon;
    const hasError = !!step.content.error;
    return (
      <div className="flex items-start gap-3 py-2 animate-fade-in">
        <div className="mt-0.5 p-1.5 rounded-lg shrink-0" style={{ background: hasError ? '#ef444420' : `${meta.color}20` }}>
          {hasError
            ? <AlertCircle size={13} className="text-rose-400" />
            : <CheckCircle2 size={13} style={{ color: meta.color }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs text-carbon-400 font-medium">
              {hasError ? `Error: ${step.content.error}` : `${TOOL_META[step.content.tool]?.label ?? step.content.tool} — done`}
            </p>
            {!hasError && (
              <button onClick={() => setOpen(o => !o)} className="text-carbon-600 hover:text-carbon-400">
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            )}
          </div>
          {open && !hasError && (
            <pre className="mt-1 text-[10px] text-carbon-500 font-mono bg-white/[0.03] rounded p-2 max-h-32 overflow-auto">
              {JSON.stringify(step.content.result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIInsights() {
  const [insight, setInsight]         = useState<AIInsight | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [days, setDays]               = useState(7);

  // Agentic chat state
  const [agentInput, setAgentInput]   = useState('');
  const [agentRunning, setAgentRunning] = useState(false);
  const [steps, setSteps]             = useState<AgentStep[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  const QUICK_QUESTIONS = [
    '📊 What is my carbon footprint this week?',
    '🚗 Compare Mumbai to Pune by car vs train',
    '🍽️ What diet change would help most?',
    '🎯 Set my daily goal to 4 kg CO₂e',
    '📝 Log 30km car petrol journey for today',
    '🌿 Give me a complete eco action plan',
  ];

  // Auto-scroll steps
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps, finalAnswer]);

  const loadInsight = async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchAIInsight(days);
      setInsight(data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally { setLoading(false); }
  };

  const runAgent = async (msg?: string) => {
    const message = msg ?? agentInput;
    if (!message.trim()) return;
    setAgentInput('');
    setSteps([]);
    setFinalAnswer(null);
    setAgentRunning(true);

    try {
      await askAgent(message, (step) => {
        if (step.type === 'answer') {
          setFinalAnswer(step.content);
        } else if (step.type === 'error') {
          setFinalAnswer(`⚠️ Error: ${step.content}`);
        } else {
          setSteps(prev => [...prev, step]);
        }
      });
    } finally {
      setAgentRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-black text-gradient mb-1">AI Eco Coach</h1>
        <p className="text-carbon-400">Autonomous AI agent — calls your real data, reasons step-by-step, acts on your behalf</p>
      </div>

      {/* ── Agentic Chat (primary) ── */}
      <div className="glass-card p-6 mb-6 animate-slide-up">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-violet-400" />
          <h2 className="section-header mb-0">Ask EcoAgent</h2>
          <span className="badge text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 flex items-center gap-1">
            <Zap size={9} />Agentic · Tool Calling
          </span>
        </div>
        <p className="text-[11px] text-carbon-500 mb-4">
          The agent autonomously fetches your data, runs calculations, and can log entries or update goals.
        </p>

        {/* Quick questions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_QUESTIONS.map(q => (
            <button key={q} onClick={() => runAgent(q)} disabled={agentRunning}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-carbon-400 hover:text-carbon-200 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all disabled:opacity-40">
              {q}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="flex gap-3 mb-4">
          <input
            className="input-field flex-1"
            placeholder='e.g. "What was my worst day?" or "Log 2 kWh electricity"'
            value={agentInput}
            onChange={e => setAgentInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAgent()}
            disabled={agentRunning}
          />
          <button onClick={() => runAgent()} disabled={agentRunning || !agentInput.trim()} className="btn-eco">
            {agentRunning ? <RefreshCw size={15} className="animate-spin" /> : <Brain size={15} />}
            {agentRunning ? 'Running…' : 'Ask'}
          </button>
        </div>

        {/* Agent output panel */}
        {(steps.length > 0 || finalAnswer || agentRunning) && (
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            {/* Thinking steps */}
            {steps.length > 0 && (
              <div className="px-4 py-2 border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[10px] text-carbon-600 font-medium uppercase tracking-wider mb-1">Agent Reasoning</p>
                <div className="divide-y divide-white/[0.04]">
                  {steps.map((s, i) => <ThinkingStep key={i} step={s} />)}
                </div>
                {agentRunning && !finalAnswer && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex gap-1">
                      {[0, 0.2, 0.4].map(d => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                          style={{ animationDelay: `${d}s` }} />
                      ))}
                    </div>
                    <span className="text-[10px] text-carbon-600">Agent thinking…</span>
                  </div>
                )}
              </div>
            )}

            {/* Final answer */}
            {finalAnswer && (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-eco-500/20 flex items-center justify-center">
                    <Brain size={13} className="text-eco-400" />
                  </div>
                  <span className="text-xs font-semibold text-eco-400">EcoAgent</span>
                  <span className="text-[10px] text-carbon-600">· {steps.length} tool{steps.length !== 1 ? 's' : ''} used</span>
                </div>
                <TypewriterText text={finalAnswer} speed={8} />
              </div>
            )}
          </div>
        )}
        <div ref={stepsEndRef} />
      </div>

      {/* ── Weekly Analysis (secondary) ── */}
      <div className="glass-card p-5 mb-6 flex items-center gap-4 animate-slide-up delay-100">
        <div className="flex-1">
          <label className="text-xs text-carbon-400 mb-1 block">Weekly analysis window</label>
          <select className="select-field" value={days} onChange={e => setDays(+e.target.value)}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
        <div className="pt-4">
          <button onClick={loadInsight} disabled={loading} className="btn-eco">
            {loading
              ? <><RefreshCw size={15} className="animate-spin" /> Analysing…</>
              : <><Brain size={15} /> Generate Weekly Report</>
            }
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card p-5 mb-6 border-rose-500/20 animate-fade-in">
          <p className="text-rose-400 text-sm">⚠️ {error}</p>
        </div>
      )}

      {insight && (
        <div className="space-y-5 animate-slide-up">
          {/* Main insight */}
          <div className="glass-card p-7 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(ellipse at top right, #22c55e, transparent)' }} />
            <div className="flex items-center gap-2 mb-4">
              <Brain size={20} className="text-eco-400" />
              <h2 className="section-header mb-0">Weekly Analysis</h2>
              {insight.cached && <span className="badge-eco text-[10px]">⚡ Cached (1/day)</span>}
              {insight.generatedAt && (
                <span className="text-xs text-carbon-600 ml-auto flex items-center gap-1">
                  <Clock size={11} /> {format(parseISO(insight.generatedAt), 'MMM d, h:mm a')}
                </span>
              )}
            </div>
            <p className="text-base leading-relaxed"><TypewriterText text={insight.insight} /></p>
            {insight.positiveNote && (
              <div className="mt-4 p-3 rounded-xl bg-eco-500/8 border border-eco-500/15">
                <p className="text-sm text-eco-400">✨ {insight.positiveNote}</p>
              </div>
            )}
          </div>

          {/* Top categories */}
          {insight.topCategories?.length > 0 && (
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <TrendingDown size={18} className="text-amber-400" />
                <h2 className="section-header mb-0">Top Emission Sources</h2>
              </div>
              <div className="space-y-3">
                {insight.topCategories.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: i === 0 ? '#f59e0b30' : '#71717a20', color: i === 0 ? '#fbbf24' : '#71717a' }}>
                        #{i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-carbon-200 capitalize">{cat.category}</p>
                        <p className="text-xs text-carbon-500">{cat.percentOfTotal?.toFixed(1)}% of total</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-amber-400">{cat.co2eKg?.toFixed(2)} kg</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {insight.suggestions?.length > 0 && (
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Lightbulb size={18} className="text-eco-400" />
                <h2 className="section-header mb-0">Action Plan</h2>
              </div>
              <div className="space-y-4">
                {insight.suggestions.map((s, i) => (
                  <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-eco-500/20 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg bg-eco-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-eco-400 text-sm font-bold">{i + 1}</span>
                        </span>
                        <p className="text-sm font-medium text-carbon-200 leading-snug">{s.action}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-eco-400">-{s.estimatedSavingKg} kg</p>
                        <p className="text-[10px] text-carbon-500">CO₂e saved</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge border text-[10px] ${DIFFICULTY_COLOR[s.difficulty] ?? ''}`}>{s.difficulty}</span>
                      <span className="text-[10px] text-carbon-600">• {s.timeframe}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
