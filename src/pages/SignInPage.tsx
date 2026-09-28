import React, { useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icons } from '../components/Icons';
import { api, API_URL, ApiError } from '../lib/api';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors placeholder-tea-text-dim";
const labelClass = "block label-caps text-tea-text-sec mb-1.5";

export default function SignInPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { state } = useLocation() as { state?: { from?: string } };
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
    ? returnTo
    : undefined;
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

  // Back only when there is an in-app page to go back to. Opened straight
  // from a link or a new tab, the sign-in page is the first entry, and going
  // back left the person on this same form, signed in, looking locked out.
  const navigateAfterSignIn = () => {
    if (safeReturnTo ?? state?.from) return navigate(safeReturnTo ?? state!.from!);
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    return historyIndex > 0 ? navigate(-1) : navigate('/');
  };

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
      navigateAfterSignIn();
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
      const result = await api.verify.confirmCode(identifier.trim(), code, 'signin');
      if (!result?.token) throw new Error('Sign in could not be completed. Please request a new code.');
      navigateAfterSignIn();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Incorrect code. Please try again.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap">
      <div className="text-center mb-8">
        <p className="label-caps text-tea-gold mb-2">Teajia</p>
        <h1 className="h2">Sign in</h1>
        <p className="subtitle mt-2">A quiet welcome back.</p>
      </div>

      <div className="mb-6">
          <a
            href={`${API_URL}/api/auth/google?return=${encodeURIComponent(safeReturnTo ?? '/?account=1')}`}
            className="w-full flex items-center justify-center gap-3 py-3 bg-tea-surface rounded-md border border-tea-border text-tea-text text-ui-14 hover:bg-tea-elevated transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            Continue with Google
          </a>

          <div className="flex items-center gap-3 mt-6">
            <div className="flex-1 h-px bg-tea-border" />
            <span className="text-ui-11 uppercase tracking-[0.22em] text-tea-text-dim">Or</span>
            <div className="flex-1 h-px bg-tea-border" />
          </div>
      </div>

      <form onSubmit={passwordMode ? handlePasswordSubmit : (codeSent ? handleCodeConfirm : handleCodeRequest)} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="signin-identifier">
            {passwordMode ? 'Email or Username' : 'Email address'}
          </label>
          <input
            id="signin-identifier"
            name="identifier"
            type={passwordMode ? 'text' : 'email'}
            value={identifier}
            onChange={e => {
              setIdentifier(e.target.value);
              setError('');
              // Correcting the address after a code went out starts over:
              // that code belongs to the old address.
              if (codeSent && !passwordMode) { setCodeSent(false); setCode(''); }
            }}
            autoComplete={passwordMode ? 'username' : 'email'}
            className={inputClass}
            placeholder={passwordMode ? 'email or username' : 'you@example.com'}
            required
            autoFocus
          />
        </div>

        {passwordMode && (
          <div>
          <label className={labelClass} htmlFor="signin-password">Password</label>
          <div className="relative">
            <input
              id="signin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`${inputClass} pr-10`}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="tap-target absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setForgotOpen(v => !v);
                setForgotError('');
                if (!forgotOpen && !forgotEmail) setForgotEmail(identifier.includes('@') ? identifier.trim() : '');
              }}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Forgot password?
            </button>
          </div>
          </div>
        )}

        {!passwordMode && codeSent && (
          <div>
            <label className={labelClass} htmlFor="signin-code">Verification code</label>
            <input
              id="signin-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              className={`${inputClass} text-center tracking-[0.28em]`}
              placeholder="123456"
              required
              autoFocus
            />
            <p className="mt-2 text-ui-13 text-tea-text-sec">
              Sent to {identifier}. No email after a minute? Check spam, or send another.
            </p>
            <div className="mt-2 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => { setCodeSent(false); setCode(''); setError(''); }}
                className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
              >
                Change email
              </button>
              <button
                type="button"
                onClick={() => { setCode(''); void handleCodeRequest(); }}
                disabled={loading}
                className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50"
              >
                Send a new code
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-md bg-tea-error/5 border border-tea-error/20">
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-tea-error" />
            <span className="text-ui-12 text-tea-error">{error}</span>
          </div>
        )}

        {!passwordMode && error && !codeSent && requestRetryable && (
          <button
            type="button"
            onClick={() => void handleCodeRequest()}
            disabled={loading}
            className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Try again
          </button>
        )}

        <button
          type="submit"
          disabled={loading || (!passwordMode && codeSent && code.length !== 6)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
          ) : (
            passwordMode ? 'Sign In' : codeSent ? 'Sign in' : 'Email me a code'
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setPasswordMode(value => !value);
            setCodeSent(false);
            setCode('');
            setError('');
            setForgotOpen(false);
          }}
          className="w-full text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
        >
          {passwordMode ? 'Use email code instead' : 'Use password instead'}
        </button>
      </form>

      {passwordMode && forgotOpen && (
        <div className="mt-6 p-4 bg-tea-surface border border-tea-border rounded">
          {forgotSent ? (
            <div className="flex items-start gap-2">
              <Icons.Check className="w-4 h-4 mt-0.5 shrink-0 text-tea-gold" />
              <div>
                <p className="font-sans text-ui-14 text-tea-text">Check your email</p>
                <p className="font-sans text-ui-13 text-tea-text-sec mt-1">
                  If an account exists for that address, we've sent a link to reset your password.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div>
                <label className={labelClass}>Reset Password</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  autoComplete="email"
                  className={inputClass}
                  placeholder="your email address"
                  required
                />
              </div>
              {forgotError && (
                <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-ui-14">
                  <Icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setForgotOpen(false); setForgotError(''); }}
                  className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail.trim()}
                  className="px-4 py-2 cta-solid font-sans font-medium rounded transition-colors duration-150 disabled:opacity-50 flex justify-center items-center gap-2 text-ui-14"
                >
                  {forgotLoading ? (
                    <div className="w-4 h-4 border-2 border-tea-border border-t-tea-text-sec rounded-full animate-spin" />
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <button
          onClick={() => navigate(safeReturnTo ? `/signup?returnTo=${encodeURIComponent(safeReturnTo)}` : '/signup')}
          className="link-text hover:opacity-80 transition-opacity"
        >
          New to Teajia? Create an account
        </button>
      </div>
    </div>
  );
}
