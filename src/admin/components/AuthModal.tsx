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
        if (result?.email_sent) {
          // Email succeeded — token is intentionally not returned.
          setInfo(result?.message || 'Check your email for a link to reset your password.');
        } else if (result?.token) {
          // Email not configured or send failed — fall back to in-app recovery.
          setResetToken(result.token);
          setMode('reset');
          setInfo("We couldn't send a reset email. Use this token here to choose a new password, or contact support.");
        } else {
          setInfo(result?.message || 'If an account exists for that email, a reset has been prepared.');
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
                <label className="block text-ui-10 font-bold uppercase tracking-display text-tea-text-sec mb-2">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50" placeholder="your name" />
              </div>
              <div>
                <label className="block text-ui-10 font-bold uppercase tracking-display text-tea-text-sec mb-2">Username <span className="text-tea-text-dim normal-case tracking-normal font-normal">(optional)</span></label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" pattern="[a-zA-Z0-9_.\-]{3,32}" className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50" placeholder="Letters, numbers, . _ -" />
              </div>
            </>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
            <div>
               <label className="block text-ui-10 font-bold uppercase tracking-display text-tea-text-sec mb-2">{mode === 'login' ? 'Email or Username' : 'Email'}</label>
               <input type={mode === 'signup' || mode === 'forgot' ? 'email' : 'text'} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={mode === 'login' ? 'username' : 'email'} className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50" placeholder={mode === 'login' ? 'you@example.com or username' : 'you@example.com'} required />
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div>
               <label className="block text-ui-10 font-bold uppercase tracking-display text-tea-text-sec mb-2">Password</label>
               <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === 'signup' ? 6 : undefined} className="w-full input-warm rounded-lg p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors" placeholder={mode === 'signup' ? 'Min 6 characters' : ''} required />
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label className="block text-ui-10 font-bold uppercase tracking-display text-tea-text-sec mb-2">Recovery Token</label>
                <input type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)} className="w-full input-warm rounded-lg p-3 text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50" placeholder="Paste your recovery token" required />
              </div>
              <div>
                <label className="block text-ui-10 font-bold uppercase tracking-display text-tea-text-sec mb-2">New Password</label>
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
                className="w-4.5 h-4.5 rounded border-tea-border bg-tea-surface text-tea-gold accent-tea-gold cursor-pointer"
              />
              <span className="text-sm text-tea-text-sec">Keep me logged in</span>
            </label>
          )}

          {info && <div className="p-3 bg-tea-gold-lt/10 border border-tea-border text-tea-text-sec text-sm rounded-lg">{info}</div>}
          {error && <div className="p-3 bg-tea-gold/10 border border-tea-accent-sub text-tea-gold text-sm rounded-lg">{error}</div>}

          <button type="submit" disabled={loading} className="w-full py-3 bg-tea-gold text-tea-bg font-bold text-xs uppercase tracking-display rounded-lg hover:bg-tea-gold/90 transition-colors disabled:opacity-50 flex justify-center mt-6 shadow-lg shadow-tea-gold/10">
            {loading ? <Loader2 className="animate-spin" /> : submitLabel}
          </button>
        </form>

        {(mode === 'login' || mode === 'signup') && (
          <div className="mt-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-tea-border" />
              <span className="text-ui-10 uppercase tracking-display text-tea-text-dim">or</span>
              <div className="flex-1 h-px bg-tea-border" />
            </div>
            <a
              href="/api/auth/google"
              className="w-full flex items-center justify-center gap-3 py-3 bg-tea-surface rounded-lg border border-tea-border text-tea-text-sec text-sm hover:text-tea-text hover:bg-tea-elevated transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>
          </div>
        )}

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
              <span className="text-tea-gold font-medium">{mode === 'login' ? 'Sign up' : 'Sign in'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
