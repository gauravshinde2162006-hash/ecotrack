import { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Check, Zap } from 'lucide-react';
import { submitLog, deleteLogEntry, fetchLog } from '../api';

const CATEGORIES = [
  {
    key: 'electricity', label: 'Electricity', icon: '⚡', color: '#3b82f6',
    subtypes: [{ key: 'india_grid', label: 'India Grid (0.82 kg/kWh)', unit: 'kWh' }],
  },
  {
    key: 'diet', label: 'Diet', icon: '🍽️', color: '#10b981',
    subtypes: [
      { key: 'vegan', label: 'Vegan (2.5 kg/day)', unit: 'days' },
      { key: 'vegetarian', label: 'Vegetarian (3.8 kg/day)', unit: 'days' },
      { key: 'non_vegetarian', label: 'Non-Vegetarian (7.2 kg/day)', unit: 'days' },
    ],
  },
  {
    key: 'lpg', label: 'LPG Gas', icon: '🔥', color: '#f59e0b',
    subtypes: [{ key: 'cylinder', label: 'Cylinder fraction (42.5 kg/cyl)', unit: 'fraction' }],
  },
  {
    key: 'waste', label: 'Waste', icon: '🗑️', color: '#8b5cf6',
    subtypes: [
      { key: 'landfill', label: 'Landfill (0.5 kg/kg)', unit: 'kg' },
      { key: 'recycled', label: 'Recycled (0.1 kg/kg)', unit: 'kg' },
    ],
  },
  {
    key: 'water', label: 'Water', icon: '💧', color: '#06b6d4',
    subtypes: [{ key: 'tap', label: 'Tap water (0.000344 kg/L)', unit: 'litres' }],
  },
];

// Local emission factors for instant preview (O(1) hashmap lookup in frontend)
const LOCAL_FACTORS: Record<string, number> = {
  'electricity:india_grid': 0.82,
  'diet:vegan': 2.5,
  'diet:vegetarian': 3.8,
  'diet:non_vegetarian': 7.2,
  'lpg:cylinder': 42.5,
  'waste:landfill': 0.5,
  'waste:recycled': 0.1,
  'water:tap': 0.000344,
};

interface Entry { category: string; subtype: string; quantity: number; co2e: number; id?: number; }

