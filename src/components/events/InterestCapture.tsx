import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '../../lib/api';
import type { ContactMethod } from '../../types/events';

interface InterestCaptureProps {
  slug: string;
  className?: string;
}

const InterestCapture: React.FC<InterestCaptureProps> = ({ slug, className = '' }) => {
  const [method, setMethod] = useState<ContactMethod>('whatsapp');
  const [contact, setContact] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.events.registerInterest(slug, {
        name: name.trim() || undefined,
        phone: method === 'whatsapp' ? contact.trim() : undefined,
        email: method === 'email' ? contact.trim() : undefined,
      }),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const isValid = contact.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || mutation.isPending) return;
    mutation.mutate();
  };

  if (submitted) {
    return (
      <div
        role="status"
        className={`flex items-center gap-2.5 px-4 py-3 rounded-md bg-tea-gold/10 border border-tea-gold/20 animate-[fadeIn_0.4s_ease-out] ${className}`}
      >
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-tea-gold/15 shrink-0">
          <Check className="w-3.5 h-3.5 text-tea-gold" />
        </span>
        <span className="label-caps text-tea-text-sec">We'll let you know.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${className}`}>
      {/* Method toggle — bottom-border underline style */}
      <div className="flex gap-6 border-b border-tea-border">
        {(['whatsapp', 'email'] as ContactMethod[]).map((m) => {
          const isActive = method === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`relative -mb-px pb-2 pt-1 transition-colors ${
                isActive ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              <span className="text-ui-12 font-semibold">
                {m === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </span>
              <span
                className={`absolute left-0 right-0 -bottom-px h-px transition-colors ${
                  isActive ? 'bg-tea-gold' : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Optional name */}
      <div>
        <label
          htmlFor={`interest-name-${slug}`}
          className="label-caps block mb-1.5"
        >
          Your name <span className="normal-case tracking-normal text-tea-text-dim">(optional)</span>
        </label>
        <input
          id={`interest-name-${slug}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="So we know who to greet"
          autoComplete="name"
          className="w-full px-3 py-2.5 bg-tea-surface border border-tea-border rounded-md text-tea-text text-ui-14 placeholder:text-tea-text-dim focus:outline-none focus:border-tea-gold/50 transition-colors"
        />
      </div>

      {/* Contact field */}
      <div>
        <label
          htmlFor={`interest-contact-${slug}`}
          className="label-caps block mb-1.5"
        >
          {method === 'whatsapp' ? 'WhatsApp number' : 'Email address'}
          <span aria-hidden="true" className="text-tea-gold"> *</span>
          <span className="sr-only"> (required)</span>
        </label>
        <input
          id={`interest-contact-${slug}`}
          type={method === 'email' ? 'email' : 'tel'}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={method === 'email' ? 'your@email.com' : '+1 555 123 4567'}
          aria-required="true"
          className="w-full px-3 py-2.5 bg-tea-surface border border-tea-border rounded-md text-tea-text text-ui-14 placeholder:text-tea-text-dim focus:outline-none focus:border-tea-gold/50 transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={!isValid || mutation.isPending}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {mutation.isPending ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-tea-bg/40 border-t-tea-bg rounded-full animate-spin" />
        ) : (
          'Express interest'
        )}
      </button>

      {mutation.isError && (
        <p role="alert" className="text-ui-12 text-tea-error">
          {(mutation.error as Error)?.message || 'Something went wrong. Please try again.'}
        </p>
      )}
    </form>
  );
};

export default InterestCapture;
