/**
 * GuestInviteClaimPage — +guest claims their invite link
 * Route: /invite/:token
 *
 * Shows who invited them, event info, form to claim with name + contact.
 * On success → redirect to their new /m/:magicToken
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ContactMethod } from '../types/events';

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
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="font-serif text-2xl text-tea-text mb-3">Invite not found</h1>
          <p className="text-sm text-tea-text-sec">
            This invite link may be invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  // Shared context used across multiple status screens
  const inviterName = (invite as any).parentAttendeeName as string | undefined;

  // Already claimed
  if (invite.status === 'claimed') {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="font-serif text-2xl text-tea-text mb-3">Already claimed</h1>
          <p className="text-sm text-tea-text-sec">
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
      <div className="min-h-screen bg-tea-bg flex flex-col items-center justify-center px-6 py-16 animate-[fadeIn_0.4s_ease-out]">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-tea-border/40 flex items-center justify-center mx-auto mb-6">
            <span className="text-xl font-serif text-tea-text-sec">茶</span>
          </div>
          <h1 className="font-serif text-2xl text-tea-text mb-4">
            This seat has passed.
          </h1>
          <p className="text-sm text-tea-text-sec leading-relaxed mb-6">
            {inviterName ? (
              <><span className="text-tea-text font-medium">{inviterName}</span> saved a place for you, but the claim window has closed.</>
            ) : (
              'A place was saved for you, but the claim window has closed.'
            )}
          </p>
          {expiredEvent?.slug && (
            <p className="text-sm text-tea-text-sec leading-relaxed mb-8">
              You can still request a spot directly —{' '}
              <a
                href={`/events/${expiredEvent.slug}`}
                className="text-tea-gold hover:text-tea-gold/80 transition-colors underline underline-offset-2"
              >
                check if seats are available
              </a>
              .
            </p>
          )}
          <p className="text-xs text-tea-text-dim">
            If you have questions, reach out to {inviterName || 'the person who invited you'}.
          </p>
        </div>
      </div>
    );
  }

  // Success
  if (submitted) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6 animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl font-serif text-tea-gold">茶</span>
          </div>
          <h1 className="font-serif text-2xl text-tea-text mb-3">You're in.</h1>
          <p className="text-sm text-tea-text-sec">Redirecting to your ticket…</p>
        </div>
      </div>
    );
  }

  // The invite's parent event info is on invite.event (injected by API)
  const event = (invite as any).event;

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.4s_ease-out]">
      <div className="max-w-md mx-auto px-6 py-12">

        {/* Event flyer */}
        {event?.flyerImageUrl && (
          <div className="mb-8 rounded-md overflow-hidden border border-tea-border">
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
            <p className="text-sm text-tea-text-sec mb-2">
              <span className="text-tea-text font-medium">{inviterName}</span> invited you
            </p>
          )}
          {event?.title && (
            <h1 className="font-serif text-2xl text-tea-text mb-2">{event.title}</h1>
          )}
          {event?.eventDate && (
            <p className="text-sm text-tea-text-sec">
              {new Date(event.eventDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
          {event?.areaHint && (
            <p className="text-sm text-tea-text-sec mt-1">{event.areaHint}</p>
          )}
        </div>

        {/* Claim form */}
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label
              htmlFor="invite-name"
              className="block text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec mb-2"
            >
              Your name
            </label>
            <input
              id="invite-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="your full name"
              autoComplete="name"
              className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-md text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
            />
          </div>

          {/* Contact method toggle */}
          <div>
            <label className="block text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec mb-2">
              How should we reach you?
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMethod('whatsapp')}
                className={`flex-1 py-2.5 text-xs uppercase tracking-[0.15em] rounded-md transition-colors ${
                  method === 'whatsapp'
                    ? 'bg-tea-gold text-tea-bg'
                    : 'bg-tea-surface text-tea-text-sec border border-tea-border hover:border-tea-gold/30'
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setMethod('email')}
                className={`flex-1 py-2.5 text-xs uppercase tracking-[0.15em] rounded-md transition-colors ${
                  method === 'email'
                    ? 'bg-tea-gold text-tea-bg'
                    : 'bg-tea-surface text-tea-text-sec border border-tea-border hover:border-tea-gold/30'
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
                className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-md text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
              />
            ) : (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-md text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
              />
            )}
          </div>

          {/* Error */}
          {claimMutation.isError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-sm text-red-400">
                {(claimMutation.error as Error)?.message || 'Something went wrong. Please try again.'}
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            disabled={!isValid || claimMutation.isPending}
            onClick={() => claimMutation.mutate()}
            className="w-full py-4 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.25em] font-semibold rounded-md hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
          >
            {claimMutation.isPending ? (
              <span className="inline-block w-4 h-4 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
            ) : (
              'Claim Your Seat'
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center pt-10 pb-8">
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec/40">
            Hosted by Teajia
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuestInviteClaimPage;
