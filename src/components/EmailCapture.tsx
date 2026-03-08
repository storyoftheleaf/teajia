import React, { useState } from 'react';
import { Button } from './shared/Button';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    console.log('Email subscription:', email);

    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existing.push({ email, date: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

    setEmail('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
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
        <p className="text-tea-green font-sans text-base animate-[fadeIn_0.3s_ease-out]">
          Thank you — we'll be in touch.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="flex-1 px-4 py-3 rounded-sm border border-tea-border bg-transparent text-tea-text placeholder:text-tea-text/40 dark:placeholder:text-tea-bg/40 font-sans text-base focus:outline-none focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/20 transition-colors"
          />
          <Button type="submit" variant="primary" size="md">
            Subscribe
          </Button>
        </form>
      )}
    </div>
  );
};
