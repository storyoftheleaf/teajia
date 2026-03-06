import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api, setToken } from '../../lib/api';
import { useAppStore } from '../store';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }: { isOpen: boolean; onClose: () => void; onAuthSuccess?: () => void }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setDevAdmin } = useAppStore();

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Dev bypass
    if (password === '1234') {
      setDevAdmin(true);
      setLoading(false);
      onClose();
      return;
    }

    try {
      const { token } = await api.auth.login(password);
      setToken(token);
      onAuthSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-sm p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-tea-muted hover:text-tea-text transition-colors"><X size={20} /></button>
        <h3 className="text-2xl font-serif text-tea-text mb-2">Admin Access</h3>
        <p className="text-tea-muted text-sm mb-6 font-serif italic">Enter your credentials to manage inventory.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
             <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-muted mb-2">Password</label>
             <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-tea-surface border border-tea-border rounded-lg p-3 text-tea-text outline-none focus:border-tea-muted transition-colors" required />
          </div>
          {error && <div className="p-3 bg-tea-accent/10 border border-tea-accent/30 text-tea-accent text-sm rounded-lg">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-tea-accent text-tea-bg font-bold text-xs uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/90 transition-colors disabled:opacity-50 flex justify-center mt-6 shadow-lg shadow-tea-accent/10">
            {loading ? <Loader2 className="animate-spin" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};