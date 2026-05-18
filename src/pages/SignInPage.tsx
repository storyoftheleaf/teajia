import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icons, SealIcon } from '../components/Icons';
import { api } from '../lib/api';

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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(identifier.trim(), password);
      navigate(safeReturnTo ?? state?.from ?? -1 as any);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap">
      <div className="text-center mb-8">
        <h1 className="h2">Sign in</h1>
        <p className="subtitle mt-2">A quiet welcome back.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Email or Username</label>
          <input
            type="text"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            autoComplete="username"
            className={inputClass}
            placeholder="email or username"
            required
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <div className="relative">
            <input
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

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-tea-error/5 border border-tea-error/20">
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-tea-error" />
            <span className="text-ui-12 text-tea-error">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      {forgotOpen && (
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
                  className="px-4 py-2 bg-tea-gold text-tea-bg font-sans font-medium rounded hover:bg-tea-gold-lt transition-colors duration-150 disabled:opacity-50 flex justify-center items-center gap-2 text-ui-14"
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
