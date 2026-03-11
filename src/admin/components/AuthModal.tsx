import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api, setToken } from '../../lib/api';
import { useAppStore } from '../store';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }: { isOpen: boolean; onClose: () => void; onAuthSuccess?: () => void }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
      resetForm();
      onAuthSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? 'Login failed' : 'Signup failed'));
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label={mode === 'login' ? 'Sign in' : 'Create account'} onKeyDown={(e) => { if (e.key === 'Escape') { resetForm(); onClose(); } }}>
      <div className="bg-tea-bg border border-tea-border rounded-lg w-full max-w-sm p-8 shadow-2xl relative">
        <button onClick={() => { resetForm(); onClose(); }} className="absolute top-4 right-4 text-tea-text-dim hover:text-tea-text transition-colors" aria-label="Close"><X size={20} /></button>
        <h3 className="text-2xl font-serif text-tea-text mb-2">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h3>
        <p className="text-tea-text-dim text-sm mb-6 font-serif italic">
          {mode === 'login' ? 'Sign in to your account.' : 'Join the Teajia community.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-dim mb-2">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-tea-surface border border-tea-border rounded-lg p-3 text-tea-text outline-none focus:border-tea-text-dim transition-colors placeholder-tea-text-dim/50" placeholder="Your name" />
            </div>
          )}
          <div>
             <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-dim mb-2">Email</label>
             <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-tea-surface border border-tea-border rounded-lg p-3 text-tea-text outline-none focus:border-tea-text-dim transition-colors placeholder-tea-text-dim/50" placeholder="you@example.com" required />
          </div>
          <div>
             <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-dim mb-2">Password</label>
             <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === 'signup' ? 6 : undefined} className="w-full bg-tea-surface border border-tea-border rounded-lg p-3 text-tea-text outline-none focus:border-tea-text-dim transition-colors" placeholder={mode === 'signup' ? 'Min 6 characters' : ''} required />
          </div>
          {error && <div className="p-3 bg-tea-accent/10 border border-tea-accent/30 text-tea-accent text-sm rounded-lg">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-tea-accent text-tea-bg font-bold text-xs uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/90 transition-colors disabled:opacity-50 flex justify-center mt-6 shadow-lg shadow-tea-accent/10">
            {loading ? <Loader2 className="animate-spin" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={toggleMode} className="text-tea-text-dim text-sm hover:text-tea-text transition-colors">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <span className="text-tea-accent font-medium">{mode === 'login' ? 'Sign up' : 'Sign in'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
