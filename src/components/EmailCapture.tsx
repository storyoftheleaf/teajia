import React, { useState } from 'react';
import { Button } from './shared/Button';
import { api } from '../lib/api';

interface EmailCaptureProps {
  heading?: string;
  subtitle?: string;
  className?: string;
}

const STORAGE_KEY = 'teajia_email_signups';

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
      await api.newsletter.subscribe(email);

      // Cache in localStorage as fallback
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      existing.push({ email, date: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

      setEmail('');
      setSubmitted(true);
    } catch (err: any) {
      // If API fails, still save locally so the email isn't lost
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      existing.push({ email, date: new Date().toISOString(), pending: true });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
  };

  return (
    <div className={`${className}`}>
      <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal text-tea-text mb-3">
        {heading}
      </h2>
      <div className="w-12 h-[1px] bg-tea-gold mb-6" />
      <p className="text-tea-text/70 mb-8 max-w-2xl">
        {subtitle}
      </p>

      {submitted ? (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <p className="text-tea-green font-sans text-base mb-2">
            Thank you — you're on the list.
          </p>
          <p className="text-tea-text-sec font-sans text-sm">
            Monthly tea insights, seasonal picks, and first access to rare teas.
          </p>
        </div>
      ) : error ? (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <p className="text-red-400 font-sans text-sm mb-3">{error}</p>
          <Button type="button" variant="primary" size="md" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-sm border border-tea-border bg-transparent text-tea-text placeholder:text-tea-text-dim font-sans text-base focus:outline-none focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/20 transition-colors disabled:opacity-50"
          />
          <Button type="submit" variant="primary" size="md" disabled={loading}>
            {loading ? 'Subscribing...' : 'Subscribe'}
          </Button>
        </form>
      )}
    </div>
  );
};
