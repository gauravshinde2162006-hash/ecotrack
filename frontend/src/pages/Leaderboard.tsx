import React, { useEffect, useState, Suspense } from 'react';
import { Trophy, Medal, User as UserIcon, Globe as GlobeIcon } from 'lucide-react';
import { fetchLeaderboard } from '../api';
import { useAuth } from '../context/AuthContext';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import Globe from '../components/Globe';

interface LeaderboardEntry {
  id: number;
  name: string;
  avatar_url: string | null;
  achievements: string | null;
  daily_goal: number;
  avg_co2e: number;
  days_logged: number;
}

export default function Leaderboard() {
  const { isAuthenticated, user } = useAuth();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLeaderboard()
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
          <Trophy size={32} className="text-carbon-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-4">Global Leaderboard</h1>
        <p className="text-carbon-400 max-w-md">
          Sign in with Google using the button in the top right to join the global leaderboard and see how your carbon footprint compares!
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto min-h-screen relative z-10 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <Trophy size={32} className="text-eco-400" />
        <h1 className="text-4xl font-black text-white tracking-tight">Global Leaderboard</h1>
      </div>
      <p className="text-carbon-400 mb-8">Top eco-warriors based on 30-day average footprint.</p>

      {/* 3D Global Map Visualization */}
      <div className="w-full h-[400px] glass-card rounded-3xl overflow-hidden mb-12 relative border border-white/10 shadow-2xl">
        <div className="absolute top-4 left-6 z-10 pointer-events-none">
          <h3 className="text-white font-bold text-lg flex items-center gap-2"><GlobeIcon size={18} /> Eco-Network</h3>
          <p className="text-carbon-300 text-sm">Live visualization of top performers</p>
        </div>
        <Canvas camera={{ position: [0, 0, 2.5], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Suspense fallback={null}>
            <Globe users={data} />
          </Suspense>
          <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
          <Environment preset="city" />
        </Canvas>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs uppercase text-carbon-500 bg-black/20">
              <th className="px-6 py-4 font-bold w-20 text-center">Rank</th>
              <th className="px-6 py-4 font-bold">EcoWarrior</th>
              <th className="px-6 py-4 font-bold text-right">30-Day Avg CO₂e</th>
              <th className="px-6 py-4 font-bold text-center">Days Logged</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  <td className="px-6 py-4"><div className="w-6 h-6 rounded bg-white/5 mx-auto animate-pulse" /></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
                      <div className="w-32 h-4 rounded bg-white/5 animate-pulse" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right"><div className="w-16 h-5 rounded bg-white/5 ml-auto animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="w-8 h-4 rounded bg-white/5 mx-auto animate-pulse" /></td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-carbon-500">
                  No data available yet. Be the first to log!
                </td>
              </tr>
            ) : (
              data.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = user?.id === entry.id;

                let rankBadge = <span className="text-carbon-400 font-mono text-lg">{rank}</span>;
                if (rank === 1) rankBadge = <Medal size={24} className="text-yellow-400 mx-auto drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />;
                else if (rank === 2) rankBadge = <Medal size={24} className="text-slate-300 mx-auto" />;
                else if (rank === 3) rankBadge = <Medal size={24} className="text-amber-600 mx-auto" />;

                let userBadges: any[] = [];
                try {
                  userBadges = typeof entry.achievements === 'string' ? JSON.parse(entry.achievements) : (entry.achievements || []);
                } catch(e) {}

                return (
                  <tr key={entry.id} className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${isCurrentUser ? 'bg-eco-500/10' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      {rankBadge}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt={entry.name} className={`w-10 h-10 rounded-full object-cover border ${isCurrentUser ? 'border-eco-500' : 'border-white/10'}`} />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isCurrentUser ? 'border-eco-500 bg-eco-500/20 text-eco-400' : 'border-white/10 bg-carbon-800 text-carbon-400'}`}>
                            <UserIcon size={20} />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <p className={`font-bold text-base flex items-center gap-2 ${isCurrentUser ? 'text-eco-400' : 'text-white'}`}>
                            {entry.name} {isCurrentUser && <span className="text-[10px] bg-eco-500/20 text-eco-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">You</span>}
                          </p>
                          {userBadges.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {userBadges.map(b => (
                                <span key={b.id} title={b.name} className="text-sm drop-shadow-md">{b.icon}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xl font-mono font-black text-white">
                          {entry.avg_co2e.toFixed(1)} <span className="text-sm text-carbon-400 font-sans font-medium">kg</span>
                        </span>
                        {entry.avg_co2e <= entry.daily_goal ? (
                          <span className="text-[10px] text-eco-400 mt-1 uppercase tracking-wide font-bold">Hitting Goal</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-carbon-300 font-mono">
                      {entry.days_logged}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
