/**
 * GuestInviteClaimPage, +guest claims their invite link
 * Route: /invite/:token
 *
 * Shows who invited them, event info, form to claim with name + contact.
 * On success → redirect to their new /m/:magicToken
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Icons } from '../components/Icons';
import type { ContactMethod } from '../types/events';

const inputClass = "w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors placeholder-tea-text-dim";
const labelClass = "block label-caps text-tea-text-sec mb-1.5";

const GuestInviteClaimPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [method, setMethod] = useState<ContactMethod>('whatsapp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ['guest-invite', token],
    queryFn: () => api.guestInvites.get(token!),
    enabled: !!token,
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: () =>
      api.guestInvites.claim(token!, {
        name: fullName.trim(),
        phone: method === 'whatsapp' ? phone.trim() : undefined,
        email: method === 'email' ? email.trim() : undefined,
      }),
    onSuccess: (data: any) => {
      setSubmitted(true);
      if (data?.redirect_url) {
        setTimeout(() => navigate(data.redirect_url), 1500);
      } else if (data?.magic_token) {
        setTimeout(() => navigate('/m/' + data.magic_token), 1500);
      } else if (data?.magicToken) {
        setTimeout(() => navigate(`/m/${data.magicToken}`), 1500);
      }
    },
  });

  const contactValue = method === 'whatsapp' ? phone : email;
  const isValid = fullName.trim().length > 0 && contactValue.trim().length > 3;

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-32 bg-tea-text-sec/10 rounded-md mx-auto" />
        </div>
      </div>
    );
  }

  // Error / not found
  if (isError || !invite) {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap">
        <div className="text-center">
          <h1 className="h2">Invite not found</h1>
          <p className="subtitle mt-2">This invite link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  // Shared context used across multiple status screens
  const inviterName = (invite as any).parentAttendeeName as string | undefined;

  // Already claimed
  if (invite.status === 'claimed') {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap">
        <div className="text-center">
          <h1 className="h2">Already claimed</h1>
          <p className="subtitle mt-2">
            This invite has been claimed
            {invite.claimedByName ? ` by ${invite.claimedByName}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  // Expired
  if (invite.status === 'expired') {
    const expiredEvent = (invite as any).event;
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-tea-border/40 flex items-center justify-center mx-auto mb-5">
            <span className="text-xl font-serif text-tea-text-sec">茶</span>
          </div>
          <h1 className="h2">This seat has passed</h1>
          <p className="subtitle mt-2">
            {inviterName ? (
              <><span className="text-tea-text">{inviterName}</span> saved a place for you, but the claim window has closed.</>
            ) : (
              'A place was saved for you, but the claim window has closed.'
            )}
          </p>
        </div>

        {expiredEvent?.slug && (
          <p className="text-ui-13 text-tea-text-sec text-center leading-relaxed mb-6">
            You can still request a spot directly:{' '}
            <a
              href={`/events/${expiredEvent.slug}`}
              className="link-text hover:opacity-80 transition-opacity"
            >
              check if seats are available
            </a>
            .
          </p>
        )}
        <p className="text-ui-12 text-tea-text-dim text-center">
          If you have questions, reach out to {inviterName || 'the person who invited you'}.
        </p>
      </div>
    );
  }

  // Success
  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-5">
            <Icons.Check size={28} className="text-tea-gold" />
          </div>
          <h1 className="h2">You're in</h1>
          <p className="subtitle mt-2">Redirecting to your ticket…</p>
        </div>
      </div>
    );
  }

  // The invite's parent event info is on invite.event (injected by API)
  const event = (invite as any).event;

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-nav-gap animate-[fadeIn_0.4s_ease-out]">

      {/* Event flyer */}
      {event?.flyerImageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-tea-border">
          <img
            src={event.flyerImageUrl}
            alt={event?.title ?? 'Event'}
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Invite message */}
      <div className="text-center mb-8">
        {inviterName && (
          <p className="text-ui-13 text-tea-text-sec mb-2">
            <span className="text-tea-text">{inviterName}</span> invited you
          </p>
        )}
        {event?.title && (
          <h1 className="h2">{event.title}</h1>
        )}
        {event?.eventDate && (
          <p className="subtitle mt-2">
            {new Date(event.eventDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}
        {event?.areaHint && (
          <p className="text-ui-13 text-tea-text-sec mt-1">{event.areaHint}</p>
        )}
      </div>

      {/* Claim form */}
      <div className="space-y-4">
        <div>
          <label htmlFor="invite-name" className={labelClass}>Your name</label>
          <input
            id="invite-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="your full name"
            autoComplete="name"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>How should we reach you?</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMethod('whatsapp')}
              className={`flex-1 py-2 rounded-md text-ui-12 font-medium border transition-colors ${
                method === 'whatsapp'
                  ? 'cta-solid border-tea-gold'
                  : 'bg-tea-surface text-tea-text-sec border-tea-border hover:text-tea-text'
              }`}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setMethod('email')}
              className={`flex-1 py-2 rounded-md text-ui-12 font-medium border transition-colors ${
                method === 'email'
                  ? 'cta-solid border-tea-gold'
                  : 'bg-tea-surface text-tea-text-sec border-tea-border hover:text-tea-text'
              }`}
            >
              Email
            </button>
          </div>

          {method === 'whatsapp' ? (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912-345-678"
              autoComplete="tel"
              className={inputClass}
            />
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className={inputClass}
            />
          )}
        </div>

        {claimMutation.isError && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-tea-error/5 border border-tea-error/20">
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-tea-error" />
            <span className="text-ui-12 text-tea-error">
              {(claimMutation.error as Error)?.message || 'Something went wrong. Please try again.'}
            </span>
          </div>
        )}

        <button
          type="button"
          disabled={!isValid || claimMutation.isPending}
          onClick={() => claimMutation.mutate()}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {claimMutation.isPending ? (
            <span className="inline-block w-4 h-4 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
          ) : (
            'Claim Your Seat'
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="text-center pt-10">
        <p className="label-caps text-tea-text-dim">Hosted by Teajia</p>
      </div>
    </div>
  );
};

export default GuestInviteClaimPage;
