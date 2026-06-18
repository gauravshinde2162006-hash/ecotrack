import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, Line,
} from 'recharts';
import { TreePine, Zap, TrendingDown, Award, Target, Flame, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchDashboard, fetchPieData, fetchTrend, submitLog } from '../api';
import type { DashboardStats, PieBreakdown, TrendPoint } from '../api';
import { format, parseISO } from 'date-fns';
import { useGoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';

// ── Sub-components ───────────────────────────────────────────────────────

function MetricCard({ title, value, unit, icon: Icon, trend, accentColor, delay = 0 }:
  { title: string; value: string | number; unit?: string; icon: any; trend?: number; accentColor?: string; delay?: number }) {
  return (
    <div className="metric-card animate-slide-up" style={{ '--accent': accentColor ?? '#22c55e', animationDelay: `${delay}ms` } as any}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: `${accentColor ?? '#22c55e'}20` }}>
          <Icon size={20} style={{ color: accentColor ?? '#22c55e' }} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-rose-400' : 'text-eco-400'}`}>
            {trend >= 0 ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-black text-carbon-50 mb-0.5">
        {value}<span className="text-base font-normal text-carbon-400 ml-1">{unit}</span>
      </p>
      <p className="text-sm text-carbon-400">{title}</p>
    </div>
  );
}

// Custom Recharts tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="font-semibold text-carbon-200 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-carbon-400">
          {p.name}: <span style={{ color: p.color }}>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value} kg</span>
        </p>
      ))}
    </div>
  );
};

