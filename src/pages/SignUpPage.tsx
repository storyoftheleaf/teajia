import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icons } from '../components/Icons';
import { LogoEmblem } from '../components/Logos';

const inputClass = "w-full bg-tea-surface border border-tea-border p-3.5 text-tea-text rounded outline-none focus:border-tea-gold focus:ring-0 transition-colors duration-150 placeholder-tea-text-dim font-sans text-sm";
const inputStyle = { boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' };
const labelClass = "block text-ui-10 font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await auth.signup(email, password, name, username.trim() || null);
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

  return (
    <div className="max-w-sm mx-auto pt-10 pb-nav-gap">
      {/* Logo */}
      <div className="flex flex-col items-center pb-8">
        <LogoEmblem size={64} color="var(--tea-gold)" className="mb-5" />
        <h1 className="font-display text-3xl text-tea-text">Join Teajia</h1>
        <p className="font-body italic text-sm text-tea-text-dim mt-1">Create your account to get started</p>

        {/* What's that? */}
        <button
          type="button"
          onClick={() => setWhatOpen(v => !v)}
          className="mt-3 flex items-center gap-1 text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors"
        >
          <Icons.Info className="w-3.5 h-3.5" />
          What is Teajia?
          <Icons.ChevronDown className={`w-3 h-3 transition-transform duration-200 ${whatOpen ? 'rotate-180' : ''}`} />
        </button>
        {whatOpen && (
          <div className="mt-2 max-w-xs text-center text-ui-12 text-tea-text-sec leading-relaxed px-2 font-body italic">
            A curated tea platform — sourcing, education, and private sessions. Every order is a personal conversation; every cup has a story.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClass}
            style={inputStyle}
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
            style={inputStyle}
            placeholder="Letters, numbers, . _ -"
          />
          <p className="text-ui-11 text-tea-text-dim mt-1.5">Sign in with either your email or username.</p>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
            style={inputStyle}
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
              className={`${inputClass} pr-12`}
              style={inputStyle}
              placeholder="Min 6 characters"
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
          <p className="text-ui-11 text-tea-text-dim mt-1.5">Must be at least 6 characters</p>
        </div>

        {/* Event & order contact opt-in */}
        <div className="pt-1 border-t border-tea-border/40">
          <p className="text-ui-10 font-bold uppercase tracking-[0.18em] text-tea-text-sec mt-3 mb-2.5">Contact for events & orders</p>
          <p className="text-ui-12 text-tea-text-dim mb-3 leading-relaxed">
            Reserve spots at tea events, receive orders and invoices directly to your phone.
          </p>

          {/* Platform selector */}
          <div className="flex gap-2 mb-3">
            {(['whatsapp', 'telegram'] as ContactPlatform[]).map(platform => (
              <button
                key={platform}
                type="button"
                onClick={() => {
                  setContactPlatform(prev => prev === platform ? null : platform);
                  setContactPhone('');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-ui-12 font-medium border transition-colors ${
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
            <span className="self-center text-ui-11 text-tea-text-dim ml-1">Optional</span>
          </div>
          <p className="text-ui-11 text-tea-text-dim mb-3">Both platforms work equally well. Choose whichever you use most.</p>

          {/* Phone input — shown once a platform is selected */}
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
                style={inputStyle}
                placeholder="+1 234 567 8900"
                autoFocus
              />
              <p className="text-ui-11 text-tea-text-dim mt-1.5">Include country code, e.g. +1, +44, +86</p>
            </div>
          )}
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
          {loading ? <div className="w-4 h-4 border-2 border-tea-border border-t-tea-text-sec rounded-full animate-spin" /> : 'Create Account'}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="font-sans text-sm text-tea-text-sec">
          Already have an account?{' '}
          <button
            onClick={() => navigate(safeReturnTo ? `/signin?returnTo=${encodeURIComponent(safeReturnTo)}` : '/signin')}
            className="text-sm text-tea-text-sec hover:text-tea-gold transition-colors font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
