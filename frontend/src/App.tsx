import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Car, BookOpen, Brain, Target, Leaf, Globe, Trophy, LogOut } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { googleLogin } from './api';
import Dashboard from './pages/Dashboard';
import DailyLog from './pages/DailyLog';
import TransportLog from './pages/TransportLog';
import AIInsights from './pages/AIInsights';
import Goals from './pages/Goals';
import CarbonTwin from './pages/CarbonTwin';
import Leaderboard from './pages/Leaderboard';
import VoiceLogger from './components/VoiceLogger';
import './index.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1061996160359-dummy.apps.googleusercontent.com';

const NAV = [
  { to: '/',          icon: LayoutDashboard,  label: 'Dashboard' },
  { to: '/log',       icon: BookOpen,         label: 'Daily Log' },
  { to: '/transport', icon: Car,              label: 'Transport' },
  { to: '/insights',  icon: Brain,            label: 'AI Insights'},
  { to: '/goals',     icon: Target,           label: 'Goals'},
  { to: '/twin',      icon: Globe,            label: 'Carbon Twin'},
  { to: '/leaderboard',icon: Trophy,          label: 'Leaderboard'},
];

function TopNavbar() {
  const { user, login, logout, isAuthenticated } = useAuth();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const { token, user: newUser } = await googleLogin(credentialResponse.credential);
      login(token, newUser);
    } catch (err) {
      console.error('Google login failed:', err);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-8 transition-all"
      style={{ background: 'rgba(10, 10, 10, 0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)' }}>
          <Leaf size={16} className="text-white" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight">EcoTrack</h1>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-white/[0.1] text-white shadow-[inset_0_-2px_0_0_#22c55e]' 
                  : 'text-carbon-300 hover:text-white hover:bg-white/[0.05]'
              }`
            }>
            <Icon size={16} />
            <span className="hidden md:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Right Side / Auth & Status */}
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-eco-500/10 border border-eco-500/20">
          <div className="w-2 h-2 rounded-full bg-eco-500 shadow-[0_0_8px_#22c55e] animate-pulse" />
          <span className="text-[11px] text-eco-400 font-bold tracking-wide uppercase">AI Active</span>
        </div>
        
        <div className="h-6 w-px bg-white/[0.1] hidden md:block" />

        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="w-8 h-8 rounded-full border border-white/20" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-carbon-800 flex items-center justify-center text-xs font-bold border border-white/20">
                  {user?.name?.[0] || 'U'}
                </div>
              )}
              <div className="flex flex-col hidden md:flex">
                <span className="text-sm font-medium text-white">{user?.name}</span>
                {(() => {
                  let badges = [];
                  try {
                    if (user?.achievements) {
                      badges = typeof user.achievements === 'string' ? JSON.parse(user.achievements) : user.achievements;
                    }
                  } catch (e) {}
                  return badges.length > 0 ? (
                    <div className="flex gap-1">
                      {badges.map((b: any) => <span key={b.id} title={b.name} className="text-[10px]">{b.icon}</span>)}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
            <button onClick={logout} className="p-2 rounded-lg text-carbon-400 hover:text-white hover:bg-white/[0.05] transition-colors" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="scale-[0.8] origin-right">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => console.error('Login Failed')}
              theme="filled_black"
              shape="pill"
            />
          </div>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const handleMouseMove = (e: React.MouseEvent) => {
    // Set variables for the background mouse glow
    document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen relative z-0" onMouseMove={handleMouseMove}>
            <TopNavbar />
        <main className="flex-1 w-full pt-24 pb-12 min-h-screen">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/log"       element={<DailyLog />} />
            <Route path="/transport" element={<TransportLog />} />
            <Route path="/insights"  element={<AIInsights />} />
            <Route path="/goals"     element={<Goals />} />
            <Route path="/twin"      element={<CarbonTwin />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Routes>
        </main>
        {/* 🎙️ Global floating voice logger */}
        <VoiceLogger />
      </div>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
