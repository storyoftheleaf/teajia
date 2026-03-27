import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, setToken } from '../../lib/api';
import { useAppStore } from '../store';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }: { isOpen: boolean; onClose: () => void; onAuthSuccess?: () => void }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('teajia_remember_me') === 'true');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setDevAdmin } = useAppStore();

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Dev bypass — only available in development builds
    if (import.meta.env.DEV && mode === 'login' && password === 'dev') {
      setDevAdmin(true);
      setLoading(false);
      resetForm();
      onClose();
      return;
    }

    try {
      let result;
      if (mode === 'login') {
        result = await api.auth.login(email, password);
      } else {
        result = await api.auth.signup(email, password, name);
      }
      setToken(result.token);
      if (rememberMe) {
        localStorage.setItem('teajia_remember_me', 'true');
      } else {
        localStorage.removeItem('teajia_remember_me');
      }
      resetForm();
      onAuthSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? 'Login failed' : 'Signup failed'));
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg" role="dialog" aria-modal="true" aria-label={mode === 'login' ? 'Sign in' : 'Create account'}>
      <div className="w-full max-w-sm px-8">
        <h3 className="text-2xl text-tea-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h3>
        <p className="text-tea-text-sec text-sm mb-6 italic" style={{ fontFamily: 'var(--font-display)' }}>
          {mode === 'login' ? 'Sign in to your account.' : 'Join the Teajia community.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full input-warm rounded-lg p-3 text-base outline-none transition-colors placeholder-tea-text-sec/50" placeholder="Your name" />
            </div>
          )}
          <div>
             <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Email</label>
             <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full input-warm rounded-lg p-3 text-base outline-none transition-colors placeholder-tea-text-sec/50" placeholder="you@example.com" required />
          </div>
          <div>
             <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Password</label>
             <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === 'signup' ? 6 : undefined} className="w-full input-warm rounded-lg p-3 text-base outline-none transition-colors" placeholder={mode === 'signup' ? 'Min 6 characters' : ''} required />
          </div>
          {mode === 'login' && (
            <label className="flex items-center gap-2.5 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-tea-border bg-tea-surface text-tea-accent accent-tea-accent cursor-pointer"
              />
              <span className="text-sm text-tea-text-sec">Keep me logged in</span>
            </label>
          )}
          {error && <div className="p-3 bg-tea-accent/10 border border-tea-accent-sub text-tea-accent text-sm rounded-lg">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-tea-accent text-tea-bg font-bold text-xs uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/90 transition-colors disabled:opacity-50 flex justify-center mt-6 shadow-lg shadow-tea-accent/10">
            {loading ? <Loader2 className="animate-spin" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={toggleMode} className="text-tea-text-sec text-sm hover:text-tea-text transition-colors">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <span className="text-tea-accent font-medium">{mode === 'login' ? 'Sign up' : 'Sign in'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
