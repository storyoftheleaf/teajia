import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icons } from '../components/Icons';
import { API_URL, type PendingSignup } from '../lib/api';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors placeholder-tea-text-dim";
const labelClass = "block label-caps text-tea-text-sec mb-1.5";

type ContactPlatform = 'whatsapp' | 'telegram';

export default function SignUpPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
    ? returnTo
    : undefined;
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [whatOpen, setWhatOpen] = useState(false);
  const [contactPlatform, setContactPlatform] = useState<ContactPlatform | null>(null);
  const [contactPhone, setContactPhone] = useState('');
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const pending = await auth.signup(email, password, name, username.trim() || null);
      setPendingSignup(pending);
      setVerificationCode('');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSignup || verificationCode.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      await auth.verifySignup(pendingSignup, verificationCode);
      if (contactPlatform) {
        localStorage.setItem('teajia_contact_platform', contactPlatform);
        if (contactPhone.trim()) localStorage.setItem('teajia_contact_phone', contactPhone.trim());
      }
      navigate(safeReturnTo ?? -1 as any);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (pendingSignup) {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap-lg">
        <div className="text-center mb-8">
          <p className="label-caps text-tea-gold mb-2">One last step</p>
          <h1 className="h2">Check your email</h1>
          <p id="signup-code-help" className="subtitle mt-2">
            Enter the six-digit code sent to <span className="text-tea-text">{pendingSignup.email}</span>.
          </p>
        </div>
        <form onSubmit={handleVerifySignup} className="space-y-4">
          <div>
            <label htmlFor="signup-verification-code" className={labelClass}>Verification code</label>
            <input
              id="signup-verification-code"
              type="text"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputClass} text-center tracking-[0.35em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              aria-describedby="signup-code-help"
              autoFocus
              required
            />
          </div>
          {error && <p role="alert" className="text-ui-12 text-tea-gold">{error}</p>}
          <button
            type="submit"
            disabled={loading || verificationCode.length !== 6}
            className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify email'}
          </button>
          <button
            type="button"
            onClick={() => { setPendingSignup(null); setVerificationCode(''); setError(''); }}
            className="w-full py-2 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Edit email
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap-lg">
      <div className="text-center mb-8">
        <p className="label-caps text-tea-gold mb-2">Teajia</p>
        <h1 className="h2">Join Teajia</h1>
        <p className="subtitle mt-2">Create your account to begin.</p>

        <button
          type="button"
          onClick={() => setWhatOpen(v => !v)}
          className="mt-3 inline-flex items-center gap-1 text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors"
        >
          <Icons.Info className="w-3.5 h-3.5" />
          What is Teajia?
          <Icons.ChevronDown className={`w-3 h-3 transition-transform duration-200 ${whatOpen ? 'rotate-180' : ''}`} />
        </button>
        {whatOpen && (
          <p className="mt-2 max-w-xs mx-auto text-ui-12 text-tea-text-sec leading-relaxed font-body italic">
            A curated tea platform — sourcing, education, and private sessions. Every order is a personal conversation; every cup has a story.
          </p>
        )}
      </div>

      {API_URL && (
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
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClass}
            placeholder="your name"
            required
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass}>
            Username <span className="normal-case tracking-normal font-normal text-tea-text-dim">(optional)</span>
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            pattern="[a-zA-Z0-9_.\-]{3,32}"
            className={inputClass}
            placeholder="Letters, numbers, . _ -"
          />
          <p className="text-ui-12 text-tea-text-dim mt-1">Sign in with either your email or username.</p>
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
            placeholder="your email"
            required
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
              placeholder="Min 6 characters"
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
          <p className="text-ui-12 text-tea-text-dim mt-1">Must be at least 6 characters.</p>
        </div>

        {/* Event & order contact opt-in */}
        <div className="pt-4 mt-2 border-t border-tea-border">
          <p className="label-caps text-tea-text-sec mb-1.5">Contact for events & orders</p>
          <p className="text-ui-12 text-tea-text-dim mb-3 leading-relaxed">
            Reserve spots at tea events, receive orders and invoices directly to your phone.
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(['whatsapp', 'telegram'] as ContactPlatform[]).map(platform => (
              <button
                key={platform}
                type="button"
                onClick={() => {
                  setContactPlatform(prev => prev === platform ? null : platform);
                  setContactPhone('');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-ui-12 font-medium border transition-colors ${
                  contactPlatform === platform
                    ? 'border-tea-gold bg-tea-gold/10 text-tea-text'
                    : 'border-tea-border bg-tea-surface text-tea-text-sec hover:text-tea-text'
                }`}
              >
                {platform === 'whatsapp' ? (
                  <Icons.Message className="w-3.5 h-3.5" />
                ) : (
                  <Icons.Send className="w-3.5 h-3.5" />
                )}
                {platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
              </button>
            ))}
            <span className="text-ui-11 text-tea-text-dim">Optional</span>
          </div>
          <p className="text-ui-11 text-tea-text-dim mb-3">Both platforms work equally well. Choose whichever you use most.</p>

          {contactPlatform && (
            <div>
              <label className={labelClass}>
                {contactPlatform === 'whatsapp' ? 'WhatsApp' : 'Telegram'} number
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className={inputClass}
                placeholder="+1 234 567 8900"
                autoFocus
              />
              <p className="text-ui-12 text-tea-text-dim mt-1">Include country code, e.g. +1, +44, +86.</p>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-md bg-tea-error/5 border border-tea-error/20">
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
            'Create Account'
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <button
          onClick={() => navigate(safeReturnTo ? `/signin?returnTo=${encodeURIComponent(safeReturnTo)}` : '/signin')}
          className="link-text hover:opacity-80 transition-opacity"
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}
