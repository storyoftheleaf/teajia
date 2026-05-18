import React, { useState } from 'react';
import { Button } from './shared/Button';
import { api } from '../lib/api';

interface EmailCaptureProps {
  heading?: string;
  subtitle?: string;
  className?: string;
}

export const EmailCapture: React.FC<EmailCaptureProps> = ({
  heading = 'Stay Connected',
  subtitle = 'Join the community for new stories, courses, and releases',
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setLoading(true);
    setError(null);

    try {
      await api.newsletter.subscribe(email, 'website');
      setEmail('');
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
  };

  return (
    <div className={`${className}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-tea-gold-dark font-sans mb-1.5">
        Newsletter
      </p>
      <h2 className="font-serif text-xl md:text-2xl font-normal text-tea-text mb-2 leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
        {heading}
      </h2>
      <p className="text-sm text-tea-text/60 mb-4 max-w-lg leading-relaxed">
        {subtitle}
      </p>

      {submitted ? (
        <div className="animate-[fadeIn_0.3s_ease-out] flex items-start gap-3">
          <svg
            className="w-6 h-6 text-tea-gold shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
              strokeDasharray: 30,
              strokeDashoffset: 30,
              animation: 'checkmark-draw 0.5s ease-out 0.15s forwards',
            }}
          >
            <polyline points="4 12 10 18 20 6" />
          </svg>
          <div>
            <p
              className="text-tea-gold font-sans text-base mb-2"
              style={{
                animation: 'email-text-in 0.4s ease-out 0.3s both',
              }}
            >
              You're on the list
            </p>
            <p
              className="text-tea-text-sec font-sans text-sm"
              style={{
                animation: 'email-text-in 0.4s ease-out 0.5s both',
              }}
            >
              Monthly tea insights, seasonal picks, and first access to rare teas.
            </p>
          </div>
          <style>{`
            @keyframes checkmark-draw {
              to { stroke-dashoffset: 0; }
            }
            @keyframes email-text-in {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      ) : error ? (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <p className="text-red-400 font-sans text-sm mb-3">{error}</p>
          <Button type="button" variant="primary" size="md" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-md">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={loading}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-tea-bg text-tea-text text-base placeholder:text-tea-text-dim font-sans focus:outline-none focus:ring-1 focus:ring-tea-gold/30 transition-colors disabled:opacity-50"
          />
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? 'Subscribing...' : 'Subscribe'}
          </Button>
        </form>
      )}
    </div>
  );
};
