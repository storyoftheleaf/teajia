import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../store';

export const AuthModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setDevAdmin } = useAppStore();

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Temporary bypass for admin access
    if (password === '1234') {
      setDevAdmin(true);
      setLoading(false);
      onClose();
      return;
    }

    const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-sm p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-tea-muted hover:text-tea-text transition-colors"><X size={20} /></button>
        <h3 className="text-2xl font-serif text-tea-text mb-2">Admin Access</h3>
        <p className="text-tea-muted text-sm mb-6 font-serif italic">Enter your credentials to manage inventory.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
             <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-muted mb-2">Email</label>
             <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-tea-surface border border-tea-border rounded-lg p-3 text-tea-text outline-none focus:border-tea-muted transition-colors placeholder-tea-muted/50" placeholder="admin@teajia.com" required />
          </div>
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