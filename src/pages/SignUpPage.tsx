import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icons, SealIcon } from '../components/Icons';

const inputClass = "w-full bg-tea-surface border border-tea-border p-3.5 text-tea-text rounded outline-none focus:border-tea-gold focus:ring-0 transition-colors duration-150 placeholder-tea-text-dim font-sans text-sm";
const inputStyle = { boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' };
const labelClass = "block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2";

export default function SignUpPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await auth.signup(email, password, name, username.trim() || null);
      navigate(-1);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto pt-12 pb-12">
      <div className="flex flex-col items-center pb-8">
        <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
          <SealIcon className="w-7 h-7 text-tea-gold" />
        </div>
        <h1 className="font-display text-3xl text-tea-text">Join Teajia</h1>
        <p className="font-body italic text-sm text-tea-text-dim mt-1">Create your account to get started</p>
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
          <p className="text-[11px] text-tea-text-dim mt-1.5">Sign in with either your email or username.</p>
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
          <p className="text-[11px] text-tea-text-dim mt-1.5">Must be at least 6 characters</p>
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
            onClick={() => navigate('/signin')}
            className="text-sm text-tea-text-sec hover:text-tea-gold transition-colors font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
