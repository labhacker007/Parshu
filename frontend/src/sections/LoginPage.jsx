import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Sparkles, Bot, Zap } from 'lucide-react';
import { useAuthStore } from '../store';
import { authAPI } from '../api/client';
import { initTheme, applyTheme, getAllThemes, getCurrentTheme } from '../themes';

export function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ threats: 0, hunts: 0, iocs: 0 });

  // Initialize theme and animate stats
  useEffect(() => {
    initTheme();
    
    // Animate stats
    const targets = { threats: 1247, hunts: 41, iocs: 771 };
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / 40, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setStats({
        threats: Math.floor(targets.threats * easeOut),
        hunts: Math.floor(targets.hunts * easeOut),
        iocs: Math.floor(targets.iocs * easeOut),
      });
      if (step >= 40) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Backend expects {email, password}
      const response = await authAPI.login({ email, password });
      const { access_token, refresh_token, user } = response.data;
      
      setAuth(user, access_token, refresh_token);
      if (onLogin) onLogin();
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      let msg = 'Invalid credentials. Please try again.';
      if (err.response?.data?.detail) {
        msg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : 'Login failed';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Left Panel - Stats & Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full text-white">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SENTINEL</h1>
              <p className="text-xs text-white/70">AI-Powered Threat Intelligence</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 max-w-md">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur border border-white/20">
              <div className="text-3xl font-bold">{stats.threats.toLocaleString()}</div>
              <div className="text-sm text-white/70">Threats Today</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur border border-white/20">
              <div className="text-3xl font-bold">{stats.hunts}</div>
              <div className="text-sm text-white/70">Active Hunts</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur border border-white/20">
              <div className="text-3xl font-bold">{stats.iocs}</div>
              <div className="text-sm text-white/70">IOCs Extracted</div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3 max-w-md">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur border border-white/20">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-medium">AI-Enabled Analysis</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur border border-white/20">
              <Bot className="w-5 h-5 text-cyan-300" />
              <span className="text-sm font-medium">Automated Intelligence to Hunt</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur border border-white/20">
              <Zap className="w-5 h-5 text-pink-300" />
              <span className="text-sm font-medium">Auto-Generated Queries</span>
            </div>
          </div>

          {/* Footer tags */}
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-full bg-white/20 text-xs font-medium">AI-Enabled</span>
            <span className="px-3 py-1.5 rounded-full bg-white/20 text-xs font-medium">Automated Threat Intel to Hunt</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="p-2.5 rounded-xl bg-indigo-600">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">SENTINEL</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI-Powered Threat Intelligence</p>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Sign in to your account</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-8">
            © 2024 Sentinel. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
