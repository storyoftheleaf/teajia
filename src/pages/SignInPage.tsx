import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icons, SealIcon } from '../components/Icons';

const inputClass = "w-full bg-tea-surface border border-tea-border p-3.5 text-tea-text rounded outline-none focus:border-tea-gold focus:ring-0 transition-colors duration-150 placeholder-tea-text-dim font-sans text-sm";
const inputStyle = { boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' };
const labelClass = "block text-ui-10 font-semibold text-tea-text-sec mb-2";

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
    <div className="max-w-sm mx-auto pt-12 pb-12">
      <div className="flex flex-col items-center pb-8">
        <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
          <Icons.LogIn className="w-7 h-7 text-tea-gold" />
        </div>
        <h1 className="font-display text-3xl text-tea-text">Welcome Back</h1>
        <p className="font-body italic text-sm text-tea-text-dim mt-1">Sign in to your Teajia account</p>
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
            style={inputStyle}
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
              className={`${inputClass} pr-12`}
              style={inputStyle}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tea-text/30 hover:text-tea-text transition-colors"
            >
              {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-tea-gold text-tea-bg font-sans font-medium rounded hover:bg-tea-gold-lt transition-colors duration-150 disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
        >
          {loading ? <div className="w-4 h-4 border-2 border-tea-border border-t-tea-text-sec rounded-full animate-spin" /> : 'Sign In'}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="font-sans text-sm text-tea-text-sec">
          Don't have an account?{' '}
          <button
            onClick={() => navigate(safeReturnTo ? `/signup?returnTo=${encodeURIComponent(safeReturnTo)}` : '/signup')}
            className="text-sm text-tea-text-sec hover:text-tea-gold transition-colors font-medium"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
