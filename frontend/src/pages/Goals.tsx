import { useState, useEffect } from 'react';
import { Target, Flame, TrendingDown, Award, RefreshCw, Check } from 'lucide-react';
import { fetchGoals, fetchStreak, setGoal, type GoalData } from '../api';

function HeatmapCell({ day }: { day: any }) {
  const getColor = () => {
    if (!day.value) return 'rgba(255,255,255,0.04)';
    if (day.isLowCarbon) return 'rgba(34,197,94,0.65)';
    if (day.value <= day.goal * 1.2) return 'rgba(251,191,36,0.55)';
    return 'rgba(244,63,94,0.55)';
  };
  return (
    <div title={`${day.date}: ${day.value?.toFixed(2)} kg — Streak: ${day.streakDay}`}
      className="relative rounded-md transition-all duration-300 hover:scale-110 cursor-pointer"
      style={{ background: getColor(), width: '32px', height: '32px' }}>
      {day.streakDay > 0 && day.streakDay % 5 === 0 && (
        <span className="absolute -top-2 -right-2 text-[8px]">🔥</span>
      )}
    </div>
  );
}

export default function Goals() {
  const [data, setData]       = useState<GoalData | null>(null);
  const [streak, setStreak]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [g, s] = await Promise.all([fetchGoals(), fetchStreak()]);
      setData(g);
      setStreak(s);
      setNewGoal(g.dailyGoal.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSaveGoal = async () => {
    if (!newGoal || isNaN(+newGoal) || +newGoal <= 0) return;
    setSaving(true);
    try {
      await setGoal(+newGoal);
      setSaved(true);
      await load();
      setTimeout(() => { setSaved(false); setEditing(false); }, 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="p-8">
      <div className="skeleton h-8 w-48 mb-8" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[0,1,2].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
      </div>
    </div>
  );

  if (!data) return null;

  const progressPct = Math.min(200, data.progressPct);
  const isOnTrack = data.onTrack;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-black text-gradient mb-1">Goals & Streaks</h1>
        <p className="text-carbon-400">Track progress with sliding window analytics</p>
      </div>

      {/* Goal + Streak cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Daily goal card */}
        <div className="metric-card animate-slide-up" style={{ '--accent': '#22c55e' } as any}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-eco-500/15"><Target size={18} className="text-eco-400" /></div>
            <button onClick={() => setEditing(!editing)} className="btn-ghost text-xs">
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
          <p className="text-3xl font-black text-carbon-50 mb-0.5">
            {data.dailyGoal}<span className="text-sm font-normal text-carbon-400 ml-1">kg/day</span>
          </p>
          <p className="text-sm text-carbon-400">Daily Goal</p>
          {editing && (
            <div className="mt-3 flex gap-2 animate-slide-up">
              <input type="number" className="input-field flex-1 text-sm" value={newGoal}
                onChange={e => setNewGoal(e.target.value)} min="0.5" max="50" step="0.5" />
              <button onClick={handleSaveGoal} disabled={saving} className="btn-eco text-xs px-3">
                {saved ? <Check size={14} /> : saving ? <RefreshCw size={14} className="animate-spin" /> : 'Set'}
              </button>
            </div>
          )}
        </div>

        {/* Current streak */}
        <div className="metric-card animate-slide-up delay-100" style={{ '--accent': '#f59e0b' } as any}>
          <div className="p-2 rounded-xl bg-amber-500/15 w-fit mb-3"><Flame size={18} className="text-amber-400" /></div>
          <p className="text-3xl font-black text-carbon-50 mb-0.5">
            {data.currentStreak}<span className="text-sm font-normal text-carbon-400 ml-1">days</span>
          </p>
          <p className="text-sm text-carbon-400">Current Streak 🔥</p>
          <p className="text-xs text-carbon-600 mt-1">Best: {data.maxStreak} days</p>
        </div>

        {/* Rolling average */}
        <div className="metric-card animate-slide-up delay-200" style={{ '--accent': isOnTrack ? '#22c55e' : '#f59e0b' } as any}>
          <div className="p-2 rounded-xl w-fit mb-3" style={{ background: isOnTrack ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)' }}>
            <TrendingDown size={18} style={{ color: isOnTrack ? '#22c55e' : '#f59e0b' }} />
          </div>
          <p className="text-3xl font-black text-carbon-50 mb-0.5">
            {data.rollingAverage.toFixed(2)}<span className="text-sm font-normal text-carbon-400 ml-1">kg/day</span>
          </p>
          <p className="text-sm text-carbon-400">30-Day Rolling Avg</p>
          <p className={`text-xs mt-1 ${isOnTrack ? 'text-eco-400' : 'text-amber-400'}`}>
            {isOnTrack ? `✅ ${Math.abs(data.deficit).toFixed(2)} kg under goal` : `⚠️ ${data.deficit.toFixed(2)} kg over goal`}
          </p>
        </div>
      </div>

      {/* Progress bar section */}
      <div className="glass-card p-6 mb-6 animate-slide-up delay-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header mb-0">Goal Progress</h2>
          <span className={`badge ${isOnTrack ? 'badge-eco' : 'badge-warn'}`}>
            {isOnTrack ? '✅ On Track' : '⚠️ Above Goal'}
          </span>
        </div>
        <div className="relative mb-2">
          <div className="progress-bar h-4">
            <div className="progress-fill h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(100, progressPct)}%`,
                background: isOnTrack
                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                  : 'linear-gradient(90deg, #f59e0b, #f97316)',
              }} />
          </div>
          {/* Goal marker */}
          <div className="absolute top-0 h-4 w-0.5 bg-carbon-400/50" style={{ left: '100%' }} />
        </div>
        <div className="flex justify-between text-xs text-carbon-500">
          <span>0 kg</span>
          <span className="text-eco-400 font-medium">{data.rollingAverage.toFixed(2)} kg avg</span>
          <span>Goal: {data.dailyGoal} kg</span>
        </div>
      </div>

      {/* Window stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Window Min', value: data.min.toFixed(2), unit: 'kg', color: '#22c55e' },
          { label: 'Window Avg', value: data.avg.toFixed(2), unit: 'kg', color: '#3b82f6' },
          { label: 'Window Max', value: data.max.toFixed(2), unit: 'kg', color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 text-center animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="text-2xl font-black mb-0.5" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-carbon-400">{s.label} ({s.unit})</p>
          </div>
        ))}
      </div>

      {/* Streak heatmap */}
      <div className="glass-card p-6 animate-slide-up delay-300">
        <div className="flex items-center gap-2 mb-5">
          <Award size={18} className="text-violet-400" />
          <h2 className="section-header mb-0">30-Day Streak Calendar</h2>
          <span className="text-xs text-carbon-600">O(1) sliding window deque</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(streak?.windowData ?? data.windowData ?? []).map((d: any, i: number) => (
            <HeatmapCell key={i} day={{ ...d, goal: data.dailyGoal }} />
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-carbon-500">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-eco-500/65 inline-block" />Under goal 🌱</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-400/55 inline-block" />Near goal ⚡</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-rose-400/55 inline-block" />Over goal ⚠️</span>
          <span className="flex items-center gap-1.5"><span className="text-base">🔥</span>5-day milestone</span>
        </div>
      </div>
    </div>
  );
}
