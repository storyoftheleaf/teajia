import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, setToken } from '../../lib/api';
import { useAppStore } from '../store';
import { useFocusTrap } from '../../hooks/useFocusTrap';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }: { isOpen: boolean; onClose: () => void; onAuthSuccess?: () => void }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [info, setInfo] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('teajia_remember_me') !== 'false');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setDevAdmin } = useAppStore();
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setUsername('');
    setResetToken('');
    setNewPassword('');
    setError('');
    setInfo('');
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setInfo('');
  };

  const goToMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    // Dev bypass — only available in development builds
    if (import.meta.env.DEV && mode === 'login' && password === 'dev') {
      setDevAdmin(true);
      setLoading(false);
      resetForm();
      onClose();
      return;
    }

    try {
      if (mode === 'forgot') {
        const result = await api.auth.forgotPassword(email);
        if (result?.token) {
          setResetToken(result.token);
          setMode('reset');
          setInfo('Reset token generated. Choose a new password to complete recovery.');
        } else {
          setInfo(result?.message || 'If an account exists for that email, a reset token has been prepared.');
        }
      } else if (mode === 'reset') {
        if (newPassword.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        await api.auth.resetPassword(resetToken, newPassword);
        setMode('login');
        setPassword('');
        setResetToken('');
        setNewPassword('');
        setInfo('Password updated. Sign in with your new password.');
      } else {
        const result = mode === 'login'
          ? await api.auth.login(email, password)
          : await api.auth.signup(email, password, name, username.trim() || null);
        setToken(result.token);
        if (rememberMe) {
          localStorage.setItem('teajia_remember_me', 'true');
        } else {
          localStorage.removeItem('teajia_remember_me');
        }
        resetForm();
        onAuthSuccess?.();
        onClose();
      }
    } catch (err: any) {
      const fallback =
        mode === 'login' ? 'Login failed'
        : mode === 'signup' ? 'Signup failed'
        : mode === 'forgot' ? 'Could not start password recovery'
        : 'Could not reset password';
      setError(err.message || fallback);
    }
    setLoading(false);
  };

  const title =
    mode === 'login' ? 'Welcome Back'
    : mode === 'signup' ? 'Create Account'
    : mode === 'forgot' ? 'Recover Access'
    : 'Set New Password';

  const subtitle =
    mode === 'login' ? 'Sign in to your account.'
    : mode === 'signup' ? 'Join the Teajia community.'
    : mode === 'forgot' ? 'Enter the email on your account to generate a recovery token.'
    : 'Enter your recovery token and choose a new password.';

  const submitLabel =
    mode === 'login' ? 'Sign In'
    : mode === 'signup' ? 'Create Account'
    : mode === 'forgot' ? 'Generate Reset Token'
    : 'Update Password';

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm px-8">
        <h3 className="text-2xl text-tea-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        <p className="text-tea-text-sec text-sm mb-6 italic" style={{ fontFamily: 'var(--font-display)' }}>
          {subtitle}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Username <span className="text-tea-text-dim normal-case tracking-normal font-normal">(optional)</span></label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" pattern="[a-zA-Z0-9_.\-]{3,32}" className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50" placeholder="Letters, numbers, . _ -" />
              </div>
            </>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
            <div>
               <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">{mode === 'login' ? 'Email or Username' : 'Email'}</label>
               <input type={mode === 'signup' || mode === 'forgot' ? 'email' : 'text'} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={mode === 'login' ? 'username' : 'email'} className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50" placeholder={mode === 'login' ? 'you@example.com or username' : 'you@example.com'} required />
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div>
               <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Password</label>
               <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === 'signup' ? 6 : undefined} className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors" placeholder={mode === 'signup' ? 'Min 6 characters' : ''} required />
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Recovery Token</label>
                <input type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)} className="w-full input-warm rounded-lg p-3 text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50" placeholder="Paste your recovery token" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors" placeholder="Min 6 characters" required />
              </div>
            </>
          )}

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

          {info && <div className="p-3 bg-tea-gold-lt/10 border border-tea-border text-tea-text-sec text-sm rounded-lg">{info}</div>}
          {error && <div className="p-3 bg-tea-accent/10 border border-tea-accent-sub text-tea-accent text-sm rounded-lg">{error}</div>}

          <button type="submit" disabled={loading} className="w-full py-3 bg-tea-accent text-tea-bg font-bold text-xs uppercase tracking-[0.2em] rounded-lg hover:bg-tea-accent/90 transition-colors disabled:opacity-50 flex justify-center mt-6 shadow-lg shadow-tea-accent/10">
            {loading ? <Loader2 className="animate-spin" /> : submitLabel}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {mode === 'login' && (
            <div>
              <button type="button" onClick={() => goToMode('forgot')} className="text-tea-text-sec text-xs hover:text-tea-text transition-colors">
                Forgot your password?
              </button>
            </div>
          )}
          {(mode === 'forgot' || mode === 'reset') && (
            <div>
              <button type="button" onClick={() => goToMode('login')} className="text-tea-text-sec text-xs hover:text-tea-text transition-colors">
                Back to sign in
              </button>
            </div>
          )}
          {(mode === 'login' || mode === 'signup') && (
            <button type="button" onClick={toggleMode} className="text-tea-text-sec text-sm hover:text-tea-text transition-colors">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-tea-accent font-medium">{mode === 'login' ? 'Sign up' : 'Sign in'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
