/**
 * ShareCardPage — public invite link landing
 * Route: /share/:token
 *
 * Anyone with the link can view the shared capture card metadata.
 * Authenticated users can claim it into their Tea Compass.
 * Unauthenticated users are nudged to sign up.
 */

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, Leaf } from 'lucide-react';
import { api, hasToken } from '../lib/api';
import { hydrateCompassEntries } from '../lib/teaCompassSync';

const ShareCardPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [claimed, setClaimed] = useState(false);

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ['compass-invite', token],
    queryFn: () => api.compass.getInvite(token!),
    enabled: !!token,
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: () => api.compass.claimInvite(token!),
    onSuccess: async () => {
      await hydrateCompassEntries();
      setClaimed(true);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-32 bg-tea-text-sec/10 rounded-sm mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !invite) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="font-serif text-2xl text-tea-text mb-3">Link not found</h1>
          <p className="text-sm text-tea-text-sec">
            This invite link may be invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  const meta = invite.shared_metadata || {};

  if (claimed) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-5">
            <Check size={22} className="text-tea-gold" strokeWidth={1.5} />
          </div>
          <h1 className="font-serif text-2xl text-tea-text mb-3">Card saved</h1>
          <p className="text-sm text-tea-text-sec mb-6">
            {meta.name} is now in your Tea Compass as an incoming entry.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xs uppercase tracking-[0.2em] text-tea-gold hover:text-tea-text transition-colors"
          >
            Open Compass
          </button>
        </div>
      </div>
    );
  }
  const photo = meta.photo as string | undefined;
  const fromName = invite.source_user_name || invite.source_account_name || 'A taster';

  const metaFields: { label: string; value: string | number | undefined }[] = [
    { label: 'Type', value: meta.type },
    { label: 'Form', value: meta.form },
    { label: 'Year', value: meta.year },
    { label: 'Season', value: meta.season },
    { label: 'Region', value: meta.originRegion },
    { label: 'Category', value: meta.teawareCategory },
    { label: 'Material', value: meta.material },
    { label: 'Capacity', value: meta.capacityMl ? `${meta.capacityMl} ml` : undefined },
  ].filter((f) => f.value != null && f.value !== '');

  const isLoggedIn = hasToken();

  return (
    <div className="min-h-screen bg-tea-bg">
      <div className="max-w-md mx-auto px-6 py-12">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Leaf size={14} className="text-tea-gold" strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec">Tea Compass</span>
          </div>
          <p className="text-sm text-tea-text-sec mb-1">
            <span className="text-tea-text font-medium">{fromName}</span> shared a capture card
          </p>
        </div>

        {/* Card */}
        <div className="bg-tea-surface rounded-lg overflow-hidden border border-tea-border mb-6">
          {photo && (
            <img
              src={photo}
              alt={meta.name || 'Tea'}
              className="w-full aspect-[4/3] object-cover"
            />
          )}
          <div className="p-4 space-y-3">
            <div>
              <h1 className="font-serif text-xl text-tea-text leading-snug">
                {meta.name || 'Untitled'}
              </h1>
              {meta.chineseName && (
                <p className="text-tea-text-sec mt-0.5" style={{ fontSize: '0.94rem' /* text-sm=0.875rem + ~8% for Noto Serif SC */ }}>{meta.chineseName}</p>
              )}
            </div>

            {metaFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {metaFields.map((f) => (
                  <span key={f.label} className="pill text-[11px]">
                    {f.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        {isLoggedIn ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={claimMutation.isPending}
              onClick={() => claimMutation.mutate()}
              className="w-full py-4 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.2em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {claimMutation.isPending ? (
                <span className="inline-block w-4 h-4 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
              ) : (
                'Add to My Compass'
              )}
            </button>
            {claimMutation.isError && (
              <p className="text-xs text-red-400 text-center">
                {(claimMutation.error as Error)?.message || 'Could not save. Please try again.'}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-tea-text-sec">
              Sign in to save this card to your Tea Compass and record your tasting notes.
            </p>
            <Link
              to="/admin"
              className="block w-full py-4 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.2em] font-semibold rounded-sm hover:bg-tea-gold/90 transition-all"
            >
              Sign in
            </Link>
            <p className="text-[11px] text-tea-text-dim">
              No account?{' '}
              <Link to="/admin" className="text-tea-gold hover:underline">
                Register free
              </Link>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec/40">
            Teajia · Tea Infrastructure
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShareCardPage;
