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

  if (submitted) {
    return (
      <div className={`flex items-center gap-2 text-tea-text-sec text-sm animate-[fadeIn_0.4s_ease-out] ${className}`}>
        <Check className="w-4 h-4 text-tea-gold shrink-0" />
        <span>We'll let you know.</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Method toggle */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMethod('whatsapp')}
          className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${
            method === 'whatsapp'
              ? 'bg-tea-gold/10 text-tea-gold'
              : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
          }`}
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => setMethod('email')}
          className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${
            method === 'email'
              ? 'bg-tea-gold/10 text-tea-gold'
              : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
          }`}
        >
          Email
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type={method === 'email' ? 'email' : 'tel'}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={method === 'email' ? 'your@email.com' : '0912-345-678'}
          className="flex-1 px-3 py-2.5 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
        />
        <button
          type="button"
          disabled={!isValid || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="px-4 py-2.5 bg-tea-gold text-tea-bg text-xs uppercase tracking-caps rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {mutation.isPending ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
          ) : (
            'Notify Me'
          )}
        </button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-400 mt-2">
          {(mutation.error as Error)?.message || 'Something went wrong. Please try again.'}
        </p>
      )}
    </div>
  );
};

export default InterestCapture;
