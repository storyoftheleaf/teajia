import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icons } from '../components/Icons';
import { api, API_URL, ApiError } from '../lib/api';
import { authPagePath, authReturnTo } from '../lib/authNavigation';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md min-h-11 px-3 py-2 text-ui-16 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors placeholder-tea-text-dim";
const labelClass = `${TYPOGRAPHY_CLASSES.label} block text-tea-text-sec mb-1`;

export default function SignInPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { state } = useLocation() as { state?: { from?: string } };
  const [searchParams] = useSearchParams();
  const destination = authReturnTo(searchParams.get('returnTo'), state?.from);
  const returnPath = new URL(destination, window.location.origin).pathname;
  const returnHint = returnPath.startsWith('/event/')
    ? 'After signing in, you’ll return to your reservation.'
    : returnPath.startsWith('/admin')
      ? 'After signing in, you’ll return to Manage.'
      : returnPath.startsWith('/account/orders')
        ? 'After signing in, you’ll return to your orders.'
        : returnPath.startsWith('/account/settings')
          ? 'After signing in, you’ll return to account settings.'
          : null;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [passwordMode, setPasswordMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [requestRetryable, setRequestRetryable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  // One request per press. `loading` disables the button, but state lands a
  // render late, so a second Enter or a password manager's own submit can slip
  // in before it does. A ref is set the moment the first one starts.
  const inFlight = useRef(false);

  // What is in the boxes when the form is sent, not what React last heard.
  // A password manager can fill an input without an event React listens for,
  // so state keeps whatever was typed before and the request carries that:
  // one refused sign-in, then a second that works once the state catches up.
  // Reading the form itself makes the request match the screen.
  const submitted = (e: React.FormEvent<HTMLFormElement>) => {
    const form = new FormData(e.currentTarget);
    const read = (name: string, fallback: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value : fallback;
    };
    return { identifier: read('identifier', identifier).trim(), password: read('password', password) };
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await api.auth.forgotPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch (err: unknown) {
      setForgotError((err as Error)?.message || 'Could not send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Every method completes here; only the caller's destination varies.
  useEffect(() => {
    if (auth.isAuthenticated) navigate(destination, { replace: true });
  }, [auth.isAuthenticated, destination, navigate]);

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlight.current) return;
    const entered = submitted(e);
    setIdentifier(entered.identifier);
    setPassword(entered.password);
    inFlight.current = true;
    setError('');
    setLoading(true);
    try {
      await auth.login(entered.identifier, entered.password);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Sign in failed. Please check your credentials.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const handleCodeRequest = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (inFlight.current) return;
    const contact = e ? submitted(e).identifier : identifier.trim();
    setIdentifier(contact);
    inFlight.current = true;
    setError('');
    setRequestRetryable(false);
    setLoading(true);
    try {
      await api.verify.requestCode(contact, 'signin');
      setCodeSent(true);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Could not send code. Try again.';
      // Not configured is permanent until the shop sets up email, so the
      // page names the two ways in that do work instead of leaving a dead end.
      const notConfigured = err instanceof ApiError && err.data?.code === 'email_not_configured';
      setError(notConfigured ? `${message} Sign in with your password or Google instead.` : message);
      setRequestRetryable(!(err instanceof ApiError) || err.data?.retryable !== false);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const handleCodeConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError('');
    setLoading(true);
    try {
      await auth.signInWithCode(identifier.trim(), code);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Incorrect code. Please try again.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto px-5 pt-6 sm:pt-10 pb-nav-gap">
      <header className="mb-5">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Sign in</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec mt-1`}>Welcome back.</p>
        {returnHint && <p className="text-ui-12 text-tea-text-sec mt-2">{returnHint}</p>}
      </header>

      <a
        href={`${API_URL}/api/auth/google?return=${encodeURIComponent(authPagePath('signin', destination))}`}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-md border border-tea-border bg-tea-surface px-3 py-2 text-ui-14 text-tea-text transition-colors hover:bg-tea-elevated"
      >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
        Continue with Google
      </a>
      <div className="my-4 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-tea-border" />
        <span className="text-ui-12 text-tea-text-dim">or</span>
        <div className="h-px flex-1 bg-tea-border" />
      </div>

      <form onSubmit={passwordMode ? handlePasswordSubmit : (codeSent ? handleCodeConfirm : handleCodeRequest)} className="space-y-3" aria-busy={loading}>
        <div>
          <label className={labelClass} htmlFor="signin-identifier">{passwordMode ? 'Email or Username' : 'Email address'}</label>
          <input
            id="signin-identifier" name="identifier" type={passwordMode ? 'text' : 'email'}
            value={identifier}
            onChange={e => {
              setIdentifier(e.target.value);
              setError('');
              if (codeSent && !passwordMode) { setCodeSent(false); setCode(''); }
            }}
            autoComplete={passwordMode ? 'username' : 'email'} autoCapitalize="none" spellCheck={false}
            className={inputClass} placeholder={passwordMode ? 'email or username' : 'you@example.com'} required
            aria-invalid={Boolean(error)} aria-describedby={error ? 'signin-error' : undefined}
          />
        </div>
        {passwordMode && (
          <div>
            <label className={labelClass} htmlFor="signin-password">Password</label>
            <div className="relative">
              <input
                id="signin-password" name="password" type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className={`${inputClass} pr-12`} autoComplete="current-password" required
                aria-invalid={Boolean(error)} aria-describedby={error ? 'signin-error' : undefined}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-tea-text-sec transition-colors hover:text-tea-text"
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <Icons.EyeSlash className="h-4 w-4" /> : <Icons.Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
        {!passwordMode && codeSent && (
          <div>
            <label className={labelClass} htmlFor="signin-code">Verification code</label>
            <input id="signin-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}"
              value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              className={`${inputClass} text-center tracking-[0.28em]`} placeholder="123456" required autoFocus
              aria-invalid={Boolean(error)} aria-describedby="signin-code-help" />
            <p id="signin-code-help" className="mt-2 text-ui-12 text-tea-text-sec" role="status">Sent to {identifier}. Check spam if it hasn’t arrived.</p>
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <button type="button" onClick={() => { setCodeSent(false); setCode(''); setError(''); }}
                className="tap-target min-h-11 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text">Change email</button>
              <button type="button" onClick={() => { setCode(''); void handleCodeRequest(); }} disabled={loading}
                className="tap-target min-h-11 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-50">Send a new code</button>
            </div>
          </div>
        )}
        {error && (
          <div id="signin-error" role="alert" className="flex items-start gap-2 rounded-md bg-tea-error/5 p-3 text-ui-13 text-tea-error">
            <Icons.AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!passwordMode && error && !codeSent && requestRetryable && (
          <button type="button" onClick={() => void handleCodeRequest()} disabled={loading}
            className="tap-target min-h-11 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text">Try again</button>
        )}
        <button type="submit" disabled={loading || (!passwordMode && codeSent && code.length !== 6)}
          className="cta-solid flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-ui-14 font-medium transition-colors disabled:opacity-50">
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-tea-border border-t-current" aria-hidden="true" />}
          {loading ? (passwordMode || codeSent ? 'Signing in…' : 'Sending code…') : (passwordMode || codeSent ? 'Sign in' : 'Email me a code')}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <button type="button" onClick={() => {
          setPasswordMode(value => !value); setCodeSent(false); setCode(''); setError(''); setForgotOpen(false);
        }} className="tap-target min-h-11 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text">
          {passwordMode ? 'Use email code instead' : 'Use password instead'}
        </button>
        {passwordMode && (
          <button type="button" aria-expanded={forgotOpen} aria-controls="password-recovery" onClick={() => {
            setForgotOpen(v => !v); setForgotError('');
            if (!forgotOpen && !forgotEmail) setForgotEmail(identifier.includes('@') ? identifier.trim() : '');
          }} className="tap-target min-h-11 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text">Forgot password?</button>
        )}
      </div>

      {passwordMode && forgotOpen && (
        <section id="password-recovery" aria-label="Password recovery" className="mt-2 border-t border-tea-border pt-4">
          {forgotSent ? (
            <div role="status" className="text-ui-13 text-tea-text-sec">
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Check your email</h2>
              <p className="mt-1">If an account exists for that address, we’ve sent a password reset link.</p>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-3" aria-busy={forgotLoading}>
              <div>
                <label className={labelClass} htmlFor="recovery-email">Recovery email</label>
                <input id="recovery-email" type="email" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setForgotError(''); }}
                  autoComplete="email" className={inputClass} placeholder="you@example.com" required
                  aria-invalid={Boolean(forgotError)} aria-describedby={forgotError ? 'recovery-error' : undefined} />
              </div>
              {forgotError && <p id="recovery-error" role="alert" className="text-ui-13 text-tea-error">{forgotError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => { setForgotOpen(false); setForgotError(''); }}
                  className="tap-target min-h-11 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text">Cancel</button>
                <button type="submit" disabled={forgotLoading || !forgotEmail.trim()}
                  className="cta-solid min-h-11 rounded-md px-4 py-2 text-ui-13 transition-colors disabled:opacity-50">{forgotLoading ? 'Sending…' : 'Send reset link'}</button>
              </div>
            </form>
          )}
        </section>
      )}
      <div className="mt-3 border-t border-tea-border pt-2">
        <button type="button" onClick={() => navigate(authPagePath('signup', destination))}
          className="min-h-11 w-full text-center text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text">
          New to Teajia? <span className="underline decoration-tea-border underline-offset-4">Create an account</span>
        </button>
      </div>
    </div>
  );
}