export default function DailyLog() {
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries]   = useState<Entry[]>([]);
  const [dayTotal, setDayTotal] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState<string | null>(null);

  // Form state
  const [cat, setCat]           = useState('electricity');
  const [subtype, setSubtype]   = useState('india_grid');
  const [quantity, setQuantity] = useState('');
  const [preview, setPreview]   = useState<number | null>(null);

  useEffect(() => {
    // Load existing entries for selected date
    fetchLog(date).then(data => {
      setEntries(data.entries ?? []);
      setDayTotal(data.totalCO2e ?? 0);
    });
  }, [date]);

  // Live CO2e preview — O(1) hashmap lookup
  useEffect(() => {
    const key = `${cat}:${subtype}`;
    const factor = LOCAL_FACTORS[key] ?? 0;
    setPreview(quantity ? +(+quantity * factor).toFixed(4) : null);
  }, [cat, subtype, quantity]);

  // Update subtype default when category changes
  useEffect(() => {
    const catDef = CATEGORIES.find(c => c.key === cat);
    if (catDef) setSubtype(catDef.subtypes[0].key);
  }, [cat]);

  const handleAdd = async () => {
    if (!quantity || isNaN(+quantity) || +quantity <= 0) return;
    setLoading(true);
    try {
      const result = await submitLog({ date, category: cat, subtype, quantity: +quantity });
      const newEntry: Entry = { category: cat, subtype, quantity: +quantity, co2e: result.co2e, id: result.logId };
      setEntries(prev => [...prev, newEntry]);
      setDayTotal(result.dayTotal);
      setQuantity('');
      setPreview(null);
      setSuccess(`Added ${result.co2e.toFixed(3)} kg CO₂e`);
      setTimeout(() => setSuccess(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, index: number) => {
    if (!id) {
      setEntries(prev => prev.filter((_, i) => i !== index));
      return;
    }
    await deleteLogEntry(id);
    setEntries(prev => prev.filter((_, i) => i !== index));
    fetchLog(date).then(d => setDayTotal(d.totalCO2e ?? 0));
  };

  const catDef = CATEGORIES.find(c => c.key === cat);
  const subtypeDef = catDef?.subtypes.find(s => s.key === subtype);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-black text-gradient mb-1">Daily Activity Log</h1>
        <p className="text-carbon-400">Track your electricity, diet, LPG, waste and more</p>
      </div>

      {/* Date selector + day total */}
      <div className="glass-card p-5 mb-6 flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-eco-400" />
          <input type="date" className="input-field w-48" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="text-right">
          <p className="text-xs text-carbon-500">Day Total</p>
          <p className={`text-2xl font-black ${dayTotal > 5 ? 'text-amber-400' : 'text-eco-400'}`}>
            {dayTotal.toFixed(3)} <span className="text-sm font-normal text-carbon-400">kg CO₂e</span>
          </p>
        </div>
      </div>

      {/* Add entry form */}
      <div className="glass-card p-6 mb-6 animate-slide-up delay-100">
        <h2 className="section-header mb-5">Add Activity</h2>

        {/* Category buttons */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`p-3 rounded-xl border text-center transition-all ${
                cat === c.key ? 'border-eco-500/60 bg-eco-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}`}>
              <span className="text-xl block mb-1">{c.icon}</span>
              <span className="text-[10px] text-carbon-400">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Subtype + quantity row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-carbon-400 font-medium mb-2 block">Type</label>
            <select className="select-field" value={subtype} onChange={e => setSubtype(e.target.value)}>
              {catDef?.subtypes.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-carbon-400 font-medium mb-2 block">
              Amount ({subtypeDef?.unit ?? 'units'})
            </label>
            <input type="number" className="input-field" placeholder="0.00" min="0" step="any"
              value={quantity} onChange={e => setQuantity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          </div>
        </div>

        {/* Live preview */}
        {preview !== null && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-eco-500/10 border border-eco-500/20 animate-fade-in">
            <Zap size={14} className="text-eco-400" />
            <span className="text-sm text-carbon-300">
              Preview: <span className="font-bold text-eco-400">{preview.toFixed(4)} kg CO₂e</span>
            </span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-eco-500/15 border border-eco-500/30 animate-fade-in">
            <Check size={14} className="text-eco-400" />
            <span className="text-sm text-eco-400">{success}</span>
          </div>
        )}

        <button onClick={handleAdd} disabled={loading || !quantity} className="btn-eco w-full justify-center">
          <Plus size={16} /> {loading ? 'Adding...' : 'Add Entry'}
        </button>
      </div>

      {/* Entries list */}
      {entries.length > 0 && (
        <div className="glass-card p-6 animate-slide-up delay-200">
          <h2 className="section-header mb-4">Today's Entries ({entries.length})</h2>
          <div className="space-y-3">
            {entries.map((e, i) => {
              const catInfo = CATEGORIES.find(c => c.key === e.category);
              return (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{catInfo?.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-carbon-200 capitalize">{e.category} — {e.subtype.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-carbon-500">{e.quantity} {catInfo?.subtypes[0]?.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-amber-400">{e.co2e.toFixed(3)} kg</span>
                    <button onClick={() => handleDelete(e.id!, i)}
                      className="p-1.5 rounded-lg text-carbon-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day total bar */}
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-carbon-400">Day Total vs Goal (5 kg)</span>
              <span className={`text-sm font-bold ${dayTotal > 5 ? 'text-amber-400' : 'text-eco-400'}`}>{dayTotal.toFixed(3)} kg</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{
                width: `${Math.min(100, (dayTotal / 5) * 100)}%`,
                background: dayTotal > 5 ? 'linear-gradient(90deg, #f59e0b, #f97316)' : undefined,
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