// Heatmap streak cells
function StreakHeatmap({ data }: { data: any[] }) {
  const getColor = (v: number, goal: number) => {
    const ratio = v / goal;
    if (v === 0) return 'rgba(255,255,255,0.04)';
    if (ratio <= 0.6) return 'rgba(34,197,94,0.7)';
    if (ratio <= 0.8) return 'rgba(34,197,94,0.4)';
    if (ratio <= 1.0) return 'rgba(251,191,36,0.5)';
    if (ratio <= 1.3) return 'rgba(251,191,36,0.7)';
    return 'rgba(244,63,94,0.6)';
  };

  return (
    <div className="flex gap-1 flex-wrap">
      {data.map((d, i) => (
        <div key={i} title={`${d.date}: ${d.value.toFixed(2)} kg`}
          className="heatmap-cell w-8 h-8 rounded"
          style={{ background: getColor(d.value, 5) }} />
      ))}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [pie, setPie]         = useState<{ breakdown: PieBreakdown[]; total: number } | null>(null);
  const [trend, setTrend]     = useState<{ data: TrendPoint[]; summary: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [s, p, t] = await Promise.all([fetchDashboard(), fetchPieData(30), fetchTrend()]);
        setStats(s);
        setPie(p);
        setTrend(t);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const syncGoogleFit = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/fitness.activity.read',
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const toastId = toast.loading('Syncing with Google Fit...');
        // Google Fit API to get aggregate step count for today
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenResponse.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
            bucketByTime: { durationMillis: 86400000 },
            startTimeMillis: startOfDay,
            endTimeMillis: now.getTime()
          })
        });

        if (!res.ok) throw new Error('Failed to fetch fitness data');
        const data = await res.json();
        const bucket = data.bucket?.[0];
        const steps = bucket?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;

        if (steps > 0) {
          // Approximate: 1 step = 0.0008 km
          const km = (steps * 0.0008).toFixed(2);
          await submitLog({
            date: format(now, 'yyyy-MM-dd'),
            category: 'transport',
            subtype: 'walking',
            quantity: Number(km),
            notes: `Auto-synced ${steps} steps from Google Fit`
          });
          toast.success(`Synced ${steps} steps (${km} km walking)!`, { id: toastId });
          
          // Refresh dashboard
          const [s, p, t] = await Promise.all([fetchDashboard(), fetchPieData(30), fetchTrend()]);
          setStats(s); setPie(p); setTrend(t);
        } else {
          toast.success('No steps recorded yet today.', { id: toastId });
        }
      } catch (e: any) {
        toast.error('Google Fit sync failed.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => toast.error('Google Fit authorization failed.')
  });

  if (loading) return <LoadingDashboard />;
  if (error) return <ErrorState message={error} />;
  if (!stats) return null;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-gradient">Carbon Dashboard</h1>
            {stats.currentStreak > 0 && (
              <span className="badge-eco">
                <Flame size={12} /> {stats.currentStreak}-day streak 🔥
              </span>
            )}
          </div>
          <p className="text-carbon-400">Your personal carbon intelligence hub • All metrics live</p>
        </div>
        <button onClick={() => syncGoogleFit()} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-sm font-medium text-white shadow-lg">
          <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          Sync Google Fit
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Today's Footprint" value={stats.todayCO2e.toFixed(2)} unit="kg CO₂e"
          icon={Zap} accentColor="#3b82f6" delay={0} />
        <MetricCard title="30-Day Total" value={stats.last30DaysCO2e.toFixed(1)} unit="kg CO₂e"
          icon={TrendingDown} accentColor="#22c55e" delay={100} />
        <MetricCard title="Trees to Offset" value={stats.treeEquivalent.toFixed(1)} unit="trees/yr"
          icon={TreePine} accentColor="#4ade80" delay={200} />
        <MetricCard title="Goal Progress" value={stats.goalProgress} unit="%"
          icon={Target} accentColor={stats.goalProgress <= 100 ? '#22c55e' : '#f59e0b'} delay={300}
          trend={stats.rollingAverage - stats.dailyGoal} />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard title="Rolling Average" value={stats.rollingAverage.toFixed(2)} unit="kg/day"
          icon={TrendingDown} accentColor="#8b5cf6" delay={100} />
        <MetricCard title="Daily Goal" value={stats.dailyGoal.toFixed(1)} unit="kg CO₂e"
          icon={Target} accentColor="#06b6d4" delay={150} />
        <MetricCard title="Best Streak" value={stats.maxStreak} unit="days"
          icon={Award} accentColor="#f59e0b" delay={200} />
        <MetricCard title="Top Emitter" value={stats.topEmissionCategory?.category ?? 'N/A'} unit=""
          icon={Flame} accentColor="#ef4444" delay={250} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
        {/* Line Chart — spans 3/5 */}
        <div className="glass-card p-6 xl:col-span-3 animate-slide-up delay-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-header">30-Day Carbon Trend</h2>
              <p className="section-subtitle">Daily footprint vs. your {stats.dailyGoal} kg goal</p>
            </div>
            {trend?.summary && (
              <div className="text-right">
                <p className="text-xs text-carbon-500">Avg</p>
                <p className="text-lg font-bold text-eco-400">{trend.summary.avg.toFixed(2)}<span className="text-sm text-carbon-400 ml-1">kg</span></p>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend?.data?.map(d => ({ ...d, date: format(parseISO(d.date), 'MMM d') })) ?? []}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGoal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" name="Daily CO₂e" stroke="#22c55e" strokeWidth={2}
                fill="url(#colorTotal)" dot={false} activeDot={{ r: 5, fill: '#22c55e' }} />
              <Line type="monotone" dataKey="goal" name="Goal" stroke="#f59e0b" strokeWidth={1.5}
                strokeDasharray="5 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart — spans 2/5 */}
        <div className="glass-card p-6 xl:col-span-2 animate-slide-up delay-300">
          <h2 className="section-header mb-1">Category Breakdown</h2>
          <p className="section-subtitle mb-4">Last 30 days • {pie?.total?.toFixed(1)} kg total</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pie?.breakdown ?? []} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                dataKey="value" paddingAngle={3}>
                {pie?.breakdown?.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.2)" />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => [`${v.toFixed(2)} kg`, '']} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="space-y-2 mt-2">
            {pie?.breakdown?.map((d) => (
              <div key={d.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-carbon-300 capitalize">{d.icon} {d.category}</span>
                </div>
                <span className="text-xs font-semibold text-carbon-200">{d.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Streak Heatmap + Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass-card p-6 xl:col-span-2 animate-slide-up delay-400">
          <h2 className="section-header mb-1">Activity Heatmap</h2>
          <p className="section-subtitle mb-4">Last 30 days — green = low carbon day</p>
          <StreakHeatmap data={stats.windowData} />
          <div className="flex items-center gap-4 mt-4 text-xs text-carbon-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-eco-500/70 inline-block" />Under goal</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400/60 inline-block" />Near goal</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400/60 inline-block" />Over goal</span>
          </div>
        </div>

        <div className="glass-card p-6 animate-slide-up delay-400">
          <h2 className="section-header mb-4">Environmental Impact</h2>
          <div className="space-y-4">
            <ImpactRow icon="🌳" label="Trees to offset" value={`${stats.treeEquivalent.toFixed(1)} trees/yr`} />
            <ImpactRow icon="🚗" label="Car km equivalent" value={`${(stats.last30DaysCO2e / 0.192).toFixed(0)} km`} />
            <ImpactRow icon="💡" label="kWh electricity" value={`${(stats.last30DaysCO2e / 0.82).toFixed(0)} kWh`} />
            <ImpactRow icon="🌊" label="Emission reduction" value={`${Math.max(0, 30 - stats.last30DaysCO2e).toFixed(1)} kg saved`} positive />
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactRow({ icon, label, value, positive = false }: { icon: string; label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-sm text-carbon-400">{label}</span>
      </div>
      <span className={`text-sm font-semibold ${positive ? 'text-eco-400' : 'text-carbon-200'}`}>{value}</span>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="p-8">
      <div className="skeleton h-8 w-64 mb-8" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-5 gap-6">
        <div className="skeleton h-80 rounded-2xl col-span-3" />
        <div className="skeleton h-80 rounded-2xl col-span-2" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="glass-card p-8 text-center max-w-md">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-carbon-100 mb-2">Backend Connection Failed</h2>
        <p className="text-sm text-carbon-400 mb-4">{message}</p>
        <p className="text-xs text-carbon-500">Make sure the backend is running: <code className="text-eco-400">cd backend && npm run dev</code></p>
      </div>
    </div>
  );
}
